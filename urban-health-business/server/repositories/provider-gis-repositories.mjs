function bounded(items, options = {}) {
  const offset = Math.max(0, Number(options.offset) || 0);
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  return items.slice(offset, offset + limit);
}

class ProviderEntityRepository {
  constructor(provider, entity, sortField = 'createdAt') {
    this.provider = provider;
    this.entity = entity;
    this.sortField = sortField;
  }

  async put(record) {
    return this.provider.put(this.entity, record);
  }

  async get(id) {
    return this.provider.get(this.entity, String(id));
  }

  async records(query = {}) {
    const items = await this.provider.list(this.entity, query);
    return items.sort((a, b) =>
      String(b[this.sortField] || '').localeCompare(String(a[this.sortField] || ''))
    );
  }

  async recordsInBounds(bounds, query = {}) {
    if (typeof this.provider.listInBounds !== 'function') return this.records(query);
    const items = await this.provider.listInBounds(this.entity, bounds, query);
    return items.sort((a, b) =>
      String(b[this.sortField] || '').localeCompare(String(a[this.sortField] || ''))
    );
  }

  async transaction(work) {
    if (typeof this.provider.transaction === 'function') {
      return this.provider.transaction(() => work(this));
    }
    return work(this);
  }

  async putMany(records) {
    return this.transaction(async (repository) => {
      const saved = [];
      for (const record of records) saved.push(await repository.put(record));
      return saved;
    });
  }
}

export class ProviderCoordinateTransformRepository extends ProviderEntityRepository {
  constructor(provider) {
    super(provider, 'coordinateTransforms');
  }

  async list(projectId = '') {
    return this.records(projectId ? { projectId: String(projectId) } : {});
  }
}

export class ProviderSpatialAnalysisRepository extends ProviderEntityRepository {
  constructor(provider) {
    super(provider, 'spatialAnalyses', 'completedAt');
  }

  async list(projectId = '', options = {}) {
    const query = projectId ? { projectId: String(projectId) } : {};
    return options.bounds
      ? this.recordsInBounds(options.bounds, query)
      : this.records(query);
  }

  async listInBounds(projectId, bounds) {
    return this.list(projectId, { bounds });
  }
}

export class ProviderSurveyRouteRepository extends ProviderEntityRepository {
  constructor(provider) {
    super(provider, 'surveyRoutes', 'updatedAt');
  }

  async list(projectId = '', options = {}) {
    const query = {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(options.status ? { status: String(options.status) } : {})
    };
    const items = options.bounds
      ? await this.recordsInBounds(options.bounds, query)
      : await this.records(query);
    return bounded(items, options);
  }

  async listInBounds(projectId, bounds, options = {}) {
    return this.list(projectId, { ...options, bounds });
  }
}

export class ProviderSurveyStopRepository extends ProviderEntityRepository {
  constructor(provider) {
    super(provider, 'surveyStops', 'createdAt');
  }

  async list(projectId = '', routeId = '', options = {}) {
    const query = {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(routeId ? { routeId: String(routeId) } : {}),
      ...(options.status ? { status: String(options.status) } : {})
    };
    const items = options.bounds
      ? await this.recordsInBounds(options.bounds, query)
      : await this.records(query);
    return bounded(items, options);
  }

  async listInBounds(projectId, bounds, options = {}) {
    return this.list(projectId, '', { ...options, bounds });
  }
}

export class ProviderPhotoRouteBindingRepository extends ProviderEntityRepository {
  constructor(provider) {
    super(provider, 'photoRouteBindings', 'createdAt');
  }

  async list(projectId = '', routeId = '', options = {}) {
    const query = {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(routeId ? { routeId: String(routeId) } : {}),
      ...(options.status ? { status: String(options.status) } : {})
    };
    return bounded(await this.records(query), options);
  }
}

export class ProviderBoundaryRevisionRepository extends ProviderEntityRepository {
  constructor(provider) {
    super(provider, 'boundaryRevisions', 'createdAt');
  }

  async putFromProject(project) {
    const revision = Math.max(1, Number(project?.revision) || 1);
    const coordinates = Array.isArray(project?.scopeBoundary) ? project.scopeBoundary : [];
    return this.put({
      id: `BNDREV-${project.id}-${revision}`,
      projectId: String(project.id),
      projectRevision: revision,
      coordinates,
      geometry: project.scopeBoundaryGeometry || (
        coordinates.length >= 3
          ? { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] }
          : null
      ),
      crs: project.scopeBoundaryCrs || 'WGS84',
      source: project.scopeBoundarySource || null,
      sourceAssetId: project.scopeBoundarySourceAssetId || null,
      sourceAssetContentHash: project.scopeBoundarySourceAssetContentHash || null,
      areaSqKm: Number(project.scopeAreaSqKm) || 0,
      center: Array.isArray(project.scopeCenter) ? project.scopeCenter : null,
      bounds: Array.isArray(project.scopeBounds) ? project.scopeBounds : null,
      polygonCount: Number(project.scopePolygonCount) || 1,
      holeCount: Number(project.scopeHoleCount) || 0,
      updatedBy: project.boundaryUpdatedBy || '',
      createdAt: project.boundaryUpdatedAt || project.updatedAt || new Date().toISOString(),
      schemaVersion: '1.1.0'
    });
  }

  async list(projectId = '') {
    const items = await this.records(projectId ? { projectId: String(projectId) } : {});
    return items.sort((a, b) => Number(b.projectRevision) - Number(a.projectRevision));
  }
}
