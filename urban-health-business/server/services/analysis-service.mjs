const CATEGORY_CODES = new Set([
  'STRUCTURE',
  'FACADE',
  'ROOF_LEAK',
  'FIRE',
  'ELECTRIC_GAS',
  'ROAD_ACCESS',
  'PUBLIC_FACILITY',
  'PUBLIC_SPACE',
  'OTHER'
]);

const ANALYSIS_TYPES = new Set([
  '建筑外立面隐患识别',
  '结构安全可见风险初筛',
  '屋面渗漏与防水问题识别',
  '公共设施损坏识别',
  '消防安全隐患排查',
  '电气与燃气可见风险排查',
  '道路与无障碍问题识别',
  '综合巡检分析'
]);

function clean(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function apiError(message, status = 400, code = 'ANALYSIS_VALIDATION_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizedBbox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const numbers = value.map(Number);
  if (numbers.some((number) => !Number.isFinite(number))) return null;
  const [x1, y1, x2, y2] = numbers.map((number) => Math.round(clamp(number, 0, 999, 0)));
  return x1 < x2 && y1 < y2 ? [x1, y1, x2, y2] : null;
}

function normalizedConfidence(value) {
  if (value === null || value === undefined || value === '') return null;
  return clamp(value, 0, 1, null);
}

export function parseModelContent(content) {
  const source = clean(content, 500_000);
  const withoutFence = source
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(withoutFence);
    if (!parsed || typeof parsed !== 'object') throw new Error('not_object');
    return parsed;
  } catch {
    throw apiError('模型返回内容不是有效JSON。', 502, 'AI_RESPONSE_INVALID');
  }
}

export function normalizeAnalysisResult(payload, options = {}) {
  const photoIds = Array.isArray(options.photoIds) ? options.photoIds.map(String) : [];
  const analysisId = String(options.analysisId || '');
  const issues = Array.isArray(payload?.issues) ? payload.issues : [];
  const candidates = issues.map((issue, index) => {
    const imageIndex = Math.max(1, Math.min(photoIds.length || 1, Math.trunc(Number(issue?.imageIndex) || 1)));
    const requestedCode = clean(issue?.categoryCode, 40).toUpperCase();
    const categoryCode = CATEGORY_CODES.has(requestedCode) ? requestedCode : 'OTHER';
    const requestedSeverity = clean(issue?.severity, 20).toLowerCase();
    const severity = ['high', 'medium', 'low'].includes(requestedSeverity) ? requestedSeverity : 'medium';
    return {
      id: `CAND-${analysisId}-${String(index + 1).padStart(4, '0')}`,
      analysisId,
      photoId: photoIds[imageIndex - 1] || '',
      imageIndex,
      severity,
      categoryCode,
      categoryName: clean(issue?.categoryName || categoryCode, 80),
      title: clean(issue?.title || '未命名候选问题', 80),
      desc: clean(issue?.desc, 2000),
      evidence: clean(issue?.evidence, 2000),
      location: clean(issue?.location, 500),
      bbox: normalizedBbox(issue?.bbox),
      confidence: normalizedConfidence(issue?.confidence),
      suggestion: clean(issue?.suggestion, 2000),
      reviewStatus: 'pending',
      createdAt: options.now || new Date().toISOString()
    };
  });

  return {
    summary: clean(payload?.summary, 4000),
    issues: candidates
  };
}

export function summarizeCandidates(candidates) {
  const items = Array.isArray(candidates) ? candidates : [];
  const confidences = items
    .filter((item) => item?.confidence !== null && item?.confidence !== undefined && item?.confidence !== '')
    .map((item) => Number(item.confidence))
    .filter(Number.isFinite);
  return {
    total: items.length,
    risk: {
      high: items.filter((item) => item.severity === 'high').length,
      medium: items.filter((item) => item.severity === 'medium').length,
      low: items.filter((item) => item.severity === 'low').length
    },
    averageConfidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null
  };
}

export function buildAnalysisPrompt(project, input, imageCount) {
  const requestedType = clean(input?.analysisType, 80);
  const analysisType = ANALYSIS_TYPES.has(requestedType) ? requestedType : '综合巡检分析';
  const focus = clean(input?.description, 1000);
  return [
    '你是一位专业的住区安全体检专家。',
    `项目：${clean(project?.name, 120) || '未命名项目'}`,
    `区域：${clean(project?.area, 160) || '未填写'}`,
    `分析类型：${analysisType}`,
    focus ? `重点关注：${focus}` : '',
    `请逐张检查本次提供的${imageCount}张真实现场照片，只识别有清晰视觉证据的问题，不得臆测不可见信息。`,
    '分类编码只能使用：STRUCTURE、FACADE、ROOF_LEAK、FIRE、ELECTRIC_GAS、ROAD_ACCESS、PUBLIC_FACILITY、PUBLIC_SPACE、OTHER。',
    '只返回合法JSON，结构为：{"summary":"总体结论","issues":[{"severity":"high|medium|low","categoryCode":"分类编码","categoryName":"分类中文名","title":"标题","desc":"描述","evidence":"可见证据","location":"照片内位置","imageIndex":1,"bbox":[x1,y1,x2,y2],"confidence":0.0,"suggestion":"建议"}]}。',
    `imageIndex必须在1到${imageCount}之间；bbox使用0-999归一化坐标且x1<x2、y1<y2。无法判断时不要编造。`
  ].filter(Boolean).join('\n');
}

function analysisId(options = {}) {
  return String((options.nowMs ?? Date.now()) * 100 + (options.randomPart ?? Math.floor(Math.random() * 100)));
}

export async function runAnalysis(client, projectId, input, options = {}) {
  const requestedPhotoIds = [...new Set(
    (Array.isArray(input?.photoIds) ? input.photoIds : []).map((item) => clean(item, 120)).filter(Boolean)
  )];
  if (!requestedPhotoIds.length) throw apiError('请至少选择一张真实照片。', 400, 'PHOTO_REQUIRED');
  if (requestedPhotoIds.length > 20) throw apiError('单次分析最多选择20张照片。', 400, 'PHOTO_LIMIT_EXCEEDED');

  const [project, projectPhotos, health] = await Promise.all([
    client.getProject(projectId),
    client.listPhotos({ projectId }),
    client.health()
  ]);
  if (!health?.ready) throw apiError('视觉AI尚未配置。', 503, 'AI_NOT_CONFIGURED');

  const photoMap = new Map(projectPhotos.items.map((photo) => [String(photo.id), photo]));
  const selected = requestedPhotoIds.map((id) => photoMap.get(id));
  if (selected.some((photo) => !photo)) {
    throw apiError('所选照片不属于当前项目或已不存在。', 400, 'PHOTO_NOT_FOUND');
  }

  const id = options.id || analysisId(options);
  const now = options.now || new Date().toISOString();
  const type = ANALYSIS_TYPES.has(clean(input?.analysisType, 80))
    ? clean(input.analysisType, 80)
    : '综合巡检分析';
  const baseRecord = {
    id,
    projectId: String(project.id),
    projectName: project.name || '',
    area: project.area || '',
    analysisType: type,
    description: clean(input?.description, 1000),
    imagesCount: selected.length,
    photoIds: requestedPhotoIds,
    status: 'running',
    createdAt: now,
    timestamp: now,
    analysisJobId: String(options.jobId || '') || null,
    analysisBatchId: String(options.batchId || '') || null,
    batchIndex: Number(options.batchIndex) || 1,
    batchCount: Number(options.batchCount) || 1,
    promptVersion: String(options.promptVersion || 'business-residential-v1'),
    schemaVersion: '1.0.0'
  };
  await client.putAnalysis(baseRecord);

  try {
    const images = [];
    for (const photo of selected) {
      const binary = await client.getPhotoContent(photo.id);
      images.push(`data:${binary.contentType};base64,${binary.bytes.toString('base64')}`);
    }
    const prompt = buildAnalysisPrompt(project, input, images.length);
    const response = await client.analyzeVision({
      images,
      prompt,
      model: health.model,
      temperature: 0.2,
      maxTokens: 5000,
      topP: 0.9
    });
    const result = normalizeAnalysisResult(parseModelContent(response?.content), {
      analysisId: id,
      photoIds: requestedPhotoIds,
      now
    });
    const completed = {
      ...baseRecord,
      status: 'reviewing',
      completedAt: new Date().toISOString(),
      result,
      reviewIssues: result.issues,
      summary: summarizeCandidates(result.issues),
      model: response?.model || health.model || null,
      modelRequestId: response?.requestId || null,
      usage: response?.usage || null
    };
    await client.putAnalysis(completed);
    return completed;
  } catch (error) {
    await client.putAnalysis({
      ...baseRecord,
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: {
        code: error.code || 'ANALYSIS_FAILED',
        message: error.message
      }
    }).catch(() => {});
    throw error;
  }
}
