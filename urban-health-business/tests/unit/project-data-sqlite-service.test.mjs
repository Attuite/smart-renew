import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectDataSqlite,
  convertSqliteTables,
  importProjectDataSqlite,
  parseSqliteContent,
  retargetProjectDataRecords
} from '../../server/services/project-data-sqlite-service.mjs';

test('SQLite domain rows reuse the original table mapping and rebuild cross-row references', () => {
  const converted = convertSqliteTables({
    project: [{
      项目编号: 'PROJ-001',
      项目名称: '测试项目'
    }],
    issue: [{
      编号: 'ISS-001',
      标题: '外墙问题',
      项目编号: 'PROJ-001',
      严重等级: 'high'
    }]
  }, '1001', {
    assetId: 'ASSET-sqlite-source',
    assetRevision: 2,
    contentHash: 'abc123'
  });

  assert.deepEqual(converted.tableStats, { project: 1, issue: 1 });
  const issue = converted.records.find((item) => item.dataType === 'issue');
  const project = converted.records.find((item) => item.dataType === 'project');
  assert.equal(issue.sourceAssetId, 'ASSET-sqlite-source');
  assert.equal(issue.sourceAssetRevision, 2);
  assert.equal(issue.sourceContentHash, 'abc123');
  assert.ok(issue.references.some((reference) =>
    reference.targetId === project.id && reference.relation === '项目编号'
  ));
});

test('JSON Envelope records retarget IDs and references when imported into another project', () => {
  const records = retargetProjectDataRecords([{
    id: 'PDI-1001-project-OLD',
    projectId: '1001',
    dataType: 'project',
    sourceId: '1001',
    payload: {}
  }, {
    id: 'PDI-1001-issue-OLD',
    projectId: '1001',
    dataType: 'issue',
    sourceId: 'ISS-001',
    references: [{ targetId: 'PDI-1001-project-OLD', relation: '所属项目' }],
    payload: {}
  }], '2002');
  const project = records.find((item) => item.dataType === 'project');
  const issue = records.find((item) => item.dataType === 'issue');
  assert.ok(records.every((item) => item.projectId === '2002'));
  assert.notEqual(project.id, 'PDI-1001-project-OLD');
  assert.ok(issue.references.some((reference) => reference.targetId === project.id));
});

test('ProjectData SQLite export can be parsed and retargeted without losing references', async () => {
  const envelope = {
    format: 'smart-renew-project-data',
    schemaVersion: '2.0.0',
    exportedAt: '2026-07-26T00:00:00.000Z',
    project: { id: '1001', name: '源项目' },
    records: [{
      id: 'PDI-1001-project-ONE',
      projectId: '1001',
      dataType: 'project',
      sourceId: '1001',
      title: '源项目',
      tags: ['项目档案'],
      references: [],
      payload: { name: '源项目' }
    }, {
      id: 'PDI-1001-issue-TWO',
      projectId: '1001',
      dataType: 'issue',
      sourceId: 'ISS-001',
      title: '问题一',
      tags: ['问题实例'],
      references: [{ targetId: 'PDI-1001-project-ONE', relation: '所属项目' }],
      payload: { projectId: '1001' }
    }]
  };

  const content = await buildProjectDataSqlite(envelope);
  assert.ok(content.length > 100);
  const parsed = await parseSqliteContent(content, '2002', {
    assetId: 'ASSET-roundtrip',
    assetRevision: 1,
    contentHash: 'roundtrip-hash'
  });
  assert.deepEqual(parsed.recognizedTables, ['project_data_index']);
  assert.equal(parsed.records.length, 2);
  assert.ok(parsed.records.every((item) => item.projectId === '2002'));
  const project = parsed.records.find((item) => item.dataType === 'project');
  const issue = parsed.records.find((item) => item.dataType === 'issue');
  assert.ok(issue.references.some((reference) => reference.targetId === project.id));
  assert.equal(issue.sourceAssetId, 'ASSET-roundtrip');
});

test('SQLite SourceAsset import is audited, idempotent and rebuilds the upstream index', async () => {
  const content = await buildProjectDataSqlite({
    format: 'smart-renew-project-data',
    schemaVersion: '2.0.0',
    project: { id: '1001' },
    records: [{
      id: 'PDI-1001-other-ONE',
      projectId: '1001',
      dataType: 'other',
      sourceId: 'ROW-1',
      title: '导入行',
      tags: [],
      references: [],
      payload: { verified: true }
    }]
  });
  const runs = [];
  const repository = {
    async findByClientRequest(projectId, clientRequestId) {
      return runs.find((item) =>
        item.projectId === String(projectId) && item.clientRequestId === clientRequestId
      ) || null;
    },
    async put(run) {
      runs.push(run);
      return run;
    }
  };
  const calls = [];
  const adapter = {
    async importRecords(projectId, records, options) {
      calls.push({ type: 'import', projectId, records, options });
      return { imported: records.length };
    },
    async rebuild(projectId) {
      calls.push({ type: 'rebuild', projectId });
      return { stats: { total: 1 } };
    }
  };
  const assetRepository = {
    async get() {
      return {
        id: 'ASSET-sqlite-import',
        projectId: '1001',
        name: '交换库.sqlite',
        mimeType: 'application/vnd.sqlite3',
        status: 'active',
        uploadStatus: 'completed',
        contentHash: 'content-hash',
        assetRevision: 3
      };
    },
    async readContent() {
      return content;
    }
  };
  const input = {
    assetId: 'ASSET-sqlite-import',
    importedBy: '导入员',
    clientRequestId: 'sqlite-import-001',
    mode: 'append'
  };

  const first = await importProjectDataSqlite(
    adapter,
    assetRepository,
    repository,
    '1001',
    input,
    {
      id: 'ASSETIMP-sqlite-import',
      now: '2026-07-26T00:00:00.000Z'
    }
  );
  const second = await importProjectDataSqlite(
    adapter,
    assetRepository,
    repository,
    '1001',
    input
  );
  assert.equal(first.run.importedCount, 1);
  assert.equal(first.run.sourceAssetRevision, 3);
  assert.deepEqual(calls.map((item) => item.type), ['import', 'rebuild']);
  assert.equal(second.duplicated, true);
});
