const DEFAULT_BASE = 'http://127.0.0.1:4173';

function normalizeBase(value) {
  return String(value || DEFAULT_BASE).replace(/\/+$/, '');
}

function queryFrom(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

export class SmartRenewClient {
  constructor(options = {}) {
    this.baseUrl = normalizeBase(options.baseUrl || process.env.SMART_RENEW_API_BASE);
    this.timeoutMs = Number(options.timeoutMs || process.env.SMART_RENEW_API_TIMEOUT_MS || 8000);
  }

  url(pathname) {
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${this.baseUrl}${path}`;
  }

  async request(pathname, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url(pathname), {
        ...options,
        headers: {
          accept: 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        const error = new Error(payload?.message || `smart-renew upstream returned ${response.status}`);
        error.status = response.status;
        error.code = payload?.code || 'UPSTREAM_ERROR';
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('smart-renew upstream timed out');
        timeoutError.status = 504;
        timeoutError.code = 'UPSTREAM_TIMEOUT';
        throw timeoutError;
      }
      if (!error?.status) {
        const unavailableError = new Error('无法连接smart-renew后端。');
        unavailableError.status = 502;
        unavailableError.code = 'UPSTREAM_UNAVAILABLE';
        unavailableError.cause = error;
        throw unavailableError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async health() {
    return this.request('/api/health');
  }

  async listProjects(query = '') {
    return itemsFrom(await this.request(`/api/projects${query}`));
  }

  async getProject(projectId) {
    const payload = await this.request(`/api/projects/${encodeURIComponent(projectId)}`);
    return payload?.item || payload?.data?.item || payload;
  }

  async putProject(project) {
    const projectId = String(project?.id || '');
    if (!/^\d+$/.test(projectId)) {
      const error = new Error('smart-renew项目编号必须为数字。');
      error.status = 400;
      error.code = 'INVALID_PROJECT_ID';
      throw error;
    }
    const payload = await this.request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(project)
    });
    return payload?.item || payload?.data?.item || payload;
  }

  async putAnalysis(record) {
    const analysisId = String(record?.id || '');
    if (!/^\d+$/.test(analysisId)) {
      const error = new Error('smart-renew分析编号必须为数字。');
      error.status = 400;
      error.code = 'INVALID_ANALYSIS_ID';
      throw error;
    }
    return this.request(`/api/analysis-records/${encodeURIComponent(analysisId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record)
    });
  }

  async getAnalysis(analysisId) {
    return this.request(`/api/analysis-records/${encodeURIComponent(analysisId)}`);
  }

  async finalizeIssues(input) {
    return this.request('/api/issues/finalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
  }

  async analyzeVision(input) {
    return this.request('/api/vision/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
  }

  async uploadPhoto(input) {
    return this.request('/api/photos/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
  }

  async getPhotoContent(photoId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url(`/api/photos/${encodeURIComponent(photoId)}/content`), {
        headers: { accept: 'image/*' },
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`照片内容读取失败：${response.status}`);
        error.status = response.status;
        error.code = 'PHOTO_CONTENT_UNAVAILABLE';
        throw error;
      }
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || 'image/jpeg'
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async safeList(pathname) {
    try {
      return {
        available: true,
        items: itemsFrom(await this.request(pathname)),
        error: null
      };
    } catch (error) {
      return {
        available: false,
        items: [],
        error: {
          code: error.code || 'UPSTREAM_ERROR',
          message: error.message,
          status: error.status || 500
        }
      };
    }
  }

  async listPhotos(filters = {}) {
    return this.safeList(`/api/photos${queryFrom(filters)}`);
  }

  async listAnalyses(filters = {}) {
    return this.safeList(`/api/analysis-records${queryFrom(filters)}`);
  }

  async listIssues(filters = {}) {
    return this.safeList(`/api/issues${queryFrom(filters)}`);
  }

  async listReports(filters = {}) {
    return this.safeList(`/api/reports${queryFrom(filters)}`);
  }

  async listFieldRecords(filters = {}) {
    return this.safeList(`/api/field-records${queryFrom(filters)}`);
  }

  async listProjectData(filters = {}) {
    return this.safeList(`/api/project-data${queryFrom(filters)}`);
  }

  async projectCollections(projectId) {
    const [photos, analyses, issues, reports, fieldRecords, projectData] = await Promise.all([
      this.listPhotos({ projectId }),
      this.listAnalyses({ projectId }),
      this.listIssues({ projectId }),
      this.listReports({ projectId }),
      this.listFieldRecords({ projectId }),
      this.listProjectData({ projectId })
    ]);
    return { photos, analyses, issues, reports, fieldRecords, projectData };
  }
}
