import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STANDARD_LIBRARY_PATH = path.resolve(
  moduleRoot,
  '..',
  '..',
  '..',
  'assets',
  'data',
  'city-health-standard-library-v1.js'
);

const SCRIPT_PREFIX = 'window.CITY_HEALTH_STANDARD_LIBRARY=';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
let cachedLibrary = null;

function libraryError(message, code, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function parseLibraryScript(source) {
  const text = String(source || '').trim();
  if (!text.startsWith(SCRIPT_PREFIX)) {
    throw libraryError('标准库文件格式不受支持。', 'STANDARD_LIBRARY_FORMAT_INVALID');
  }
  const json = text.slice(SCRIPT_PREFIX.length).replace(/;\s*$/, '');
  let library;
  try {
    library = JSON.parse(json);
  } catch {
    throw libraryError('标准库JSON解析失败。', 'STANDARD_LIBRARY_JSON_INVALID');
  }
  if (!Array.isArray(library?.records)) {
    throw libraryError('标准库缺少records数组。', 'STANDARD_LIBRARY_RECORDS_INVALID');
  }
  return library;
}

export async function loadStandardLibrary(filePath = DEFAULT_STANDARD_LIBRARY_PATH) {
  if (filePath === DEFAULT_STANDARD_LIBRARY_PATH && cachedLibrary) return cachedLibrary;
  const library = parseLibraryScript(await readFile(filePath, 'utf8'));
  if (filePath === DEFAULT_STANDARD_LIBRARY_PATH) cachedLibrary = library;
  return library;
}

export function summarizeStandardLibrary(library) {
  const sourceTables = {};
  for (const record of library.records) {
    const key = String(record.sourceTable || 'unknown');
    sourceTables[key] = (sourceTables[key] || 0) + 1;
  }
  return {
    name: library.name,
    format: library.format,
    schemaVersion: library.schemaVersion,
    source: library.source,
    generatedAt: library.generatedAt,
    recordCount: library.records.length,
    sourceTables
  };
}

function dimensionOf(record) {
  return String(record?.payload?.['维度'] || '').trim();
}

function includesQuery(record, query) {
  if (!query) return true;
  return JSON.stringify({
    code: record.code,
    title: record.title,
    tags: record.tags,
    payload: record.payload
  }).toLowerCase().includes(query);
}

export function queryStandardLibrary(library, options = {}) {
  const sourceTable = String(options.sourceTable || options.type || '').trim();
  const dimension = String(options.dimension || '').trim();
  const query = String(options.q || '').trim().toLowerCase();
  const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(options.limit, 10) || DEFAULT_LIMIT));
  const filtered = library.records.filter((record) => (
    (!sourceTable || record.sourceTable === sourceTable)
    && (!dimension || dimensionOf(record) === dimension)
    && includesQuery(record, query)
  ));
  return {
    total: filtered.length,
    offset,
    limit,
    items: filtered.slice(offset, offset + limit)
  };
}

export function findStandardRecord(library, sourceTable, code) {
  const expected = String(code || '').trim();
  return library.records.find((record) => (
    record.sourceTable === sourceTable
    && [record.code, record.sourceId, record.payload?.['编码'], record.payload?.['问题编码']]
      .some((value) => String(value ?? '') === expected)
  )) || null;
}

export function assertStandardRecord(record, sourceTable, code) {
  if (record) return record;
  throw libraryError(
    `标准库中不存在${sourceTable}:${code}。`,
    'STANDARD_LIBRARY_RECORD_NOT_FOUND',
    404
  );
}
