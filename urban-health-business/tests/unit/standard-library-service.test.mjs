import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStandardRecord,
  findStandardRecord,
  loadStandardLibrary,
  queryStandardLibrary,
  summarizeStandardLibrary
} from '../../server/services/standard-library-service.mjs';

test('standard library loads the source asset without inventing records', async () => {
  const library = await loadStandardLibrary();
  const summary = summarizeStandardLibrary(library);
  assert.equal(summary.recordCount, 412);
  assert.equal(summary.sourceTables.indicator, 61);
  assert.equal(summary.sourceTables.problem_category, 35);
  assert.equal(summary.sourceTables.problem_type, 124);
  assert.equal(summary.sourceTables.remediation, 124);
});

test('standard library supports bounded filters and exact lookups', async () => {
  const library = await loadStandardLibrary();
  const indicators = queryStandardLibrary(library, {
    sourceTable: 'indicator',
    dimension: 'HOUSE',
    limit: 5
  });
  assert.equal(indicators.items.length, 5);
  assert.ok(indicators.total > 5);
  assert.ok(indicators.items.every((item) => item.payload['维度'] === 'HOUSE'));

  const record = findStandardRecord(library, 'indicator', 'IND-HOUSE-001');
  assert.equal(assertStandardRecord(record, 'indicator', 'IND-HOUSE-001').title, '存在结构安全隐患的住宅数量');
  assert.throws(
    () => assertStandardRecord(null, 'indicator', 'MISSING'),
    (error) => error.code === 'STANDARD_LIBRARY_RECORD_NOT_FOUND' && error.status === 404
  );
});
