import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { SqliteRepositoryProvider } from '../../server/providers/sqlite-provider.mjs';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('GIS JSON migration moves official issues into SQLite and its RTree atomically', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-gis-migration-'));
  const sourceRoot = path.join(root, 'json');
  const issueRoot = path.join(sourceRoot, 'official-issues');
  const sqlitePath = path.join(root, 'business.sqlite');
  await mkdir(issueRoot, { recursive: true });
  await writeFile(path.join(issueRoot, 'ISS-MIGRATION-REAL-001.json'), JSON.stringify({
    id: 'ISS-MIGRATION-REAL-001',
    projectId: 'P-1',
    status: 'active',
    title: '迁移正式问题',
    geometry: { type: 'Point', coordinates: [108.95, 34.27] },
    updatedAt: '2026-08-03T01:00:00Z'
  }), 'utf8');

  const { stdout } = await execFileAsync(process.execPath, [
    path.join(projectRoot, 'scripts/migrate-gis-json-to-sqlite.mjs'),
    sourceRoot,
    sqlitePath
  ]);
  const summary = JSON.parse(stdout);
  assert.equal(summary.byEntity.officialIssues.imported, 1);

  const provider = new SqliteRepositoryProvider(sqlitePath);
  const items = await provider.listInBounds(
    'officialIssues',
    [108.94, 34.26, 108.96, 34.28],
    { projectId: 'P-1' }
  );
  assert.deepEqual(items.map((item) => item.id), ['ISS-MIGRATION-REAL-001']);
  provider.close();
});
