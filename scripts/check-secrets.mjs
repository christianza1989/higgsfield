import { execFileSync } from 'node:child_process';

// Inspect staged code only. Never open environment files or print matched data.
const files = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const blocked = files.filter(f => /(^|\/)(\.env(?!\.example$)|storage\/|node_modules\/|\.next\/)/.test(f));
const patterns = [
  /sk-or-v1-[a-zA-Z0-9]{24,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32,}\b/i,
  /\b(?:ghp_|gho_|github_pat_)[a-zA-Z0-9_]{24,}\b/,
];
for (const f of files) {
  let content;
  try { content = execFileSync('git', ['show', `:${f}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); } catch { continue; }
  if (patterns.some(p => p.test(content))) blocked.push(f);
}
if (blocked.length) {
  console.error('Commit blocked: secret or private runtime data detected in staged files:', [...new Set(blocked)].join(', '));
  process.exit(1);
}
console.log(`Staged secret/private-data check passed (${files.length} files). Credential files were not opened.`);
