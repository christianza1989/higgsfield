import fs from 'node:fs';
export function serveMedia(req: Request, filename: string, mime: string) {
  const size = fs.statSync(filename).size;
  const headers: Record<string, string> = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
  const range = req.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = Math.min(size - 1, match[1] && match[2] ? Number(match[2]) : size - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const buffer = Buffer.alloc(end - start + 1); const fd = fs.openSync(filename, 'r');
    try { fs.readSync(fd, buffer, 0, buffer.length, start); } finally { fs.closeSync(fd); }
    return new Response(buffer, { status: 206, headers: { ...headers, 'Content-Length': String(buffer.length), 'Content-Range': `bytes ${start}-${end}/${size}` } });
  }
  return new Response(fs.readFileSync(filename), { headers: { ...headers, 'Content-Length': String(size) } });
}
