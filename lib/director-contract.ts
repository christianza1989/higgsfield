export type ReferenceRole = 'face' | 'location' | 'wardrobe' | 'prop' | 'style';
export interface DirectorReference { assetId: string; role: ReferenceRole; instruction: string }
export interface DirectorInput {
  requestId: string;
  concept: string;
  dialogue: string;
  language: 'lt' | 'en';
  voiceMode: 'recording' | 'clone' | 'silent';
  voiceId: string;
  recordingAssetId: string;
  location: string;
  locationMode: 'real' | 'fantasy';
  weather: string;
  environment: string;
  camera: string;
  subjectDescription?: string;
  wardrobeDescription?: string;
  propsDescription?: string;
  autoGenerateReferences?: boolean;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: '480p' | '720p';
  duration: number;
  minimumLocationReferences: number;
  references: DirectorReference[];
}
export interface DirectorSource { assetId: string; title: string; page: string; license: string; author: string; observations: string }
export interface DirectorPrepared {
  id: string;
  input: DirectorInput;
  prompt: string;
  transcript: string;
  duration: number;
  modelDuration: number;
  audioUrl?: string;
  references: { assetId: string; localUrl: string; role: string; instruction: string }[];
  sources: DirectorSource[];
  warnings: string[];
  estimatedUsd: number;
  generationStarted: false;
}
