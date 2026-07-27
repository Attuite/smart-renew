export function inferLegacyProblemCode(issue) {
  if (/^PRB-(0[1-6])-\d{2}$/.test(String(issue?.problemCode || ''))) return issue.problemCode;
  const text = [issue?.title, issue?.desc, issue?.evidence, issue?.categoryCode].join(' ');
  const rules = [
    ['PRB-03-08', /灭火器/], ['PRB-03-07', /消火栓/], ['PRB-03-09', /疏散指示/],
    ['PRB-03-11', /电动车|充电/], ['PRB-03-10', /堆放|杂物/], ['PRB-03-03', /楼道照明|照明缺/],
    ['PRB-02-06', /燃气报警/], ['PRB-02-05', /自闭阀/], ['PRB-02-02', /橡胶软管|软管老化/],
    ['PRB-02-01', /燃气/], ['PRB-04-05', /屋面|漏水|渗漏/], ['PRB-04-04', /门窗|玻璃/],
    ['PRB-04-02', /保温层/], ['PRB-04-01', /外墙|立面|饰面|脱落/],
    ['PRB-06-07', /私搭乱接/], ['PRB-06-06', /电力|电线|裸露|电气/],
    ['PRB-06-04', /给排水|堵塞/], ['PRB-06-01', /滴漏|跑冒/],
    ['PRB-01-02', /承重.*拆|拆除.*承重/], ['PRB-01-04', /违规加建|加建/],
    ['PRB-01-01', /结构|裂缝|沉降/]
  ];
  for (const [code, pattern] of rules) if (pattern.test(text)) return code;
  const fallback = {
    STRUCTURE: 'PRB-01-01', FIRE: 'PRB-03-06', ELECTRIC_GAS: 'PRB-06-06',
    ROOF_LEAK: 'PRB-04-05', FACADE: 'PRB-04-01', ROAD_ACCESS: 'PRB-03-01',
    PUBLIC_FACILITY: 'PRB-03-03', PUBLIC_SPACE: 'PRB-03-10'
  };
  return fallback[issue?.categoryCode] || 'PRB-04-01';
}

export function auditLegacyData(projectId, analyses, photoRecords, officialIssues) {
  const projectAnalyses = (analyses || []).filter((item) => String(item.projectId) === String(projectId));
  const embeddedOriginals = projectAnalyses.reduce((sum, item) => sum + (Array.isArray(item.imagesBase64) ? item.imagesBase64.length : 0), 0);
  const embeddedAnnotated = projectAnalyses.reduce((sum, item) => sum + (Array.isArray(item.annotatedImages) ? item.annotatedImages.length : 0), 0);
  const archivedCandidates = projectAnalyses.reduce((sum, item) => sum + (item.status === 'archived' && Array.isArray(item.result?.issues) ? item.result.issues.length : 0), 0);
  const projectPhotos = (photoRecords || []).filter((item) => String(item.projectId) === String(projectId));
  const projectIssues = (officialIssues || []).filter((item) => String(item.projectId) === String(projectId));
  return {
    projectId: String(projectId),
    analysisCount: projectAnalyses.length,
    embeddedOriginals,
    embeddedAnnotated,
    archivedCandidates,
    existingPhotoRecords: projectPhotos.length,
    existingOfficialIssues: projectIssues.length,
    needsMigration: embeddedOriginals > 0 || embeddedAnnotated > 0 || archivedCandidates > projectIssues.length
  };
}
