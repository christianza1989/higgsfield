import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { renderAd, subtitleDocument } from './ad-export';
import { inspectMedia, runMediaTool } from './media-tools';
import { serveMedia } from './serve-media';

test('local editing renders a 15s portrait ad with original audio and Lithuanian captions; rejects insufficient media', { timeout: 120000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ad-test-'));
  const clip = path.join(temp, 'clip.mp4'); const voice = path.join(temp, 'voice.wav'); const output = path.join(temp, `${randomUUID()}.mp4`);
  try {
    await runMediaTool('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', clip]);
    await runMediaTool('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=16', '-c:a', 'pcm_s16le', '-y', voice]);
    const clips = Array.from({ length: 3 }, (_, i) => ({ file: clip, start: i === 1 ? 1 : 0, duration: 5, caption: 'Ąžuolas, šviesa ir kokybė' }));
    const info = await renderAd(clips, { ratio: '9:16', audioMode: 'original', voiceFile: voice, cta: 'Atrask daugiau' }, output);
    assert.ok(Math.abs(info.duration! - 15) < .1); assert.equal(info.width, 720); assert.equal(info.height, 1280); assert.equal(info.hasAudio, true);
    const range = serveMedia(new Request('http://localhost/video', { headers: { range: 'bytes=0-99' } }), output, 'video/mp4');
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 100);
    assert.equal(serveMedia(new Request('http://localhost/video', { headers: { range: 'bytes=99999999999999-' } }), output, 'video/mp4').status, 416);
    await assert.rejects(renderAd([{ file: clip, start: 2, duration: 5 }], { ratio: '9:16', audioMode: 'silent' }, output), /shorter than its scene/);
    await assert.rejects(renderAd([{ file: clip, start: 0, duration: 5 }], { ratio: '9:16', audioMode: 'original', voiceFile: clip }, output), /voiceover is shorter/);
    await renderAd([{ file: clip, start: 0, duration: 1 }], { ratio: '16:9', audioMode: 'silent' }, output);
    assert.equal((await inspectMedia(output)).hasAudio, false);
    await renderAd([{ file: clip, start: 0, duration: 1 }, { file: clip, start: 1, duration: 1 }], { ratio: '1:1', audioMode: 'generated' }, output);
    assert.equal((await inspectMedia(output)).hasAudio, true);
    const ass = subtitleDocument([{ file: clip, start: 0, duration: 5, caption: '{\\pos(1,1)}Caption' }], '', 720, 1280);
    assert.ok(!ass.includes('{\\pos'));
  } finally {
    if (!path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(temp).startsWith('studio-ad-test-')) throw new Error('Unsafe test cleanup path.');
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
