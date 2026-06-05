import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID } from '@/constants/sleep';
import { deriveOnboardingState } from '@/core/onboarding';
import { APP_SETTINGS_STORAGE_SQL } from '@/db/schema';
import type { AppSettings, OnboardingState } from '@/types/appSettings';

interface AppSettingsRow {
  onboarding_completed_at: string | null;
  onboarding_mode: string | null;
  evening_plan_prompt_dismissed_date_key: string | null;
}

const APP_SETTINGS_ID = 'default';

function mapAppSettingsRow(row: AppSettingsRow | null): AppSettings {
  return {
    eveningPlanPromptDismissedDateKey: row?.evening_plan_prompt_dismissed_date_key ?? null,
    onboardingCompletedAt: row?.onboarding_completed_at ?? null,
    onboardingMode:
      row?.onboarding_mode === 'tracking_only' || row?.onboarding_mode === 'plan_saved'
        ? row.onboarding_mode
        : null,
  };
}

function assertValidDateKey(dateKey: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error('Date key must use YYYY-MM-DD format');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Date key must be a valid date');
  }
}

async function ensureAppSettingsStorage(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(APP_SETTINGS_STORAGE_SQL);
}

async function hasActiveTargetDayPlan(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: string }>(
    `
    SELECT id
    FROM target_day_plan
    WHERE child_id = ? AND is_active = 1
    LIMIT 1
    `,
    [childId],
  );

  return row !== null;
}

export async function getAppSettings(db: SQLiteDatabase): Promise<AppSettings> {
  await ensureAppSettingsStorage(db);

  const row = await db.getFirstAsync<AppSettingsRow>(
    `
    SELECT
      onboarding_completed_at,
      onboarding_mode,
      evening_plan_prompt_dismissed_date_key
    FROM app_settings
    WHERE id = ?
    LIMIT 1
    `,
    [APP_SETTINGS_ID],
  );

  return mapAppSettingsRow(row);
}

export async function getOnboardingState(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<OnboardingState> {
  const [appSettings, hasActivePlan] = await Promise.all([
    getAppSettings(db),
    hasActiveTargetDayPlan(db, childId),
  ]);

  return deriveOnboardingState({
    appSettings,
    hasActiveTargetDayPlan: hasActivePlan,
  });
}

export async function completeOnboardingTrackingOnly(db: SQLiteDatabase): Promise<AppSettings> {
  await ensureAppSettingsStorage(db);

  const completedAt = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO app_settings (
      id,
      onboarding_completed_at,
      onboarding_mode,
      evening_plan_prompt_dismissed_date_key
    )
    VALUES (?, ?, 'tracking_only', NULL)
    ON CONFLICT(id) DO UPDATE SET
      onboarding_completed_at = COALESCE(app_settings.onboarding_completed_at, excluded.onboarding_completed_at),
      onboarding_mode = 'tracking_only'
    `,
    [APP_SETTINGS_ID, completedAt],
  );

  return getAppSettings(db);
}

export async function markOnboardingPlanSaved(db: SQLiteDatabase): Promise<AppSettings> {
  await ensureAppSettingsStorage(db);

  const completedAt = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO app_settings (
      id,
      onboarding_completed_at,
      onboarding_mode,
      evening_plan_prompt_dismissed_date_key
    )
    VALUES (?, ?, 'plan_saved', NULL)
    ON CONFLICT(id) DO UPDATE SET
      onboarding_completed_at = COALESCE(app_settings.onboarding_completed_at, excluded.onboarding_completed_at),
      onboarding_mode = 'plan_saved'
    `,
    [APP_SETTINGS_ID, completedAt],
  );

  return getAppSettings(db);
}

export async function dismissEveningPlanPrompt(
  db: SQLiteDatabase,
  dateKey: string,
): Promise<AppSettings> {
  assertValidDateKey(dateKey);
  await ensureAppSettingsStorage(db);

  await db.runAsync(
    `
    INSERT INTO app_settings (
      id,
      onboarding_completed_at,
      onboarding_mode,
      evening_plan_prompt_dismissed_date_key
    )
    VALUES (?, NULL, NULL, ?)
    ON CONFLICT(id) DO UPDATE SET
      evening_plan_prompt_dismissed_date_key = excluded.evening_plan_prompt_dismissed_date_key
    `,
    [APP_SETTINGS_ID, dateKey],
  );

  return getAppSettings(db);
}
