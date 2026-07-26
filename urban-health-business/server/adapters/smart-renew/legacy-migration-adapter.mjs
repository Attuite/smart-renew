export class LegacyMigrationAdapter {
  constructor(client) {
    this.client = client;
  }

  async audit(projectId) {
    return this.client.request(
      `/api/migrations/legacy?projectId=${encodeURIComponent(projectId)}`
    );
  }

  async apply(projectId, options = {}) {
    if (options.confirmed !== true) {
      const error = new Error('旧数据迁移必须显式确认。');
      error.status = 400;
      error.code = 'LEGACY_MIGRATION_CONFIRMATION_REQUIRED';
      throw error;
    }
    return this.client.request('/api/migrations/legacy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        apply: true,
        reviewerName: options.reviewerName || ''
      })
    });
  }
}
