import { CloudBaseStorageProvider } from './storage-provider.mjs';

export const CLOUDBASE_COLLECTIONS = Object.freeze({
  projects: 'projects',
  analyses: 'analysisRecords',
  projectData: 'projectDataRecords',
  fieldTasks: 'fieldCollectionTasks',
  photos: 'photoRecords',
  officialIssues: 'officialIssues',
  reports: 'reportSnapshots',
  sourceAssets: 'sourceAssets',
  reviewSessions: 'reviewSessions',
  uploadSessions: 'uploadSessions',
  coordinateTransforms: 'coordinateTransforms',
  surveyRoutes: 'surveyRoutes',
  surveyStops: 'surveyStops',
  photoRouteBindings: 'photoRouteBindings',
  mapSnapshots: 'mapSnapshots',
  boundaryRevisions: 'boundaryRevisions',
  spatialAnalyses: 'spatialAnalyses'
});

function cloudBaseError(message, code = 'CLOUDBASE_PROVIDER_ERROR', status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function itemFromGet(payload) {
  if (Array.isArray(payload?.data)) return payload.data[0] || null;
  if (payload && Object.hasOwn(payload, 'data')) return payload.data ?? null;
  return payload || null;
}

export class CloudBaseRepositoryProvider {
  constructor(app, collections = CLOUDBASE_COLLECTIONS) {
    if (!app?.database) throw cloudBaseError('CloudBase数据库实例不可用。', 'CLOUDBASE_DATABASE_REQUIRED');
    this.app = app;
    this.database = app.database();
    this.collections = { ...collections };
    this.kind = 'cloudbase-database';
  }

  collection(entity) {
    const name = this.collections[entity];
    if (!name) throw cloudBaseError(`未配置${entity}对应的CloudBase Collection。`, 'CLOUDBASE_COLLECTION_NOT_CONFIGURED');
    return this.database.collection(name);
  }

  async get(entity, id) {
    return itemFromGet(await this.collection(entity).doc(String(id)).get());
  }

  async put(entity, record) {
    if (!record?.id) throw cloudBaseError('CloudBase记录缺少id。', 'CLOUDBASE_RECORD_ID_REQUIRED', 400);
    await this.collection(entity).doc(String(record.id)).set({ data: record });
    return record;
  }

  async list(entity, query = {}) {
    let collection = this.collection(entity);
    if (Object.keys(query).length) collection = collection.where(query);
    const payload = await collection.get();
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async remove(entity, id) {
    await this.collection(entity).doc(String(id)).remove();
    return { id: String(id), removed: true };
  }
}

export function cloudBaseProviderCapability(env = process.env) {
  const selected = String(env.URBAN_HEALTH_PROVIDER || 'local').toLowerCase();
  const environmentId = String(env.TCB_ENV || env.SCF_NAMESPACE || '').trim();
  const configured = Boolean(environmentId);
  return {
    selected,
    local: {
      ready: true,
      database: 'business-json',
      storage: 'smart-renew-filesystem'
    },
    cloudbase: {
      ready: false,
      configured,
      environmentId: configured ? environmentId : null,
      collections: { ...CLOUDBASE_COLLECTIONS },
      reason: configured
        ? 'cloudbase_runtime_not_probed'
        : 'cloudbase_environment_not_configured',
      productionVerified: false
    }
  };
}

export function createCloudBaseProviders(cloudbase, env = process.env) {
  const environmentId = String(env.TCB_ENV || env.SCF_NAMESPACE || '').trim();
  if (!environmentId) {
    throw cloudBaseError('请配置TCB_ENV或SCF_NAMESPACE。', 'CLOUDBASE_ENV_REQUIRED', 503);
  }
  if (!cloudbase?.init) {
    throw cloudBaseError('CloudBase SDK不可用。', 'CLOUDBASE_SDK_UNAVAILABLE', 503);
  }
  const app = cloudbase.init({ env: environmentId });
  return {
    app,
    repositories: new CloudBaseRepositoryProvider(app),
    storage: new CloudBaseStorageProvider(app)
  };
}
