import { describe, expect, it } from 'vitest';

import {
  CHILD_NAME_INPUT_PLACEHOLDER,
  CHILD_NAME_MAX_LENGTH,
  getChildNameDraftValue,
  getChildNameValidationError,
  normalizeChildName,
} from '@/core/childProfile';

describe('child profile name validation', () => {
  it('trims child name input', () => {
    expect(normalizeChildName('  Миша  ')).toBe('Миша');
  });

  it('requires a non-empty name for profile forms', () => {
    expect(getChildNameValidationError('   ', { required: true })).toBe('Введите имя ребёнка');
  });

  it('allows an empty optional first-run name', () => {
    expect(getChildNameValidationError('   ', { required: false })).toBeNull();
  });

  it('uses a clear placeholder for child name inputs', () => {
    expect(CHILD_NAME_INPUT_PLACEHOLDER).toBe('Укажите имя ребёнка');
  });

  it('keeps fallback child name out of editable form drafts', () => {
    expect(getChildNameDraftValue('Ребёнок', 'Ребёнок')).toBe('');
    expect(getChildNameDraftValue('  Ребёнок  ', 'Ребёнок')).toBe('');
    expect(getChildNameDraftValue('Миша', 'Ребёнок')).toBe('Миша');
  });

  it('limits child name to 32 characters after trim', () => {
    expect(
      getChildNameValidationError('А'.repeat(CHILD_NAME_MAX_LENGTH + 1), {
        required: false,
      }),
    ).toBe('Имя не длиннее 32 символов');
    expect(
      getChildNameValidationError(` ${'А'.repeat(CHILD_NAME_MAX_LENGTH)} `, {
        required: true,
      }),
    ).toBeNull();
  });
});
