import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

function requiredAbsolutePath(value, label) {
  if (!value || !path.isAbsolute(value)) {
    throw new Error(`${label}必须是明确的绝对路径。`);
  }
  return path.resolve(value);
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const dataRoot = requiredAbsolutePath(
  process.env.URBAN_HEALTH_DATA_DIR,
  'URBAN_HEALTH_DATA_DIR'
);
const providerMode = String(process.env.URBAN_HEALTH_PROVIDER || 'local').toLowerCase();
if (!['local', 'sqlite'].includes(providerMode)) {
  throw new Error('当前本地备份脚本支持local或sqlite；CloudBase请使用CloudBase原生备份与对象存储版本控制。');
}
const backupRoot = requiredAbsolutePath(process.argv[2], '备份输出目录参数');
if (backupRoot === dataRoot || backupRoot.startsWith(`${dataRoot}${path.sep}`)) {
  throw new Error('备份输出目录不得位于正在备份的数据目录内部。');
}

const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
const target = path.join(backupRoot, `urban-health-${timestamp}`);
await mkdir(target, { recursive: false });

let sqliteManifest = null;
let localDataManifest = null;
if (providerMode === 'sqlite') {
  const sqlitePath = path.resolve(
    process.env.URBAN_HEALTH_SQLITE_PATH || path.join(dataRoot, 'business-records.sqlite')
  );
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  const integrity = database.prepare('PRAGMA integrity_check').all();
  if (!integrity.every((row) => row.integrity_check === 'ok')) {
    database.close();
    throw new Error(`SQLite完整性检查失败：${JSON.stringify(integrity)}`);
  }
  const sqliteTarget = path.join(target, 'business-records.sqlite');
  await backup(database, sqliteTarget);
  database.close();
  const objectRoot = path.join(dataRoot, 'objects');
  try {
    await cp(objectRoot, path.join(target, 'objects'), {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const sqliteBytes = await readFile(sqliteTarget);
  sqliteManifest = {
    file: 'business-records.sqlite',
    size: sqliteBytes.length,
    sha256: hash(sqliteBytes),
    integrity: 'ok'
  };
} else {
  await cp(dataRoot, path.join(target, 'data'), {
    recursive: true,
    errorOnExist: true,
    force: false
  });
  localDataManifest = {
    directory: 'data',
    note: '包含本地JSON业务记录、对象内容和AI配置加密主密钥；恢复时必须保留文件权限。'
  };
}

const manifest = {
  createdAt: new Date().toISOString(),
  sourceDataRoot: dataRoot,
  repositoryProvider: providerMode,
  mapSnapshotProvider: process.env.GIS_MAP_SNAPSHOT_PROVIDER || 'filesystem',
  mode: providerMode,
  sqlite: sqliteManifest,
  localData: localDataManifest,
  localObjectsIncluded: providerMode === 'local' || process.env.GIS_MAP_SNAPSHOT_PROVIDER !== 's3',
  remoteObjectStorageNote: process.env.GIS_MAP_SNAPSHOT_PROVIDER === 's3'
    ? 'S3对象未复制；必须由Bucket版本控制、复制和保留策略覆盖。'
    : null
};
await writeFile(
  path.join(target, 'backup-manifest.json'),
  JSON.stringify(manifest, null, 2),
  { encoding: 'utf8', flag: 'wx' }
);
process.stdout.write(`${target}\n`);
