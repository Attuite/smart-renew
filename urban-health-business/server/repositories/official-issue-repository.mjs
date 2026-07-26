import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function clean(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function safeFileId(value) {
  const id = clean(value, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,159}$/.test(id)) {
    const error = new Error('正式问题编号无效。');
    error.status = 400;
    error.code = 'INVALID_ISSUE_ID';
    throw error;
  }
  return id;
}

export function officialIssueFromCandidate(candidate, analysis, reviewerName, options = {}) {
  const now = options.now || new Date().toISOString();
  const imageIndex = Math.max(1, Number(candidate?.imageIndex) || 1);
  const sourcePhotoId = clean(candidate?.photoId || analysis?.photoIds?.[imageIndex - 1], 120);
  if (!sourcePhotoId) {
    const error = new Error('正式问题缺少原始照片引用。');
    error.status = 400;
    error.code = 'OFFICIAL_ISSUE_PHOTO_REQUIRED';
    throw error;
  }
  const candidateId = clean(candidate?.id, 120);
  const issueId = safeFileId(`ISS-${candidateId || `${analysis.id}-${imageIndex}`}`);
  return {
    id: issueId,
    projectId: String(analysis.projectId),
    analysisId: String(analysis.id),
    candidateId,
    source: 'ai-reviewed',
    originalPhotoId: sourcePhotoId,
    communityId: clean(candidate?.communityId || analysis?.communityId, 120),
    buildingId: clean(candidate?.buildingId || analysis?.buildingId, 120),
    categoryCode: clean(candidate?.categoryCode, 50),
    categoryName: clean(candidate?.categoryName, 120),
    title: clean(candidate?.title || '未命名问题', 120),
    description: clean(candidate?.desc, 2000),
    evidence: clean(candidate?.evidence, 2000),
    severity: ['high', 'medium', 'low'].includes(candidate?.severity) ? candidate.severity : 'medium',
    confidence: candidate?.confidence == null ? null : Math.max(0, Math.min(1, Number(candidate.confidence))),
    location: clean(candidate?.location, 500),
    bbox: Array.isArray(candidate?.bbox) ? candidate.bbox.slice(0, 4) : null,
    suggestion: clean(candidate?.suggestion, 2000),
    geometry: candidate?.geometry || null,
    spatialBinding: null,
    indicatorCode: null,
    indicatorBindingStatus: 'not_integrated',
    reviewStatus: candidate?.reviewStatus === 'modified' ? 'modified' : 'confirmed',
    reviewerName: clean(reviewerName, 120),
    reviewedAt: candidate?.reviewedAt || now,
    status: 'active',
    issueRevision: 1,
    auditTrail: [{
      revision: 1,
      action: candidate?.reviewStatus === 'modified' ? 'candidate_modified_and_confirmed' : 'candidate_confirmed',
      actor: clean(reviewerName, 120),
      at: now
    }],
    createdAt: now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
}

export class OfficialIssueRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(issue) {
    await this.ensure();
    const id = safeFileId(issue.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(issue), 'utf8');
    await rename(temporary, target);
    return issue;
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const issue = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (issue.status === 'deleted') continue;
      if (projectId && String(issue.projectId) !== String(projectId)) continue;
      items.push(issue);
    }
    return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  async get(issueId) {
    await this.ensure();
    const id = safeFileId(issueId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async updateGeometry(issueId, input, options = {}) {
    const issue = await this.get(issueId);
    if (!issue) {
      const error = new Error('正式问题不存在或不是Business正式问题。');
      error.status = 404;
      error.code = 'OFFICIAL_ISSUE_NOT_FOUND';
      throw error;
    }
    const currentGeometryRevision = Math.max(0, Number(issue.geometryRevision) || 0);
    if (
      input?.expectedGeometryRevision !== undefined
      && Number(input.expectedGeometryRevision) !== currentGeometryRevision
    ) {
      const error = new Error('问题点位已被其他操作修改，请刷新后重试。');
      error.status = 409;
      error.code = 'GEOMETRY_REVISION_CONFLICT';
      throw error;
    }
    const longitude = Number(input?.longitude);
    const latitude = Number(input?.latitude);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      const error = new Error('经度必须在-180到180之间。');
      error.status = 400;
      error.code = 'INVALID_LONGITUDE';
      throw error;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      const error = new Error('纬度必须在-90到90之间。');
      error.status = 400;
      error.code = 'INVALID_LATITUDE';
      throw error;
    }
    const confirmedBy = clean(input?.confirmedBy, 120);
    if (!confirmedBy) {
      const error = new Error('请填写坐标确认人员。');
      error.status = 400;
      error.code = 'SPATIAL_CONFIRMER_REQUIRED';
      throw error;
    }
    const now = options.now || new Date().toISOString();
    const nextGeometryRevision = currentGeometryRevision + 1;
    const nextGeometry = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    const updated = {
      ...issue,
      geometry: nextGeometry,
      spatialBinding: {
        status: 'confirmed',
        source: 'manual',
        crs: clean(input?.crs, 20) || 'WGS84',
        accuracy: clean(input?.accuracy, 80) || 'unknown',
        confirmedBy,
        confirmedAt: now
      },
      geometryRevision: nextGeometryRevision,
      geometryAudit: [
        ...(Array.isArray(issue.geometryAudit) ? issue.geometryAudit : []),
        {
          revision: nextGeometryRevision,
          before: issue.geometry || null,
          after: nextGeometry,
          crs: clean(input?.crs, 20) || 'WGS84',
          confirmedBy,
          at: now
        }
      ],
      updatedAt: now
    };
    return this.put(updated);
  }

  async updateDetails(issueId, input, options = {}) {
    const issue = await this.get(issueId);
    if (!issue) {
      const error = new Error('正式问题不存在或不是Business正式问题。');
      error.status = 404;
      error.code = 'OFFICIAL_ISSUE_NOT_FOUND';
      throw error;
    }
    const expectedRevision = Number(input?.expectedRevision);
    const currentRevision = Math.max(1, Number(issue.issueRevision) || 1);
    if (Number.isFinite(expectedRevision) && expectedRevision !== currentRevision) {
      const error = new Error('正式问题已被其他修改覆盖，请刷新后重试。');
      error.status = 409;
      error.code = 'ISSUE_REVISION_CONFLICT';
      throw error;
    }
    const updatedBy = clean(input?.updatedBy, 120);
    if (!updatedBy) {
      const error = new Error('请填写修改人员。');
      error.status = 400;
      error.code = 'ISSUE_UPDATER_REQUIRED';
      throw error;
    }
    const severity = input?.severity == null ? issue.severity : clean(input.severity, 20).toLowerCase();
    if (!['high', 'medium', 'low'].includes(severity)) {
      const error = new Error('风险等级必须为high、medium或low。');
      error.status = 400;
      error.code = 'INVALID_SEVERITY';
      throw error;
    }
    const title = input?.title == null ? issue.title : clean(input.title, 120);
    if (!title) {
      const error = new Error('问题标题不能为空。');
      error.status = 400;
      error.code = 'ISSUE_TITLE_REQUIRED';
      throw error;
    }
    const now = options.now || new Date().toISOString();
    const nextRevision = currentRevision + 1;
    const updated = {
      ...issue,
      title,
      description: input?.description == null ? issue.description : clean(input.description, 2000),
      evidence: input?.evidence == null ? issue.evidence : clean(input.evidence, 2000),
      severity,
      categoryCode: input?.categoryCode == null ? issue.categoryCode : clean(input.categoryCode, 50),
      categoryName: input?.categoryName == null ? issue.categoryName : clean(input.categoryName, 120),
      suggestion: input?.suggestion == null ? issue.suggestion : clean(input.suggestion, 2000),
      issueRevision: nextRevision,
      auditTrail: [
        ...(Array.isArray(issue.auditTrail) ? issue.auditTrail : []),
        {
          revision: nextRevision,
          action: 'details_update',
          actor: updatedBy,
          at: now
        }
      ],
      updatedAt: now
    };
    return this.put(updated);
  }

  async createFromCandidates(candidates, analysis, reviewerName, options = {}) {
    const issues = candidates.map((candidate) =>
      officialIssueFromCandidate(candidate, analysis, reviewerName, options)
    );
    for (const issue of issues) await this.put(issue);
    return issues;
  }
}
