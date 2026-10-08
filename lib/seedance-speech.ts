// Explicitly listed in BytePlus's Seedance 2.5 tutorial, checked 2026-10-08.
// Documentation support is not a live quality/lip-sync verification.
export const SEEDANCE_DOCUMENTED_LANGUAGES = [
  'Chinese', 'English', 'Spanish', 'Indonesian', 'Malay', 'Thai', 'Arabic', 'Portuguese', 'Vietnamese', 'Japanese', 'Korean',
] as const;
const codes: Record<string, string> = { zh: 'Chinese', en: 'English', es: 'Spanish', id: 'Indonesian', ms: 'Malay', th: 'Thai', ar: 'Arabic', pt: 'Portuguese', vi: 'Vietnamese', ja: 'Japanese', ko: 'Korean' };
export function speechLanguageEvidence(language: string) {
  const normalized = language.trim().toLowerCase();
  const label = codes[normalized.split('-')[0]] ?? SEEDANCE_DOCUMENTED_LANGUAGES.find(l => l.toLowerCase() === normalized);
  return { requested: language, documented: Boolean(label), label: label ?? null, liveVerified: false };
}
