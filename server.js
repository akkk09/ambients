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

require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

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

const DATA_DIR = process.env.VERCEL ? '/tmp/data' : path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem in serverless runtime, ignore
}

// 1. Aiven / Managed PostgreSQL Database Connection
const rawPgUri = process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI || '';
let pgPool = null;

if (rawPgUri) {
  try {
    // Parse URL and strip search params to allow explicit rejectUnauthorized: false for Aiven self-signed CA
    let cleanConnStr = rawPgUri;
    try {
      const parsed = new URL(rawPgUri);
      parsed.search = '';
      cleanConnStr = parsed.toString();
    } catch (_) {}

    pgPool = new Pool({
      connectionString: cleanConnStr,
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

if (!pgPool) {
  console.log('[Database] No Aiven PostgreSQL URI found; using local data/users.json storage.');
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

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

// JWT Token Helpers (stateless — survives Vercel cold starts)
function signToken(username, userId) {
  return jwt.sign({ username, userId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function extractToken(req) {
  const header = req.headers['authorization'];
  if (!header) return null;
  const token = header.replace('Bearer ', '');
  return verifyToken(token);
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

  // B. Local file store fallback
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
}

// 5A. Register
app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
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

    const token = signToken(cleanUsername, newUser.id);

    const { salt: _, passwordHash: __, ...safeUser } = newUser;
    return res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// 5B. Login
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
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

    const token = signToken(cleanUsername, user.id);

    const { salt: _, passwordHash: __, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// 5C. Get Current User (Session Check)
app.get(['/api/auth/me', '/auth/me'], async (req, res) => {
  const decoded = extractToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await getStoredUser(decoded.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { salt: _, passwordHash: __, ...safeUser } = user;
  return res.json({ user: safeUser });
});

// 5D. Sync Account Data to Server / Cloud
app.post(['/api/auth/sync', '/auth/sync'], async (req, res) => {
  const decoded = extractToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await getStoredUser(decoded.username);
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

// 5E. Logout (stateless JWT — client deletes token)
app.post(['/api/auth/logout', '/auth/logout'], (req, res) => {
  return res.json({ success: true });
});

// Fallback: Serve index.html for non-API GET page navigations (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/auth') && !req.url.startsWith('/ai')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// =========================================================================
// ABLY REAL-TIME TOKEN ENDPOINT
// =========================================================================
const Ably = require('ably');

app.post(['/api/ably-token', '/ably-token'], async (req, res) => {
  const ablyKey = process.env.ABLY_API_KEY;
  if (!ablyKey) {
    return res.status(503).json({ error: 'Real-time not configured', solo: true });
  }

  try {
    const decoded = extractToken(req);
    const clientId = decoded?.username || `anon_${crypto.randomBytes(4).toString('hex')}`;

    const ablyRest = new Ably.Rest({ key: ablyKey });
    const tokenRequest = await ablyRest.auth.createTokenRequest({
      clientId,
      capability: { 'ambients:*': ['publish', 'subscribe', 'presence'] }
    });

    return res.json(tokenRequest);
  } catch (err) {
    console.error('[Ably Token Error]:', err);
    res.status(500).json({ error: 'Failed to issue real-time token' });
  }
});

app.get('/api/rooms/active', async (req, res) => {
  const ablyKey = process.env.ABLY_API_KEY;
  if (!ablyKey) {
    return res.json({ rooms: [] });
  }
  try {
    const ablyRest = new Ably.Rest({ key: ablyKey });
    
    // Use Ably REST API to fetch active channels with namespace 'ambients:'
    const result = await ablyRest.request('get', '/channels', { prefix: 'ambients:', by: 'id' });
    if (!result || !result.items) return res.json({ rooms: [] });
    
    const rooms = result.items.map(channelStr => {
      // channelStr e.g. "ambients:quiet-haven-42"
      const roomId = channelStr.replace('ambients:', '');
      return { id: roomId };
    });
    
    return res.json({ rooms });
  } catch (err) {
    console.error('[Ably Channels Error]:', err);
    res.status(500).json({ error: 'Failed to fetch active rooms' });
  }
});

// Fallback for unmatched API requests: Always JSON
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// Start standalone Node.js server (for local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✨ Ambients Server is live at: http://localhost:${PORT}`);
    console.log(`   Real-time powered by Ably (configure ABLY_API_KEY in .env)`);
  });
}

module.exports = app;
