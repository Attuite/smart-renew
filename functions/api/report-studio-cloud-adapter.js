/**
 * report-studio-cloud-adapter.js
 * CloudBase 薄适配层。将共享核心模块与 CloudBase 数据集合对接。
 * 本地 server.mjs 可复用同一批核心文件，仅在存储适配上不同。
 */

import { buildReportContext } from './report-context-core.js';
import { runAllCalculations } from './report-calculation-core.js';

/**
 * 从 CloudBase 集合中读取项目相关数据并构建标准上下文
 * @param {object} params
 * @param {Function} params.getProject - 读取项目
 * @param {Function} params.listPhotos - 列出照片
 * @param {Function} params.listAnalyses - 列出分析批次
 * @param {Function} params.listIssues - 列出正式问题
 * @param {string} params.projectId
 * @returns {object} 标准报告上下文
 */
export async function buildContextFromCloudBase({ getProject, listPhotos, listAnalyses, listIssues, projectId }) {
  if (!projectId) throw new Error('项目编号无效');

  const [project, photos, analyses, issues] = await Promise.all([
    getProject(projectId),
    listPhotos(projectId),
    listAnalyses(projectId),
    listIssues(projectId)
  ]);

  if (!project) throw new Error('项目不存在');

  return buildReportContext({
    project,
    photos,
    analyses,
    officialIssues: issues
  });
}

/**
 * 从本地存储中读取项目相关数据并构建标准上下文
 * @param {object} params
 * @param {Function} params.readJson - 读取 JSON 文件
 * @param {Function} params.listFiles - 列出目录中的 JSON 文件
 * @param {string} params.projectStorage - 项目存储目录
 * @param {string} params.photoStorage - 照片存储目录
 * @param {string} params.analysisStorage - 分析存储目录
 * @param {string} params.issueStorage - 正式问题存储目录
 * @param {string} params.projectId
 * @returns {object} 标准报告上下文
 */
export async function buildContextFromLocal({ readJson, listFiles, projectStorage, photoStorage, analysisStorage, issueStorage, projectId }) {
  if (!projectId) throw new Error('项目编号无效');

  const project = await readJson(`${projectStorage}/${projectId}.json`);
  if (!project) throw new Error('项目不存在');

  const photos = await listFiles(photoStorage);
  const analyses = await listFiles(analysisStorage);
  const issues = await listFiles(issueStorage);

  const projectPhotos = photos.filter((p) => String(p.projectId) === projectId);
  const projectAnalyses = analyses.filter((a) => String(a.projectId) === projectId);
  const projectIssues = issues.filter((i) => String(i.projectId) === projectId);

  return buildReportContext({
    project,
    photos: projectPhotos,
    analyses: projectAnalyses,
    officialIssues: projectIssues
  });
}

/**
 * 运行计算并返回快照
 * @param {object} context - buildReportContext 的输出
 * @returns {object} 计算快照
 */
export function computeReportMetrics(context) {
  return runAllCalculations(context);
}

/**
 * 验证上下文与计算快照的一致性
 * @param {object} context
 * @param {object} calcSnapshot
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateContextSnapshotConsistency(context, calcSnapshot) {
  const errors = [];
  if (context.contextHash !== calcSnapshot.contextHash) {
    errors.push('计算快照的 contextHash 与当前上下文不匹配');
  }
  if (context.projectId !== calcSnapshot.projectId) {
    errors.push('项目编号不一致');
  }
  return { valid: errors.length === 0, errors };
}
