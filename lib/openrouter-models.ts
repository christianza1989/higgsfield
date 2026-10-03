import type { ModelDef } from "./models";

export const OPENROUTER_PREFIX = "openrouter:";
export const OPENROUTER_MODELS: ModelDef[] = [
  { slug: "bytedance/seedance-2.5", name: "Seedance 2.5", family: "Seedance", price: 1.1556, seedance: true },
  { slug: "kwaivgi/kling-v3.0-std", name: "3.0 Standard", family: "Kling", price: 0.42, seedance: false },
  { slug: "kwaivgi/kling-v3.0-pro", name: "3.0 Pro", family: "Kling", price: 0.56, seedance: false },
].map(({ slug, name, family, price, seedance }) => ({
  id: OPENROUTER_PREFIX + slug,
  endpoint: OPENROUTER_PREFIX + slug,
  provider: "openrouter",
  name,
  family,
  vendor: slug.split("/")[0],
  kind: "video",
  refKeys: ["first_frame_url", "last_frame_url"],
  fromUsd: price,
  blurb: "OpenRouter · text or first/last frame images. Live estimated price before platform fees.",
  params: [
    { key: "duration", label: "Length", type: "int", min: seedance ? 4 : 3, max: seedance ? 30 : 15, default: 5 },
    { key: "resolution", label: "Quality", type: "enum", options: seedance ? ["480p", "720p"] : ["720p"], default: "720p" },
    { key: "aspect_ratio", label: "Ratio", type: "enum", options: seedance ? ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"] : ["16:9", "9:16", "1:1"], default: "16:9" },
    { key: "generate_audio", label: "Audio", type: "bool", default: false },
    ...(seedance ? [{ key: "seed", label: "Seed", type: "seed" as const }] : []),
  ],
}));
