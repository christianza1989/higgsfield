import type { VideoReference } from './video-references';

export interface AdScene {
  id: string;
  duration: number;
  visual: string;
  camera: string;
  narration: string;
  caption: string;
  source?: { type: 'asset' | 'generation'; id: string };
  trimStart: number;
  jobId?: string;
}
export interface AdPlan {
  version: 1;
  product: string;
  audience: string;
  style: 'ugc' | 'cinematic';
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: '480p' | '720p';
  provider: 'openrouter' | 'higgsfield';
  audioMode: 'original' | 'generated' | 'silent';
  language: string;
  voiceAssetId?: string;
  voiceDuration?: number;
  voiceName?: string;
  cta: string;
  references: VideoReference[];
  scenes: AdScene[];
}
export function newAdPlan(): AdPlan {
  return { version: 1, product: '', audience: '', style: 'ugc', aspectRatio: '9:16', resolution: '720p', provider: 'openrouter', audioMode: 'original', language: 'Lithuanian', cta: '', references: [], scenes: [
    { id: 'hook', duration: 5, visual: '', camera: 'Natural handheld medium shot, eye-level.', narration: '', caption: '', trimStart: 0 },
    { id: 'demo', duration: 5, visual: '', camera: 'Close-up of the product in use.', narration: '', caption: '', trimStart: 0 },
    { id: 'cta', duration: 5, visual: '', camera: 'Clean hero shot of the product.', narration: '', caption: '', trimStart: 0 },
  ] };
}
export function sceneTimeline(plan: AdPlan) {
  let time = 0;
  return plan.scenes.map(scene => { const start = time; time += scene.duration; return { ...scene, start, end: time }; });
}
export function adDuration(plan: AdPlan) { return plan.scenes.reduce((sum, s) => sum + s.duration, 0); }
export function planIssues(plan: AdPlan): string[] {
  const issues: string[] = [];
  if (!plan.product.trim()) issues.push('Describe the product and the identity details that must stay unchanged.');
  if (!plan.scenes.length || plan.scenes.length > 10) issues.push('Use 1–10 scenes.');
  if (plan.scenes.some(s => !Number.isInteger(s.duration) || s.duration < 1 || s.duration > 30)) issues.push('Scene durations must be whole seconds between 1 and 30.');
  if (adDuration(plan) < 4 || adDuration(plan) > 30) issues.push('The complete model prompt must be 4–30 seconds long.');
  if (plan.scenes.some(s => !s.visual.trim())) issues.push('Describe the action in every scene.');
  if (plan.audioMode === 'generated' && !plan.scenes.some(s => s.narration.trim())) issues.push('Write the exact spoken words in at least one scene, or choose silent visuals.');
  return issues;
}
export function buildAdPrompt(plan: AdPlan, sceneIndex?: number): string {
  const single = sceneIndex !== undefined;
  const chosen = single ? [plan.scenes[sceneIndex!]] : plan.scenes;
  if (chosen.some(s => !s)) throw new Error('Scene not found.');
  let time = 0;
  const duration = single ? Math.max(4, chosen[0].duration) : adDuration(plan);
  const shots = chosen.map(s => {
    const start = time; time += s.duration;
    return `[${start}–${time}s] ${s.visual.trim()} Camera: ${s.camera.trim() || 'Stable, natural movement.'}${plan.audioMode === 'generated' ? s.narration.trim() ? ` Dialogue in ${plan.language}: ${JSON.stringify(s.narration.trim())}. Natural delivery; synchronize visible speech.` : ' No spoken dialogue during this shot.' : ''}`;
  });
  if (single && chosen[0].duration < 4) shots.push(`[${chosen[0].duration}–4s] Hold the final composition with subtle natural motion; this tail will be trimmed in editing.`);
  return [
    `Create a ${duration}-second ${plan.aspectRatio} product advertisement.`,
    `PRODUCT: ${plan.product.trim()}`,
    plan.audience.trim() ? `AUDIENCE: ${plan.audience.trim()}` : '',
    plan.style === 'ugc' ? 'STYLE: Authentic phone-shot UGC, believable everyday environment, natural light and skin texture, restrained acting, practical product demonstration.' : 'STYLE: Cinematic product advertisement, controlled lighting, clear visual hierarchy, intentional camera movement.',
    'CONTINUITY: Keep the same product shape, packaging, colors and logo throughout; use the supplied reference roles. Keep character identity, clothing and environment consistent between shots. Show physical actions clearly.',
    ...shots,
    plan.audioMode === 'generated' ? 'AUDIO: Generate the exact dialogue above with consistent voice, appropriate room tone and subtle sound effects. Keep music below speech.' : plan.audioMode === 'original' ? 'AUDIO: Silent visuals. Existing voiceover will be added unchanged in editing. Do not generate dialogue, lip movements for speech, music or sound effects.' : 'AUDIO: Silent visuals. Do not generate dialogue, music or sound effects.',
    'FINISH: No baked-in subtitles, extra text, watermark or new logos. Leave room near the lower center for captions added in editing. Preserve product readability.',
  ].filter(Boolean).join('\n\n');
}
