import { CloudBaseStorageProvider } from './storage-provider.mjs';
import { createRequire } from 'node:module';

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
  spatialAnalyses: 'spatialAnalyses',
  businessOfficialIssues: 'businessOfficialIssues',
  businessReports: 'businessReports',
  businessReviewSessions: 'businessReviewSessions',
  businessSpatialAnalyses: 'businessSpatialAnalyses',
  businessUploadSessions: 'businessUploadSessions',
  businessAnalysisJobs: 'businessAnalysisJobs',
  businessAnalysisCandidates: 'businessAnalysisCandidates',
  businessPhotoMetadata: 'businessPhotoMetadata',
  businessBoundaryRevisions: 'businessBoundaryRevisions',
  businessCollectionValidations: 'businessCollectionValidations',
  businessSourceAssets: 'businessSourceAssets',
  businessSourceAssetImports: 'businessSourceAssetImports',
  businessFieldTaskReferences: 'businessFieldTaskReferences',
  businessMigrationRuns: 'businessMigrationRuns',
  businessResidentialDiscoveryRuns: 'businessResidentialDiscoveryRuns',
  businessAiConfigurations: 'businessAiConfigurations',
  businessCoordinateTransforms: 'businessCoordinateTransforms',
  businessSurveyRoutes: 'businessSurveyRoutes',
  businessSurveyStops: 'businessSurveyStops',
  businessPhotoRouteBindings: 'businessPhotoRouteBindings',
  businessMapSnapshots: 'businessMapSnapshots',
  businessProviderMigrationRuns: 'businessProviderMigrationRuns'
});

export const BUSINESS_PROVIDER_SCHEMA_VERSION = '1.0.0';
export const BUSINESS_PROVIDER_COLLECTION_SPECS = Object.freeze([
  ['businessOfficialIssues', 'projectId,status,issueRevision'],
  ['businessReports', 'projectId,version,status'],
  ['businessReviewSessions', 'projectId,archivedAt'],
  ['businessAnalysisJobs', 'projectId,status,createdAt'],
  ['businessAnalysisCandidates', 'projectId,analysisId,jobId'],
  ['businessSpatialAnalyses', 'projectId,status,completedAt'],
  ['businessUploadSessions', 'projectId,status,clientRequestId'],
  ['businessPhotoMetadata', 'projectId,photoId,metadataRevision'],
  ['businessBoundaryRevisions', 'projectId,revision'],
  ['businessCollectionValidations', 'projectId,createdAt'],
  ['businessSourceAssets', 'projectId,status,contentHash'],
  ['businessSourceAssetImports', 'projectId,assetId,clientRequestId'],
  ['businessFieldTaskReferences', 'projectId,taskId'],
  ['businessMigrationRuns', 'projectId,clientRequestId'],
  ['businessProviderMigrationRuns', 'clientRequestId,status'],
  ['businessResidentialDiscoveryRuns', 'projectId,createdAt'],
  ['businessAiConfigurations', 'userId,revision'],
  ['businessCoordinateTransforms', 'projectId,sourceObjectId'],
  ['businessSurveyRoutes', 'projectId,status,updatedAt'],
  ['businessSurveyStops', 'projectId,routeId,status'],
  ['businessPhotoRouteBindings', 'projectId,routeId,status'],
  ['businessMapSnapshots', 'projectId,reportId,status']
].map(([collection, indexes]) => ({
  collection,
  indexes: indexes.split(','),
  schemaVersion: BUSINESS_PROVIDER_SCHEMA_VERSION,
  uniqueKey: 'id'
})));

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

  async atomicMutate(entity, id, mutate) {
    if (typeof this.database.runTransaction !== 'function') {
      throw cloudBaseError(
        '当前CloudBase数据库不支持事务，无法安全执行原子状态变更。',
        'CLOUDBASE_TRANSACTION_UNAVAILABLE',
        503
      );
    }
    let outcome = null;
    const collectionName = this.collections[entity];
    if (!collectionName) {
      throw cloudBaseError(`未配置${entity}对应的CloudBase Collection。`, 'CLOUDBASE_COLLECTION_NOT_CONFIGURED');
    }
    const transactionResult = await this.database.runTransaction(async (transaction) => {
      const document = transaction.collection(collectionName).doc(String(id));
      const current = itemFromGet(await document.get());
      const decision = await mutate(current);
      outcome = decision?.result ?? null;
      if (decision?.record) await document.set({ data: decision.record });
      return outcome;
    });
    return transactionResult?.result ?? outcome;
  }

  async list(entity, options = {}) {
    const input = options && typeof options === 'object' ? options : {};
    const query = { ...input };
    const requestedOffset = Math.max(0, Number(query.offset) || 0);
    const requestedLimit = query.limit == null ? null : Math.max(0, Number(query.limit) || 0);
    const maxItems = Math.max(1, Math.min(100000, Number(query.maxItems) || 100000));
    delete query.offset;
    delete query.limit;
    delete query.maxItems;
    let collection = this.collection(entity);
    if (Object.keys(query).length) collection = collection.where(query);

    const supportsPaging = typeof collection.skip === 'function' && typeof collection.limit === 'function';
    if (!supportsPaging) {
      const payload = await collection.get();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const end = requestedLimit == null
        ? Math.min(items.length, requestedOffset + maxItems)
        : Math.min(items.length, requestedOffset + requestedLimit);
      return items.slice(requestedOffset, end);
    }

    const pageSize = Math.min(100, requestedLimit == null ? 100 : Math.max(1, requestedLimit));
    const items = [];
    let offset = requestedOffset;
    while (items.length < maxItems) {
      const remaining = requestedLimit == null ? pageSize : requestedLimit - items.length;
      if (remaining <= 0) break;
      const page = collection.skip(offset).limit(Math.min(pageSize, remaining));
      const payload = await page.get();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      if (!rows.length) break;
      items.push(...rows);
      offset += rows.length;
      if (rows.length < Math.min(pageSize, remaining)) break;
    }
    return items.slice(0, requestedLimit == null ? maxItems : requestedLimit);
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
  const sdkModule = String(env.CLOUDBASE_SDK_MODULE || '@cloudbase/node-sdk').trim();
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
      sdkModule,
      collections: { ...CLOUDBASE_COLLECTIONS },
      reason: configured
        ? 'cloudbase_runtime_not_probed'
        : 'cloudbase_environment_not_configured',
      productionVerified: false
    }
  };
}

export function loadCloudBaseSdk(env = process.env) {
  const moduleName = String(env.CLOUDBASE_SDK_MODULE || '@cloudbase/node-sdk').trim();
  const require = createRequire(import.meta.url);
  try {
    const loaded = require(moduleName);
    return loaded?.default || loaded;
  } catch (error) {
    throw cloudBaseError(
      `CloudBase SDK不可用（${moduleName}）。请安装SDK或设置CLOUDBASE_SDK_MODULE。`,
      'CLOUDBASE_SDK_UNAVAILABLE',
      503
    );
  }
}

export function createCloudBaseProviders(cloudbase, env = process.env) {
  const environmentId = String(env.TCB_ENV || env.SCF_NAMESPACE || '').trim();
  if (!environmentId) {
    throw cloudBaseError('请配置TCB_ENV或SCF_NAMESPACE。', 'CLOUDBASE_ENV_REQUIRED', 503);
  }
  if (!cloudbase?.init) {
    throw cloudBaseError('CloudBase SDK不可用。', 'CLOUDBASE_SDK_UNAVAILABLE', 503);
  }
  let app;
  try {
    app = cloudbase.init({ env: environmentId });
  } catch (error) {
    throw cloudBaseError(
      `CloudBase运行时初始化失败：${error.message}`,
      'CLOUDBASE_INIT_FAILED',
      503
    );
  }
  return {
    app,
    repositories: new CloudBaseRepositoryProvider(app),
    storage: new CloudBaseStorageProvider(app, {
      healthObject: env.CLOUDBASE_HEALTH_OBJECT
    })
  };
}

export function cloudBaseRuntimeCapability(runtime, env = process.env) {
  const capability = cloudBaseProviderCapability(env);
  const ready = Boolean(runtime?.repositories && runtime?.storage);
  return {
    ...capability,
    cloudbase: {
      ...capability.cloudbase,
      ready,
      reason: ready ? null : capability.cloudbase.reason,
      repositoryKind: runtime?.repositories?.kind || null,
      storageKind: runtime?.storage?.kind || null,
      productionVerified: false
    }
  };
}
