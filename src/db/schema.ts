export const DATABASE_NAME = 'baby_sleep_planner.db';

export const DATABASE_VERSION = 2;

export const INITIAL_SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS child_profile (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sleep_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('nap', 'night')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);

CREATE INDEX IF NOT EXISTS sleep_sessions_child_started_idx
ON sleep_sessions(child_id, started_at);

CREATE TABLE IF NOT EXISTS target_day_plan (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT NOT NULL,
  target_awake_minutes INTEGER NOT NULL,
  target_day_sleep_minutes INTEGER NOT NULL,
  bedtime_target_minutes INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);
`;
