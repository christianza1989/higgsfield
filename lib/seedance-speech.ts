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

// Asset responsibility and sound notation follow BytePlus's prompt guide.
// Articulation/framing directions are production guidance, not forced alignment.
export function referenceSpeechDirection(audioLabel: string) {
  return `${audioLabel} supplies the complete spoken dialogue, pacing, pauses and voice timbre; it is not an enrollment sample or music reference. Map each recorded voice to its intended visible speaker and keep that assignment throughout. Follow the recording's exact words, language, pronunciation, emotion, accent, breathing and hesitation timing. Synchronize the visible speaker's mouth movements, lip closures and jaw articulation to the recorded syllables. During non-speech pauses use relaxed lips and natural breathing, without invented talking. Keep other characters silent during this speaker's lines. Keep the speaking face and mouth readable and unobstructed; preserve the specified camera direction with restrained head motion. Delivery tags are performance directions, never spoken words. Do not translate, paraphrase, stretch, repeat or add speech. Generate matching video audio.`;
}

export const REFERENCE_AUDIO_DESIGN = 'Retain the reference dialogue and any ambience already present in the recording. Do not add a second ambience layer or additional voices. No new music, background music, BGM, score, instrumental, melody, synth effects or ambient pad. Keep dialogue clearly audible.';
