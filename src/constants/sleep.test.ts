import { describe, expect, it } from 'vitest';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';

describe('DEFAULT_SLEEP_PLAN', () => {
  it('uses a 06:50-07:10 default wake-up range', () => {
    expect(DEFAULT_SLEEP_PLAN.wakeUpStartMinutes).toBe(6 * 60 + 50);
    expect(DEFAULT_SLEEP_PLAN.wakeUpEndMinutes).toBe(7 * 60 + 10);
    expect(DEFAULT_SLEEP_PLAN.dayStartMinutes).toBe(6 * 60 + 50);
  });
});
