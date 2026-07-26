import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(projectRoot, '..');
const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  cwd: repositoryRoot,
  encoding: 'utf8'
});

const violations = output
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).replace(/^"|"$/g, ''))
  .filter((file) => !file.replaceAll('\\', '/').startsWith('urban-health-business/'));

if (violations.length) {
  console.error('Changes outside urban-health-business are not allowed during the isolated migration:');
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log('project boundary verified');
