/**
 * report-context-core.js
 * 构建标准化报告上下文。纯函数模块，不访问 DOM、不调用 LLM、不直接访问数据库。
 * 本地和 CloudBase 共享同一份核心逻辑。
 *
 * 上下文包含：项目信息、住宅台账、照片、分析批次、正式问题、社区/街区分析、
 * 缺失项检查、来源追踪和内容哈希。
 */

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
  }
  return String(obj);
}

function fvn32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

/**
 * 从项目对象中提取有效住宅小区（过滤软删除）
 */
function activeCommunities(project) {
  const items = project?.residentialInventory?.items;
  return Array.isArray(items) ? items.filter((item) => item?.status !== 'deleted') : [];
}

/**
 * 从小区中提取有效楼栋
 */
function activeBuildings(community) {
  const buildings = Array.isArray(community?.buildings) ? community.buildings : [];
  return buildings.filter((b) => b?.status !== 'deleted');
}

/**
 * 区分原始现场照片和标注图
 */
function classifyPhotos(photos) {
  const original = [];
  const annotated = [];
  for (const photo of photos) {
    if (photo?.status === 'deleted') continue;
    const name = String(photo?.name || '').toLowerCase();
    const desc = String(photo?.description || '').toLowerCase();
    if (name.includes('标注') || name.includes('annotated') || desc.includes('标注图') || desc.includes('标注')) {
      annotated.push(photo);
    } else {
      original.push(photo);
    }
  }
  return { original, annotated };
}

/**
 * 按小区和楼栋分组照片
 */
function groupPhotosByLocation(photos) {
  const byCommunity = {};
  const byBuilding = {};
  for (const photo of photos) {
    const cid = clean(photo?.communityId, 120);
    const bid = clean(photo?.buildingId, 120);
    if (cid) {
      if (!byCommunity[cid]) byCommunity[cid] = [];
      byCommunity[cid].push(photo);
    }
    if (bid) {
      if (!byBuilding[bid]) byBuilding[bid] = [];
      byBuilding[bid].push(photo);
    }
  }
  return { byCommunity, byBuilding };
}

/**
 * 标准化风险等级
 */
function normalizeSeverity(value) {
  const s = String(value || '').toLowerCase();
  if (s === 'high' || s === 'high-risk') return 'high';
  if (s === 'low' || s === 'low-risk') return 'low';
  return 'medium';
}

/**
 * 构建标准报告上下文
 *
 * @param {object} params
 * @param {object} params.project - 项目对象
 * @param {Array} params.photos - 照片记录列表
 * @param {Array} params.analyses - 分析批次列表
 * @param {Array} params.officialIssues - 正式问题列表
 * @returns {object} 标准化报告上下文
 */
export function buildReportContext({ project, photos, analyses, officialIssues }) {
  if (!project || !project.id) throw new Error('缺少有效项目数据');

  const projectId = String(project.id);
  const now = new Date().toISOString();

  // 1. 住宅台账
  const communities = activeCommunities(project);
  const allBuildings = [];
  const buildingsWithDetail = [];
  let totalHouseholdFromBuildings = 0;

  for (const community of communities) {
    const buildings = activeBuildings(community);
    if (buildings.length > 0) {
      buildingsWithDetail.push(community);
      for (const b of buildings) {
        allBuildings.push({ ...b, communityId: community.id, communityName: community.name || '' });
        totalHouseholdFromBuildings += number(b.householdCount);
      }
    }
  }

  // 统计口径：有楼栋明细的小区使用明细，无明细的使用小区汇总
  let summaryBuildingCount = 0;
  let summaryHouseholdCount = 0;
  for (const c of communities) {
    const detailBuildings = activeBuildings(c);
    if (detailBuildings.length === 0) {
      summaryBuildingCount += number(c.buildingCount);
      summaryHouseholdCount += number(c.householdCount);
    }
  }
  const buildingCount = allBuildings.length + summaryBuildingCount;
  const householdCount = totalHouseholdFromBuildings + summaryHouseholdCount;

  // 2. 照片分类
  const { original: originalPhotos, annotated: annotatedPhotos } = classifyPhotos(photos);
  const { byCommunity: photosByCommunity, byBuilding: photosByBuilding } = groupPhotosByLocation(originalPhotos);

  const communitiesWithPhotos = new Set(originalPhotos.filter((p) => p.communityId).map((p) => p.communityId));
  const buildingsWithPhotos = new Set(originalPhotos.filter((p) => p.buildingId).map((p) => p.buildingId));

  // 3. 分析批次
  const validAnalyses = (Array.isArray(analyses) ? analyses : []).filter(
    (a) => a && String(a.projectId) === projectId && a.status !== 'deleted'
  );
  const archivedAnalyses = validAnalyses.filter((a) => a.status === 'archived');

  // 4. 正式问题（只保留活跃状态）
  const validIssues = (Array.isArray(officialIssues) ? officialIssues : []).filter(
    (i) => i && String(i.projectId) === projectId && i.status !== 'deleted'
  );

  // 5. 指标编码映射
  const INDICATOR_NAMES = {
    'IND-HOUSE-001': '结构安全',
    'IND-HOUSE-002': '设施设备',
    'IND-HOUSE-003': '维护管理',
    'IND-HOUSE-004': '环境品质',
    'IND-HOUSE-005': '功能适用',
    'IND-HOUSE-006': '防灾韧性'
  };

  const PROBLEM_NAMES = {
    'PRB-01': '结构安全',
    'PRB-02': '消防隐患',
    'PRB-03': '楼道安全',
    'PRB-04': '围护安全',
    'PRB-05': '设备设施',
    'PRB-06': '环境品质'
  };

  // 6. 正式问题聚合统计
  const issueStats = { total: validIssues.length, high: 0, medium: 0, low: 0 };
  const indicatorCounts = {};
  const categoryCounts = {};
  const communitiesAffected = new Set();
  const buildingsAffected = new Set();
  const communityRiskDistribution = {};
  const buildingRiskDistribution = {};
  const remediationSet = new Set();

  for (const issue of validIssues) {
    const sev = normalizeSeverity(issue.severity);
    issueStats[sev] += 1;

    const indCode = clean(issue.indicatorCode, 50);
    if (indCode) indicatorCounts[indCode] = (indicatorCounts[indCode] || 0) + 1;

    const catCode = clean(issue.categoryCode || issue.problemCode, 50);
    const catPrefix = catCode.slice(0, 7);
    if (catPrefix) categoryCounts[catPrefix] = (categoryCounts[catPrefix] || 0) + 1;

    const cid = clean(issue.communityId, 120);
    const bid = clean(issue.buildingId, 120);
    if (cid) communitiesAffected.add(cid);
    if (bid) buildingsAffected.add(bid);

    if (cid) {
      if (!communityRiskDistribution[cid]) communityRiskDistribution[cid] = { total: 0, high: 0, medium: 0, low: 0 };
      communityRiskDistribution[cid].total += 1;
      communityRiskDistribution[cid][sev] += 1;
    }
    if (bid) {
      if (!buildingRiskDistribution[bid]) buildingRiskDistribution[bid] = { total: 0, high: 0, medium: 0, low: 0 };
      buildingRiskDistribution[bid].total += 1;
      buildingRiskDistribution[bid][sev] += 1;
    }

    const sug = clean(issue.suggestion, 2000);
    if (sug) remediationSet.add(sug);
  }

  const withOriginalPhoto = validIssues.filter((i) => i.originalPhotoId).length;
  const withAnnotatedPhoto = validIssues.filter((i) => i.annotatedPhotoId).length;

  // 7. 社区/街区分析
  const communityAnalysis = project.communityAnalysis || null;

  // 8. 缺失项检查
  const missingFields = [];
  const missingImageSlots = [];
  const warnings = [];

  if (!project.name) missingFields.push({ key: 'project.name', label: '项目名称' });
  if (!project.administrativeArea) missingFields.push({ key: 'project.administrativeArea', label: '行政区划' });
  if (!project.scope && !project.scopeAreaSqKm) missingFields.push({ key: 'project.scope', label: '项目范围' });

  if (communities.length === 0) warnings.push('无有效住宅小区数据');
  if (validIssues.length === 0) warnings.push('无正式问题数据');
  if (originalPhotos.length === 0) warnings.push('无原始现场照片');

  if (!project.scopeAreaSqKm) missingImageSlots.push({ type: 'project-map', label: '项目范围地图' });

  // 9. 内容哈希
  const hashInput = stableStringify({
    projectId,
    communityCount: communities.length,
    buildingCount,
    householdCount,
    photoCount: originalPhotos.length,
    issueCount: validIssues.length,
    issueStats,
    updatedAt: project.updatedAt || now
  });
  const contextHash = fvn32(hashInput);

  return {
    schemaVersion: '2.0.0',
    projectId,
    dataCutoffAt: now,
    contextHash,
    project: {
      id: projectId,
      name: clean(project.name, 200),
      administrativeArea: clean(project.administrativeArea, 200),
      area: clean(project.area, 200),
      type: clean(project.type, 200),
      stage: clean(project.stage, 200),
      renewalType: clean(project.renewalType, 200),
      scope: clean(project.scope, 2000),
      scopeAreaSqKm: number(project.scopeAreaSqKm),
      description: clean(project.desc, 2000),
      responsibleUnit: clean(project.responsibleUnit, 200),
      plannedPeriod: clean(project.plannedPeriod, 200)
    },
    housing: {
      communityCount: communities.length,
      buildingCount,
      householdCount,
      communitiesWithBuildingDetail: buildingsWithDetail.length,
      communitiesWithHouseholdData: communities.filter((c) => number(c.householdCount) > 0).length,
      communities: communities.map((c) => ({
        id: c.id,
        name: clean(c.name, 200),
        buildingCount: activeBuildings(c).length || number(c.buildingCount),
        householdCount: number(c.householdCount),
        buildingDetail: activeBuildings(c).map((b) => ({
          id: b.id,
          name: clean(b.name, 120),
          householdCount: number(b.householdCount)
        }))
      }))
    },
    photos: {
      originalCount: originalPhotos.length,
      annotatedCount: annotatedPhotos.length,
      communitiesWithPhotos: communitiesWithPhotos.size,
      buildingsWithPhotos: buildingsWithPhotos.size,
      originalPhotos: originalPhotos.map((p) => ({
        id: p.id,
        communityId: clean(p.communityId, 120),
        communityName: clean(p.communityName, 200),
        buildingId: clean(p.buildingId, 120),
        buildingName: clean(p.buildingName, 200),
        name: clean(p.name, 240),
        cloudPath: clean(p.cloudPath, 500)
      })),
      byCommunity: photosByCommunity,
      byBuilding: photosByBuilding
    },
    analyses: {
      totalCount: validAnalyses.length,
      archivedCount: archivedAnalyses.length
    },
    officialIssues: {
      totalCount: validIssues.length,
      stats: issueStats,
      indicatorCounts,
      categoryCounts,
      communitiesAffected: communitiesAffected.size,
      buildingsAffected: buildingsAffected.size,
      communityRiskDistribution,
      buildingRiskDistribution,
      withOriginalPhoto,
      withAnnotatedPhoto,
      remediationCategories: Array.from(remediationSet),
      items: validIssues.map((i) => ({
        id: i.id,
        communityId: clean(i.communityId, 120),
        buildingId: clean(i.buildingId, 120),
        problemCode: clean(i.problemCode, 20),
        indicatorCode: clean(i.indicatorCode, 50),
        categoryCode: clean(i.categoryCode, 50),
        title: clean(i.title, 120),
        description: clean(i.description, 2000),
        severity: normalizeSeverity(i.severity),
        location: clean(i.location, 500),
        suggestion: clean(i.suggestion, 2000),
        originalPhotoId: clean(i.originalPhotoId, 120),
        annotatedPhotoId: clean(i.annotatedPhotoId, 120)
      }))
    },
    communityAnalysis,
    template: {
      id: 'TPL-WORD-V1',
      version: 1
    },
    availability: {
      missingFields,
      missingImageSlots,
      warnings
    },
    sourceIds: {
      projectIds: [projectId],
      communityIds: communities.map((c) => c.id),
      buildingIds: allBuildings.map((b) => b.id),
      photoIds: photos.map((p) => String(p.id)),
      analysisIds: validAnalyses.map((a) => String(a.id)),
      issueIds: validIssues.map((i) => i.id)
    }
  };
}
