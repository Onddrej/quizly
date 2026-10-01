export const DEFINITION_LANGUAGES = [
  { code: 'sk', name: 'Slovak' },
  { code: 'cs', name: 'Czech' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
] as const;

export function languageName(code: string): string {
  return DEFINITION_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
