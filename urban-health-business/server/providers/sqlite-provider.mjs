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

function numericBounds(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const bounds = value.map(Number);
  if (!bounds.every(Number.isFinite)) return null;
  if (bounds[0] > bounds[2] || bounds[1] > bounds[3]) return null;
  return bounds;
}

function flattenPositions(value, output = []) {
  if (!Array.isArray(value)) return output;
  if (
    value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
  ) {
    output.push([Number(value[0]), Number(value[1])]);
    return output;
  }
  for (const item of value) flattenPositions(item, output);
  return output;
}

function boundsFromPositions(positions) {
  if (!positions.length) return null;
  const longitude = positions.map((point) => point[0]);
  const latitude = positions.map((point) => point[1]);
  return [
    Math.min(...longitude),
    Math.min(...latitude),
    Math.max(...longitude),
    Math.max(...latitude)
  ];
}

export function recordSpatialBounds(record) {
  const explicit = numericBounds(record?.bounds || record?.scopeBounds);
  if (explicit) return explicit;
  const geometry = record?.geometry
    || record?.cleanedGeometry
    || record?.transformedGeometry
    || record?.sourceGeometry;
  const positions = flattenPositions(geometry?.coordinates);
  if (positions.length) return boundsFromPositions(positions);
  if (Array.isArray(record?.coordinates)) {
    const coordinatePositions = flattenPositions(record.coordinates);
    if (coordinatePositions.length) return boundsFromPositions(coordinatePositions);
  }
  const center = Array.isArray(record?.parameters?.center)
    ? record.parameters.center.slice(0, 2).map(Number)
    : null;
  const radiusMeters = Number(record?.parameters?.radiusMeters);
  if (center?.every(Number.isFinite) && Number.isFinite(radiusMeters) && radiusMeters >= 0) {
    const latitudeDelta = radiusMeters / 110540;
    const longitudeDelta = radiusMeters
      / (111320 * Math.max(Math.cos(center[1] * Math.PI / 180), 0.1));
    return [
      center[0] - longitudeDelta,
      center[1] - latitudeDelta,
      center[0] + longitudeDelta,
      center[1] + latitudeDelta
    ];
  }
  return null;
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
      CREATE VIRTUAL TABLE IF NOT EXISTS business_record_bounds USING rtree(
        record_rowid,
        min_lon,
        max_lon,
        min_lat,
        max_lat
      );
      CREATE TABLE IF NOT EXISTS provider_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
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
    this.rowIdStatement = this.database.prepare(
      'SELECT rowid FROM business_records WHERE entity = ? AND id = ?'
    );
    this.deleteBoundsStatement = this.database.prepare(
      'DELETE FROM business_record_bounds WHERE record_rowid = ?'
    );
    this.putBoundsStatement = this.database.prepare(`
      INSERT OR REPLACE INTO business_record_bounds(
        record_rowid, min_lon, max_lon, min_lat, max_lat
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.migrateSpatialIndex();
  }

  migrateSpatialIndex() {
    const migrationKey = 'spatial_rtree_v1';
    const migrated = this.database.prepare(
      'SELECT value FROM provider_metadata WHERE key = ?'
    ).get(migrationKey);
    if (migrated?.value === 'complete') return;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.exec('DELETE FROM business_record_bounds');
      const rows = this.database.prepare(
        'SELECT rowid, payload FROM business_records'
      ).all();
      for (const row of rows) {
        const bounds = recordSpatialBounds(parseRecord(row));
        if (bounds) {
          this.putBoundsStatement.run(
            row.rowid,
            bounds[0],
            bounds[2],
            bounds[1],
            bounds[3]
          );
        }
      }
      this.database.prepare(`
        INSERT INTO provider_metadata(key, value) VALUES (?, 'complete')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(migrationKey);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async get(entity, id) {
    return parseRecord(this.getStatement.get(cleanEntity(entity), cleanId(id)));
  }

  withSavepoint(name, work) {
    this.database.exec(`SAVEPOINT ${name}`);
    try {
      const outcome = work();
      this.database.exec(`RELEASE SAVEPOINT ${name}`);
      return outcome;
    } catch (error) {
      this.database.exec(`ROLLBACK TO SAVEPOINT ${name}`);
      this.database.exec(`RELEASE SAVEPOINT ${name}`);
      throw error;
    }
  }

  async put(entity, record) {
    const safeEntity = cleanEntity(entity);
    const id = cleanId(record?.id);
    const payload = JSON.stringify(record);
    this.withSavepoint('provider_record_put', () => {
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
      const rowId = this.rowIdStatement.get(safeEntity, id)?.rowid;
      if (rowId != null) {
        this.deleteBoundsStatement.run(rowId);
        const bounds = recordSpatialBounds(record);
        if (bounds) {
          this.putBoundsStatement.run(rowId, bounds[0], bounds[2], bounds[1], bounds[3]);
        }
      }
    });
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

  async listInBounds(entity, bounds, query = {}) {
    const safeEntity = cleanEntity(entity);
    const safeBounds = numericBounds(bounds);
    if (!safeBounds) {
      throw providerError('空间查询边界无效。', 'SQLITE_SPATIAL_BOUNDS_INVALID', 400);
    }
    const clauses = [
      'records.entity = ?',
      'spatial.max_lon >= ?',
      'spatial.min_lon <= ?',
      'spatial.max_lat >= ?',
      'spatial.min_lat <= ?'
    ];
    const values = [
      safeEntity,
      safeBounds[0],
      safeBounds[2],
      safeBounds[1],
      safeBounds[3]
    ];
    const indexed = {
      projectId: 'records.project_id',
      status: 'records.status',
      reportId: 'records.report_id',
      routeId: 'records.route_id'
    };
    for (const [field, column] of Object.entries(indexed)) {
      if (query[field] == null || query[field] === '') continue;
      clauses.push(`${column} = ?`);
      values.push(String(query[field]));
    }
    const rows = this.database.prepare(`
      SELECT records.payload
      FROM business_record_bounds AS spatial
      JOIN business_records AS records ON records.rowid = spatial.record_rowid
      WHERE ${clauses.join(' AND ')}
      ORDER BY COALESCE(records.updated_at, records.created_at, '') DESC, records.id ASC
    `).all(...values);
    const remaining = Object.entries(query).filter(([field]) => !(field in indexed));
    return rows.map(parseRecord).filter((record) =>
      remaining.every(([field, expected]) => String(record?.[field] ?? '') === String(expected))
    );
  }

  explainSpatialQuery(entity, bounds, query = {}) {
    const safeEntity = cleanEntity(entity);
    const safeBounds = numericBounds(bounds);
    if (!safeBounds) {
      throw providerError('空间查询边界无效。', 'SQLITE_SPATIAL_BOUNDS_INVALID', 400);
    }
    const clauses = [
      'records.entity = ?',
      'spatial.max_lon >= ?',
      'spatial.min_lon <= ?',
      'spatial.max_lat >= ?',
      'spatial.min_lat <= ?'
    ];
    const values = [
      safeEntity,
      safeBounds[0],
      safeBounds[2],
      safeBounds[1],
      safeBounds[3]
    ];
    if (query.projectId != null && query.projectId !== '') {
      clauses.push('records.project_id = ?');
      values.push(String(query.projectId));
    }
    return this.database.prepare(`
      EXPLAIN QUERY PLAN
      SELECT records.payload
      FROM business_record_bounds AS spatial
      JOIN business_records AS records ON records.rowid = spatial.record_rowid
      WHERE ${clauses.join(' AND ')}
    `).all(...values).map((row) => String(row.detail || ''));
  }

  spatialIndexStats() {
    const row = this.database.prepare(
      'SELECT COUNT(*) AS count FROM business_record_bounds'
    ).get();
    return {
      kind: 'sqlite-rtree',
      indexedRecordCount: Number(row?.count) || 0
    };
  }

  async remove(entity, id) {
    const safeEntity = cleanEntity(entity);
    const safeId = cleanId(id);
    const result = this.withSavepoint('provider_record_remove', () => {
      const rowId = this.rowIdStatement.get(safeEntity, safeId)?.rowid;
      if (rowId != null) this.deleteBoundsStatement.run(rowId);
      return this.removeStatement.run(safeEntity, safeId);
    });
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
    spatialIndex: provider ? provider.spatialIndexStats() : null,
    productionVerified: false
  };
}
