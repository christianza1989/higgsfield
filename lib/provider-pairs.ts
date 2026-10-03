import { defaultParams, getModel, type ModelDef } from './models';

const pairs = [
  ['bytedance-seedance-2-5-text-to-video', 'openrouter:bytedance/seedance-2.5'],
  ['kling-video-v3-0-std-text-to-video', 'openrouter:kwaivgi/kling-v3.0-std'],
  ['kling-video-v3-0-pro-text-to-video', 'openrouter:kwaivgi/kling-v3.0-pro'],
];
export function providerPeer(id: string): ModelDef | undefined {
  const pair = pairs.find(p => p.includes(id));
  return pair ? getModel(pair.find(p => p !== id)!) : undefined;
}

export function transferParams(model: ModelDef, source: Record<string, unknown>) {
  const params = defaultParams(model);
  for (const p of model.params) {
    const v = source[p.key];
    if (v === undefined) continue;
    if (p.options && !p.options.includes(v as string | number)) continue;
    if (p.type === 'int' || p.type === 'float') {
      if (typeof v !== 'number' || !Number.isFinite(v) || (p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max)) continue;
    }
    if (p.type === 'bool' && typeof v !== 'boolean') continue;
    params[p.key] = v;
  }
  return params;
}
