-- Ambients - Supabase Cloud Database Schema
-- Run this in your Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS ambients_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  profile JSONB DEFAULT '{"name": "Student", "avatarColor": "#38bdf8", "focusText": ""}'::jsonb,
  exam_target JSONB DEFAULT '{"title": "Target Exam", "targetDate": "2026-10-15", "targetPercentage": 90}'::jsonb,
  metrics JSONB DEFAULT '{"streak": 1, "todayCompletedTasks": 0, "todayFocusMinutes": 0, "totalFocusMinutes": 0, "lastDate": "2026-09-01"}'::jsonb,
  activity_log JSONB DEFAULT '{}'::jsonb,
  tasks JSONB DEFAULT '[]'::jsonb,
  marks JSONB DEFAULT '[]'::jsonb,
  companion JSONB DEFAULT '{"type": "bonsai", "name": "Zen Bonsai", "xp": 20, "stage": 1}'::jsonb,
  gemini_key TEXT DEFAULT '',
  chat_history JSONB DEFAULT '[]'::jsonb,
  theme TEXT DEFAULT 'nextjs',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on username for fast authentication lookups
CREATE INDEX IF NOT EXISTS idx_ambients_users_username ON ambients_users(username);

-- Study Rooms / Live State Table (Optional for cross-device shared rooms)
CREATE TABLE IF NOT EXISTS ambients_rooms (
  id TEXT PRIMARY KEY,
  timer_state JSONB DEFAULT '{"mode": "25m", "isRunning": false, "remainingSecs": 1500}'::jsonb,
  user_a JSONB,
  user_b JSONB,
  scratchpad_text TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE ambients_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambients_rooms ENABLE ROW LEVEL SECURITY;

-- Allow public service role / anonymous API access for the study app
CREATE POLICY "Allow public select on ambients_users" ON ambients_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on ambients_users" ON ambients_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on ambients_users" ON ambients_users FOR UPDATE USING (true);

CREATE POLICY "Allow public all on ambients_rooms" ON ambients_rooms FOR ALL USING (true);
