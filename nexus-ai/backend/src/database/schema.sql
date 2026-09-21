CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(category, key)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  overall_progress INTEGER DEFAULT 0,
  started_at TEXT NOT NULL,
  estimated_completion_at TEXT,
  current_step_index INTEGER DEFAULT 0,
  steps TEXT NOT NULL DEFAULT '[]',
  logs TEXT NOT NULL DEFAULT '[]',
  context TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS gaming_concepts (
  id TEXT PRIMARY KEY,
  game_title TEXT NOT NULL,
  concept_title TEXT NOT NULL,
  style TEXT,
  script_outline TEXT,
  gameplay_plan TEXT,
  commentary_style TEXT,
  target_duration_min INTEGER,
  recommended_hashtags TEXT DEFAULT '[]',
  originality_score REAL DEFAULT 0,
  script TEXT,
  video_titles TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS youtube_queue (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT DEFAULT '[]',
  thumbnail_url TEXT,
  video_path TEXT,
  scheduled_time TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  outcome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  path TEXT PRIMARY KEY,
  granted_at TEXT NOT NULL
);
