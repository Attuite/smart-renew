import { itemsFrom } from './client.mjs';

function itemFrom(payload) {
  return payload?.item || payload?.data?.item || payload;
}

export class ReportSnapshotAdapter {
  constructor(client) {
    this.client = client;
  }

  async list(projectId = '') {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return itemsFrom(await this.client.request(`/api/reports${query}`));
  }

  async get(reportId) {
    return itemFrom(await this.client.request(
      `/api/reports/${encodeURIComponent(reportId)}`
    ));
  }
}
