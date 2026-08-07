import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const SQLITE_MIME_TYPES = new Set([
  'application/vnd.sqlite3',
  'application/x-sqlite3',
  'application/octet-stream'
]);

export const SQLITE_TYPE_MAP = Object.freeze({
  project: 'project',
  geo_node: 'geoNode',
  photo: 'photo',
  analysis_record: 'analysisRecord',
  issue: 'issue',
  issue_media: 'issue',
  unclassified_problem: 'issue',
  indicator_result: 'indicatorResult',
  score_summary: 'indicatorResult',
  report: 'report',
  report_indicator_ref: 'report',
  report_issue_ref: 'report',
  audit_log: 'audit',
  dimension: 'dictionary',
  element: 'dictionary',
  indicator: 'dictionary',
  problem_category: 'dictionary',
  problem_type: 'dictionary',
  remediation: 'dictionary',
  severity_rule: 'dictionary',
  severity_band: 'dictionary',
  code_dict: 'dictionary',
  geo_level: 'dictionary',
  survey_route: 'other',
  survey_stop: 'other',
  gis_layer: 'other',
  meta: 'other'
});

const TYPE_LABELS = Object.freeze({
  project: '项目档案',
  scope: '项目范围',
  residentialUnit: '住宅台账',
  building: '楼栋档案',
  geoNode: '地理单元',
  photo: '照片',
  analysisRecord: '分析批次',
  issue: '问题实例',
  indicatorResult: '指标结果',
  report: '报告',
  dictionary: '标准字典',
  audit: '审计记录',
  other: '其他数据'
});

const MAX_SQLITE_RECORDS = 20_000;

function sqliteError(message, status = 400, code = 'PROJECT_DATA_SQLITE_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function clean(value, maxLength = 240) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function stableDataHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function makeProjectDataId(projectId, dataType, sourceKey) {
  const type = String(dataType || 'other').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'other';
  return `PDI-${String(projectId)}-${type}-${stableDataHash(sourceKey)}`;
}

function portableValue(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) {
    return {
      encoding: 'base64',
      data: Buffer.from(value).toString('base64')
    };
  }
  return value;
}

function portableRow(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key, portableValue(value)])
  );
}

function firstValue(payload, names) {
  for (const name of names) {
    if (payload[name] !== undefined && payload[name] !== null && payload[name] !== '') {
      return payload[name];
    }
  }
  return '';
}

export function sqliteRowToProjectData(table, row, index, projectId, lineage = {}) {
  const payload = portableRow(row);
  const dataType = SQLITE_TYPE_MAP[table] || 'other';
  const sourceId = String(
    firstValue(payload, ['编码', '编号', '项目编号', '照片编号', '批次编号', '报告编号', 'id'])
    || `${table}-${index}`
  );
  const code = String(firstValue(payload, ['编码', '编号', '问题编码', '指标编码', '项目编号']) || '');
  const title = String(
    firstValue(payload, ['名称', '项目名称', '原始叫法', '标题', '文件名', '编号', '编码'])
    || `${TYPE_LABELS[dataType]} ${index + 1}`
  );
  const tags = ['SQLite导入', TYPE_LABELS[dataType], table];
  for (const key of ['维度', '大类编码', '问题编码', '指标编码', '复核状态', '归类状态', '状态', '严重等级']) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
      tags.push(`${key}:${payload[key]}`);
    }
  }
  return {
    id: makeProjectDataId(projectId, dataType, `${table}:${sourceId}`),
    projectId: String(projectId),
    dataType,
    sourceTable: table,
    sourceId,
    code,
    title,
    status: String(firstValue(payload, ['复核状态', '归类状态', '状态']) || 'active'),
    tags: [...new Set(tags)],
    references: [],
    source: 'colleague-sqlite',
    sourceAssetId: lineage.assetId || null,
    sourceAssetRevision: Number(lineage.assetRevision) || null,
    sourceContentHash: lineage.contentHash || null,
    schemaVersion: '2.0.0',
    payload
  };
}

export function rebuildImportedReferences(records) {
  const lookup = new Map();
  for (const record of records) {
    for (const key of [record.sourceId, record.code]) {
      if (key && !lookup.has(String(key))) lookup.set(String(key), record.id);
    }
  }
  for (const record of records) {
    const references = Array.isArray(record.references) ? record.references : [];
    for (const [key, value] of Object.entries(record.payload || {})) {
      if (!value || !/(编码|编号|ID|Id|id)$/.test(key)) continue;
      const targetId = lookup.get(String(value));
      if (
        targetId
        && targetId !== record.id
        && !references.some((reference) => reference.targetId === targetId)
      ) {
        references.push({ targetId, relation: key });
      }
    }
    record.references = references;
  }
  return records;
}

export function retargetProjectDataRecords(records, projectId, lineage = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const idMap = new Map();
  const normalized = sourceRecords.map((item, index) => {
    const dataType = TYPE_LABELS[item?.dataType] ? item.dataType : 'other';
    const sourceId = String(item?.sourceId || item?.code || item?.id || index);
    const id = String(item?.projectId) === String(projectId) && item?.id
      ? String(item.id)
      : makeProjectDataId(projectId, dataType, `${item?.sourceTable || ''}:${sourceId}`);
    if (item?.id) idMap.set(String(item.id), id);
    return {
      ...item,
      id,
      projectId: String(projectId),
      dataType,
      sourceId,
      source: item?.source || 'portable-import',
      ...(lineage.assetId ? {
        sourceAssetId: lineage.assetId,
        sourceAssetRevision: Number(lineage.assetRevision) || null,
        sourceContentHash: lineage.contentHash || null
      } : {}),
      references: Array.isArray(item?.references) ? item.references : [],
      payload: item?.payload && typeof item.payload === 'object' ? item.payload : {}
    };
  });
  for (const record of normalized) {
    record.references = record.references
      .filter((reference) => reference?.targetId)
      .map((reference) => ({
        ...reference,
        targetId: idMap.get(String(reference.targetId)) || String(reference.targetId)
      }));
  }
  return rebuildImportedReferences(normalized);
}

function parseJsonColumn(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function convertProjectDataIndexRows(rows, projectId, lineage = {}) {
  const idMap = new Map();
  const records = rows.map((row, index) => {
    const sourceProjectId = String(row.project_id || '');
    const dataType = TYPE_LABELS[row.data_type] ? row.data_type : 'other';
    const sourceId = String(row.source_id || row.code || row.id || `project-data-index-${index}`);
    const id = sourceProjectId === String(projectId) && row.id
      ? String(row.id)
      : makeProjectDataId(projectId, dataType, `${row.source_table || ''}:${sourceId}`);
    if (row.id) idMap.set(String(row.id), id);
    const importedTags = parseJsonColumn(row.tags_json, []);
    return {
      id,
      projectId: String(projectId),
      dataType,
      sourceTable: String(row.source_table || ''),
      sourceId,
      code: String(row.code || ''),
      title: String(row.title || sourceId),
      status: String(row.status || 'active'),
      tags: [
        ...new Set([
          ...(Array.isArray(importedTags) ? importedTags : []),
          'SQLite导入',
          'ProjectData交换'
        ].map(String).filter(Boolean))
      ],
      references: parseJsonColumn(row.references_json, []),
      source: 'portable-sqlite',
      sourceAssetId: lineage.assetId || null,
      sourceAssetRevision: Number(lineage.assetRevision) || null,
      sourceContentHash: lineage.contentHash || null,
      schemaVersion: '2.0.0',
      payload: parseJsonColumn(row.payload_json, {}),
      createdAt: row.created_at || undefined,
      updatedAt: row.updated_at || undefined
    };
  });
  for (const record of records) {
    record.references = (Array.isArray(record.references) ? record.references : [])
      .filter((reference) => reference?.targetId)
      .map((reference) => ({
        ...reference,
        targetId: idMap.get(String(reference.targetId)) || String(reference.targetId)
      }));
  }
  return rebuildImportedReferences(records);
}

export function convertSqliteTables(tables, projectId, lineage = {}) {
  const records = [];
  const tableStats = {};
  for (const table of Object.keys(SQLITE_TYPE_MAP)) {
    const rows = Array.isArray(tables?.[table]) ? tables[table] : [];
    if (!rows.length) continue;
    if (records.length + rows.length > MAX_SQLITE_RECORDS) {
      throw sqliteError(
        `SQLite记录超过${MAX_SQLITE_RECORDS}条限制。`,
        413,
        'PROJECT_DATA_SQLITE_TOO_LARGE',
        { maxRecords: MAX_SQLITE_RECORDS }
      );
    }
    tableStats[table] = rows.length;
    rows.forEach((row, index) => {
      records.push(sqliteRowToProjectData(table, row, index, projectId, lineage));
    });
  }
  return {
    records: rebuildImportedReferences(records),
    tableStats,
    recognizedTables: Object.keys(tableStats)
  };
}

async function sqliteModule() {
  try {
    return await import('node:sqlite');
  } catch {
    throw sqliteError(
      '当前Node.js运行时不支持服务端SQLite转换，需要Node.js 22.13或更高版本。',
      501,
      'SQLITE_RUNTIME_UNAVAILABLE'
    );
  }
}

export async function parseSqliteContent(content, projectId, lineage = {}) {
  if (!Buffer.isBuffer(content) || !content.length) {
    throw sqliteError('SQLite文件内容为空。', 422, 'PROJECT_DATA_SQLITE_EMPTY');
  }
  const { DatabaseSync } = await sqliteModule();
  let database;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'urban-health-sqlite-import-'));
  const filename = path.join(directory, 'source.sqlite');
  try {
    await writeFile(filename, content);
    database = new DatabaseSync(filename, { readOnly: true });
    const available = database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all().map((row) => String(row.name));
    if (available.includes('project_data_index')) {
      const rows = database.prepare('SELECT * FROM "project_data_index"').all();
      if (rows.length > MAX_SQLITE_RECORDS) {
        throw sqliteError(
          `SQLite记录超过${MAX_SQLITE_RECORDS}条限制。`,
          413,
          'PROJECT_DATA_SQLITE_TOO_LARGE',
          { maxRecords: MAX_SQLITE_RECORDS }
        );
      }
      return {
        records: convertProjectDataIndexRows(rows, projectId, lineage),
        tableStats: { project_data_index: rows.length },
        recognizedTables: ['project_data_index'],
        availableTables: available
      };
    }
    const tables = {};
    for (const table of Object.keys(SQLITE_TYPE_MAP).filter((name) => available.includes(name))) {
      const safeTable = table.replace(/"/g, '""');
      tables[table] = database.prepare(`SELECT * FROM "${safeTable}"`).all();
    }
    const converted = convertSqliteTables(tables, projectId, lineage);
    return {
      ...converted,
      availableTables: available
    };
  } catch (error) {
    if (error.code?.startsWith('PROJECT_DATA_') || error.code === 'SQLITE_RUNTIME_UNAVAILABLE') {
      throw error;
    }
    throw sqliteError(
      'SQLite文件无法解析或结构不受支持。',
      422,
      'PROJECT_DATA_SQLITE_PARSE_FAILED',
      { cause: error.message }
    );
  } finally {
    database?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

export async function importProjectDataSqlite(
  adapter,
  assetRepository,
  importRepository,
  projectId,
  input,
  options = {}
) {
  const assetId = clean(input?.assetId, 180);
  const importedBy = clean(input?.importedBy, 120);
  const clientRequestId = clean(input?.clientRequestId, 160);
  const mode = input?.mode === 'replace' ? 'replace' : 'append';
  if (!assetId) throw sqliteError('请选择SQLite资料资产。', 400, 'SOURCE_ASSET_REQUIRED');
  if (!importedBy) throw sqliteError('请记录SQLite导入人员。', 400, 'SOURCE_ASSET_IMPORTER_REQUIRED');
  if (!clientRequestId) throw sqliteError('缺少SQLite导入幂等编号。', 400, 'CLIENT_REQUEST_ID_REQUIRED');
  const existing = await importRepository.findByClientRequest(String(projectId), clientRequestId);
  if (existing) return { run: existing, duplicated: true };

  const asset = await assetRepository.get(assetId);
  if (!asset || String(asset.projectId) !== String(projectId)) {
    throw sqliteError('SQLite资料不存在或不属于当前项目。', 404, 'SOURCE_ASSET_NOT_FOUND');
  }
  if (asset.status !== 'active' || asset.uploadStatus !== 'completed') {
    throw sqliteError('只有使用中且上传完成的SQLite资料可以导入。', 409, 'SOURCE_ASSET_NOT_ACTIVE');
  }
  if (!SQLITE_MIME_TYPES.has(asset.mimeType)) {
    throw sqliteError('所选资料不是受支持的SQLite文件。', 415, 'PROJECT_DATA_SQLITE_MIME_UNSUPPORTED');
  }
  const content = await assetRepository.readContent(asset.id);
  if (!content) throw sqliteError('SQLite资料二进制不存在。', 404, 'SOURCE_ASSET_CONTENT_NOT_FOUND');
  const converted = await parseSqliteContent(content, projectId, {
    assetId: asset.id,
    assetRevision: asset.assetRevision,
    contentHash: asset.contentHash
  });
  if (!converted.records.length) {
    throw sqliteError(
      'SQLite文件中没有识别到可导入的业务表。',
      422,
      'PROJECT_DATA_SQLITE_NO_RECOGNIZED_TABLES',
      { availableTables: converted.availableTables }
    );
  }
  const imported = await adapter.importRecords(projectId, converted.records, { mode });
  const rebuilt = await adapter.rebuild(projectId);
  const completedAt = options.now || new Date().toISOString();
  const run = {
    id: options.id || `ASSETIMP-${randomUUID()}`,
    clientRequestId,
    projectId: String(projectId),
    assetId: asset.id,
    assetName: asset.name,
    sourceContentHash: asset.contentHash,
    sourceAssetRevision: Number(asset.assetRevision) || 1,
    target: 'projectData',
    format: 'sqlite',
    mode,
    status: 'completed',
    importedCount: converted.records.length,
    recognizedTables: converted.recognizedTables,
    tableStats: converted.tableStats,
    importedBy,
    completedAt,
    upstream: {
      imported,
      rebuilt
    },
    schemaVersion: '1.0.0'
  };
  await importRepository.put(run);
  return { run, duplicated: false };
}

function stringifyPortable(value) {
  return JSON.stringify(value, (_key, item) => portableValue(item));
}

export async function buildProjectDataSqlite(envelope) {
  const { DatabaseSync } = await sqliteModule();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'urban-health-project-data-'));
  const filename = path.join(directory, 'project-data.sqlite');
  let database;
  try {
    database = new DatabaseSync(filename);
    database.exec(`
      CREATE TABLE project_data_meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
      CREATE TABLE project_data_index (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        data_type TEXT NOT NULL,
        source_table TEXT,
        source_id TEXT,
        code TEXT,
        title TEXT,
        status TEXT,
        tags_json TEXT,
        references_json TEXT,
        payload_json TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      BEGIN;
    `);
    const meta = database.prepare('INSERT INTO project_data_meta (key, value_json) VALUES (?, ?)');
    for (const [key, value] of [
      ['format', envelope?.format || 'smart-renew-project-data'],
      ['schema_version', envelope?.schemaVersion || '2.0.0'],
      ['exported_at', envelope?.exportedAt || new Date().toISOString()],
      ['project', envelope?.project || null]
    ]) {
      meta.run(key, stringifyPortable(value));
    }
    const insert = database.prepare(`
      INSERT INTO project_data_index (
        id, project_id, data_type, source_table, source_id, code, title, status,
        tags_json, references_json, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of Array.isArray(envelope?.records) ? envelope.records : []) {
      insert.run(
        String(item.id),
        String(item.projectId),
        item.dataType || 'other',
        item.sourceTable || '',
        item.sourceId || '',
        item.code || '',
        item.title || '',
        item.status || '',
        stringifyPortable(item.tags || []),
        stringifyPortable(item.references || []),
        stringifyPortable(item.payload || {}),
        item.createdAt || '',
        item.updatedAt || ''
      );
    }
    database.exec('COMMIT;');
    database.close();
    database = null;
    return await readFile(filename);
  } catch (error) {
    try {
      database?.exec('ROLLBACK;');
    } catch {}
    if (error.code === 'SQLITE_RUNTIME_UNAVAILABLE') throw error;
    throw sqliteError(
      'ProjectData SQLite导出失败。',
      500,
      'PROJECT_DATA_SQLITE_EXPORT_FAILED',
      { cause: error.message }
    );
  } finally {
    database?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

export { MAX_SQLITE_RECORDS, SQLITE_MIME_TYPES };
