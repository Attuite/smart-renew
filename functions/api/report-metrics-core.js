import fs from 'node:fs';
import { HOUSING_PROBLEM_GROUPS } from './housing-problem-catalog.js';

const HOUSING_FALLBACK = [
  ['housing.structural_safety', 'IND-HOUSE-001', '安全耐久', '存在结构安全隐患的住宅数量', '栋', 'officialIssues'],
  ['housing.gas_safety', 'IND-HOUSE-002', '安全耐久', '存在燃气安全隐患的住宅数量', '栋', 'officialIssues'],
  ['housing.corridor_safety', 'IND-HOUSE-003', '安全耐久', '存在楼道安全隐患的住宅数量', '栋', 'officialIssues'],
  ['housing.envelope_safety', 'IND-HOUSE-004', '安全耐久', '存在围护安全隐患的住宅数量', '栋', 'officialIssues'],
  ['housing.non_self_contained', 'IND-HOUSE-005', '功能完备', '非成套住宅数量', '套', 'officialIssues'],
  ['housing.pipeline_damage', 'IND-HOUSE-006', '功能完备', '存在管线管道破损的住宅数量', '栋', 'officialIssues'],
  ['housing.age_friendly_upgrade', 'IND-HOUSE-007', '功能完备', '需要进行适老化改造的住宅数量', '栋', 'notCollected'],
  ['housing.water_quality', 'IND-HOUSE-008', '功能完备', '入户水质不达标的住宅数量', '栋', 'notCollected'],
  ['housing.energy_upgrade', 'IND-HOUSE-009', '绿色智能', '需要进行节能改造的住宅数量', '栋', 'notCollected'],
  ['housing.digital_upgrade', 'IND-HOUSE-010', '绿色智能', '需要进行数字化改造的住宅数量', '栋', 'notCollected']
].map(([id, indicatorCode, group, name, unit, source]) => ({ id, indicatorCode, group, name, unit, source }));

const COMMUNITY_FALLBACK = [
  ['community.elderly_service', 'cat1', '设施完善', '地图检索到的养老服务设施空间数量'],
  ['community.childcare_service', 'cat2', '设施完善', '地图检索到的婴幼儿照护设施空间数量'],
  ['community.kindergarten', 'cat3', '设施完善', '地图检索到的幼儿园设施空间数量'],
  ['community.primary_school', 'cat4', '设施完善', '地图检索到的小学设施空间数量'],
  ['community.parking', 'cat5', '设施完善', '地图检索到的停车设施空间数量'],
  ['community.vehicle_charging', 'cat6', '设施完善', '地图检索到的新能源汽车充电设施空间数量'],
  ['community.bicycle_charging', 'cat7', '设施完善', '地图检索到的电动自行车充电设施空间数量'],
  ['community.public_activity', 'cat8', '环境宜居', '地图检索到的公共活动场地数量'],
  ['community.walking_space', 'cat9', '环境宜居', '地图检索到的步行空间数量'],
  ['community.waste_sorting', 'cat10', '环境宜居', '地图检索到的垃圾分类设施空间数量'],
  ['community.property_management', 'cat11', '管理健全', '地图检索到的物业管理服务空间数量'],
  ['community.smart_facility', 'cat12', '管理健全', '地图检索到的智慧设施空间数量']
].map(([id, categoryKey, group, name], index) => ({ id, categoryKey, referenceIndicatorCode: `IND-COMM-${String(index + 11).padStart(3, '0')}`, group, name, unit: '个' }));

function loadDefinitions() {
  try {
    const url = new URL('../../assets/indicators/report-metric-definitions.json', import.meta.url);
    return JSON.parse(fs.readFileSync(url, 'utf8'));
  } catch {
    return { schemaVersion: '1.0.0', housing: HOUSING_FALLBACK, community: COMMUNITY_FALLBACK };
  }
}

export const REPORT_METRIC_DEFINITIONS = loadDefinitions();

const RECOGNITION_CATALOG_BY_INDICATOR = new Map(HOUSING_PROBLEM_GROUPS.map((group) => [
  group.indicatorCode,
  {
    groupCode: group.code,
    groupName: group.name,
    problemTypes: group.items.map(([problemCode, problemName]) => ({ problemCode, problemName }))
  }
]));

function list(value) {
  return Array.isArray(value) ? value : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(numerator, denominator) {
  if (!(denominator > 0)) return null;
  return Number(((number(numerator) / number(denominator)) * 100).toFixed(2));
}

function cleanId(value) {
  return String(value == null ? '' : value).trim().slice(0, 160);
}

function uniqueIds(items) {
  return [...new Set(list(items).map(cleanId).filter(Boolean))];
}

function activeCommunities(project) {
  return list(project?.residentialInventory?.items).filter((item) => item?.status !== 'deleted');
}

function activeBuildings(communities) {
  return communities.flatMap((community) => list(community?.buildings)
    .filter((building) => building?.status !== 'deleted')
    .map((building) => ({ ...building, communityId: building.communityId || community.id })));
}

function inventoryBuildingCount(communities, buildings) {
  if (buildings.length) return buildings.length;
  return communities.reduce((sum, community) => sum + number(community?.buildingCount), 0);
}

function groupSummary(items) {
  const groups = new Map();
  for (const item of items) {
    const current = groups.get(item.group) || { group: item.group, metricCount: 0, readyCount: 0, partialCount: 0, unavailableCount: 0, issueCount: 0 };
    current.metricCount += 1;
    current[`${item.status}Count`] = number(current[`${item.status}Count`]) + 1;
    current.issueCount += number(item.issueCount);
    groups.set(item.group, current);
  }
  return [...groups.values()];
}

function housingMetrics({ project, issues, analyses }) {
  const communities = activeCommunities(project);
  const buildings = activeBuildings(communities);
  const buildingCount = inventoryBuildingCount(communities, buildings);
  const archivedAnalyses = list(analyses).filter((item) => item?.status === 'archived');
  const surveyedBuildingIds = uniqueIds(archivedAnalyses.map((item) => item?.buildingId));
  const surveyedCommunityIds = uniqueIds(archivedAnalyses.map((item) => item?.communityId));
  const officialIssues = list(issues).filter((item) => item?.status !== 'deleted');
  const supportedCodes = new Set(list(REPORT_METRIC_DEFINITIONS.housing)
    .filter((definition) => definition.source === 'officialIssues')
    .map((definition) => definition.indicatorCode));
  const scopedIssues = officialIssues.filter((issue) => supportedCodes.has(issue?.indicatorCode));

  const items = list(REPORT_METRIC_DEFINITIONS.housing).map((definition) => {
    if (definition.source !== 'officialIssues') {
      return {
        ...definition,
        status: 'unavailable',
        value: null,
        rate: null,
        issueCount: 0,
        affectedBuildingCount: null,
        affectedCommunityCount: null,
        reason: definition.calculation || '当前数据源尚未覆盖该指标',
        recognitionCatalog: RECOGNITION_CATALOG_BY_INDICATOR.get(definition.indicatorCode) || null,
        evidenceLineage: { issueIds: [], analysisIds: [], originalPhotoIds: [], annotatedPhotoIds: [], problemCodes: [] },
        sourceIds: []
      };
    }

    const matched = scopedIssues.filter((issue) => issue.indicatorCode === definition.indicatorCode);
    const affectedBuildingIds = uniqueIds(matched.map((issue) => issue.buildingId));
    const affectedCommunityIds = uniqueIds(matched.map((issue) => issue.communityId));
    const missingBuildingIdCount = matched.filter((issue) => !cleanId(issue.buildingId)).length;
    const outsideSurveyCount = affectedBuildingIds.filter((id) => !surveyedBuildingIds.includes(id)).length;
    const isHouseholdMetric = definition.indicatorCode === 'IND-HOUSE-005';
    let status = 'ready';
    let reason = '';
    let value = affectedBuildingIds.length;
    let rate = null;

    if (isHouseholdMetric) {
      status = matched.length ? 'partial' : (surveyedBuildingIds.length ? 'partial' : 'unavailable');
      reason = '当前正式问题没有户级对象编号，只能提供问题记录数，不能推算非成套住宅套数';
      value = null;
    } else if (!surveyedBuildingIds.length) {
      status = matched.length ? 'partial' : 'unavailable';
      reason = matched.length ? '存在正式问题，但缺少已归档分析覆盖楼栋分母' : '缺少已归档分析覆盖楼栋分母';
      value = affectedBuildingIds.length || null;
    } else if (missingBuildingIdCount || outsideSurveyCount) {
      status = 'partial';
      reason = missingBuildingIdCount
        ? `${missingBuildingIdCount}条正式问题缺少楼栋编号，楼栋数仅为已绑定记录的下限`
        : `${outsideSurveyCount}个问题楼栋未出现在已归档分析覆盖楼栋中`;
      value = affectedBuildingIds.length;
    } else {
      rate = percent(affectedBuildingIds.length, surveyedBuildingIds.length);
    }

    return {
      ...definition,
      status,
      value,
      rate,
      rateUnit: '%',
      issueCount: matched.length,
      affectedBuildingCount: affectedBuildingIds.length,
      affectedCommunityCount: affectedCommunityIds.length,
      denominator: surveyedBuildingIds.length || null,
      denominatorName: '已归档分析覆盖楼栋数',
      reason,
      recognitionCatalog: RECOGNITION_CATALOG_BY_INDICATOR.get(definition.indicatorCode) || null,
      evidenceLineage: {
        issueIds: uniqueIds(matched.map((item) => item.id)),
        analysisIds: uniqueIds(matched.map((item) => item.analysisId)),
        originalPhotoIds: uniqueIds(matched.map((item) => item.originalPhotoId)),
        annotatedPhotoIds: uniqueIds(matched.map((item) => item.annotatedPhotoId)),
        problemCodes: uniqueIds(matched.map((item) => item.problemCode))
      },
      sourceIds: matched.map((item) => cleanId(item.id)).filter(Boolean)
    };
  });

  const issueBuildingIds = uniqueIds(scopedIssues.map((issue) => issue.buildingId));
  const quality = buildingCount && surveyedBuildingIds.length
    ? (surveyedBuildingIds.length >= buildingCount ? 'ready' : 'partial')
    : (buildingCount || surveyedBuildingIds.length ? 'partial' : 'unavailable');
  return {
    dimension: 'housing',
    status: quality,
    scope: {
      communityCount: communities.length,
      buildingCount,
      householdCount: communities.reduce((sum, item) => sum + number(item?.householdCount), 0),
      archivedAnalysisCount: archivedAnalyses.length,
      surveyedCommunityCount: surveyedCommunityIds.length,
      surveyedBuildingCount: surveyedBuildingIds.length,
      analysisCoverageRate: percent(surveyedBuildingIds.length, buildingCount)
    },
    summary: {
      officialIssueCount: scopedIssues.length,
      affectedBuildingCount: issueBuildingIds.length,
      readyMetricCount: items.filter((item) => item.status === 'ready').length,
      partialMetricCount: items.filter((item) => item.status === 'partial').length,
      unavailableMetricCount: items.filter((item) => item.status === 'unavailable').length
    },
    groups: groupSummary(items),
    items,
    caveats: [
      '指标比例仅以已归档分析覆盖楼栋为分母，不代表项目全部楼栋。',
      '同一楼栋同一指标的多条正式问题按楼栋编号去重。',
      '缺少调查、历年和整改数据时，不形成达标等级、趋势或整改成效结论。'
    ]
  };
}

function communityMetrics({ project }) {
  const analysis = project?.communityAnalysis;
  const isCommunity = analysis?.dimension === 'community';
  const counts = isCommunity && analysis?.counts && typeof analysis.counts === 'object' ? analysis.counts : {};
  const samplesByCategory = new Map(list(analysis?.categoryMetrics).map((item) => [item.categoryKey, list(item.sampleFacilities)]));
  const items = list(REPORT_METRIC_DEFINITIONS.community).map((definition) => {
    const hasValue = isCommunity && Object.prototype.hasOwnProperty.call(counts, definition.categoryKey);
    return {
      ...definition,
      status: hasValue ? 'partial' : 'unavailable',
      resultType: hasValue ? 'proxyObservation' : 'standardIndicatorUnavailable',
      value: hasValue ? number(counts[definition.categoryKey]) : null,
      reason: hasValue
        ? '结果来自地图POI检索与空间合并，只描述检索到的设施数量，不等同于配建达标数量或服务覆盖率'
        : (analysis ? '当前保存的是街区维度分析，不是社区维度设施分析' : '尚未保存社区维度设施分析'),
      sampleFacilities: samplesByCategory.get(definition.categoryKey) || [],
      sourceIds: []
    };
  });
  const available = items.filter((item) => item.value != null);
  return {
    dimension: 'community',
    status: available.length ? 'partial' : 'unavailable',
    scope: {
      radiusKm: isCommunity ? number(analysis.radiusKm) : null,
      facilitySpaceTotal: isCommunity ? number(analysis.spaceTotal) : null,
      rawPoiTotal: isCommunity ? number(analysis.rawTotal) : null,
      categoryCount: available.length,
      center: isCommunity ? analysis.center || null : null
    },
    summary: {
      availableMetricCount: available.length,
      unavailableMetricCount: items.length - available.length,
      highestCategories: available.slice().sort((a, b) => b.value - a.value).slice(0, 3).map((item) => ({ id: item.id, name: item.name, value: item.value })),
      lowestCategories: available.slice().sort((a, b) => a.value - b.value).slice(0, 3).map((item) => ({ id: item.id, name: item.name, value: item.value }))
    },
    groups: groupSummary(items),
    items,
    conclusion: isCommunity ? String(analysis.conclusion || '') : '',
    advice: isCommunity ? String(analysis.advice || '') : '',
    caveats: [
      '当前社区指标仅使用地图POI检索结果，不包含居民问卷、服务覆盖率和配建标准核查。',
      '设施数量为搜索结果经邻近合并后的设施空间数量，不能据此判断达标或不达标。',
      '暂无居住用地、步行路网和设施建筑面积时，不生成服务盲区、可达性或面积合规结论。'
    ]
  };
}

export function computeCommunityHousingMetrics({ project, issues = [], analyses = [], calculatedAt = '' }) {
  if (!project?.id) throw new Error('指标计算缺少项目档案');
  return {
    schemaVersion: REPORT_METRIC_DEFINITIONS.schemaVersion || '1.0.0',
    calculatedAt: calculatedAt || new Date().toISOString(),
    sourcePolicy: 'projectSnapshotInputs',
    housing: housingMetrics({ project, issues, analyses }),
    community: communityMetrics({ project })
  };
}
