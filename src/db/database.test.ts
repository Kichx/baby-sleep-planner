import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it } from 'vitest';

import { migrateDatabase } from '@/db/database';
import { DATABASE_VERSION } from '@/db/schema';

class FakeMigrationDatabase {
  execSqls: string[] = [];
  runSqls: string[] = [];

  constructor(private readonly userVersion: number) {}

  async execAsync(sql: string): Promise<void> {
    this.execSqls.push(sql);
  }

  async runAsync(sql: string): Promise<void> {
    this.runSqls.push(sql);
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql.includes('PRAGMA user_version')) {
      return { user_version: this.userVersion } as T;
    }

    return null;
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }
}

function createFakeDatabase(userVersion: number): SQLiteDatabase & FakeMigrationDatabase {
  return new FakeMigrationDatabase(userVersion) as SQLiteDatabase & FakeMigrationDatabase;
}

describe('database migrations', () => {
  it('adds guarded app tables for an existing database', async () => {
    const db = createFakeDatabase(DATABASE_VERSION - 1);

    await migrateDatabase(db);

    const execSql = db.execSqls.join('\n');

    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS sleep_day_temporary_mode');
    expect(execSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS sleep_day_temporary_mode_child_day_mode_idx',
    );
    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS app_settings');
    expect(execSql).toContain('onboarding_completed_at TEXT');
    expect(execSql).toContain('evening_plan_prompt_dismissed_date_key TEXT');
    expect(execSql).toContain('tracking_only_bridge_dismissed_date_key TEXT');
    expect(execSql).toContain(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });

  it('keeps guarded app tables before the user_version early return', async () => {
    const db = createFakeDatabase(DATABASE_VERSION);

    await migrateDatabase(db);

    const execSql = db.execSqls.join('\n');

    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS sleep_day_temporary_mode');
    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS app_settings');
    expect(execSql).not.toContain(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
});
