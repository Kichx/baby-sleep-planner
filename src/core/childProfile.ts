export const CHILD_NAME_MAX_LENGTH = 32;
export const CHILD_NAME_INPUT_PLACEHOLDER = 'Укажите имя ребёнка';

export function normalizeChildName(name: string): string {
  return name.trim();
}

export function getChildNameDraftValue(name: string, fallbackName: string): string {
  const normalizedName = normalizeChildName(name);
  const normalizedFallbackName = normalizeChildName(fallbackName);

  if (normalizedName.length > 0 && normalizedName === normalizedFallbackName) {
    return '';
  }

  return name;
}

export function getChildNameValidationError(
  name: string,
  options: { required: boolean },
): string | null {
  const normalizedName = normalizeChildName(name);

  if (options.required && normalizedName.length === 0) {
    return 'Введите имя ребёнка';
  }

  if (normalizedName.length > CHILD_NAME_MAX_LENGTH) {
    return `Имя не длиннее ${CHILD_NAME_MAX_LENGTH} символов`;
  }

  return null;
}
