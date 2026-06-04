export const DATABASE_NAME = 'baby_sleep_planner.db';

export const DATABASE_VERSION = 15;

export const BOTTLE_FEEDINGS_STORAGE_SQL = `
CREATE TABLE IF NOT EXISTS bottle_feedings (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  volume_ml INTEGER NOT NULL CHECK (volume_ml > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);

CREATE INDEX IF NOT EXISTS bottle_feedings_child_started_idx
ON bottle_feedings(child_id, started_at);
`;

export const SLEEP_DAY_TEMPORARY_MODE_STORAGE_SQL = `
CREATE TABLE IF NOT EXISTS sleep_day_temporary_mode (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT NOT NULL,
  sleep_day_date_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('soft_day', 'early_wake')),
  base_plan_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  disabled_at TEXT,
  dismissed_at TEXT,
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sleep_day_temporary_mode_child_day_mode_idx
ON sleep_day_temporary_mode(child_id, sleep_day_date_key, mode);
`;

export const INITIAL_SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS child_profile (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT,
  photo_uri TEXT,
  bottle_feeding_enabled INTEGER NOT NULL DEFAULT 0,
  bottle_feeding_prompt_dismissed INTEGER NOT NULL DEFAULT 0,
  bottle_feeding_default_volume_ml INTEGER NOT NULL DEFAULT 180,
  bottle_feeding_top_up_threshold_ml INTEGER NOT NULL DEFAULT 30,
  bottle_feeding_reminders_enabled INTEGER NOT NULL DEFAULT 0,
  bottle_feeding_reminder_interval_minutes INTEGER NOT NULL DEFAULT 180,
  bottle_feeding_notify_during_sleep INTEGER NOT NULL DEFAULT 1,
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

${BOTTLE_FEEDINGS_STORAGE_SQL}

${SLEEP_DAY_TEMPORARY_MODE_STORAGE_SQL}

CREATE TABLE IF NOT EXISTS target_day_plan (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Основной',
  is_active INTEGER NOT NULL DEFAULT 1,
  evening_rules_mode TEXT NOT NULL DEFAULT 'auto',
  wake_up_start_minutes INTEGER,
  wake_up_end_minutes INTEGER,
  target_awake_min_minutes INTEGER,
  target_awake_max_minutes INTEGER,
  target_awake_minutes INTEGER NOT NULL,
  nap_count INTEGER,
  target_day_sleep_min_minutes INTEGER,
  target_day_sleep_max_minutes INTEGER,
  target_day_sleep_minutes INTEGER NOT NULL,
  bedtime_target_minutes INTEGER NOT NULL,
  latest_evening_nap_end_minutes INTEGER NOT NULL DEFAULT 1200,
  max_evening_nap_minutes INTEGER NOT NULL DEFAULT 45,
  micro_nap_minutes INTEGER NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);

CREATE TABLE IF NOT EXISTS sleep_day_plan_snapshot (
  child_id TEXT NOT NULL,
  sleep_day_date TEXT NOT NULL,
  source_plan_id TEXT,
  source_plan_name TEXT NOT NULL,
  day_start_minutes INTEGER NOT NULL,
  wake_up_start_minutes INTEGER NOT NULL,
  wake_up_end_minutes INTEGER NOT NULL,
  target_awake_min_minutes INTEGER NOT NULL,
  target_awake_max_minutes INTEGER NOT NULL,
  target_awake_minutes INTEGER NOT NULL,
  nap_count INTEGER NOT NULL,
  target_day_sleep_min_minutes INTEGER NOT NULL,
  target_day_sleep_max_minutes INTEGER NOT NULL,
  target_day_sleep_minutes INTEGER NOT NULL,
  bedtime_target_minutes INTEGER NOT NULL,
  early_bedtime_minutes INTEGER NOT NULL,
  latest_evening_nap_end_minutes INTEGER NOT NULL,
  max_evening_nap_minutes INTEGER NOT NULL,
  min_night_sleep_minutes INTEGER NOT NULL,
  micro_nap_minutes INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, sleep_day_date),
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);
`;
