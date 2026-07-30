import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function providerError(message, code = 'SQLITE_PROVIDER_ERROR', status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function cleanEntity(value) {
  const entity = String(value || '');
  if (!/^[A-Za-z][A-Za-z0-9]{1,79}$/.test(entity)) {
    throw providerError('数据库实体名称无效。', 'SQLITE_ENTITY_INVALID', 400);
  }
  return entity;
}

function cleanId(value) {
  const id = String(value || '');
  if (!id || id.length > 200) {
    throw providerError('数据库记录编号无效。', 'SQLITE_RECORD_ID_INVALID', 400);
  }
  return id;
}

function parseRecord(row) {
  return row?.payload ? JSON.parse(row.payload) : null;
}

export class SqliteRepositoryProvider {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.database = new DatabaseSync(this.filePath);
    this.kind = 'sqlite-database';
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS business_records (
        entity TEXT NOT NULL,
        id TEXT NOT NULL,
        project_id TEXT,
        status TEXT,
        report_id TEXT,
        route_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        payload TEXT NOT NULL CHECK(json_valid(payload)),
        PRIMARY KEY(entity, id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_business_records_project
        ON business_records(entity, project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_business_records_status
        ON business_records(entity, project_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_business_records_report
        ON business_records(entity, report_id);
      CREATE INDEX IF NOT EXISTS idx_business_records_route
        ON business_records(entity, route_id, created_at DESC);
    `);
    this.getStatement = this.database.prepare(
      'SELECT payload FROM business_records WHERE entity = ? AND id = ?'
    );
    this.putStatement = this.database.prepare(`
      INSERT INTO business_records(
        entity, id, project_id, status, report_id, route_id, created_at, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity, id) DO UPDATE SET
        project_id = excluded.project_id,
        status = excluded.status,
        report_id = excluded.report_id,
        route_id = excluded.route_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `);
    this.removeStatement = this.database.prepare(
      'DELETE FROM business_records WHERE entity = ? AND id = ?'
    );
  }

  async get(entity, id) {
    return parseRecord(this.getStatement.get(cleanEntity(entity), cleanId(id)));
  }

  async put(entity, record) {
    const safeEntity = cleanEntity(entity);
    const id = cleanId(record?.id);
    const payload = JSON.stringify(record);
    this.putStatement.run(
      safeEntity,
      id,
      record.projectId == null ? null : String(record.projectId),
      record.status == null ? null : String(record.status),
      record.reportId == null ? null : String(record.reportId),
      record.routeId == null ? null : String(record.routeId),
      record.createdAt == null ? null : String(record.createdAt),
      record.updatedAt == null ? null : String(record.updatedAt),
      payload
    );
    return record;
  }

  async list(entity, query = {}) {
    const safeEntity = cleanEntity(entity);
    const clauses = ['entity = ?'];
    const values = [safeEntity];
    const indexed = {
      projectId: 'project_id',
      status: 'status',
      reportId: 'report_id',
      routeId: 'route_id'
    };
    for (const [field, column] of Object.entries(indexed)) {
      if (query[field] == null || query[field] === '') continue;
      clauses.push(`${column} = ?`);
      values.push(String(query[field]));
    }
    const rows = this.database.prepare(
      `SELECT payload FROM business_records WHERE ${clauses.join(' AND ')}
       ORDER BY COALESCE(updated_at, created_at, '') DESC, id ASC`
    ).all(...values);
    const remaining = Object.entries(query).filter(([field]) => !(field in indexed));
    return rows.map(parseRecord).filter((record) =>
      remaining.every(([field, expected]) => String(record?.[field] ?? '') === String(expected))
    );
  }

  async remove(entity, id) {
    const result = this.removeStatement.run(cleanEntity(entity), cleanId(id));
    return { id: String(id), removed: Number(result.changes) > 0 };
  }

  async transaction(work) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const outcome = await work(this);
      this.database.exec('COMMIT');
      return outcome;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

export function sqliteProviderCapability(provider) {
  return {
    selected: Boolean(provider),
    kind: provider?.kind || 'not-selected',
    configured: Boolean(provider?.filePath),
    transactionMode: provider ? 'BEGIN IMMEDIATE' : null,
    wal: Boolean(provider),
    productionVerified: false
  };
}
