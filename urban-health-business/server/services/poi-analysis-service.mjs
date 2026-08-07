import { createHash, randomUUID } from 'node:crypto';
import { haversineMeters } from './spatial-analysis-service.mjs';
import { finitePoint } from './amap-provider.mjs';
import { pointInPolygon } from './spatial-binding-service.mjs';

export const POI_RULE_VERSION = 'smart-renew-ab-poi-v1';

export const POI_CATEGORIES = Object.freeze({
  residential: {
    label: '住宅小区',
    keywords: ['小区', '家园', '花园', '公寓', '住宅', '社区'],
    types: '120300',
    allow: /小区|家园|花园|公寓|住宅|社区/,
    exclude: /酒店|写字楼|商场|售楼处|公司|产业园/
  },
  elderlyCare: {
    label: '养老服务',
    keywords: ['养老院', '日间照料中心', '老年活动中心', '长者服务中心', '敬老院', '康养中心'],
    types: '080000|130000|140000',
    allow: /养老|日间照料|老年活动|长者|敬老|康养/,
    exclude: /房地产|售楼|酒店/
  },
  childcare: {
    label: '托育照护',
    keywords: ['托育', '托儿所', '早教中心', '婴幼儿照护', '儿童成长中心'],
    types: '141200|080000',
    allow: /托育|托儿|早教|婴幼儿|儿童成长/,
    exclude: /培训学校|摄影|商店/
  },
  kindergarten: {
    label: '幼儿园',
    keywords: ['幼儿园', '幼稚园', '学前教育', '保育院'],
    types: '141200',
    allow: /幼儿园|幼稚园|学前教育|保育院/,
    exclude: /培训|托管|商店/
  },
  primarySchool: {
    label: '小学',
    keywords: ['小学', '实验小学', '中心小学'],
    types: '141202|141200',
    allow: /小学/,
    exclude: /培训|辅导|家教/
  },
  parking: {
    label: '停车设施',
    keywords: ['停车场', '公共停车场', '停车库', '停车楼', '路侧停车'],
    types: '150900',
    allow: /停车/,
    exclude: /汽车销售|维修/
  },
  evCharging: {
    label: '汽车充电',
    keywords: ['汽车充电站', '新能源充电站', '充电桩', '超级充电站'],
    types: '011100|150900',
    allow: /充电站|充电桩|超级充电/,
    exclude: /手机|数码|维修/
  },
  activity: {
    label: '公共活动场地',
    keywords: ['公园', '广场', '社区活动中心', '健身广场', '运动场'],
    types: '110000|080000',
    allow: /公园|广场|活动中心|运动场|篮球场|足球场|游园/,
    exclude: /酒店|商场|售楼/
  },
  transit: {
    label: '公共交通',
    keywords: ['公交站', '地铁站', '公共自行车'],
    types: '150000',
    allow: /公交|地铁|公共自行车/,
    exclude: /公司|维修/
  }
});

function poiError(message, status = 400, code = 'POI_ANALYSIS_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

function comparable(value) {
  return clean(value, 500)
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\-—_·()（）[\]【】,，.。]/g, '');
}

export function poiStableId(item) {
  const identity = item?.providerId
    || `${comparable(item?.name)}|${comparable(item?.address)}|${(item?.coordinates || [])
      .slice(0, 2)
      .map((value) => Number(value).toFixed(6))
      .join(',')}`;
  return `POI-${createHash('sha256').update(String(identity)).digest('hex').slice(0, 20)}`;
}

function projectCenter(project) {
  const explicit = finitePoint(project?.scopeCenter);
  if (explicit) return explicit;
  const points = (Array.isArray(project?.scopeBoundary) ? project.scopeBoundary : [])
    .map(finitePoint)
    .filter(Boolean);
  if (!points.length) return null;
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length
  ];
}

function rawPoi(item, categoryKey, queryKeyword, center) {
  const coordinates = finitePoint(item?.location);
  if (!coordinates) return null;
  const distanceValue = Number(item?.distance);
  return {
    providerId: clean(item?.id, 120) || null,
    category: categoryKey,
    queryKeyword,
    name: clean(item?.name, 200) || '未命名POI',
    address: clean(Array.isArray(item?.address) ? item.address.join('') : item?.address, 300),
    type: clean(item?.type, 300),
    typecode: clean(item?.typecode, 80),
    coordinates,
    crs: 'GCJ02',
    distanceMeters: Number.isFinite(distanceValue)
      ? distanceValue
      : Math.round(haversineMeters(center, coordinates) * 10) / 10,
    providerRaw: item
  };
}

function cleanPois(rawItems, rule, radiusMeters, boundary = null) {
  const accepted = [];
  const rejected = [];
  const exactSeen = new Set();
  for (const item of rawItems) {
    const text = `${item.name} ${item.address} ${item.type}`;
    let reason = '';
    if (item.distanceMeters > radiusMeters) reason = 'OUTSIDE_RADIUS';
    else if (Array.isArray(boundary) && boundary.length >= 3 && !pointInPolygon(item.coordinates, boundary)) {
      reason = 'OUTSIDE_PROJECT_BOUNDARY';
    }
    else if (rule.exclude?.test(text)) reason = 'HARD_EXCLUDED';
    else if (rule.allow && !rule.allow.test(text)) reason = 'ALLOW_RULE_NOT_MATCHED';
    const exactKey = item.providerId
      || `${comparable(item.name)}|${comparable(item.address)}|${item.coordinates.map((value) => value.toFixed(6)).join(',')}`;
    if (!reason && exactSeen.has(exactKey)) reason = 'DUPLICATE';
    if (reason) {
      rejected.push({ providerId: item.providerId, name: item.name, reason });
      continue;
    }
    exactSeen.add(exactKey);
    accepted.push(item);
  }

  const merged = [];
  for (const item of accepted.sort((a, b) => a.distanceMeters - b.distanceMeters)) {
    const nameKey = comparable(item.name);
    const addressKey = comparable(item.address);
    const existing = merged.find((candidate) => {
      const near = haversineMeters(candidate.coordinates, item.coordinates) <= 35;
      return near && (
        comparable(candidate.name) === nameKey
        || (addressKey && comparable(candidate.address) === addressKey)
      );
    });
    if (!existing) {
      merged.push({
        ...item,
        normalizedId: poiStableId(item),
        reviewStatus: 'pending',
        reviewRevision: 0,
        sourceCount: 1,
        sourceProviderIds: [item.providerId].filter(Boolean)
      });
      continue;
    }
    existing.sourceCount += 1;
    if (item.providerId) existing.sourceProviderIds.push(item.providerId);
  }
  return { items: merged, rejected };
}

export async function runPoiAnalysis(
  client,
  spatialRepository,
  provider,
  projectId,
  input = {},
  options = {}
) {
  const project = await client.getProject(projectId);
  if (String(project?.scopeBoundaryCrs || '').toUpperCase().replace('-', '') !== 'GCJ02') {
    throw poiError(
      '高德POI使用GCJ-02；当前项目边界不是GCJ-02，坐标转换能力接入前不能混合分析。',
      409,
      'POI_PROJECT_CRS_MISMATCH'
    );
  }
  const center = finitePoint(input.center) || projectCenter(project);
  if (!center) {
    throw poiError('项目缺少有效边界中心。', 409, 'POI_CENTER_REQUIRED');
  }
  const radiusMeters = Math.round(Number(input.radiusMeters));
  if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 10000) {
    throw poiError('POI检索半径必须在50到10000米之间。', 400, 'POI_RADIUS_INVALID');
  }
  const createdBy = clean(input.createdBy, 120);
  if (!createdBy) throw poiError('请填写POI分析操作人员。', 400, 'POI_CREATOR_REQUIRED');
  const category = clean(input.category, 40) || 'residential';
  const rule = POI_CATEGORIES[category];
  if (!rule) throw poiError('POI分类无效。', 400, 'POI_CATEGORY_INVALID');
  const customKeywords = clean(input.keywords, 200)
    .split(/[|,，;；]/)
    .map((item) => clean(item, 80))
    .filter(Boolean);
  const keywords = (customKeywords.length ? customKeywords : rule.keywords).slice(0, 8);
  const maxPages = Math.max(1, Math.min(5, Math.round(Number(input.maxPages) || 3)));
  const pageSize = 50;
  const projectBoundary = (Array.isArray(project.scopeBoundary) ? project.scopeBoundary : [])
    .map(finitePoint)
    .filter(Boolean);
  const boundaryOnly = input.boundaryOnly === true
    || (input.boundaryOnly !== false && category === 'residential' && projectBoundary.length >= 3);
  const rawItems = [];
  let upstreamResultCount = 0;
  for (const keyword of keywords) {
    for (let page = 1; page <= maxPages; page += 1) {
      const result = await provider.searchAround({
        center,
        radiusMeters,
        keywords: keyword,
        types: rule.types,
        page,
        pageSize
      });
      upstreamResultCount += Number(result.count) || 0;
      const items = (Array.isArray(result.items) ? result.items : [])
        .map((item) => rawPoi(item, category, keyword, center))
        .filter(Boolean);
      rawItems.push(...items);
      if (items.length < pageSize || page * pageSize >= Number(result.count || 0)) break;
    }
  }
  const cleaned = cleanPois(rawItems, rule, radiusMeters, boundaryOnly ? projectBoundary : null);
  const now = options.now || new Date().toISOString();
  return spatialRepository.put({
    id: options.id || `SPRUN-${randomUUID()}`,
    projectId: String(project.id),
    type: 'poi-search',
    status: 'completed',
    parameters: {
      center,
      centerCrs: 'GCJ02',
      radiusMeters,
      category,
      categoryLabel: rule.label,
      keywords,
      types: rule.types,
      boundaryOnly,
      maxPages,
      pageSize
    },
    providerSnapshot: {
      provider: 'amap',
      api: 'place-around-v3',
      coordinateSystem: 'GCJ-02',
      queriedAt: now
    },
    sourceSnapshot: {
      projectRevision: Number(project.revision) || 0,
      boundaryUpdatedAt: project.boundaryUpdatedAt || null,
      boundaryCrs: project.scopeBoundaryCrs || null
    },
    cleaning: {
      ruleVersion: POI_RULE_VERSION,
      rawCount: rawItems.length,
      acceptedBeforeMergeCount: rawItems.length - cleaned.rejected.length,
      mergedCount: cleaned.items.length,
      rejectedCount: cleaned.rejected.length
    },
    rawPois: rawItems,
    result: {
      upstreamResultCount,
      category,
      categoryLabel: rule.label,
      itemCount: cleaned.items.length,
      items: cleaned.items,
      rejected: cleaned.rejected
    },
    createdBy,
    completedAt: now,
    schemaVersion: '1.0.0'
  });
}

export { cleanPois, projectCenter };
