import { adDuration, buildAdPrompt, generationDuration, planIssues, type AdPlan } from './ad-plan';
import { modelsByKind } from './models';

export function adGenerationRequest(plan: AdPlan, index?: number) {
  if (plan.audioMode === 'reference') {
    const issues = planIssues(plan);
    if (issues.length) throw new Error(issues.join(' '));
    if (index !== undefined && plan.scenes.length > 1) throw new Error('Use Review full ad in Studio to generate all scenes with the complete voiceover.');
  }
  const references = plan.audioMode === 'reference' ? plan.references : plan.references.filter(r => r.assetId !== plan.voiceReferenceAssetId);
  const model = plan.provider === 'openrouter' ? modelsByKind('video').find(m => m.id === 'openrouter:bytedance/seedance-2.5') :
    modelsByKind('video').find(m => references.length ? m.id === 'seedance-2-5-audio-reference' : m.endpoint === '/bytedance/seedance-2.5/text-to-video');
  if (!model) throw new Error('Seedance 2.5 is not available in the model registry.');
  if (!Number.isFinite(adDuration(plan))) throw new Error('Invalid scene duration.');
  const duration = generationDuration(plan, index), lengthDef = model.params.find(p => p.key === 'duration');
  if (lengthDef?.max && duration > lengthDef.max) throw new Error(`${model.name} supports up to ${lengthDef.max}s here. Choose OpenRouter or generate shorter scenes.`);
  return { modelId: model.id, prompt: buildAdPrompt(plan, index),
    params: { duration, resolution: plan.resolution, aspect_ratio: plan.aspectRatio, generate_audio: plan.audioMode === 'generated' || plan.audioMode === 'reference' }, batch: 1,
    ...(model.referenceModes ? { references, referenceMode: 'references' as const } : {}) };
}
