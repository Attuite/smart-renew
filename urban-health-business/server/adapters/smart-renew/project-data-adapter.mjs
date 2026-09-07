import { itemsFrom } from './client.mjs';

function queryString(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export class ProjectDataAdapter {
  constructor(client) {
    this.client = client;
  }

  async list(projectId, filters = {}) {
    const payload = await this.client.request('/api/project-data' + queryString({
      projectId,
      ...filters
    }));
    return {
      items: itemsFrom(payload),
      stats: payload?.stats || null,
      storage: payload?.storage || null
    };
  }

  async get(recordId) {
    return this.client.request(`/api/project-data/${encodeURIComponent(recordId)}`);
  }

  async importRecords(projectId, records, options = {}) {
    return this.client.request('/api/project-data/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        records,
        mode: options.mode || 'append'
      })
    });
  }

  async rebuild(projectId) {
    return this.client.request(
      `/api/projects/${encodeURIComponent(projectId)}/data-index/rebuild`,
      { method: 'POST' }
    );
  }

  async stats(projectId) {
    return this.client.request(
      `/api/projects/${encodeURIComponent(projectId)}/data-index/stats`
    );
  }

  async export(projectId) {
    return this.client.request(
      `/api/projects/${encodeURIComponent(projectId)}/data-export`
    );
  }
}
