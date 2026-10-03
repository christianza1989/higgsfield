import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, MEDIA_DIR, insertJob, insertGeneration, updateJob } from '@/lib/db';
import { readAsset, assetPath } from '@/lib/reference-assets';
import { renderAd, type EditOptions, type EditClip } from '@/lib/ad-export';

export const runtime = 'nodejs';
export const maxDuration = 180;
const state = globalThis as typeof globalThis & { adExportBusy?: boolean };
export async function POST(req: Request) {
  if (state.adExportBusy) return Response.json({ error: 'Another export is running. Try again after it completes.' }, { status: 429 });
  state.adExportBusy = true;
  try {
    const raw = await req.json();
    if (!Array.isArray(raw.clips) || raw.clips.length < 1 || raw.clips.length > 10) throw new Error('Select 1–10 clips.');
    const clips: EditClip[] = raw.clips.map((c: { source: { type: string; id: string }; start: number; duration: number; caption?: string }) => {
      if (!c.source || typeof c.source.id !== 'string' || (c.caption !== undefined && typeof c.caption !== 'string')) throw new Error('Invalid clip.');
      let file: string;
      if (c.source.type === 'asset') {
        const asset = readAsset(c.source.id);
        if (asset.kind !== 'video') throw new Error('Choose a video clip.');
        file = assetPath(asset);
      } else if (c.source.type === 'generation') {
        const generation = db().prepare('SELECT local_path FROM generations WHERE id = ? AND kind = ?').get(c.source.id, 'video') as { local_path: string | null } | undefined;
        if (!generation?.local_path) throw new Error('The selected video has no saved local file.');
        file = path.resolve(MEDIA_DIR, generation.local_path);
        if (!file.startsWith(path.resolve(MEDIA_DIR) + path.sep)) throw new Error('Invalid clip path.');
      } else throw new Error('Choose an uploaded or generated video.');
      return { file, start: c.start, duration: c.duration, caption: c.caption };
    });
    let voiceFile: string | undefined;
    if (raw.audioMode === 'original') {
      const asset = readAsset(raw.voiceAssetId);
      if (asset.kind !== 'audio') throw new Error('Choose an audio file for the voiceover.');
      voiceFile = assetPath(asset);
    }
    if (raw.cta !== undefined && typeof raw.cta !== 'string') throw new Error('Invalid call to action.');
    const id = randomUUID(); fs.mkdirSync(MEDIA_DIR, { recursive: true });
    const filename = `${id}.mp4`;
    const options: EditOptions = { ratio: raw.aspectRatio, audioMode: raw.audioMode, voiceFile, cta: raw.cta };
    const info = await renderAd(clips, options, path.join(MEDIA_DIR, filename));
    db().transaction(() => {
      insertJob({ id, model_id: 'local-ad-export', model_name: 'Edited ad', endpoint: 'local/edit', kind: 'video', prompt: 'Locally edited advertisement', params: { aspect_ratio: raw.aspectRatio, duration: info.duration, resolution: '720p', audio_mode: raw.audioMode }, batch: 1, est_usd: 0, est_credits: 0 });
      insertGeneration({ id: randomUUID(), job_id: id, kind: 'video', remote_url: null, local_path: filename, mime: 'video/mp4', bytes: fs.statSync(path.join(MEDIA_DIR, filename)).size });
      updateJob(id, { status: 'completed' });
    })();
    return Response.json({ url: `/api/media/${filename}`, jobId: id, duration: info.duration });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Export failed.' }, { status: 400 });
  } finally { state.adExportBusy = false; }
}
