const DATA_TYPE_LABELS = {
  project: '项目档案',
  scope: '项目范围',
  residentialUnit: '住宅台账',
  building: '楼栋档案',
  geoNode: '地理单元',
  photo: '照片',
  analysisRecord: '分析批次',
  issue: '问题实例',
  indicatorResult: '指标结果',
  report: '报告',
  dictionary: '标准字典',
  audit: '审计记录',
  other: '其他数据'
};

export function stableDataHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

export function makeProjectDataId(projectId, dataType, sourceKey) {
  const type = String(dataType || 'other').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'other';
  return `PDI-${String(projectId)}-${type}-${stableDataHash(sourceKey)}`;
}

export function normalizeProjectDataRecord(input, projectId) {
  const now = new Date().toISOString();
  const dataType = DATA_TYPE_LABELS[input?.dataType] ? input.dataType : 'other';
  const sourceId = String(input?.sourceId || input?.code || input?.id || now);
  const id = String(input?.id || makeProjectDataId(projectId, dataType, `${input?.sourceTable || ''}:${sourceId}`));
  const tags = Array.from(new Set([
    DATA_TYPE_LABELS[dataType],
    ...(Array.isArray(input?.tags) ? input.tags : [])
  ].map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 30);
  const references = (Array.isArray(input?.references) ? input.references : [])
    .filter((item) => item && item.targetId)
    .map((item) => ({ targetId: String(item.targetId), relation: String(item.relation || '关联') }))
    .slice(0, 50);
  return {
    ...input,
    id,
    projectId: String(projectId),
    dataType,
    dataTypeLabel: DATA_TYPE_LABELS[dataType],
    sourceId,
    code: String(input?.code || ''),
    title: String(input?.title || sourceId || DATA_TYPE_LABELS[dataType]),
    tags,
    references,
    status: String(input?.status || 'active'),
    source: String(input?.source || 'smart-renew'),
    schemaVersion: String(input?.schemaVersion || '2.0.0'),
    payload: input?.payload && typeof input.payload === 'object' ? input.payload : {},
    createdAt: input?.createdAt || now,
    updatedAt: now
  };
}

export function buildNativeProjectIndex(project, analysisRecords = []) {
  const projectId = String(project.id);
  const records = [];
  const add = (record) => records.push(normalizeProjectDataRecord(record, projectId));
  add({
    dataType: 'project',
    sourceId: projectId,
    code: `PROJ-${projectId}`,
    title: project.name || '未命名项目',
    tags: [project.type || '体检项目', project.status || '已建档'],
    payload: {
      name: project.name || '',
      area: project.area || '',
      type: project.type || '',
      scope: project.scope || '',
      description: project.desc || '',
      status: project.status || '',
      createdAt: project.createdAt || '',
      updatedAt: project.updatedAt || ''
    }
  });
  if (Array.isArray(project.scopeBoundary) && project.scopeBoundary.length >= 3) {
    add({
      dataType: 'scope',
      sourceId: `${projectId}-scope`,
      code: `SCOPE-${projectId}`,
      title: `${project.name || '项目'}地图范围`,
      tags: ['地图框选'],
      references: [{ targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }],
      payload: {
        boundary: project.scopeBoundary,
        areaSqKm: project.scopeAreaSqKm || 0,
        center: project.scopeCenter || null
      }
    });
  }
  const inventory = project.residentialInventory || {};
  const residentialItems = [
    ...(Array.isArray(inventory.items) ? inventory.items.map((item) => ({ ...item, deleted: false })) : []),
    ...(Array.isArray(inventory.deletedItems) ? inventory.deletedItems.map((item) => ({ ...item, deleted: true })) : [])
  ];
  residentialItems.forEach((item, index) => {
    const sourceId = String(item.id || `${item.name || 'community'}-${index}`);
    const communityDataId = makeProjectDataId(projectId, 'residentialUnit', `:${sourceId}`);
    const buildings = Array.isArray(item.buildings) ? item.buildings : [];
    const activeBuildings = buildings.filter((building) => building.status !== 'deleted');
    const buildingIds = activeBuildings.map((building, buildingIndex) => String(building.id || `${sourceId}-building-${buildingIndex}`));
    add({
      id: communityDataId,
      dataType: 'residentialUnit',
      sourceId,
      code: `RES-${stableDataHash(sourceId)}`,
      title: item.name || `住宅小区${index + 1}`,
      status: item.deleted ? 'deleted' : 'active',
      tags: [item.zone || '', item.deleted ? '回收站' : '有效台账', Array.isArray(item.members) ? '合并小区' : '独立小区'],
      references: [{ targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }],
      payload: {
        address: item.address || '',
        longitude: item.lng ?? null,
        latitude: item.lat ?? null,
        buildingCount: item.buildingCount ?? null,
        householdCount: item.householdCount ?? null,
        buildingDetailCount: activeBuildings.length,
        buildingIds,
        members: item.members || [],
        dataSource: item.dataSource || inventory.dataSource || '',
        deletedAt: item.deletedAt || ''
      }
    });
    buildings.forEach((building, buildingIndex) => {
      const buildingSourceId = String(building.id || `${sourceId}-building-${buildingIndex}`);
      add({
        dataType: 'building',
        sourceId: buildingSourceId,
        code: building.code || `BLD-${stableDataHash(buildingSourceId)}`,
        title: building.name || `未命名楼栋 ${buildingIndex + 1}`,
        status: building.status || 'active',
        tags: [item.name || '所属小区未命名', building.status === 'deleted' ? '已删除' : '楼栋档案'],
        references: [
          { targetId: communityDataId, relation: '所属小区' },
          { targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }
        ],
        payload: {
          communityId: sourceId,
          communityName: item.name || '',
          name: building.name || '',
          householdCount: building.householdCount ?? null,
          unitCount: building.unitCount ?? null,
          floorCount: building.floorCount ?? null,
          address: building.address || item.address || '',
          dataSource: building.source || 'manual',
          deletedAt: building.deletedAt || ''
        }
      });
    });
  });
  analysisRecords.forEach((analysis, analysisIndex) => {
    const analysisId = String(analysis.id || `${projectId}-${analysisIndex}`);
    const analysisDataId = makeProjectDataId(projectId, 'analysisRecord', `:${analysisId}`);
    const issues = Array.isArray(analysis.result?.issues) ? analysis.result.issues : [];
    const imageCount = analysis.imagesCount || analysis.imagesBase64?.length || analysis.annotatedImages?.length || 0;
    const analysisCommunityId = String(analysis.communityId || '');
    const analysisBuildingId = String(analysis.buildingId || '');
    const analysisReferences = [{ targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }];
    if (analysisCommunityId) analysisReferences.push({ targetId: makeProjectDataId(projectId, 'residentialUnit', `:${analysisCommunityId}`), relation: '所属小区' });
    if (analysisBuildingId) analysisReferences.push({ targetId: makeProjectDataId(projectId, 'building', `:${analysisBuildingId}`), relation: '所属楼栋' });
    add({
      id: analysisDataId,
      dataType: 'analysisRecord',
      sourceId: analysisId,
      code: `ANA-${analysisId}`,
      title: `住区分析批次 ${analysisIndex + 1}`,
      tags: ['AI分析', analysis.status || '已归档'],
      references: analysisReferences,
      payload: {
        timestamp: analysis.timestamp || '',
        archivedAt: analysis.archivedAt || '',
        imagesCount: imageCount,
        issueCount: issues.length,
        communityId: analysisCommunityId,
        buildingId: analysisBuildingId,
        model: analysis.model || ''
      }
    });
    for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
      const photoSourceId = `${analysisId}-image-${imageIndex + 1}`;
      const imageMeta = analysis.imageMeta?.[imageIndex] || {};
      const communityId = String(imageMeta.communityId || analysis.communityId || '');
      const buildingId = String(imageMeta.buildingId || analysis.buildingId || '');
      const photoReferences = [
        { targetId: analysisDataId, relation: '所属分析批次' },
        { targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }
      ];
      if (communityId) photoReferences.push({ targetId: makeProjectDataId(projectId, 'residentialUnit', `:${communityId}`), relation: '所属小区' });
      if (buildingId) photoReferences.push({ targetId: makeProjectDataId(projectId, 'building', `:${buildingId}`), relation: '所属楼栋' });
      add({
        dataType: 'photo',
        sourceId: photoSourceId,
        code: `PHOTO-${stableDataHash(photoSourceId)}`,
        title: `现场照片 ${imageIndex + 1}`,
        tags: ['现场照片', analysis.annotatedImages?.[imageIndex] ? '已标注' : '原始影像'],
        references: photoReferences,
        payload: {
          imageIndex: imageIndex + 1,
          communityId,
          buildingId,
          storage: 'analysis-record-embedded',
          hasOriginal: Boolean(analysis.imagesBase64?.[imageIndex]),
          hasAnnotated: Boolean(analysis.annotatedImages?.[imageIndex])
        }
      });
    }
    issues.forEach((issue, issueIndex) => {
      const issueId = String(issue.id || `${analysisId}-${issueIndex}`);
      const references = [
        { targetId: analysisDataId, relation: '来源分析批次' },
        { targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }
      ];
      const communityId = String(issue.communityId || analysis.communityId || '');
      const buildingId = String(issue.buildingId || analysis.buildingId || '');
      if (communityId) references.push({ targetId: makeProjectDataId(projectId, 'residentialUnit', `:${communityId}`), relation: '所属小区' });
      if (buildingId) references.push({ targetId: makeProjectDataId(projectId, 'building', `:${buildingId}`), relation: '所属楼栋' });
      if (Number(issue.imageIndex) > 0 && Number(issue.imageIndex) <= imageCount) {
        references.push({
          targetId: makeProjectDataId(projectId, 'photo', `:${analysisId}-image-${Number(issue.imageIndex)}`),
          relation: '对应照片'
        });
      }
      add({
        dataType: 'issue',
        sourceId: issueId,
        code: issue.problemCode || issue.categoryCode || `ISS-${stableDataHash(issueId)}`,
        title: issue.title || issue.desc || `问题 ${issueIndex + 1}`,
        status: issue.reviewStatus || 'pending',
        tags: [issue.categoryCode || '', issue.severity ? `${issue.severity}风险` : '', issue.reviewStatus || ''],
        references,
        payload: {
          description: issue.desc || '',
          severity: issue.severity || '',
          location: issue.location || '',
          suggestion: issue.suggestion || '',
          confidence: issue.confidence ?? null,
          bbox: issue.bbox || null,
          imageIndex: issue.imageIndex ?? null,
          categoryCode: issue.categoryCode || '',
          communityId,
          buildingId,
          reviewStatus: issue.reviewStatus || ''
        }
      });
    });
  });
  if (project.communityAnalysis) {
    add({
      dataType: 'indicatorResult',
      sourceId: `${projectId}-community-analysis`,
      code: `COMM-${projectId}`,
      title: project.communityAnalysis.dimensionLabel || '社区／街区分析',
      tags: ['空间分析', project.communityAnalysis.dimensionLabel || '社区维度'],
      references: [{ targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }],
      payload: project.communityAnalysis
    });
  }
  add({
    dataType: 'report',
    sourceId: `${projectId}-report`,
    code: `REPORT-${projectId}`,
    title: `${project.name || '项目'}体检报告`,
    status: project.reportStatus || 'pending',
    tags: ['体检报告', project.reportStatus === 'completed' ? '已完成' : '待完善'],
    references: [{ targetId: makeProjectDataId(projectId, 'project', `:${projectId}`), relation: '所属项目' }],
    payload: {
      reportStatus: project.reportStatus || 'pending',
      analysisCount: analysisRecords.length,
      communityAnalysisReady: Boolean(project.communityAnalysis)
    }
  });
  return records;
}

export function projectDataStats(records) {
  const byType = {};
  const tagSet = new Set();
  for (const record of records) {
    byType[record.dataType] = (byType[record.dataType] || 0) + 1;
    (record.tags || []).forEach((tag) => tagSet.add(tag));
  }
  return { total: records.length, byType, tags: tagSet.size };
}

export { DATA_TYPE_LABELS };
