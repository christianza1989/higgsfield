import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Import only text and attribution. Do not download third-party example media.
const repo = 'EvoLinkAI/awesome-seedance-2.5-prompts';
const commit = await fetch(`https://api.github.com/repos/${repo}/commits/main`).then(async r => {
  if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
  return (await r.json()).sha;
});
const raw = `https://raw.githubusercontent.com/${repo}/${commit}`;
const [readme, license] = await Promise.all(['README.md', 'LICENSE'].map(async file => {
  const r = await fetch(`${raw}/${file}`);
  if (!r.ok) throw new Error(`Cannot fetch ${file}: ${r.status}`);
  return r.text();
}));
const headings = [...readme.matchAll(/^### Case\s+(\d+):\s*([\s\S]*?)(?=\n\s*\n)/gm)];
const entries = [];
for (let i = 0; i < headings.length; i++) {
  const h = headings[i];
  const block = readme.slice(h.index, headings[i + 1]?.index ?? readme.length);
  const title = h[2].match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  const prompt = block.match(/\*\*Prompt:\*\*\s*```[^\n]*\n([\s\S]*?)```/i);
  if (!title || !prompt) continue;
  const category = [...readme.slice(0, h.index).matchAll(/^## (.+)$/gm)].at(-1)?.[1].replace(/^[^\p{L}\p{N}]+/u, '').trim() ?? 'Other';
  const author = h[2].match(/\(by\s+\[([^\]]+)\]/)?.[1] ?? 'See original source';
  const mediaBlock = block.slice(0, block.indexOf('**Prompt:**'));
  const videoUrl = mediaBlock.match(/<video\b[^>]*\bsrc="(https:\/\/[^"\s]+)"/i)?.[1];
  const id = 'evolink-' + createHash('sha256').update(category + h[1] + title[1] + title[2]).digest('hex').slice(0, 16);
  entries.push({ id, title: title[1], category, prompt: prompt[1].trim(),
    source: title[2], author, videoUrl, collection: `https://github.com/${repo}/blob/${commit}/README.md`,
    kind: 'video', requiresReference: /reference image|uploaded image|provided image|image 1|@image|参考图/i.test(prompt[1]) });
}
if (entries.length < 100 || new Set(entries.map(e => e.id)).size !== entries.length) throw new Error(`Upstream format changed (${entries.length} entries, ${new Set(entries.map(e => e.id)).size} unique); existing catalogue was not replaced.`);
await fs.mkdir('lib/data', { recursive: true });
await fs.mkdir('licenses', { recursive: true });
await fs.writeFile('lib/data/prompts.json', JSON.stringify({ repo, commit, importedAt: new Date().toISOString(), entries }, null, 2) + '\n');
await fs.writeFile('licenses/EvoLinkAI-LICENSE.txt', license);
console.log(`Imported ${entries.length} attributed prompts at ${commit}.`);
