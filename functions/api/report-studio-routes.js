/**
 * report-studio-routes.js
 * 报告工作台路由处理。本地 server.mjs 和 CloudBase 共享路由逻辑。
 * 各端只提供不同的存储适配函数。
 */

import { buildReportContext } from './report-context-core.js';
import { runAllCalculations } from './report-calculation-core.js';

/**
 * 处理报告工作台 API 请求
 *
 * @param {object} params
 * @param {object} params.req - HTTP 请求
 * @param {object} params.res - HTTP 响应
 * @param {object} params.url - parsed URL
 * @param {Function} params.readJson - 读取请求体 JSON
 * @param {Function} params.writeJson - 写入 JSON 响应
 * @param {Function} params.loadProject - 加载项目
 * @param {Function} params.loadPhotos - 加载照片列表
 * @param {Function} params.loadAnalyses - 加载分析批次列表
 * @param {Function} params.loadIssues - 加载正式问题列表
 * @param {Function} params.loadReportSnapshots - 加载报告快照列表
 * @param {Function} params.saveReportSnapshot - 保存报告快照
 * @returns {boolean} 是否处理了该请求
 */
export async function handleReportStudioRoute({
  req, res, url, readJson, writeJson,
  loadProject, loadPhotos, loadAnalyses, loadIssues,
  loadReportSnapshots, saveReportSnapshot
}) {
  const pathname = url.pathname;

  // 只处理 /api/report-studio 前缀
  if (!pathname.startsWith('/api/report-studio')) return false;

  try {
    // === GET /api/report-studio/projects/{projectId}/context ===
    const contextMatch = pathname.match(/^\/api\/report-studio\/projects\/([^/]+)\/context$/);
    if (req.method === 'GET' && contextMatch) {
      const projectId = contextMatch[1];
      if (!projectId) return writeJson(res, 400, { message: '项目编号无效' });

      const [project, photos, analyses, issues] = await Promise.all([
        loadProject(projectId),
        loadPhotos(projectId),
        loadAnalyses(projectId),
        loadIssues(projectId)
      ]);

      if (!project) return writeJson(res, 404, { message: '项目不存在' });

      const context = buildReportContext({ project, photos, analyses, officialIssues: issues });
      return writeJson(res, 200, { context, storage: 'server' });
    }

    // === POST /api/report-studio/projects/{projectId}/calculations ===
    const calcMatch = pathname.match(/^\/api\/report-studio\/projects\/([^/]+)\/calculations$/);
    if (req.method === 'POST' && calcMatch) {
      const projectId = calcMatch[1];
      if (!projectId) return writeJson(res, 400, { message: '项目编号无效' });

      const [project, photos, analyses, issues] = await Promise.all([
        loadProject(projectId),
        loadPhotos(projectId),
        loadAnalyses(projectId),
        loadIssues(projectId)
      ]);

      if (!project) return writeJson(res, 404, { message: '项目不存在' });

      const context = buildReportContext({ project, photos, analyses, officialIssues: issues });
      const snapshot = runAllCalculations(context);
      return writeJson(res, 200, { snapshot, storage: 'server' });
    }

    // === GET /api/report-studio/projects/{projectId}/drafts ===
    const draftsMatch = pathname.match(/^\/api\/report-studio\/projects\/([^/]+)\/drafts$/);
    if (req.method === 'GET' && draftsMatch) {
      // 阶段 5+ 实现
      return writeJson(res, 200, { items: [], storage: 'server', note: '草稿功能将在阶段5实现' });
    }

    // === 未匹配的路由 ===
    return writeJson(res, 404, { message: '报告工作台接口不存在' });

  } catch (error) {
    return writeJson(res, 400, { message: error.message || '报告工作台请求失败' });
  }
}
