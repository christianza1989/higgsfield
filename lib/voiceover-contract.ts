export const VOICEOVER_CAPABILITIES = {
  preserveVoiceover: true,
  referenceAudio: { documented: true, liveVerified: false },
  exactLipSync: false,
} as const;

export interface VoiceoverManifest {
  schemaVersion: 1;
  source: 'voiceovers';
  sourceJobId: string;
  status: 'completed';
  text: string;
  language: string;
  style?: string;
  model?: string;
  voiceId?: string;
  durationSeconds: number;
  segments?: { text: string; startSeconds: number; endSeconds: number }[];
}

export interface VoiceoverImport {
  schemaVersion: 1;
  importId: string;
  asset: { assetId: string; localUrl: string; kind: 'audio'; mime: 'audio/wav'; duration: number; bytes: number };
  manifest: VoiceoverManifest;
  compositionUrl: string;
  generationStarted: false;
  capabilities: typeof VOICEOVER_CAPABILITIES;
}
