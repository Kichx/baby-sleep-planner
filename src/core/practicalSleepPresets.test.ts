import { describe, expect, it } from 'vitest';

import {
  getDaySleepRangeStatusForPracticalPreset,
  getNapCountStatusForPracticalPreset,
  getPracticalSleepPresetByAgeMonths,
} from '@/core/practicalSleepPresets';

describe('getPracticalSleepPresetByAgeMonths', () => {
  it('returns 0-2 months preset for 1 month', () => {
    expect(getPracticalSleepPresetByAgeMonths(1)?.id).toBe('practical-sleep-0-2-months');
  });

  it('returns 3-4 months preset for 3 months', () => {
    expect(getPracticalSleepPresetByAgeMonths(3)?.id).toBe('practical-sleep-3-4-months');
  });

  it('returns 5-6 months preset for 6 months', () => {
    expect(getPracticalSleepPresetByAgeMonths(6)?.id).toBe('practical-sleep-5-6-months');
  });

  it('returns 7-8 months preset for 8 months', () => {
    expect(getPracticalSleepPresetByAgeMonths(8)?.id).toBe('practical-sleep-7-8-months');
  });

  it('returns 9-11 months preset for 10 months', () => {
    expect(getPracticalSleepPresetByAgeMonths(10)?.id).toBe(
      'practical-sleep-9-11-months',
    );
  });

  it('returns 12-15 months preset for 13 months', () => {
    expect(getPracticalSleepPresetByAgeMonths(13)?.id).toBe(
      'practical-sleep-12-15-months',
    );
  });

  it('returns 16-24 months preset for 18 months', () => {
    expect(getPracticalSleepPresetByAgeMonths(18)?.id).toBe(
      'practical-sleep-16-24-months',
    );
  });

  it('returns null for missing age', () => {
    expect(getPracticalSleepPresetByAgeMonths(null)).toBeNull();
    expect(getPracticalSleepPresetByAgeMonths(undefined)).toBeNull();
  });

  it('returns null for age outside supported range', () => {
    expect(getPracticalSleepPresetByAgeMonths(-1)).toBeNull();
    expect(getPracticalSleepPresetByAgeMonths(25)).toBeNull();
  });
});

describe('getNapCountStatusForPracticalPreset', () => {
  it('marks recommended nap count as typical', () => {
    const result = getNapCountStatusForPracticalPreset({
      ageMonths: 6,
      napCount: 3,
    });

    expect(result.status).toBe('typical');
    expect(result.preset?.id).toBe('practical-sleep-5-6-months');
  });

  it('marks alternative nap count as transition', () => {
    const result = getNapCountStatusForPracticalPreset({
      ageMonths: 8,
      napCount: 2,
    });

    expect(result.status).toBe('transition');
  });

  it('marks unusual nap count as outside_typical', () => {
    const result = getNapCountStatusForPracticalPreset({
      ageMonths: 10,
      napCount: 5,
    });

    expect(result.status).toBe('outside_typical');
  });

  it('returns unknown when age is missing', () => {
    const result = getNapCountStatusForPracticalPreset({
      ageMonths: null,
      napCount: 3,
    });

    expect(result.status).toBe('unknown');
    expect(result.preset).toBeNull();
  });

  it('returns unknown when nap count is missing', () => {
    const result = getNapCountStatusForPracticalPreset({
      ageMonths: 6,
      napCount: null,
    });

    expect(result.status).toBe('unknown');
    expect(result.preset?.id).toBe('practical-sleep-5-6-months');
  });
});

describe('getDaySleepRangeStatusForPracticalPreset', () => {
  it('marks fully included range as within_practical_range', () => {
    const result = getDaySleepRangeStatusForPracticalPreset({
      ageMonths: 6,
      daySleepMinMinutes: 190,
      daySleepMaxMinutes: 240,
    });

    expect(result.status).toBe('within_practical_range');
  });

  it('marks overlapping range as partially_within_practical_range', () => {
    const result = getDaySleepRangeStatusForPracticalPreset({
      ageMonths: 6,
      daySleepMinMinutes: 150,
      daySleepMaxMinutes: 210,
    });

    expect(result.status).toBe('partially_within_practical_range');
  });

  it('marks range below preset as below_practical_range', () => {
    const result = getDaySleepRangeStatusForPracticalPreset({
      ageMonths: 6,
      daySleepMinMinutes: 90,
      daySleepMaxMinutes: 120,
    });

    expect(result.status).toBe('below_practical_range');
  });

  it('marks range above preset as above_practical_range', () => {
    const result = getDaySleepRangeStatusForPracticalPreset({
      ageMonths: 6,
      daySleepMinMinutes: 300,
      daySleepMaxMinutes: 330,
    });

    expect(result.status).toBe('above_practical_range');
  });

  it('normalizes reversed min/max values', () => {
    const result = getDaySleepRangeStatusForPracticalPreset({
      ageMonths: 6,
      daySleepMinMinutes: 240,
      daySleepMaxMinutes: 180,
    });

    expect(result.status).toBe('within_practical_range');
    expect(result.daySleepMinMinutes).toBe(180);
    expect(result.daySleepMaxMinutes).toBe(240);
  });

  it('returns unknown when age is missing', () => {
    const result = getDaySleepRangeStatusForPracticalPreset({
      ageMonths: undefined,
      daySleepMinMinutes: 180,
      daySleepMaxMinutes: 240,
    });

    expect(result.status).toBe('unknown');
    expect(result.preset).toBeNull();
  });
});
