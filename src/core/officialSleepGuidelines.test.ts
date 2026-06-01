import { describe, expect, it } from 'vitest';

import {
  checkTotalSleepAgainstOfficialGuideline,
  checkTotalSleepRangeAgainstOfficialGuideline,
  getOfficialSleepGuidelineByAgeMonths,
} from '@/core/officialSleepGuidelines';

describe('official sleep guidelines', () => {
  it('matches 2 months to the 14-17 hour range', () => {
    const guideline = getOfficialSleepGuidelineByAgeMonths(2);

    expect(guideline?.totalSleepMinMinutes).toBe(14 * 60);
    expect(guideline?.totalSleepMaxMinutes).toBe(17 * 60);
  });

  it('matches 6 months to the 12-16 hour range', () => {
    const guideline = getOfficialSleepGuidelineByAgeMonths(6);

    expect(guideline?.totalSleepMinMinutes).toBe(12 * 60);
    expect(guideline?.totalSleepMaxMinutes).toBe(16 * 60);
  });

  it('matches 18 months to the 11-14 hour range', () => {
    const guideline = getOfficialSleepGuidelineByAgeMonths(18);

    expect(guideline?.totalSleepMinMinutes).toBe(11 * 60);
    expect(guideline?.totalSleepMaxMinutes).toBe(14 * 60);
  });

  it('matches 36 months to the 10-13 hour range', () => {
    const guideline = getOfficialSleepGuidelineByAgeMonths(36);

    expect(guideline?.totalSleepMinMinutes).toBe(10 * 60);
    expect(guideline?.totalSleepMaxMinutes).toBe(13 * 60);
  });

  it('returns unknown for a missing age', () => {
    const result = checkTotalSleepAgainstOfficialGuideline({
      ageMonths: null,
      totalSleepMinutes: 14 * 60,
    });

    expect(result.status).toBe('unknown');
    expect(result.guideline).toBeNull();
  });

  it('marks 14 hours for 6 months as within recommended', () => {
    const result = checkTotalSleepAgainstOfficialGuideline({
      ageMonths: 6,
      totalSleepMinutes: 14 * 60,
    });

    expect(result.status).toBe('within_recommended');
  });

  it('marks 11 hours for 6 months as below recommended', () => {
    const result = checkTotalSleepAgainstOfficialGuideline({
      ageMonths: 6,
      totalSleepMinutes: 11 * 60,
    });

    expect(result.status).toBe('below_recommended');
  });

  it('marks 17 hours for 6 months as above recommended', () => {
    const result = checkTotalSleepAgainstOfficialGuideline({
      ageMonths: 6,
      totalSleepMinutes: 17 * 60,
    });

    expect(result.status).toBe('above_recommended');
  });

  it('marks a 13-15 hour range for 6 months as within recommended', () => {
    const result = checkTotalSleepRangeAgainstOfficialGuideline({
      ageMonths: 6,
      minTotalSleepMinutes: 13 * 60,
      maxTotalSleepMinutes: 15 * 60,
    });

    expect(result.status).toBe('within_recommended');
  });

  it('marks an 11-13 hour range for 6 months as partially within recommended', () => {
    const result = checkTotalSleepRangeAgainstOfficialGuideline({
      ageMonths: 6,
      minTotalSleepMinutes: 11 * 60,
      maxTotalSleepMinutes: 13 * 60,
    });

    expect(result.status).toBe('partially_within_recommended');
  });

  it('marks a 10-11 hour range for 6 months as below recommended', () => {
    const result = checkTotalSleepRangeAgainstOfficialGuideline({
      ageMonths: 6,
      minTotalSleepMinutes: 10 * 60,
      maxTotalSleepMinutes: 11 * 60,
    });

    expect(result.status).toBe('below_recommended');
  });

  it('marks a 17-18 hour range for 6 months as above recommended', () => {
    const result = checkTotalSleepRangeAgainstOfficialGuideline({
      ageMonths: 6,
      minTotalSleepMinutes: 17 * 60,
      maxTotalSleepMinutes: 18 * 60,
    });

    expect(result.status).toBe('above_recommended');
  });
});
