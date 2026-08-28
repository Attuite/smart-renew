import { HOUSING_PROBLEM_GROUPS } from '../functions/api/housing-problem-catalog.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
const WHITE_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2I7sAAAAASUVORK5CYII=';
const CATEGORY_BY_GROUP = {
  '01': 'STRUCTURE',
  '02': 'ELECTRIC_GAS',
  '03': 'FIRE',
  '04': 'FACADE',
  '05': 'OTHER',
  '06': 'ELECTRIC_GAS'
};
const SEVERITIES = ['high', 'medium', 'low'];

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) || '';
}

function active(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.status !== 'deleted');
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathname}: ${payload.message || `HTTP ${response.status}`}`);
  return payload;
}

function selectProject(projects, requestedId) {
  if (requestedId) {
    const project = projects.find((item) => String(item.id) === requestedId);
    if (!project) throw new Error(`找不到项目 ${requestedId}`);
    return project;
  }
  if (projects.length !== 1) throw new Error(`当前共有 ${projects.length} 个项目，请使用 --project-id=项目编号 明确指定`);
  return projects[0];
}

function ensureTestBuildings(project) {
  const communities = active(project?.residentialInventory?.items);
  if (!communities.length) throw new Error('项目没有可用小区，无法关联测试照片和问题');
  let changed = false;
  const buildings = communities.map((community, index) => {
    if (!Array.isArray(community.buildings)) community.buildings = [];
    const existing = active(community.buildings)[0];
    if (existing) return { community, building: existing };
    const building = {
      id: `BLD-TEST-${String(community.id).replace(/[^A-Za-z0-9_.-]/g, '_')}`,
      communityId: String(community.id),
      name: `测试楼栋${index + 1}号楼`,
      householdCount: Number(community.householdCount) || 0,
      status: 'active',
      source: 'report-test-seed',
      testData: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    community.buildings.push(building);
    community.buildingCount = active(community.buildings).length;
    changed = true;
    return { community, building };
  });
  return { buildings, changed };
}

function buildSamples() {
  const samples = [];
  for (const group of HOUSING_PROBLEM_GROUPS) {
    group.items.forEach(([problemCode, problemName], itemIndex) => {
      samples.push({ group, problemCode, problemName, variant: 1 });
      if (itemIndex === 0) samples.push({ group, problemCode, problemName, variant: 2 });
    });
  }
  return samples;
}

function analysisIdFor(projectId, batchIndex) {
  const source = String(projectId).replace(/\D/g, '').slice(-13).padStart(13, '0');
  return String(Number(`8${source}`) + batchIndex);
}

async function main() {
  const baseUrl = (argument('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const requestedProjectId = argument('project-id');
  const projectList = await request(baseUrl, '/api/projects');
  const selected = selectProject(projectList.items || [], requestedProjectId);
  const projectId = String(selected.id);
  const project = await request(baseUrl, `/api/projects/${projectId}`);
  const { buildings, changed } = ensureTestBuildings(project);

  if (changed) {
    project.updatedAt = new Date().toISOString();
    await request(baseUrl, `/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(project) });
  }

  const samples = buildSamples();
  const batches = buildings.map((entry, index) => ({ ...entry, index, samples: [] }));
  samples.forEach((sample, index) => batches[index % batches.length].samples.push(sample));
  const analysisIds = [];
  let photoCount = 0;
  let issueCount = 0;

  for (const batch of batches) {
    if (!batch.samples.length) continue;
    const analysisId = analysisIdFor(projectId, batch.index + 1);
    const now = new Date().toISOString();
    const photoIds = [];
    const reviewIssues = [];

    for (let index = 0; index < batch.samples.length; index += 1) {
      const sample = batch.samples[index];
      const suffix = `${sample.problemCode}-${sample.variant}`;
      const photoId = `TEST-PHOTO-${projectId}-${suffix}`;
      const issueId = `TEST-ISSUE-${projectId}-${suffix}`;
      const severity = SEVERITIES[(photoCount + index) % SEVERITIES.length];
      const imageIndex = index + 1;
      await request(baseUrl, '/api/photos/upload', {
        method: 'POST',
        body: JSON.stringify({
          photoId,
          projectId,
          communityId: String(batch.community.id),
          buildingId: String(batch.building.id),
          analysisId,
          imageIndex,
          name: `测试空白图-${sample.problemCode}-${sample.variant}.png`,
          description: `【测试数据】${sample.group.name} / ${sample.problemName}`,
          problemCode: sample.problemCode,
          capturedAt: now,
          width: 1,
          height: 1,
          dataUrl: WHITE_PNG_DATA_URL
        })
      });
      photoIds.push(photoId);
      reviewIssues.push({
        id: issueId,
        reviewStatus: 'modified',
        reviewedAt: now,
        problemCode: sample.problemCode,
        indicatorCode: sample.group.indicatorCode,
        categoryCode: CATEGORY_BY_GROUP[sample.group.code] || 'OTHER',
        categoryName: sample.group.name,
        type: sample.group.name,
        title: `【测试】${sample.problemName}`,
        desc: `【测试数据】用于验证“${sample.problemName}”在指标计算、问题清单和报告叙述中的展示。`,
        evidence: '测试用纯白占位图片，不代表真实现场证据。',
        severity,
        confidence: 0.88,
        location: `${batch.community.name} · ${batch.building.name} · 测试位置`,
        imageIndex,
        bbox: [120, 120, 880, 880],
        suggestion: `【测试建议】对${sample.problemName}开展现场复核，确认后再制定正式整改方案。`,
        mergedCount: 1
      });
      photoCount += 1;
    }

    const analysis = {
      id: Number(analysisId),
      timestamp: now,
      createdAt: now,
      archivedAt: now,
      projectName: project.name,
      area: project.area,
      projectId: project.id,
      communityId: String(batch.community.id),
      buildingId: String(batch.building.id),
      analysisType: '住区住房安全测试数据',
      analysisTemplate: 'report-test-seed',
      analysisDesc: '【测试数据】自动生成的空白图片和住房问题，用于报告链路测试。',
      imagesCount: photoIds.length,
      photoIds,
      annotatedPhotoIds: [...photoIds],
      imageMeta: photoIds.map((photoId, index) => ({
        name: `测试空白图-${index + 1}.png`,
        width: 1,
        height: 1,
        photoId,
        communityId: String(batch.community.id),
        buildingId: String(batch.building.id),
        storage: 'server-filesystem',
        testData: true
      })),
      reviewIssues,
      result: {
        summary: `【测试数据】本批次包含 ${reviewIssues.length} 个测试问题，不代表真实体检结论。`,
        issues: reviewIssues
      },
      status: 'archived',
      reviewerName: '测试数据生成器',
      model: 'test-fixture',
      provider: 'local-test',
      requestId: '',
      usage: null,
      promptVersion: 'report-test-seed-v1',
      testData: true
    };
    await request(baseUrl, `/api/analysis-records/${analysisId}`, { method: 'PUT', body: JSON.stringify(analysis) });
    const finalized = await request(baseUrl, '/api/issues/finalize', {
      method: 'POST',
      body: JSON.stringify({ analysisId, reviewerName: '测试数据生成器', issues: reviewIssues })
    });
    analysis.officialIssueIds = (finalized.items || []).map((item) => item.id);
    await request(baseUrl, `/api/analysis-records/${analysisId}`, { method: 'PUT', body: JSON.stringify(analysis) });
    issueCount += analysis.officialIssueIds.length;
    analysisIds.push(Number(analysisId));
  }

  const refreshedProject = await request(baseUrl, `/api/projects/${projectId}`);
  refreshedProject.analysisIds = [...new Set([...(refreshedProject.analysisIds || []), ...analysisIds])];
  refreshedProject.status = 'reviewed';
  refreshedProject.updatedAt = new Date().toISOString();
  await request(baseUrl, `/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(refreshedProject) });

  const [photos, issues, analyses] = await Promise.all([
    request(baseUrl, `/api/photos?projectId=${encodeURIComponent(projectId)}`),
    request(baseUrl, `/api/issues?projectId=${encodeURIComponent(projectId)}`),
    request(baseUrl, `/api/analysis-records?projectId=${encodeURIComponent(projectId)}`)
  ]);
  const seededPhotoCount = (photos.items || []).filter((item) => String(item.id).startsWith(`TEST-PHOTO-${projectId}-`)).length;
  const seededIssueCount = (issues.items || []).filter((item) => String(item.id).startsWith(`TEST-ISSUE-${projectId}-`)).length;
  const seededAnalysisCount = (analyses.items || []).filter((item) => item.testData === true).length;

  console.log(JSON.stringify({
    project: { id: projectId, name: project.name },
    problemGroups: HOUSING_PROBLEM_GROUPS.length,
    problemTypes: HOUSING_PROBLEM_GROUPS.reduce((sum, group) => sum + group.items.length, 0),
    requestedSamples: samples.length,
    processedPhotos: photoCount,
    finalizedIssues: issueCount,
    verified: {
      testPhotos: seededPhotoCount,
      testIssues: seededIssueCount,
      testAnalyses: seededAnalysisCount,
      linkedBuildings: buildings.length
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
