class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status || 0;
    this.code = options.code || 'REQUEST_FAILED';
    this.details = options.details || {};
    this.requestId = options.requestId || null;
  }
}

async function request(pathname, options = {}) {
  const response = await fetch(pathname, {
    cache: 'no-store',
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || payload?.message || `请求失败（${response.status}）`,
      {
        status: response.status,
        code: payload?.error?.code || payload?.code,
        details: payload?.error?.details,
        requestId: payload?.requestId
      }
    );
  }
  return payload?.ok === true ? payload.data : payload;
}

async function download(pathname) {
  const response = await fetch(pathname, {
    cache: 'no-store',
    headers: { accept: 'application/octet-stream' }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message || payload?.message || `下载失败（${response.status}）`,
      {
        status: response.status,
        code: payload?.error?.code || payload?.code,
        details: payload?.error?.details,
        requestId: payload?.requestId
      }
    );
  }
  const disposition = response.headers.get('content-disposition') || '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || 'project-data.sqlite';
  return {
    blob: await response.blob(),
    filename
  };
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

export const api = {
  async meta() {
    return request('/api/meta');
  },

  async gisConfig() {
    return request('/api/gis/config');
  },

  async projects() {
    return itemsFrom(await request('/api/projects'));
  },

  async createProject(input) {
    const payload = await request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async project(projectId) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}`);
    return payload?.item || payload?.data?.item || payload;
  },

  async updateProject(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async summary(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/summary`);
  },

  async workflow(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/workflow`);
  },

  async projectData(projectId, filters = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query}` : '';
    return request(`/api/projects/${encodeURIComponent(projectId)}/project-data${suffix}`);
  },

  async importProjectData(projectId, input) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/project-data`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async exportProjectData(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/project-data/export`);
  },

  async importProjectDataSqlite(projectId, input) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/project-data/sqlite-import`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async projectDataImports(projectId) {
    return itemsFrom(await request(
      `/api/projects/${encodeURIComponent(projectId)}/project-data/imports`
    ));
  },

  async rebuildProjectData(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/project-data/rebuild`, {
      method: 'POST',
      body: '{}'
    });
  },

  async downloadProjectDataSqlite(projectId) {
    return download(`/api/projects/${encodeURIComponent(projectId)}/project-data/sqlite-export`);
  },

  async fieldCommunities(projectId) {
    return itemsFrom(await request(
      `/api/projects/${encodeURIComponent(projectId)}/field/communities`
    ));
  },

  async fieldBuildings(projectId, communityId) {
    return itemsFrom(await request(
      `/api/projects/${encodeURIComponent(projectId)}/field/communities/${encodeURIComponent(communityId)}/buildings`
    ));
  },

  async fieldTasks(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/field/tasks`);
  },

  async createFieldTask(projectId, input) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/field/tasks`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async legacyMigration(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/legacy-migration`);
  },

  async applyLegacyMigration(projectId, input) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/legacy-migration`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async communities(projectId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/communities`));
  },

  async addCommunity(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/communities`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async updateCommunity(projectId, communityId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/communities/${encodeURIComponent(communityId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async updateBoundary(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/boundary`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async importBoundary(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/boundary/import`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async boundaryRevisions(projectId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/boundary`));
  },

  async geocode(projectId, input) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/gis/geocode`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async collectionValidation(projectId) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/collection/validation`);
  },

  async collectionValidationRuns(projectId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/collection/validation-runs`));
  },

  async validateCollection(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/collection/validate`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async buildings(projectId, communityId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/communities/${encodeURIComponent(communityId)}/buildings`));
  },

  async addBuilding(projectId, communityId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/communities/${encodeURIComponent(communityId)}/buildings`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async updateBuilding(projectId, communityId, buildingId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/communities/${encodeURIComponent(communityId)}/buildings/${encodeURIComponent(buildingId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async photos(projectId, includeInactive = false) {
    return itemsFrom(await request(`/api/photos?projectId=${encodeURIComponent(projectId)}${includeInactive ? '&includeInactive=true' : ''}`));
  },

  async updatePhotoMetadata(projectId, photoId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/photos/${encodeURIComponent(photoId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async batchUpdatePhotoMetadata(projectId, input) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/photos/batch-metadata`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async sourceAssets(projectId, includeInactive = false) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/assets${includeInactive ? '?includeInactive=true' : ''}`));
  },

  async createSourceAsset(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.asset || payload?.item || payload;
  },

  async uploadSourceAssetContent(assetId, file, mimeType) {
    const payload = await request(`/api/assets/${encodeURIComponent(assetId)}/content`, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': mimeType }
    });
    return payload?.item || payload;
  },

  async updateSourceAsset(projectId, assetId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async sourceAssetPreview(assetId) {
    return request(`/api/assets/${encodeURIComponent(assetId)}/preview?maxRows=20`);
  },

  async uploadPhoto(input) {
    const payload = await request('/api/photos/upload', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async uploadSessions(projectId) {
    return itemsFrom(await request(`/api/uploads?projectId=${encodeURIComponent(projectId)}`));
  },

  async createUploadSession(input) {
    return request('/api/uploads', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async uploadSessionContent(sessionId, file) {
    return request(`/api/uploads/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type }
    });
  },

  async cancelUploadSession(sessionId) {
    return request(`/api/uploads/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async analyses(projectId) {
    return itemsFrom(await request(`/api/analysis-records?projectId=${encodeURIComponent(projectId)}`));
  },

  async createAnalysis(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/analyses`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async analysisJobs(projectId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/analysis-jobs`));
  },

  async createAnalysisJob(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/analysis-jobs`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.job || payload?.item || payload;
  },

  async analysisJob(jobId) {
    const payload = await request(`/api/analysis-jobs/${encodeURIComponent(jobId)}`);
    return payload?.item || payload;
  },

  async analysisJobCandidates(jobId) {
    return itemsFrom(await request(`/api/analysis-jobs/${encodeURIComponent(jobId)}/candidates`));
  },

  async updateAnalysisCandidate(candidateId, input) {
    const payload = await request(`/api/analysis-candidates/${encodeURIComponent(candidateId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async cancelAnalysisJob(jobId) {
    const payload = await request(`/api/analysis-jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    return payload?.item || payload;
  },

  async retryAnalysisJob(jobId) {
    const payload = await request(`/api/analysis-jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    return payload?.job || payload?.item || payload;
  },

  async finalizeReview(analysisId, input) {
    return request(`/api/analyses/${encodeURIComponent(analysisId)}/review/finalize`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async manualReviews(projectId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/manual-reviews`));
  },

  async createManualIssue(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/issues`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async finalizeManualReview(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/manual-reviews`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.session || payload?.item || payload;
  },

  async updateIssue(issueId, input) {
    const payload = await request(`/api/issues/${encodeURIComponent(issueId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async issues(projectId) {
    return itemsFrom(await request(`/api/issues?projectId=${encodeURIComponent(projectId)}`));
  },

  async updateIssueGeometry(issueId, input) {
    const payload = await request(`/api/issues/${encodeURIComponent(issueId)}/geometry`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async spatialAnalyses(projectId) {
    return itemsFrom(await request(`/api/projects/${encodeURIComponent(projectId)}/spatial-analyses`));
  },

  async runPoiAnalysis(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/poi-analyses`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async createSpatialAnalysis(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/spatial-analyses`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async indicatorMeta() {
    return request('/api/indicator-engine/meta');
  },

  async reports(projectId) {
    return itemsFrom(await request(`/api/reports?projectId=${encodeURIComponent(projectId)}`));
  },

  async compareReports(projectId, baseReportId, targetReportId) {
    const query = new URLSearchParams({ baseReportId, targetReportId });
    return request(`/api/projects/${encodeURIComponent(projectId)}/reports/compare?${query}`);
  },

  async createReport(projectId, input) {
    const payload = await request(`/api/projects/${encodeURIComponent(projectId)}/reports`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  },

  async updateReport(reportId, input) {
    const payload = await request(`/api/reports/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload?.item || payload;
  }
};

export { ApiError };
