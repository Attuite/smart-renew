import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !path.isAbsolute(process.argv[2])) {
  throw new Error('请提供备份目录的绝对路径。');
}
const manifest = JSON.parse(await readFile(path.join(root, 'backup-manifest.json'), 'utf8'));
if (manifest.mode === 'local') {
  const dataPath = path.join(root, manifest.localData?.directory || 'data');
  const entries = await readdir(dataPath, { recursive: true, withFileTypes: true });
  const fileCount = entries.filter((entry) => entry.isFile()).length;
  if (!fileCount) throw new Error('本地JSON备份没有可恢复文件。');
  process.stdout.write(`Local JSON backup verified: ${root} (${fileCount} files)\n`);
} else {
  const sqlitePath = path.join(root, manifest.sqlite.file);
  const bytes = await readFile(sqlitePath);
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== manifest.sqlite.sha256) throw new Error('备份SQLite哈希不匹配。');
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  const integrity = database.prepare('PRAGMA integrity_check').all();
  database.close();
  if (!integrity.every((row) => row.integrity_check === 'ok')) {
    throw new Error(`备份SQLite完整性检查失败：${JSON.stringify(integrity)}`);
  }
  process.stdout.write(`Backup verified: ${root}\n`);
}
