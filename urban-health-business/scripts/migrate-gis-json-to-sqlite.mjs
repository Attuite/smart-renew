import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { SqliteRepositoryProvider } from '../server/providers/sqlite-provider.mjs';

const collections = {
  'official-issues': 'officialIssues',
  'boundary-revisions': 'boundaryRevisions',
  'spatial-analyses': 'spatialAnalyses',
  'coordinate-transforms': 'coordinateTransforms',
  'survey-routes': 'surveyRoutes',
  'survey-stops': 'surveyStops',
  'photo-route-bindings': 'photoRouteBindings',
  'map-snapshots': 'mapSnapshots'
};

function absolute(value, label) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${label}必须是绝对路径。`);
  return path.resolve(value);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const sourceRoot = absolute(process.argv[2], 'JSON数据根目录');
const sqlitePath = absolute(process.argv[3], 'SQLite目标文件');
const provider = new SqliteRepositoryProvider(sqlitePath);
const summary = {
  sourceRoot,
  sqlitePath,
  startedAt: new Date().toISOString(),
  imported: 0,
  skipped: 0,
  byEntity: {}
};

await provider.transaction(async (transaction) => {
  for (const [directory, entity] of Object.entries(collections)) {
    let names = [];
    try {
      names = await readdir(path.join(sourceRoot, directory));
    } catch (error) {
      if (error.code === 'ENOENT') {
        summary.byEntity[entity] = { imported: 0, skipped: 0 };
        continue;
      }
      throw error;
    }
    const entitySummary = { imported: 0, skipped: 0 };
    for (const name of names.filter((item) => item.endsWith('.json')).sort()) {
      const record = JSON.parse(await readFile(path.join(sourceRoot, directory, name), 'utf8'));
      if (!record?.id) throw new Error(`${directory}/${name}缺少id。`);
      const existing = await transaction.get(entity, record.id);
      if (existing) {
        if (canonical(existing) !== canonical(record)) {
          throw new Error(
            `${entity}/${record.id}已存在且内容不同；迁移已回滚。源指纹=${fingerprint(record)}`
          );
        }
        entitySummary.skipped += 1;
        summary.skipped += 1;
        continue;
      }
      await transaction.put(entity, record);
      entitySummary.imported += 1;
      summary.imported += 1;
    }
    summary.byEntity[entity] = entitySummary;
  }
});
provider.close();
summary.completedAt = new Date().toISOString();
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
