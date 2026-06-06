import { describe, expect, it } from 'vitest';

import {
  deriveOnboardingState,
  getSleepPlanChoiceNavigationAction,
  shouldShowEveningPlanPrompt,
} from '@/core/onboarding';

describe('onboarding state derivation', () => {
  it('treats an empty first-run database as not started', () => {
    expect(
      deriveOnboardingState({
        appSettings: null,
        hasActiveTargetDayPlan: false,
      }),
    ).toBe('not_started');
  });

  it('uses explicit tracking-only mode when no target plan is active', () => {
    expect(
      deriveOnboardingState({
        appSettings: { onboardingMode: 'tracking_only' },
        hasActiveTargetDayPlan: false,
      }),
    ).toBe('tracking_only');
  });

  it('uses explicit plan-saved mode', () => {
    expect(
      deriveOnboardingState({
        appSettings: { onboardingMode: 'plan_saved' },
        hasActiveTargetDayPlan: false,
      }),
    ).toBe('plan_saved');
  });

  it('treats an existing active target plan as plan saved for old databases', () => {
    expect(
      deriveOnboardingState({
        appSettings: null,
        hasActiveTargetDayPlan: true,
      }),
    ).toBe('plan_saved');
  });
});

describe('evening plan prompt visibility', () => {
  const baseInput = {
    dismissedDateKey: null,
    hasActiveTargetDayPlan: false,
    isSelectedDateToday: true,
    nowMinutesFromMidnight: 18 * 60,
    onboardingMode: 'tracking_only' as const,
    sleepDayDateKey: '2026-06-05',
    sleepSessionCount: 1,
  };

  it('shows for tracking-only users in the evening after a sleep record exists', () => {
    expect(shouldShowEveningPlanPrompt(baseInput)).toBe(true);
  });

  it.each([
    ['plan is already active', { hasActiveTargetDayPlan: true }],
    ['selected date is not today', { isSelectedDateToday: false }],
    ['there are no sleep records', { sleepSessionCount: 0 }],
    ['local time is before 18:00', { nowMinutesFromMidnight: 17 * 60 + 59 }],
    ['prompt was dismissed for this sleep day', { dismissedDateKey: '2026-06-05' }],
    ['sleep day key is missing', { sleepDayDateKey: null }],
    ['onboarding is plan-saved', { onboardingMode: 'plan_saved' as const }],
    ['onboarding is not started', { onboardingMode: null }],
  ])('hides when %s', (_caseName, override) => {
    expect(shouldShowEveningPlanPrompt({ ...baseInput, ...override })).toBe(false);
  });

  it('shows again for the next sleep day after a previous-day dismiss', () => {
    expect(
      shouldShowEveningPlanPrompt({
        ...baseInput,
        dismissedDateKey: '2026-06-04',
        sleepDayDateKey: '2026-06-05',
      }),
    ).toBe(true);
  });
});

describe('sleep-plan choice navigation', () => {
  it('returns replace-home action after first-run plan save with home return target', () => {
    expect(
      getSleepPlanChoiceNavigationAction({
        onboardingState: 'not_started',
        returnTo: 'home',
        source: 'first-run',
      }),
    ).toEqual({
      href: '/',
      type: 'replace',
    });
  });

  it('returns replace-home action after evening prompt plan save with home return target', () => {
    expect(
      getSleepPlanChoiceNavigationAction({
        onboardingState: 'tracking_only',
        returnTo: 'home',
        source: 'evening-prompt',
      }),
    ).toEqual({
      href: '/',
      type: 'replace',
    });
  });

  it.each([
    ['ordinary sleep-plan route', { onboardingState: 'plan_saved' as const, returnTo: null, source: null }],
    ['first-run source after onboarding is no longer not_started', { onboardingState: 'plan_saved' as const, returnTo: 'home', source: 'first-run' }],
    ['first-run source without home return target', { onboardingState: 'not_started' as const, returnTo: null, source: 'first-run' }],
    ['evening source before tracking-only state', { onboardingState: 'not_started' as const, returnTo: 'home', source: 'evening-prompt' }],
  ])('does not navigate for %s', (_caseName, input) => {
    expect(getSleepPlanChoiceNavigationAction(input)).toBeNull();
  });
});
