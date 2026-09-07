import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStandardRecord,
  findRemediation,
  findStandardRecord,
  getProblemTypeBinding,
  loadStandardLibrary,
  queryStandardLibrary,
  standardLibraryVersion,
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

test('problem type binding derives indicator and remediation from one library version', async () => {
  const library = await loadStandardLibrary();
  const binding = getProblemTypeBinding(library, 'PRB-01-01');
  assert.equal(binding.problemType.code, 'PRB-01-01');
  assert.equal(binding.indicator.code, 'IND-HOUSE-001');
  assert.ok(binding.remediations.length >= 1);
  assert.equal(binding.remediations[0].problemCode, 'PRB-01-01');
  assert.equal(binding.standardLibraryVersion, standardLibraryVersion(library));
  assert.equal(findRemediation(binding, binding.remediations[0].id).text.length > 0, true);
});
