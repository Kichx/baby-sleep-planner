import { describe, expect, it } from 'vitest';

import {
  AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS,
  formatAgeSleepPlanPresetCustomPlanName,
  formatAgeSleepPlanPresetTargetPlanName,
  getAllAgeSleepPlanPresetTemplateOptions,
  getAgeSleepPlanPresetTemplateCatalog,
  getAgeSleepPlanPresetTemplateCatalogForProfile,
  getAgeSleepPlanPresetTemplateOptions,
} from '@/core/ageSleepPlanPresetTemplates';
import { buildSleepPlanPreset, buildWakeWindowsForPlan } from '@/core/sleepPlan';

describe('getAgeSleepPlanPresetTemplateCatalog', () => {
  it('returns a recommended preset for every age from 0 to 12 months', () => {
    for (let ageMonths = 0; ageMonths <= 12; ageMonths += 1) {
      const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths });

      expect(catalog?.recommendedPreset).toBeTruthy();
      expect(catalog?.recommendedPreset.ageBandId).toBe(catalog?.ageBand.id);
    }
  });

  it('uses the softer preset with more naps in transition bands', () => {
    for (const ageBand of AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS) {
      const catalog = getAgeSleepPlanPresetTemplateCatalog({
        ageMonths: ageBand.ageFromMonths,
      });

      expect(catalog?.alternativePreset).toBeTruthy();
      expect(catalog?.recommendedPreset.napCount).toBeGreaterThan(
        catalog?.alternativePreset?.napCount ?? 0,
      );
    }
  });

  it('does not duplicate the recommended preset as the alternative', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 7 });

    expect(catalog?.recommendedPreset.id).not.toBe(catalog?.alternativePreset?.id);
    expect(catalog?.recommendedPreset.napCount).not.toBe(
      catalog?.alternativePreset?.napCount,
    );
  });

  it('returns a non-empty whyRecommendedText', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 5 });

    expect(catalog?.whyRecommendedText.trim().length).toBeGreaterThan(0);
  });

  it('does not mark the recommended preset as automatically selected', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 8 });

    expect(catalog?.recommendedPreset.isRecommended).toBe(true);
    expect(catalog?.recommendedPreset.isAutomaticallySelected).toBe(false);
  });

  it('builds at most two preset options with the recommendation first', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 5 });
    const options = getAgeSleepPlanPresetTemplateOptions(catalog);

    expect(options).toHaveLength(2);
    expect(options[0]).toBe(catalog?.recommendedPreset);
    expect(options[0].isAutomaticallySelected).toBe(false);
    expect(options[1]).toBe(catalog?.alternativePreset);
  });

  it('builds all preset options with the current age recommendation first', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 5 });
    const options = getAllAgeSleepPlanPresetTemplateOptions(catalog);

    expect(options.length).toBeGreaterThan(AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS.length);
    expect(options[0].preset).toBe(catalog?.recommendedPreset);
    expect(options[0].catalog).toBe(catalog);
    expect(options[1].preset).toBe(catalog?.alternativePreset);
    expect(options.slice(2).every((option) => option.catalog.ageBand.id !== catalog?.ageBand.id)).toBe(
      true,
    );
  });

  it('builds all preset options without duplicates when there is no current age catalog', () => {
    const options = getAllAgeSleepPlanPresetTemplateOptions(null);
    const uniqueIds = new Set(options.map((option) => option.preset.id));

    expect(options.length).toBe(uniqueIds.size);
    expect(options[0].catalog.ageBand.id).toBe(AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS[0].id);
  });

  it('uses a 06:50-07:10 wake-up range for every preset option', () => {
    const options = getAllAgeSleepPlanPresetTemplateOptions(null);

    expect(options.length).toBeGreaterThan(0);

    for (const { preset } of options) {
      expect(preset.plan.wakeUpStartMinutes).toBe(6 * 60 + 50);
      expect(preset.plan.wakeUpEndMinutes).toBe(7 * 60 + 10);
      expect(preset.plan.dayStartMinutes).toBe(6 * 60 + 50);
    }
  });

  it('formats a clear target plan name from a preset template', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 5 });

    expect(formatAgeSleepPlanPresetTargetPlanName(catalog!.recommendedPreset)).toBe(
      '4 сна · 5–6 мес',
    );
    expect(formatAgeSleepPlanPresetCustomPlanName(catalog!.recommendedPreset)).toBe(
      'Свой план · 5–6 мес',
    );
  });

  it('builds plan data compatible with buildSleepPlanPreset and buildWakeWindowsForPlan', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalog({ ageMonths: 6 });
    const preset = catalog?.recommendedPreset;

    expect(preset).toBeTruthy();

    const plan = preset!.plan;
    const rebuiltPlan = buildSleepPlanPreset({
      latestEveningNapEndMinutes: plan.latestEveningNapEndMinutes,
      maxEveningNapMinutes: plan.maxEveningNapMinutes,
      microNapMinutes: plan.microNapMinutes,
      minNightSleepMinutes: plan.minNightSleepMinutes,
      napCount: plan.napCount,
      targetAwakeMaxMinutes: plan.targetAwakeMaxMinutes,
      targetAwakeMinMinutes: plan.targetAwakeMinMinutes,
      targetDaySleepMaxMinutes: plan.targetDaySleepMaxMinutes,
      targetDaySleepMinMinutes: plan.targetDaySleepMinMinutes,
      wakeUpEndMinutes: plan.wakeUpEndMinutes,
      wakeUpStartMinutes: plan.wakeUpStartMinutes,
    });

    expect(plan.napCount).toBe(preset!.napCount);
    expect(plan.targetDaySleepMinMinutes).toBe(preset!.daySleepMinMinutes);
    expect(plan.targetDaySleepMaxMinutes).toBe(preset!.daySleepMaxMinutes);
    expect(plan.wakeWindows).toEqual(
      buildWakeWindowsForPlan({
        napCount: plan.napCount,
        targetAwakeMaxMinutes: plan.targetAwakeMaxMinutes,
        targetAwakeMinMinutes: plan.targetAwakeMinMinutes,
      }),
    );
    expect(rebuiltPlan.wakeWindows).toEqual(plan.wakeWindows);
  });

  it('uses profile birth date age before a manual age band', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalogForProfile({
      birthDate: new Date(2026, 0, 3),
      manualAgeBandId: 'preset_template_7_8_months',
      now: new Date(2026, 6, 3),
    });

    expect(catalog?.source).toBe('profile_birth_date');
    expect(catalog?.ageBand.id).toBe('preset_template_5_6_months');
  });

  it('does not use manual age band when profile age exists but is outside template range', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalogForProfile({
      birthDate: new Date(2024, 0, 3),
      manualAgeBandId: 'preset_template_7_8_months',
      now: new Date(2026, 6, 3),
    });

    expect(catalog).toBeNull();
  });

  it('uses manual age band when birth date is missing', () => {
    const catalog = getAgeSleepPlanPresetTemplateCatalogForProfile({
      birthDate: null,
      manualAgeBandId: 'preset_template_7_8_months',
      now: new Date(2026, 6, 3),
    });

    expect(catalog?.source).toBe('manual_age_band');
    expect(catalog?.ageBand.id).toBe('preset_template_7_8_months');
  });
});
