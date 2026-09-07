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

export function standardLibraryVersion(library) {
  return [
    String(library?.name || 'standard-library'),
    String(library?.schemaVersion || 'unknown'),
    String(library?.generatedAt || 'unknown')
  ].join('@');
}

function isActiveRecord(record) {
  const payloadStatus = String(record?.payload?.['状态'] ?? '').trim().toLowerCase();
  return record?.status !== 'inactive'
    && record?.status !== 'disabled'
    && payloadStatus !== 'inactive'
    && payloadStatus !== 'disabled'
    && payloadStatus !== '停用';
}

function publicProblemType(record, indicator, version) {
  return {
    code: record.code || record.sourceId,
    name: record.title || record.payload?.['名称'] || record.code || record.sourceId,
    dimension: dimensionOf(record) || null,
    categoryCode: record.payload?.['问题大类'] || null,
    keywords: String(record.payload?.['关键词'] || '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean),
    description: record.payload?.['描述'] || '',
    indicatorCode: indicator?.code || indicator?.sourceId || null,
    indicatorName: indicator?.title || indicator?.payload?.['名称'] || null,
    standardLibraryVersion: version,
    sourceRecordId: record.sourceId || record.code
  };
}

function publicIndicator(record) {
  if (!record) return null;
  return {
    code: record.code || record.sourceId,
    name: record.title || record.payload?.['名称'] || record.code || record.sourceId,
    dimension: dimensionOf(record) || null,
    elementCode: record.payload?.['体检要素'] || null,
    unit: record.payload?.['单位'] || null,
    direction: record.payload?.['方向'] || null,
    sourceRecordId: record.sourceId || record.code
  };
}

function publicRemediation(record, problemCode, version, index = 0) {
  const number = record?.payload?.['编号'] ?? index + 1;
  return {
    id: `REM-${problemCode}-${number}`,
    problemCode,
    text: record?.payload?.['整治建议'] || '',
    type: record?.payload?.['建议类型'] || 'general',
    responsibleUnit: record?.payload?.['责任单位'] || '',
    standardLibraryVersion: version,
    sourceRecordId: record?.sourceId || String(number)
  };
}

export function getProblemTypeBinding(library, problemCode) {
  const expected = String(problemCode || '').trim();
  const problem = findStandardRecord(library, 'problem_type', expected);
  if (!problem || !isActiveRecord(problem)) {
    throw libraryError(
      `标准库中不存在或已停用问题类型:${expected}。`,
      'STANDARD_PROBLEM_TYPE_NOT_FOUND',
      404
    );
  }
  const version = standardLibraryVersion(library);
  const expectedIndicator = String(problem.payload?.['国标指标'] || '').trim();
  const indicatorRecord = expectedIndicator
    ? findStandardRecord(library, 'indicator', expectedIndicator)
    : null;
  if (expectedIndicator && !indicatorRecord) {
    throw libraryError(
      `问题类型${expected}引用的指标${expectedIndicator}不存在。`,
      'STANDARD_BINDING_INCONSISTENT',
      500
    );
  }
  const remediations = library.records
    .filter((record) => record.sourceTable === 'remediation'
      && String(record.payload?.['问题编码'] || '').trim() === expected
      && isActiveRecord(record))
    .map((record, index) => publicRemediation(record, expected, version, index));
  return {
    standardLibraryVersion: version,
    problemType: publicProblemType(problem, indicatorRecord, version),
    indicator: publicIndicator(indicatorRecord),
    remediations
  };
}

export function findRemediation(binding, remediationId) {
  const expected = String(remediationId || '').trim();
  if (!expected) return binding.remediations[0] || null;
  return binding.remediations.find((item) => item.id === expected) || null;
}
