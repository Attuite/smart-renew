import { itemsFrom } from './client.mjs';

function itemFrom(payload) {
  return payload?.item || payload?.data?.item || payload;
}

export class FieldAdapter {
  constructor(client) {
    this.client = client;
  }

  async listProjects() {
    return itemsFrom(await this.client.request('/api/field/projects'));
  }

  async listCommunities(projectId) {
    return itemsFrom(await this.client.request(
      `/api/field/projects/${encodeURIComponent(projectId)}/communities`
    ));
  }

  async listBuildings(projectId, communityId) {
    return itemsFrom(await this.client.request(
      `/api/field/projects/${encodeURIComponent(projectId)}/communities/${encodeURIComponent(communityId)}/buildings`
    ));
  }

  async createTask(input) {
    return itemFrom(await this.client.request('/api/field/collection-tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    }));
  }

  async getTask(taskId) {
    return itemFrom(await this.client.request(
      `/api/field/collection-tasks/${encodeURIComponent(taskId)}`
    ));
  }
}
