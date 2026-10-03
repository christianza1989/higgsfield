import fs from 'node:fs';
import path from 'node:path';
import { inspectMedia, runMediaTool } from './media-tools';

export interface EditClip { file: string; start: number; duration: number; caption?: string }
export interface EditOptions { ratio: '9:16' | '16:9' | '1:1'; audioMode: 'original' | 'generated' | 'silent'; voiceFile?: string; cta?: string }
export const OUTPUT_SIZES = { '9:16': [720, 1280], '16:9': [1280, 720], '1:1': [720, 720] } as const;
function assTime(seconds: number) {
  const n = Math.round(seconds * 100);
  return `${Math.floor(n / 360000)}:${String(Math.floor(n / 6000) % 60).padStart(2, '0')}:${String(Math.floor(n / 100) % 60).padStart(2, '0')}.${String(n % 100).padStart(2, '0')}`;
}
function assText(text: string) { return text.replace(/[{}\\\r]/g, '').replace(/\n/g, '\\N').slice(0, 500); }
export function subtitleDocument(clips: EditClip[], cta: string, width: number, height: number) {
  let time = 0;
  const lines = clips.flatMap(clip => {
    const start = time; time += clip.duration;
    return clip.caption?.trim() ? [`Dialogue: 0,${assTime(start)},${assTime(time)},Caption,,0,0,0,,${assText(clip.caption.trim())}`] : [];
  });
  if (cta.trim()) lines.push(`Dialogue: 1,${assTime(Math.max(0, time - 3))},${assTime(time)},CTA,,0,0,0,,${assText(cta.trim())}`);
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Arial,${Math.round(width / 22)},&H00FFFFFF,&H00FFFFFF,&H00111111,&H80111111,-1,0,0,0,100,100,0,0,1,2,1,2,${Math.round(width * .1)},${Math.round(width * .1)},${Math.round(height * .13)},1\nStyle: CTA,Arial,${Math.round(width / 18)},&H00FFFFFF,&H00FFFFFF,&H00111111,&H80111111,-1,0,0,0,100,100,0,0,1,3,1,8,${Math.round(width * .1)},${Math.round(width * .1)},${Math.round(height * .18)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join('\n')}\n`;
}
export async function renderAd(clips: EditClip[], options: EditOptions, output: string) {
  if (!clips.length || clips.length > 10 || !OUTPUT_SIZES[options.ratio] || !['original', 'generated', 'silent'].includes(options.audioMode)) throw new Error('Invalid editing settings.');
  const duration = clips.reduce((sum, c) => sum + c.duration, 0);
  if (!Number.isFinite(duration) || duration < 1 || duration > 30) throw new Error('Export a video between 1 and 30 seconds.');
  const information: Awaited<ReturnType<typeof inspectMedia>>[] = [];
  for (const clip of clips) {
    if (!Number.isFinite(clip.start) || clip.start < 0 || !Number.isFinite(clip.duration) || clip.duration < .1 || (clip.caption?.length ?? 0) > 300) throw new Error('Invalid clip timing or caption.');
    const info = await inspectMedia(clip.file);
    if (!info.hasVideo || !info.duration || clip.start + clip.duration > info.duration + .05) throw new Error('A selected clip is shorter than its scene. Generate a longer clip or shorten the scene / trim offset.');
    information.push(info);
  }
  if ((options.cta?.length ?? 0) > 150) throw new Error('Keep the call to action under 150 characters.');
  if (options.audioMode === 'original') {
    if (!options.voiceFile) throw new Error('Add your original voiceover before exporting.');
    const voice = await inspectMedia(options.voiceFile);
    if (!voice.hasAudio || !voice.duration || voice.duration < duration - .05) throw new Error('The voiceover is shorter than the complete advertisement. Adjust the scene durations or upload the complete recording.');
  }
  const [width, height] = OUTPUT_SIZES[options.ratio];
  const args = ['-v', 'error', '-nostdin'];
  for (const clip of clips) args.push('-protocol_whitelist', 'file,pipe', '-i', clip.file);
  if (options.audioMode === 'original') args.push('-protocol_whitelist', 'file,pipe', '-i', options.voiceFile!);
  const filters: string[] = [];
  clips.forEach((c, i) => {
    filters.push(`[${i}:v:0]trim=start=${c.start}:duration=${c.duration},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[v${i}]`);
    if (options.audioMode === 'generated') {
      if (information[i].hasAudio) filters.push(`[${i}:a:0]atrim=start=${c.start}:duration=${c.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=${c.duration},atrim=duration=${c.duration}[a${i}]`);
      else filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${c.duration}[a${i}]`);
    }
  });
  const generated = options.audioMode === 'generated';
  filters.push(`${clips.map((_, i) => `[v${i}]${generated ? `[a${i}]` : ''}`).join('')}concat=n=${clips.length}:v=1:a=${generated ? 1 : 0}[joined]${generated ? '[audio]' : ''}`);
  if (options.audioMode === 'original') filters.push(`[${clips.length}:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[audio]`);
  const assPath = output.replace(/\.mp4$/, '.ass');
  try {
    const hasCaptions = clips.some(c => c.caption?.trim()) || options.cta?.trim();
    if (hasCaptions) {
      fs.writeFileSync(assPath, subtitleDocument(clips, options.cta ?? '', width, height), 'utf8');
      // Only generated UUID filenames reach the filter; user text stays in an ASS file.
      filters.push(`[joined]subtitles=filename=${path.basename(assPath)}[final]`);
    }
    args.push('-filter_complex', filters.join(';'), '-map', hasCaptions ? '[final]' : '[joined]');
    if (options.audioMode !== 'silent') args.push('-map', '[audio]', '-c:a', 'aac', '-b:a', '192k');
    else args.push('-an');
    args.push('-t', String(duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', output);
    await runMediaTool('ffmpeg', args, path.dirname(output));
    const result = await inspectMedia(output);
    if (!result.hasVideo || !result.duration || Math.abs(result.duration - duration) > .15) throw new Error('The rendered video duration does not match the scene plan.');
    return result;
  } catch (error) { try { fs.unlinkSync(output); } catch {} throw error; }
  finally { try { fs.unlinkSync(assPath); } catch {} }
}
