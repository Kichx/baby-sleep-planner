import { describe, expect, it } from 'vitest';

import {
  WAKE_WINDOW_GUIDELINES,
  checkWakeWindowAgainstGuideline,
  checkWakeWindowRangeAgainstGuideline,
  formatWakeWindowRangeShort,
  formatWakeWindowStatusText,
  getWakeWindowGuidelineByAgeMonths,
} from '@/core/wakeWindowGuidelines';

describe('getWakeWindowGuidelineByAgeMonths', () => {
  it('matches boundary ages to practical wake window ranges', () => {
    expect(getWakeWindowGuidelineByAgeMonths(0)?.label).toBe('0–1 месяц');
    expect(getWakeWindowGuidelineByAgeMonths(1)?.label).toBe('1–3 месяца');
    expect(getWakeWindowGuidelineByAgeMonths(3)?.label).toBe('3–4 месяца');
    expect(getWakeWindowGuidelineByAgeMonths(4)?.label).toBe('3–4 месяца');
    expect(getWakeWindowGuidelineByAgeMonths(5)?.label).toBe('5–7 месяцев');
    expect(getWakeWindowGuidelineByAgeMonths(7)?.label).toBe('7–10 месяцев');
    expect(getWakeWindowGuidelineByAgeMonths(10)?.label).toBe('10–12 месяцев');
    expect(getWakeWindowGuidelineByAgeMonths(12)?.label).toBe('10–12 месяцев');
  });

  it('returns null for age outside the supported range', () => {
    expect(getWakeWindowGuidelineByAgeMonths(-1)).toBeNull();
    expect(getWakeWindowGuidelineByAgeMonths(13)).toBeNull();
    expect(getWakeWindowGuidelineByAgeMonths(null)).toBeNull();
    expect(getWakeWindowGuidelineByAgeMonths(undefined)).toBeNull();
  });
});

describe('formatWakeWindowRangeShort', () => {
  it('formats minute-only wake window ranges compactly', () => {
    expect(formatWakeWindowRangeShort(30, 60)).toBe('30–60 мин');
  });

  it('formats whole-hour wake window ranges compactly', () => {
    expect(formatWakeWindowRangeShort(60, 120)).toBe('1–2 ч');
    expect(formatWakeWindowRangeShort(120, 240)).toBe('2–4 ч');
  });

  it('formats mixed hour and minute wake window ranges with existing duration style', () => {
    expect(formatWakeWindowRangeShort(75, 150)).toBe('1 ч 15 мин — 2 ч 30 мин');
  });

  it('accepts a guideline object as input', () => {
    const guideline = getWakeWindowGuidelineByAgeMonths(6);

    expect(guideline ? formatWakeWindowRangeShort(guideline) : null).toBe('2–4 ч');
  });

  it('normalizes reversed formatting input', () => {
    expect(formatWakeWindowRangeShort(120, 60)).toBe('1–2 ч');
  });
});

describe('wake window guideline status checks', () => {
  const oneToThreeMonthsGuideline = WAKE_WINDOW_GUIDELINES[1];

  it('checks one wake window against a guideline', () => {
    expect(checkWakeWindowAgainstGuideline(45, oneToThreeMonthsGuideline)).toBe('short');
    expect(checkWakeWindowAgainstGuideline(90, oneToThreeMonthsGuideline)).toBe('within');
    expect(checkWakeWindowAgainstGuideline(150, oneToThreeMonthsGuideline)).toBe('long');
  });

  it('checks a wake window range against a guideline', () => {
    expect(checkWakeWindowRangeAgainstGuideline(60, 120, oneToThreeMonthsGuideline)).toBe(
      'within',
    );
    expect(checkWakeWindowRangeAgainstGuideline(45, 90, oneToThreeMonthsGuideline)).toBe(
      'partially_overlaps',
    );
    expect(checkWakeWindowRangeAgainstGuideline(30, 45, oneToThreeMonthsGuideline)).toBe(
      'short',
    );
    expect(checkWakeWindowRangeAgainstGuideline(150, 180, oneToThreeMonthsGuideline)).toBe(
      'long',
    );
  });

  it('normalizes reversed wake window ranges', () => {
    expect(checkWakeWindowRangeAgainstGuideline(120, 60, oneToThreeMonthsGuideline)).toBe(
      'within',
    );
  });

  it('formats user-facing status text', () => {
    expect(formatWakeWindowStatusText('within')).toBe('План в ориентире');
    expect(formatWakeWindowStatusText('partially_overlaps')).toBe(
      'Частично пересекается с ориентиром',
    );
    expect(formatWakeWindowStatusText('short')).toBe('Короче практического ориентира');
    expect(formatWakeWindowStatusText('long')).toBe('Длиннее практического ориентира');
  });
});

describe('wake window guidelines module boundaries', () => {
  it('does not mutate the guideline table while checking ranges', () => {
    const before = WAKE_WINDOW_GUIDELINES.map((guideline) => ({ ...guideline }));
    const guideline = getWakeWindowGuidelineByAgeMonths(10);

    if (guideline) {
      checkWakeWindowAgainstGuideline(240, guideline);
      checkWakeWindowRangeAgainstGuideline(180, 360, guideline);
      formatWakeWindowRangeShort(guideline);
    }

    expect(WAKE_WINDOW_GUIDELINES).toEqual(before);
  });
});
