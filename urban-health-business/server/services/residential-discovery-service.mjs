import { randomUUID } from 'node:crypto';
import { appendDiscoveredCommunity } from './project-service.mjs';
import { runPoiAnalysis } from './poi-analysis-service.mjs';

function discoveryError(message, status = 400, code = 'RESIDENTIAL_DISCOVERY_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function clean(value, maxLength = 300) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function comparable(value) {
  return clean(value, 500)
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\-—_·()（）[\]【】,，.。]/g, '');
}

function boundaryIsStale(run, project) {
  return String(run?.sourceSnapshot?.boundaryUpdatedAt || '')
    !== String(project?.boundaryUpdatedAt || '');
}

function hydratedRun(run, project) {
  const stale = boundaryIsStale(run, project);
  return {
    ...run,
    stale,
    status: stale ? 'stale' : run.status
  };
}

function activeInventory(project) {
  return (Array.isArray(project?.residentialInventory?.items)
    ? project.residentialInventory.items
    : []).filter((item) => item?.status !== 'deleted');
}

function matchingCommunity(items, candidate) {
  const providerId = clean(candidate?.providerId, 120);
  const normalizedId = clean(candidate?.normalizedId, 120);
  return items.find((community) => {
    const discovery = community?.discovery || {};
    if (providerId && clean(discovery.providerId, 120) === providerId) return true;
    if (normalizedId && clean(discovery.normalizedId, 120) === normalizedId) return true;
    return comparable(community?.name) === comparable(candidate?.name)
      && comparable(community?.address) === comparable(candidate?.address);
  }) || null;
}

export async function createResidentialDiscoveryRun(
  client,
  repository,
  provider,
  projectId,
  input = {},
  options = {}
) {
  const actor = clean(input.createdBy, 120);
  if (!actor) throw discoveryError('请填写住宅识别操作人员。', 400, 'RESIDENTIAL_DISCOVERY_ACTOR_REQUIRED');
  const project = await client.getProject(projectId);
  const estimatedRadius = Math.round(Math.sqrt(
    Math.max(0.01, Number(project?.scopeAreaSqKm) || 0.01) * 1_000_000 / Math.PI
  ) * 1.2);
  const radiusMeters = input.radiusMeters === undefined
    ? Math.max(500, Math.min(10000, estimatedRadius))
    : input.radiusMeters;
  const captured = await runPoiAnalysis(
    client,
    { put: async (run) => run },
    provider,
    projectId,
    {
      ...input,
      category: 'residential',
      boundaryOnly: true,
      radiusMeters,
      createdBy: actor
    },
    {
      ...options,
      id: `SPRUN-${randomUUID()}`
    }
  );
  const now = options.now || new Date().toISOString();
  const run = {
    id: options.id || `RDRUN-${randomUUID()}`,
    projectId: String(projectId),
    status: 'completed',
    revision: 1,
    query: captured.parameters,
    providerSnapshot: captured.providerSnapshot,
    sourceSnapshot: captured.sourceSnapshot,
    cleaning: captured.cleaning,
    candidates: (captured.result?.items || []).map((item) => ({
      ...item,
      decisionStatus: 'pending',
      decisionRevision: 0,
      linkedCommunityId: null
    })),
    rejected: captured.result?.rejected || [],
    upstreamResultCount: Number(captured.result?.upstreamResultCount) || 0,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    confirmationAudit: [],
    schemaVersion: '1.0.0'
  };
  return repository.put(run);
}

export async function listResidentialDiscoveryRuns(client, repository, projectId) {
  const [project, runs] = await Promise.all([
    client.getProject(projectId),
    repository.list(projectId)
  ]);
  return runs.map((run) => hydratedRun(run, project));
}

export async function confirmResidentialDiscoveryRun(
  client,
  repository,
  runId,
  input = {},
  options = {}
) {
  const run = await repository.get(runId);
  if (!run) throw discoveryError('住宅识别运行不存在。', 404, 'RESIDENTIAL_DISCOVERY_RUN_NOT_FOUND');
  if (input.projectId && String(input.projectId) !== String(run.projectId)) {
    throw discoveryError('住宅识别运行不属于当前项目。', 404, 'RESIDENTIAL_DISCOVERY_RUN_NOT_FOUND');
  }
  const actor = clean(input.confirmedBy, 120);
  if (!actor) throw discoveryError('请填写住宅确认人员。', 400, 'RESIDENTIAL_CONFIRM_ACTOR_REQUIRED');
  const clientRequestId = clean(input.clientRequestId, 120);
  if (!clientRequestId) throw discoveryError('住宅确认请求缺少幂等编号。', 400, 'CLIENT_REQUEST_ID_REQUIRED');
  const existingAudit = (run.confirmationAudit || []).find(
    (item) => item.clientRequestId === clientRequestId
  );
  if (existingAudit) {
    const project = await client.getProject(run.projectId);
    const communities = activeInventory(project).filter((item) =>
      existingAudit.communityIds.includes(String(item.id || item.sourceId))
    );
    return { run: hydratedRun(run, project), communities, duplicated: true };
  }
  const expectedRevision = Number(input.expectedRevision);
  if (Number.isFinite(expectedRevision) && expectedRevision !== Number(run.revision || 1)) {
    throw discoveryError(
      '住宅识别运行已被其他操作修改，请刷新后重试。',
      409,
      'RESIDENTIAL_DISCOVERY_REVISION_CONFLICT'
    );
  }
  const selectedIds = Array.isArray(input.candidateIds)
    ? [...new Set(input.candidateIds.map((item) => clean(item, 160)).filter(Boolean))]
    : [];
  if (!selectedIds.length || selectedIds.length > 500) {
    throw discoveryError('每次必须确认1到500个住宅候选。', 400, 'RESIDENTIAL_CONFIRM_SIZE_INVALID');
  }
  const selected = new Set(selectedIds);
  const candidates = Array.isArray(run.candidates) ? run.candidates : [];
  for (const candidateId of selected) {
    if (!candidates.some((item) => item.normalizedId === candidateId)) {
      throw discoveryError('确认请求包含不存在的住宅候选。', 404, 'RESIDENTIAL_CANDIDATE_NOT_FOUND');
    }
  }
  let project = await client.getProject(run.projectId);
  if (boundaryIsStale(run, project)) {
    throw discoveryError('项目边界已变化，请重新识别住宅小区。', 409, 'RESIDENTIAL_DISCOVERY_STALE');
  }
  const now = options.now || new Date().toISOString();
  const linked = [];
  for (const candidate of candidates.filter((item) => selected.has(item.normalizedId))) {
    const duplicate = matchingCommunity(activeInventory(project), candidate);
    if (duplicate) {
      linked.push({ candidate, community: duplicate, duplicate: true });
      continue;
    }
    const outcome = appendDiscoveredCommunity(project, candidate, {
      now,
      idSuffix: options.idSuffixes?.[candidate.normalizedId],
      confirmedBy: actor,
      discoveryRunId: run.id
    });
    project = outcome.project;
    linked.push({ candidate, community: outcome.community, duplicate: false });
  }
  await client.putProject(project);
  const byCandidateId = new Map(linked.map((item) => [item.candidate.normalizedId, item]));
  const updatedCandidates = candidates.map((candidate) => {
    const item = byCandidateId.get(candidate.normalizedId);
    if (!item) return candidate;
    return {
      ...candidate,
      decisionStatus: 'confirmed',
      decisionRevision: Number(candidate.decisionRevision || 0) + 1,
      linkedCommunityId: String(item.community.id || item.community.sourceId),
      duplicateCommunity: item.duplicate,
      confirmedBy: actor,
      confirmedAt: now
    };
  });
  const communityIds = [...new Set(linked.map((item) => String(item.community.id || item.community.sourceId)))];
  const updatedRun = {
    ...run,
    candidates: updatedCandidates,
    revision: Number(run.revision || 1) + 1,
    updatedAt: now,
    confirmationAudit: [
      ...(run.confirmationAudit || []),
      {
        clientRequestId,
        candidateIds: selectedIds,
        communityIds,
        createdCommunityIds: linked.filter((item) => !item.duplicate)
          .map((item) => String(item.community.id || item.community.sourceId)),
        confirmedBy: actor,
        at: now
      }
    ]
  };
  await repository.put(updatedRun);
  return {
    run: hydratedRun(updatedRun, project),
    communities: linked.map((item) => item.community),
    duplicated: false
  };
}

function walkCommunityReferences(value, path, targets, findings, seen) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value) && targets.has(String(value.communityId || ''))) {
    findings.push({
      communityId: String(value.communityId),
      path,
      recordId: clean(value.id || value.taskId || value.photoId || value.issueId, 180) || null
    });
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkCommunityReferences(item, `${path}[${index}]`, targets, findings, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    walkCommunityReferences(item, `${path}.${key}`, targets, findings, seen);
  }
}

export function findCommunityReferences(communityIds, sources = {}) {
  const targets = new Set((communityIds || []).map(String));
  const findings = [];
  for (const [source, value] of Object.entries(sources)) {
    walkCommunityReferences(value, source, targets, findings, new WeakSet());
  }
  const counts = Object.fromEntries([...targets].map((id) => [id, 0]));
  for (const finding of findings) counts[finding.communityId] += 1;
  return { counts, findings, total: findings.length };
}
