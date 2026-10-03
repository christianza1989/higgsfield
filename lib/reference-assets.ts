import fs from 'node:fs';
import path from 'node:path';
import type { VideoReference } from './video-references';

export const ASSET_DIR = path.join(process.cwd(), 'storage', 'references');
export interface ReferenceAsset extends VideoReference {
  assetId: string;
  filename: string;
  mime: string;
  localUrl: string;
  hasAudio?: boolean;
}
export function readAsset(id: string): ReferenceAsset {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid asset ID.');
  try {
    const asset = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, `${id}.json`), 'utf8')) as ReferenceAsset;
    if (asset.assetId !== id || !/^[0-9a-f-]{36}\.(png|jpg|gif|webp|mp4|wav)$/i.test(asset.filename)) throw new Error();
    if (!fs.existsSync(path.join(ASSET_DIR, asset.filename))) throw new Error();
    return asset;
  } catch { throw new Error('Reference file is unavailable. Upload it again.'); }
}
export function saveAsset(asset: ReferenceAsset) {
  fs.writeFileSync(path.join(ASSET_DIR, `${asset.assetId}.json`), JSON.stringify(asset));
}
export function assetPath(asset: ReferenceAsset) { return path.join(ASSET_DIR, asset.filename); }
export function publicAsset(asset: ReferenceAsset) {
  const { filename, ...metadata } = asset;
  return metadata;
}
