import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeProjectId(value) {
  const id = String(value || '');
  if (!/^\d+$/.test(id)) {
    const error = new Error('项目编号无效。');
    error.status = 400;
    error.code = 'INVALID_PROJECT_ID';
    throw error;
  }
  return id;
}

export class BoundaryRevisionRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async putFromProject(project) {
    await this.ensure();
    const projectId = safeProjectId(project?.id);
    const revision = Math.max(1, Number(project?.revision) || 1);
    const item = {
      id: `BNDREV-${projectId}-${revision}`,
      projectId,
      projectRevision: revision,
      coordinates: Array.isArray(project.scopeBoundary) ? project.scopeBoundary : [],
      geometry: project.scopeBoundaryGeometry || (
        Array.isArray(project.scopeBoundary) && project.scopeBoundary.length >= 3
          ? {
              type: 'Polygon',
              coordinates: [[...project.scopeBoundary, project.scopeBoundary[0]]]
            }
          : null
      ),
      crs: project.scopeBoundaryCrs || 'WGS84',
      source: project.scopeBoundarySource || null,
      sourceAssetId: project.scopeBoundarySourceAssetId || null,
      sourceAssetContentHash: project.scopeBoundarySourceAssetContentHash || null,
      areaSqKm: Number(project.scopeAreaSqKm) || 0,
      center: Array.isArray(project.scopeCenter) ? project.scopeCenter : null,
      bounds: Array.isArray(project.scopeBounds) ? project.scopeBounds : null,
      polygonCount: Number(project.scopePolygonCount) || 1,
      holeCount: Number(project.scopeHoleCount) || 0,
      updatedBy: project.boundaryUpdatedBy || '',
      createdAt: project.boundaryUpdatedAt || project.updatedAt || new Date().toISOString(),
      schemaVersion: '1.1.0'
    };
    const target = path.join(this.root, `${item.id}.json`);
    const temporary = path.join(this.root, `${item.id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(item), 'utf8');
    await rename(temporary, target);
    return item;
  }

  async list(projectId = '') {
    await this.ensure();
    const requested = projectId ? safeProjectId(projectId) : '';
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const revision = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (requested && String(revision.projectId) !== requested) continue;
      items.push(revision);
    }
    return items.sort((a, b) => Number(b.projectRevision) - Number(a.projectRevision));
  }
}
