/**
 * Ambients - Real-Time Ambient Co-Working & Study Web App
 * Backend Server with Express & Native WebSockets (ws)
 * 
 * Features:
 * - In-memory Room State Management (max 2 active peers per study room)
 * - Synchronized Pomodoro / Stopwatch Timer with server timestamp drift correction
 * - Real-time Dual Todo / Focus HUD mirroring & completion ripples
 * - Ambient Presence & Tab Focus Detection
 * - Micro-Encouragement Nudges with server-side 5-second anti-spam throttling
 * - Shared Synchronized Markdown Scratchpad
 * - Latency / Ping-Pong heartbeat
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// =========================================================================
// GEMINI AI INTEGRATION ENDPOINTS
// =========================================================================
const { GoogleGenAI } = require('@google/genai');

function getGenAIClient(req) {
  const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

async function generateWithGemini(ai, prompt, isJson = true) {
  const models = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  let lastErr = null;

  for (const model of models) {
    try {
      const config = isJson ? { responseMimeType: 'application/json' } : {};
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });

      let text = response.text ? response.text.trim() : '';
      if (isJson) {
        text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(text);
      }
      return text;
    } catch (e) {
      lastErr = e;
      console.warn(`[Gemini API] Model ${model} error:`, e.message);
    }
  }
  throw lastErr || new Error('Failed to generate response from Gemini API');
}

// 1. AI Task Scribe: Break down focus goal into 3-5 micro-tasks
app.post('/api/ai/breakdown-tasks', async (req, res) => {
  try {
    const { focusGoal } = req.body;
    if (!focusGoal) return res.status(400).json({ error: 'focusGoal is required' });

    const ai = getGenAIClient(req);

    if (ai) {
      const prompt = `You are an expert study and productivity coach. 
Break down the following study focus goal into 3 to 4 sequential, highly actionable micro-tasks for a 25m/50m study session.
Focus goal: "${focusGoal}"

Return ONLY a valid JSON object matching this schema:
{
  "tasks": [
    {
      "title": "Clear concise micro-task title (max 65 chars)",
      "tag": "focus" | "drill" | "review" | "exam" | "code",
      "dots": 1 | 2 | 3
    }
  ]
}`;

      const parsed = await generateWithGemini(ai, prompt, true);
      return res.json({ tasks: parsed.tasks || [] });
    }

    // Fallback if no API key is provided
    return res.json({
      tasks: [
        { title: `Review foundational concepts for ${focusGoal}`, tag: 'review', dots: 1 },
        { title: `Complete active practice problems on ${focusGoal}`, tag: 'drill', dots: 2 },
        { title: `Summarize key derivations / notes in scratchpad`, tag: 'focus', dots: 1 }
      ]
    });
  } catch (err) {
    console.error('[Gemini AI] Task breakdown error:', err);
    res.status(500).json({ error: err.message || 'Failed to break down tasks via Gemini AI' });
  }
});

// 2. AI Flashcard Generator: Generate active recall deck from topic
app.post('/api/ai/generate-flashcards', async (req, res) => {
  try {
    const { topic, subject } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const ai = getGenAIClient(req);

    if (ai) {
      const prompt = `You are an expert tutor.
Generate 5 high-yield active recall flashcards for the topic: "${topic}".
Format all mathematical formulas, physics equations, chemical reactions, or technical definitions using LaTeX ($...$ for inline, $$...$$ for block equations).

Return ONLY a valid JSON object matching this schema:
{
  "deckTitle": "${topic} Flashcards",
  "subject": "${subject || 'general'}",
  "cards": [
    {
      "q": "Concise conceptual question or prompt",
      "a": "Accurate, clear answer or derivation with LaTeX formulas"
    }
  ]
}`;

      const parsed = await generateWithGemini(ai, prompt, true);
      return res.json(parsed);
    }

    // Fallback if no API key is provided
    return res.json({
      deckTitle: `${topic} Flashcards`,
      subject: subject || 'general',
      cards: [
        { q: `What is the fundamental theorem or governing principle behind ${topic}?`, a: `The core governing principle in ${topic} relating inputs to boundary conditions.` },
        { q: `State the primary equation or definition for ${topic}`, a: `$$\\int f(x) \\, dx \\quad \\text{or} \\quad E = mc^2$$` },
        { q: `What are common edge cases or key applications of ${topic}?`, a: `Check boundary limits where variables approach extreme values.` }
      ]
    });
  } catch (err) {
    console.error('[Gemini AI] Flashcards generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate flashcards via Gemini AI' });
  }
});

// 3. AI Socratic Tutor Hint: Provide a guiding hint without giving away full answer
app.post('/api/ai/socratic-hint', async (req, res) => {
  try {
    const { context, question } = req.body;
    const ai = getGenAIClient(req);

    if (ai) {
      const prompt = `You are a calm, Socratic study coach assisting a student during a deep focus session.
The student is working on this note/problem context:
"${context || 'General problem solving'}"

Their question/stuck point:
"${question || 'How do I proceed?'}"

Provide a concise, encouraging 2-sentence guiding hint using Socratic questioning. Do NOT give the entire solution away. Encourage active deduction. If helpful, include one LaTeX formula snippet.`;

      const hintText = await generateWithGemini(ai, prompt, false);
      return res.json({ hint: hintText });
    }

    return res.json({
      hint: 'Consider analyzing the boundary conditions or the fundamental theorem: what happens when you isolate the primary variable?'
    });
  } catch (err) {
    console.error('[Gemini AI] Socratic hint error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate Socratic hint' });
  }
});

// =========================================================================
// 4. GEMINI AI FOCUS OVERSEER & AGENTIC CHATBAR
// =========================================================================
app.post('/api/ai/overseer-chat', async (req, res) => {
  try {
    const { message, chatHistory, roomContext } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const ai = getGenAIClient(req);

    if (ai) {
      const systemPrompt = `You are "Ambients Overseer", an intelligent, calm, proactive AI study coach and desk copilot embedded in the user's remote study session.
You have DIRECT CONTROL over the user's study environment and can execute actions on their behalf.

CURRENT DESK CONTEXT:
- Active Tasks: ${JSON.stringify(roomContext?.tasks || [])}
- Focus Goal: "${roomContext?.focusText || 'None set'}"
- Timer State: ${JSON.stringify(roomContext?.timer || {})}
- Companion Pet: ${JSON.stringify(roomContext?.companion || {})}
- Exam Goal: ${JSON.stringify(roomContext?.examTarget || {})}
- Total Focus Minutes: ${roomContext?.totalFocusMinutes || 0}m

CAPABILITIES:
You can converse helpfully (concise, encouraging, maximum 2-3 sentences) AND optionally emit executable "actions" array to manipulate the desk:
Available action types:
- {"type": "add_task", "title": string, "tag": "focus"|"drill"|"review"|"exam"|"code", "dots": 1|2|3}
- {"type": "complete_task", "title": string}
- {"type": "delete_task", "title": string}
- {"type": "clear_completed"}
- {"type": "set_focus", "focusText": string}
- {"type": "set_timer", "mode": "25m"|"5m"|"50m"|"stopwatch", "state": "start"|"pause"|"reset"}
- {"type": "set_exam", "title": string, "targetDate": "YYYY-MM-DD", "targetPercentage": number}
- {"type": "set_soundscape", "soundType": "rain"|"brown"|"vinyl"|"binaural", "level": number (0.0 to 1.0)}
- {"type": "generate_deck", "topic": string}

RESPONSE FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "reply": "Conversational, supportive message to the user (2-3 sentences max).",
  "actions": [
    // array of action objects as listed above, or empty array if no action needed
  ]
}`;

      const conversationHistory = (chatHistory || []).slice(-6).map(m => `${m.sender === 'user' ? 'User' : 'Overseer'}: ${m.text}`).join('\n');
      const userPrompt = `${conversationHistory ? 'CONVERSATION HISTORY:\n' + conversationHistory + '\n\n' : ''}USER MESSAGE: "${message}"`;

      const parsed = await generateWithGemini(ai, `${systemPrompt}\n\n${userPrompt}`, true);
      return res.json({
        reply: parsed.reply || "I'm with you on your study goals. Let's make steady progress!",
        actions: parsed.actions || []
      });
    }

    // Heuristic Fallback when no API Key is provided
    const lower = message.toLowerCase();
    const actions = [];
    let reply = "I'm observing your study session. Let's stay in deep focus!";

    if (lower.includes('add') || lower.includes('task') || lower.includes('todo')) {
      actions.push({ type: 'add_task', title: message.replace(/add\s*(a\s*)?(task\s*)?(to\s*)?/i, '').trim() || 'Review key formulas', tag: 'focus', dots: 2 });
      reply = `I've added that task to your desk list. Let's get it done!`;
    } else if (lower.includes('start') || lower.includes('pomodoro') || lower.includes('timer') || lower.includes('25m')) {
      actions.push({ type: 'set_timer', mode: '25m', state: 'start' });
      reply = `Starting a 25-minute focus block for you now. Time to lock in!`;
    } else if (lower.includes('rain') || lower.includes('sound') || lower.includes('binaural')) {
      actions.push({ type: 'set_soundscape', soundType: 'rain', level: 0.4 });
      reply = `Soft rain soundscape activated. Enjoy the calm ambience!`;
    } else if (lower.includes('break') || lower.includes('5m')) {
      actions.push({ type: 'set_timer', mode: '5m', state: 'start' });
      reply = `Starting a 5-minute recharge break. Stretch and hydrate!`;
    }

    return res.json({ reply, actions });
  } catch (err) {
    console.error('[Gemini AI] Overseer Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to process Overseer chat' });
  }
});

// =========================================================================
// 5. USER ACCOUNTS & PERSISTENT AUTHENTICATION API (AIVEN POSTGRES + LOCAL STORE)
// =========================================================================
const fs = require('fs');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 1. Aiven / Managed PostgreSQL Database Connection
const pgConnectionString = process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI || '';
let pgPool = null;

if (pgConnectionString) {
  try {
    pgPool = new Pool({
      connectionString: pgConnectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000
    });

    // Auto-initialize tables on Aiven
    pgPool.query(`
      CREATE TABLE IF NOT EXISTS ambients_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        profile JSONB DEFAULT '{}'::jsonb,
        exam_target JSONB DEFAULT '{}'::jsonb,
        metrics JSONB DEFAULT '{}'::jsonb,
        activity_log JSONB DEFAULT '{}'::jsonb,
        tasks JSONB DEFAULT '[]'::jsonb,
        marks JSONB DEFAULT '[]'::jsonb,
        companion JSONB DEFAULT '{}'::jsonb,
        gemini_key TEXT DEFAULT '',
        chat_history JSONB DEFAULT '[]'::jsonb,
        theme TEXT DEFAULT 'nextjs',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ambients_users_username ON ambients_users(username);
    `).then(() => {
      console.log('⚡ [Aiven PostgreSQL] Tables initialized & ready in cloud database!');
    }).catch(err => {
      console.warn('[Aiven PostgreSQL Init Warning]:', err.message);
    });

    console.log('⚡ [Aiven PostgreSQL] Connected to Managed Cloud Database.');
  } catch (err) {
    console.error('[Aiven PostgreSQL Connect Error]:', err);
  }
}

// 2. Supabase Fallback (if configured)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (!pgPool && !supabase) {
  console.log('[Database] No Aiven/Supabase URI found; using local data/users.json storage.');
}

function loadUsersFromDisk() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Auth] Error loading users.json:', e);
  }
  return {};
}

function saveUsersToDisk(usersObj) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2), 'utf8');
  } catch (e) {
    console.error('[Auth] Error saving users.json:', e);
  }
}

const userDatabase = loadUsersFromDisk();
const sessions = new Map(); // token -> username

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

// Unified Cloud / Local Store Helpers
async function getStoredUser(username) {
  const clean = username.trim().toLowerCase();

  // A. Try Aiven PostgreSQL
  if (pgPool) {
    try {
      const result = await pgPool.query('SELECT * FROM ambients_users WHERE username = $1 LIMIT 1', [clean]);
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          username: row.username,
          salt: row.salt,
          passwordHash: row.password_hash,
          profile: row.profile || {},
          examTarget: row.exam_target,
          metrics: row.metrics,
          activityLog: row.activity_log || {},
          tasks: row.tasks || [],
          marks: row.marks || [],
          companion: row.companion || {},
          geminiKey: row.gemini_key || '',
          chatHistory: row.chat_history || [],
          theme: row.theme || 'nextjs',
          createdAt: row.created_at
        };
      }
    } catch (err) {
      console.warn('[Aiven PostgreSQL Query Error]:', err.message);
    }
  }

  // B. Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ambients_users')
        .select('*')
        .eq('username', clean)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          salt: data.salt,
          passwordHash: data.password_hash,
          profile: data.profile || {},
          examTarget: data.exam_target,
          metrics: data.metrics,
          activityLog: data.activity_log || {},
          tasks: data.tasks || [],
          marks: data.marks || [],
          companion: data.companion || {},
          geminiKey: data.gemini_key || '',
          chatHistory: data.chat_history || [],
          theme: data.theme || 'nextjs',
          createdAt: data.created_at
        };
      }
    } catch (err) {
      console.warn('[Supabase Fetch Error]:', err.message);
    }
  }

  // C. Local file store fallback
  return userDatabase[clean] || null;
}

async function saveStoredUser(userObj) {
  const clean = userObj.username.trim().toLowerCase();
  userDatabase[clean] = userObj;
  saveUsersToDisk(userDatabase);

  // A. Save to Aiven PostgreSQL
  if (pgPool) {
    try {
      const query = `
        INSERT INTO ambients_users (
          id, username, salt, password_hash, profile, exam_target, metrics, activity_log,
          tasks, marks, companion, gemini_key, chat_history, theme, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (username) DO UPDATE SET
          profile = EXCLUDED.profile,
          exam_target = EXCLUDED.exam_target,
          metrics = EXCLUDED.metrics,
          activity_log = EXCLUDED.activity_log,
          tasks = EXCLUDED.tasks,
          marks = EXCLUDED.marks,
          companion = EXCLUDED.companion,
          gemini_key = EXCLUDED.gemini_key,
          chat_history = EXCLUDED.chat_history,
          theme = EXCLUDED.theme,
          updated_at = NOW();
      `;
      const values = [
        userObj.id,
        clean,
        userObj.salt,
        userObj.passwordHash,
        JSON.stringify(userObj.profile || {}),
        JSON.stringify(userObj.examTarget || {}),
        JSON.stringify(userObj.metrics || {}),
        JSON.stringify(userObj.activityLog || {}),
        JSON.stringify(userObj.tasks || []),
        JSON.stringify(userObj.marks || []),
        JSON.stringify(userObj.companion || {}),
        userObj.geminiKey || '',
        JSON.stringify(userObj.chatHistory || []),
        userObj.theme || 'nextjs'
      ];
      await pgPool.query(query, values);
    } catch (err) {
      console.warn('[Aiven PostgreSQL Upsert Error]:', err.message);
    }
  }

  // B. Save to Supabase
  if (supabase) {
    try {
      const payload = {
        id: userObj.id,
        username: clean,
        salt: userObj.salt,
        password_hash: userObj.passwordHash,
        profile: userObj.profile,
        exam_target: userObj.examTarget,
        metrics: userObj.metrics,
        activity_log: userObj.activityLog,
        tasks: userObj.tasks,
        marks: userObj.marks,
        companion: userObj.companion,
        gemini_key: userObj.geminiKey,
        chat_history: userObj.chatHistory,
        theme: userObj.theme,
        updated_at: new Date().toISOString()
      };
      await supabase.from('ambients_users').upsert(payload);
    } catch (err) {
      console.warn('[Supabase Upsert Error]:', err.message);
    }
  }
}

// 5A. Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, profile } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await getStoredUser(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const userId = 'u_' + crypto.randomBytes(8).toString('hex');

    const newUser = {
      id: userId,
      username: cleanUsername,
      salt,
      passwordHash,
      profile: {
        name: profile?.name || username.trim(),
        avatarColor: profile?.avatarColor || '#38bdf8',
        focusText: profile?.focusText || ''
      },
      examTarget: {
        title: 'Target Exam',
        targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        targetPercentage: 90
      },
      metrics: {
        streak: 1,
        todayCompletedTasks: 0,
        todayFocusMinutes: 0,
        totalFocusMinutes: 0,
        lastDate: new Date().toISOString().slice(0, 10)
      },
      activityLog: {},
      tasks: [],
      marks: [],
      companion: { type: 'bonsai', name: 'Zen Bonsai', xp: 20, stage: 1 },
      geminiKey: '',
      chatHistory: [],
      theme: 'nextjs',
      createdAt: Date.now()
    };

    await saveStoredUser(newUser);

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    sessions.set(token, cleanUsername);

    const { salt: _, passwordHash: __, ...safeUser } = newUser;
    return res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 5B. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await getStoredUser(cleanUsername);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const computedHash = hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    sessions.set(token, cleanUsername);

    const { salt: _, passwordHash: __, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 5C. Get Current User (Session Check)
app.get('/api/auth/me', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const username = sessions.get(token);
  const user = await getStoredUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { salt: _, passwordHash: __, ...safeUser } = user;
  return res.json({ user: safeUser });
});

// 5D. Sync Account Data to Server / Supabase
app.post('/api/auth/sync', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const username = sessions.get(token);
  const user = await getStoredUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { profile, examTarget, metrics, activityLog, tasks, marks, companion, geminiKey, chatHistory, theme } = req.body;

  if (profile) user.profile = { ...user.profile, ...profile };
  if (examTarget !== undefined) user.examTarget = examTarget;
  if (metrics !== undefined) user.metrics = metrics;
  if (activityLog !== undefined) user.activityLog = activityLog;
  if (tasks !== undefined) user.tasks = tasks;
  if (marks !== undefined) user.marks = marks;
  if (companion !== undefined) user.companion = companion;
  if (geminiKey !== undefined) user.geminiKey = geminiKey;
  if (chatHistory !== undefined) user.chatHistory = chatHistory;
  if (theme !== undefined) user.theme = theme;

  await saveStoredUser(user);

  return res.json({ success: true, lastSynced: Date.now() });
});

// 5E. Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && sessions.has(token)) {
    sessions.delete(token);
  }
  return res.json({ success: true });
});

// Fallback route to serve index.html for single-page routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create HTTP Server
const server = http.createServer(app);

// Attach WebSocket Server
const wss = new WebSocketServer({ server });

/**
 * In-Memory Room Store
 * Map<roomId, RoomState>
 */
const rooms = new Map();

/**
 * Default Room Configuration
 */
function createDefaultRoom(roomId) {
  return {
    id: roomId,
    createdAt: Date.now(),
    timer: {
      mode: '25m', // '25m' | '5m' | '50m' | 'stopwatch' | 'custom'
      duration: 25 * 60, // Total duration in seconds
      remaining: 25 * 60, // Remaining seconds
      isRunning: false,
      startedAt: null, // Server timestamp when current run started
      pausedAt: null, // Server timestamp when paused
      linked: true, // Whether timer is locked/synced between both peers
    },
    scratchpad: {
      content: `# Shared Study Notes & Formulas 📝\n\n- Welcome to your quiet co-working space!\n- Jot down formulas, shared goals, or quick reference links here.\n- Updates sync automatically in real-time.`,
      lastUpdatedBy: null,
      lastUpdatedAt: Date.now(),
    },
    // Map of peerId -> PeerState
    peers: new Map(),
  };
}

/**
 * Timer Helper: Calculates current accurate timer remaining/elapsed
 * based on server timestamps to prevent client-side timer drift.
 */
function computeTimerState(timer) {
  if (!timer.isRunning || !timer.startedAt) {
    return {
      remaining: timer.remaining,
      isRunning: timer.isRunning,
      mode: timer.mode,
      duration: timer.duration,
      linked: timer.linked,
      serverTime: Date.now(),
    };
  }

  const elapsedSinceStart = (Date.now() - timer.startedAt) / 1000;

  if (timer.mode === 'stopwatch') {
    // Stopwatch counts upward from remaining (or 0)
    const currentElapsed = Math.max(0, Math.floor(timer.remaining + elapsedSinceStart));
    return {
      remaining: currentElapsed,
      isRunning: true,
      mode: timer.mode,
      duration: timer.duration,
      linked: timer.linked,
      serverTime: Date.now(),
    };
  } else {
    // Pomodoro countdown modes
    const currentRemaining = Math.max(0, Math.ceil(timer.remaining - elapsedSinceStart));
    const isFinished = currentRemaining <= 0;

    if (isFinished) {
      timer.isRunning = false;
      timer.remaining = 0;
      timer.startedAt = null;
    }

    return {
      remaining: currentRemaining,
      isRunning: timer.isRunning,
      mode: timer.mode,
      duration: timer.duration,
      linked: timer.linked,
      serverTime: Date.now(),
      isFinished,
    };
  }
}

/**
 * Broadcast helper to send a JSON message to all peers in a room
 * Optionally excludes a specific sender (e.g. for scratchpad typing echo prevention)
 */
function broadcastToRoom(room, message, excludePeerId = null) {
  const payload = JSON.stringify(message);
  for (const [peerId, peer] of room.peers.entries()) {
    if (peerId !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

/**
 * Send JSON message to a single client
 */
function sendToPeer(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * WebSocket Connection Handler
 */
wss.on('connection', (ws, req) => {
  let currentRoomId = null;
  let currentPeerId = null;

  // Handle incoming messages
  ws.on('message', (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      const { type, payload } = data;

      switch (type) {
        // ==========================================
        // 1. JOIN ROOM & SLOT NEGOTIATION
        // ==========================================
        case 'JOIN_ROOM': {
          const { roomId, profile, peerId } = payload;
          const cleanRoomId = (roomId || 'ambience').trim().toLowerCase();
          
          currentRoomId = cleanRoomId;
          currentPeerId = peerId || crypto.randomUUID();

          // Retrieve or create room
          if (!rooms.has(cleanRoomId)) {
            rooms.set(cleanRoomId, createDefaultRoom(cleanRoomId));
          }
          const room = rooms.get(cleanRoomId);

          // Assign slot: determine if user is Slot A (Host) or Slot B (Partner)
          let assignedSlot = 'userA';
          const existingSlots = Array.from(room.peers.values()).map(p => p.slot);
          if (existingSlots.includes('userA')) {
            assignedSlot = 'userB';
          }

          // Check if room is full (>2 active peers)
          if (room.peers.size >= 2 && !room.peers.has(currentPeerId)) {
            sendToPeer(ws, {
              type: 'ROOM_FULL',
              payload: {
                message: 'This study room already has 2 active peers. You can create a new room or join another.',
                roomId: cleanRoomId,
              },
            });
            return;
          }

          // Create / update peer record
          const peerState = {
            id: currentPeerId,
            ws,
            slot: assignedSlot,
            profile: {
              name: profile?.name || (assignedSlot === 'userA' ? 'Desk A' : 'Desk B'),
              avatarColor: profile?.avatarColor || (assignedSlot === 'userA' ? '#38bdf8' : '#a855f7'),
              focusText: profile?.focusText || '',
            },
            status: {
              state: 'deep_focus', // 'deep_focus' | 'reviewing' | 'break' | 'away'
              isTabActive: true,
              lastActiveTime: Date.now(),
            },
            tasks: profile?.tasks || [],
            marks: profile?.marks || [],
            companion: profile?.companion || { type: 'bonsai', stage: 1, xp: 0 },
            flashcardProgress: null,
            examTarget: profile?.examTarget || null,
            lastNudgeTime: 0,
          };

          room.peers.set(currentPeerId, peerState);

          // Gather partner information if present
          let partnerData = null;
          for (const [otherId, otherPeer] of room.peers.entries()) {
            if (otherId !== currentPeerId) {
              partnerData = {
                id: otherPeer.id,
                slot: otherPeer.slot,
                profile: otherPeer.profile,
                status: otherPeer.status,
                tasks: otherPeer.tasks,
                marks: otherPeer.marks || [],
                companion: otherPeer.companion,
                flashcardProgress: otherPeer.flashcardProgress,
                examTarget: otherPeer.examTarget,
              };
              break;
            }
          }

          // Send full Room Snapshot to the newly joined peer
          const currentTimerState = computeTimerState(room.timer);
          sendToPeer(ws, {
            type: 'ROOM_SNAPSHOT',
            payload: {
              roomId: cleanRoomId,
              peerId: currentPeerId,
              slot: assignedSlot,
              timer: currentTimerState,
              scratchpad: room.scratchpad,
              myProfile: peerState.profile,
              myStatus: peerState.status,
              myTasks: peerState.tasks,
              myMarks: peerState.marks,
              myCompanion: peerState.companion,
              myExamTarget: peerState.examTarget,
              partner: partnerData,
              serverTime: Date.now(),
            },
          });

          // Notify the other peer (if connected) that a partner joined
          if (partnerData) {
            broadcastToRoom(room, {
              type: 'PEER_JOINED',
              payload: {
                partner: {
                  id: peerState.id,
                  slot: peerState.slot,
                  profile: peerState.profile,
                  status: peerState.status,
                  tasks: peerState.tasks,
                  marks: peerState.marks,
                  companion: peerState.companion,
                  flashcardProgress: peerState.flashcardProgress,
                  examTarget: peerState.examTarget,
                },
                serverTime: Date.now(),
              },
            }, currentPeerId);
          }
          break;
        }

        // ==========================================
        // 2. USER PROFILE & FOCUS BADGE UPDATES
        // ==========================================
        case 'UPDATE_PROFILE': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          if (payload.name !== undefined) peer.profile.name = payload.name;
          if (payload.avatarColor !== undefined) peer.profile.avatarColor = payload.avatarColor;
          if (payload.focusText !== undefined) peer.profile.focusText = payload.focusText;

          // Broadcast updated profile to partner
          broadcastToRoom(room, {
            type: 'PARTNER_PROFILE_UPDATED',
            payload: {
              peerId: currentPeerId,
              profile: peer.profile,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 3. AMBIENT PRESENCE & TAB FOCUS
        // ==========================================
        case 'UPDATE_STATUS': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          if (payload.state !== undefined) peer.status.state = payload.state;
          if (payload.isTabActive !== undefined) peer.status.isTabActive = payload.isTabActive;
          peer.status.lastActiveTime = Date.now();

          // Broadcast updated status to partner
          broadcastToRoom(room, {
            type: 'PARTNER_STATUS_UPDATED',
            payload: {
              peerId: currentPeerId,
              status: peer.status,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 4. SYNCHRONIZED TIMER ACTIONS
        // ==========================================
        case 'TIMER_ACTION': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const { action, mode, duration, linked } = payload;
          const now = Date.now();

          switch (action) {
            case 'start': {
              if (!room.timer.isRunning) {
                room.timer.isRunning = true;
                room.timer.startedAt = now;
              }
              break;
            }
            case 'pause': {
              if (room.timer.isRunning && room.timer.startedAt) {
                const elapsed = (now - room.timer.startedAt) / 1000;
                if (room.timer.mode === 'stopwatch') {
                  room.timer.remaining = Math.max(0, Math.floor(room.timer.remaining + elapsed));
                } else {
                  room.timer.remaining = Math.max(0, Math.ceil(room.timer.remaining - elapsed));
                }
                room.timer.isRunning = false;
                room.timer.startedAt = null;
                room.timer.pausedAt = now;
              }
              break;
            }
            case 'reset': {
              room.timer.isRunning = false;
              room.timer.startedAt = null;
              room.timer.pausedAt = null;
              if (room.timer.mode === 'stopwatch') {
                room.timer.remaining = 0;
              } else {
                room.timer.remaining = room.timer.duration;
              }
              break;
            }
            case 'set_mode': {
              room.timer.isRunning = false;
              room.timer.startedAt = null;
              room.timer.pausedAt = null;
              room.timer.mode = mode || '25m';

              if (mode === '25m') {
                room.timer.duration = 25 * 60;
                room.timer.remaining = 25 * 60;
              } else if (mode === '5m') {
                room.timer.duration = 5 * 60;
                room.timer.remaining = 5 * 60;
              } else if (mode === '50m') {
                room.timer.duration = 50 * 60;
                room.timer.remaining = 50 * 60;
              } else if (mode === 'stopwatch') {
                room.timer.duration = 0;
                room.timer.remaining = 0;
              } else if (mode === 'custom' && duration) {
                room.timer.duration = duration;
                room.timer.remaining = duration;
              }
              break;
            }
            case 'toggle_link': {
              if (linked !== undefined) {
                room.timer.linked = !!linked;
              } else {
                room.timer.linked = !room.timer.linked;
              }
              break;
            }
          }

          // Broadcast updated timer state to all peers in the room
          const timerSyncData = computeTimerState(room.timer);
          broadcastToRoom(room, {
            type: 'TIMER_SYNC',
            payload: {
              ...timerSyncData,
              actionInitiatedBy: currentPeerId,
              actionType: action,
            },
          });
          break;
        }

        // ==========================================
        // 5. DUAL TODO & TASK COMPLETION RIPPLES
        // ==========================================
        case 'TASK_ACTION': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          const { action, tasks, completedTaskId } = payload;
          if (tasks) {
            peer.tasks = tasks;
          }

          // Broadcast updated tasks to partner
          broadcastToRoom(room, {
            type: 'PARTNER_TASKS_UPDATED',
            payload: {
              peerId: currentPeerId,
              tasks: peer.tasks,
              action,
              completedTaskId, // If present, triggers particle/ripple micro-animation on partner's screen
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 5B. CUSTOM MARKS & SCORE TRACKER
        // ==========================================
        case 'MARKS_ACTION': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          const { action, marks } = payload;
          if (marks) {
            peer.marks = marks;
          }

          // Broadcast updated marks to partner
          broadcastToRoom(room, {
            type: 'PARTNER_MARKS_UPDATED',
            payload: {
              peerId: currentPeerId,
              marks: peer.marks,
              action,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 5C. HIGH FIVE CELEBRATION
        // ==========================================
        case 'HIGH_FIVE': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const senderPeer = room.peers.get(currentPeerId);
          if (!senderPeer) return;

          broadcastToRoom(room, {
            type: 'HIGH_FIVE_RECEIVED',
            payload: {
              fromPeerId: currentPeerId,
              fromName: senderPeer.profile.name,
              timestamp: Date.now(),
            },
          });
          break;
        }

        // ==========================================
        // 5D. AMBIENT DESK COMPANION / FLOW PET
        // ==========================================
        case 'COMPANION_ACTION': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          if (payload.companion) {
            peer.companion = payload.companion;
          }

          broadcastToRoom(room, {
            type: 'PARTNER_COMPANION_UPDATED',
            payload: {
              peerId: currentPeerId,
              companion: peer.companion,
              action: payload.action,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 5E. DUO FLASHCARDS DRILL CO-OP
        // ==========================================
        case 'FLASHCARD_ACTION': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          peer.flashcardProgress = payload.progress;

          broadcastToRoom(room, {
            type: 'PARTNER_FLASHCARD_UPDATED',
            payload: {
              peerId: currentPeerId,
              progress: peer.flashcardProgress,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 5F. EXAM COUNTDOWN & TARGET
        // ==========================================
        case 'EXAM_ACTION': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const peer = room.peers.get(currentPeerId);
          if (!peer) return;

          if (payload.examTarget !== undefined) {
            peer.examTarget = payload.examTarget;
          }

          broadcastToRoom(room, {
            type: 'PARTNER_EXAM_UPDATED',
            payload: {
              peerId: currentPeerId,
              examTarget: peer.examTarget,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 6. MICRO-ENCOURAGEMENT / NUDGE SYSTEM
        // ==========================================
        case 'SEND_NUDGE': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const senderPeer = room.peers.get(currentPeerId);
          if (!senderPeer) return;

          const now = Date.now();
          const COOLDOWN_MS = 5000; // 5-second anti-spam throttle

          if (now - senderPeer.lastNudgeTime < COOLDOWN_MS) {
            const waitSeconds = Math.ceil((COOLDOWN_MS - (now - senderPeer.lastNudgeTime)) / 1000);
            sendToPeer(ws, {
              type: 'NUDGE_THROTTLED',
              payload: {
                message: `Please wait ${waitSeconds}s before sending another encouragement.`,
                remainingMs: COOLDOWN_MS - (now - senderPeer.lastNudgeTime),
              },
            });
            return;
          }

          senderPeer.lastNudgeTime = now;

          const { nudgeType, text } = payload; // 'fistbump' | 'coffee' | 'sparkle' | 'bolt' | 'water' | 'celebrate'
          
          // Check partner's presence status
          let isPartnerInDeepFocus = false;
          for (const [otherId, otherPeer] of room.peers.entries()) {
            if (otherId !== currentPeerId) {
              if (otherPeer.status.state === 'deep_focus') {
                isPartnerInDeepFocus = true;
              }
              break;
            }
          }

          // Acknowledge sender
          sendToPeer(ws, {
            type: 'NUDGE_SENT_ACK',
            payload: {
              nudgeType,
              timestamp: now,
              cooldownMs: COOLDOWN_MS,
              isPartnerInDeepFocus,
            },
          });

          // Forward nudge to partner
          broadcastToRoom(room, {
            type: 'NUDGE_RECEIVED',
            payload: {
              fromPeerId: currentPeerId,
              fromName: senderPeer.profile.name,
              nudgeType,
              text,
              timestamp: now,
              isSuppressed: isPartnerInDeepFocus, // If true, partner client renders ultra-gentle indicator without loud chime
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 7. SHARED SCRATCHPAD SYNCHRONIZATION
        // ==========================================
        case 'SCRATCHPAD_UPDATE': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const { content } = payload;

          room.scratchpad.content = content;
          room.scratchpad.lastUpdatedBy = currentPeerId;
          room.scratchpad.lastUpdatedAt = Date.now();

          // Broadcast scratchpad to partner (exclude sender to prevent cursor jump/jitter)
          broadcastToRoom(room, {
            type: 'SCRATCHPAD_UPDATED',
            payload: {
              content,
              updatedBy: currentPeerId,
              timestamp: room.scratchpad.lastUpdatedAt,
            },
          }, currentPeerId);
          break;
        }

        case 'SCRATCHPAD_TYPING': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const room = rooms.get(currentRoomId);
          const { isTyping } = payload;

          broadcastToRoom(room, {
            type: 'PARTNER_TYPING',
            payload: {
              peerId: currentPeerId,
              isTyping,
            },
          }, currentPeerId);
          break;
        }

        // ==========================================
        // 8. LATENCY / PING-PONG HEARTBEAT
        // ==========================================
        case 'PING': {
          sendToPeer(ws, {
            type: 'PONG',
            payload: {
              clientTimestamp: payload?.clientTimestamp || 0,
              serverTimestamp: Date.now(),
            },
          });
          break;
        }

        default:
          console.warn(`[Ambients] Unrecognized message type: ${type}`);
      }
    } catch (err) {
      console.error('[Ambients] WebSocket message parsing error:', err);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    if (currentRoomId && currentPeerId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      const departingPeer = room.peers.get(currentPeerId);

      if (departingPeer) {
        room.peers.delete(currentPeerId);

        // Notify remaining peer that partner disconnected
        broadcastToRoom(room, {
          type: 'PEER_LEFT',
          payload: {
            peerId: currentPeerId,
            slot: departingPeer.slot,
            name: departingPeer.profile.name,
            serverTime: Date.now(),
          },
        });

        // If room is completely empty, schedule cleanup after 15 minutes of inactivity
        if (room.peers.size === 0) {
          setTimeout(() => {
            if (rooms.has(currentRoomId) && rooms.get(currentRoomId).peers.size === 0) {
              rooms.delete(currentRoomId);
              console.log(`[Ambients] Room cleaned up: ${currentRoomId}`);
            }
          }, 15 * 60 * 1000);
        }
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[Ambients] WebSocket error on peer ${currentPeerId}:`, err);
  });
});

// Start standalone Node.js server with WebSocket timer loop
if (require.main === module) {
  // Periodic server-side timer tick broadcast (every 1 second when active timer is running)
  setInterval(() => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.timer.isRunning && room.peers.size > 0) {
        const timerState = computeTimerState(room.timer);
        broadcastToRoom(room, {
          type: 'TIMER_TICK',
          payload: timerState,
        });
      }
    }
  }, 1000);

  server.listen(PORT, () => {
    console.log(`✨ Ambients Server is live at: http://localhost:${PORT}`);
    console.log(`   Real-time WebSocket server ready for remote study sessions.`);
  });
}

module.exports = app;
