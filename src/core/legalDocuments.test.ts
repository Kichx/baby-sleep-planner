import { describe, expect, it } from 'vitest';

import { getLegalDocument } from '@/core/legalDocuments';

describe('getLegalDocument', () => {
  it('returns terms by id', () => {
    expect(getLegalDocument('terms-of-use').id).toBe('terms-of-use');
  });

  it('defaults to privacy policy', () => {
    expect(getLegalDocument('unknown').id).toBe('privacy-policy');
  });
});
