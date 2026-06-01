import { describe, expect, it } from 'vitest';

import {
  SCIENTIFIC_SLEEP_EVIDENCE_SOURCES,
  formatScientificEvidenceSourceLabel,
  getScientificSleepEvidenceSourceById,
  getScientificSleepEvidenceSourcesByTopic,
} from '@/core/scientificSleepEvidence';

describe('scientific sleep evidence', () => {
  it('contains exactly three sources', () => {
    expect(SCIENTIFIC_SLEEP_EVIDENCE_SOURCES).toHaveLength(3);
  });

  it('marks every source as level D', () => {
    expect(SCIENTIFIC_SLEEP_EVIDENCE_SOURCES.every((source) => source.level === 'D')).toBe(
      true,
    );
  });

  it('has unique ids', () => {
    const ids = SCIENTIFIC_SLEEP_EVIDENCE_SOURCES.map((source) => source.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps app use and limitations non-empty for every source', () => {
    for (const source of SCIENTIFIC_SLEEP_EVIDENCE_SOURCES) {
      expect(source.appUse.length).toBeGreaterThan(0);
      expect(source.limitations.length).toBeGreaterThan(0);
    }
  });

  it('keeps at least one supported topic for every source', () => {
    for (const source of SCIENTIFIC_SLEEP_EVIDENCE_SOURCES) {
      expect(source.supportsTopics.length).toBeGreaterThan(0);
    }
  });

  it('finds a source by id', () => {
    const source = getScientificSleepEvidenceSourceById(
      'galland-2012-normal-sleep-patterns',
    );

    expect(source?.authors).toBe('Galland et al.');
  });

  it('returns null for an unknown id', () => {
    expect(getScientificSleepEvidenceSourceById('unknown-source')).toBeNull();
  });

  it('filters by supported topic only', () => {
    const sources = getScientificSleepEvidenceSourcesByTopic('cultural_variability');

    expect(sources.length).toBeGreaterThan(0);
    expect(
      sources.every((source) => source.supportsTopics.includes('cultural_variability')),
    ).toBe(true);
  });

  it('formats a stable source label with authors, year and evidence kind', () => {
    const source = getScientificSleepEvidenceSourceById(
      'galland-2012-normal-sleep-patterns',
    );

    expect(source).not.toBeNull();
    expect(formatScientificEvidenceSourceLabel(source!)).toBe(
      'Galland et al., 2012 · systematic review',
    );
  });

  it('does not describe app use as direct clinical or automatic plan logic', () => {
    const blockedPhrases = [
      'медицинскую норму',
      'лечение',
      'диагноз',
      'автоматически применить к плану',
    ];

    for (const source of SCIENTIFIC_SLEEP_EVIDENCE_SOURCES) {
      const appUseText = source.appUse.join(' ').toLowerCase();

      for (const phrase of blockedPhrases) {
        expect(appUseText).not.toContain(phrase);
      }
    }
  });
});
