import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoRoot = path.join(projectRoot, 'apps', 'demo-v9.1');
const manifestPath = path.join(demoRoot, 'manifest-v9.1.txt');
const manifest = await readFile(manifestPath, 'utf8');
const excluded = new Set(['preview-v9.1.html']);

const entries = manifest
  .split(/\r?\n/)
  .map((line) => line.split('\t'))
  .filter((parts) => parts.length === 3 && /^\d+$/.test(parts[1]) && /^[a-f0-9]{64}$/i.test(parts[2]))
  .map(([relative, bytes, hash]) => ({ relative: relative.replaceAll('/', path.sep), bytes: Number(bytes), hash: hash.toLowerCase() }))
  .filter((entry) => !excluded.has(entry.relative.replaceAll(path.sep, '/')));

if (!entries.length) throw new Error('V9.1 manifest did not contain verifiable file entries');

const failures = [];
for (const entry of entries) {
  const target = path.resolve(demoRoot, entry.relative);
  if (!(target === demoRoot || target.startsWith(`${demoRoot}${path.sep}`))) {
    failures.push(`${entry.relative}: escaped demo root`);
    continue;
  }
  try {
    const info = await stat(target);
    const bytes = await readFile(target);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (info.size !== entry.bytes) failures.push(`${entry.relative}: size ${info.size} != ${entry.bytes}`);
    if (hash !== entry.hash) failures.push(`${entry.relative}: sha256 mismatch`);
  } catch (error) {
    failures.push(`${entry.relative}: ${error.code || error.message}`);
  }
}

if (failures.length) {
  console.error('V9.1 demo integrity verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`V9.1 demo integrity verified (${entries.length} files; preview build excluded)`);
