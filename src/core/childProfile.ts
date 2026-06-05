export const CHILD_NAME_MAX_LENGTH = 32;

export function normalizeChildName(name: string): string {
  return name.trim();
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
