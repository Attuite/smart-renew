function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeCommunities(project) {
  const items = project?.residentialInventory?.items;
  return Array.isArray(items) ? items.filter((item) => item?.status !== 'deleted') : [];
}

export function nextReportVersion(existing) {
  return (Array.isArray(existing) ? existing : []).reduce((max, item) => Math.max(max, number(item.version)), 0) + 1;
}

export function buildReportSnapshot({ project, issues, photos, analyses, existing, generatedBy }) {
  const version = nextReportVersion(existing);
  const projectId = String(project.id);
  const communities = activeCommunities(project);
  const buildings = communities.flatMap((community) => (Array.isArray(community.buildings) ? community.buildings : [])
    .filter((building) => building?.status !== 'deleted'));
  const householdCount = communities.reduce((sum, community) => sum + number(community.householdCount), 0);
  const issueStats = { total: issues.length, high: 0, medium: 0, low: 0 };
  const indicatorCounts = {};
  issues.forEach((issue) => {
    if (issue.severity === 'high') issueStats.high += 1;
    else if (issue.severity === 'low') issueStats.low += 1;
    else issueStats.medium += 1;
    indicatorCounts[issue.indicatorCode] = (indicatorCounts[issue.indicatorCode] || 0) + 1;
  });
  const now = new Date().toISOString();
  const id = `RPT-${projectId}-V${String(version).padStart(4, '0')}`;
  return {
    id,
    projectId,
    version,
    title: `${project.name || '未命名项目'}体检报告`,
    reportType: 'comprehensive',
    generatedBy: String(generatedBy || '').trim().slice(0, 120),
    generatedAt: now,
    dataCutoffAt: now,
    status: 'snapshot',
    sourceIds: {
      projectIds: [projectId],
      communityIds: communities.map((item, index) => String(item.id || `community-${index + 1}`)),
      buildingIds: buildings.map((item, index) => String(item.id || `building-${index + 1}`)),
      photoIds: photos.map((item) => String(item.id)),
      analysisIds: analyses.map((item) => String(item.id)),
      issueIds: issues.map((item) => String(item.id))
    },
    snapshot: {
      project: {
        id: projectId,
        name: project.name || '',
        area: project.area || '',
        type: project.type || '',
        scope: project.scope || '',
        description: project.desc || '',
        scopeAreaSqKm: number(project.scopeAreaSqKm)
      },
      housing: {
        communityCount: communities.length,
        buildingCount: buildings.length || communities.reduce((sum, item) => sum + number(item.buildingCount), 0),
        householdCount
      },
      photos: {
        total: photos.length,
        archived: photos.filter((item) => item.status === 'archived').length
      },
      analyses: {
        total: analyses.filter((item) => item.status === 'archived').length
      },
      issues: {
        ...issueStats,
        indicatorCounts,
        items: issues.map((issue) => ({ ...issue }))
      },
      communityAnalysis: project.communityAnalysis || null
    },
    pdfFileId: '',
    schemaVersion: '1.0.0'
  };
}
