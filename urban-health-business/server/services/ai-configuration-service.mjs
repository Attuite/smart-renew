const ALLOWED_MODELS = new Set([
  'qwen3-vl-plus',
  'qwen3-vl-flash',
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen2.5-vl-72b-instruct'
]);

function configError(message, status = 400, code = 'AI_CONFIG_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

export function aiUserIdentity(identity) {
  return identity?.authenticated
    ? { userId: identity.userId, displayName: identity.displayName || identity.userId }
    : { userId: 'local-development-user', displayName: '本地开发用户' };
}

export function publicAiConfiguration(record) {
  return {
    userId: record?.userId || null,
    displayName: record?.displayName || null,
    ready: Boolean(record?.encryptedKey),
    keyHint: record?.encryptedKey ? `****${record.keyLast4 || ''}` : null,
    preferences: record?.preferences || {
      model: process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus',
      timeoutMs: 120000,
      maxImagesPerBatch: 20
    },
    revision: Math.max(0, Number(record?.revision) || 0),
    configuredAt: record?.configuredAt || null,
    updatedAt: record?.updatedAt || null
  };
}

export async function getAiConfiguration(repository, user) {
  return publicAiConfiguration(await repository.get(user.userId));
}

export async function updateAiPreferences(repository, user, input = {}) {
  const model = String(input.model || '').trim();
  if (!ALLOWED_MODELS.has(model)) {
    throw configError('所选AI模型不受支持。', 400, 'AI_MODEL_INVALID', { models: [...ALLOWED_MODELS] });
  }
  const timeoutMs = Math.round(Number(input.timeoutMs));
  if (!Number.isFinite(timeoutMs) || timeoutMs < 10000 || timeoutMs > 300000) {
    throw configError('AI超时必须在10000到300000毫秒之间。', 400, 'AI_TIMEOUT_INVALID');
  }
  const maxImagesPerBatch = Math.round(Number(input.maxImagesPerBatch));
  if (!Number.isInteger(maxImagesPerBatch) || maxImagesPerBatch < 1 || maxImagesPerBatch > 20) {
    throw configError('单批图片数必须在1到20之间。', 400, 'AI_BATCH_SIZE_INVALID');
  }
  const record = await repository.setPreferences(user.userId, user.displayName, {
    model,
    timeoutMs,
    maxImagesPerBatch
  }, { expectedRevision: input.expectedRevision });
  return publicAiConfiguration(record);
}

export async function checkAiConfiguration(repository, user, options = {}) {
  const record = await repository.get(user.userId);
  if (!record?.encryptedKey) {
    throw configError('当前用户尚未配置AI Key。', 409, 'AI_KEY_NOT_CONFIGURED');
  }
  const key = await repository.resolveKey(user.userId);
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(15000, record.preferences?.timeoutMs || 15000));
  try {
    const response = await fetchImpl(
      `${String(process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')}/models`,
      { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal }
    );
    if (response.status === 401 || response.status === 403) {
      throw configError('AI Key 无效或没有访问权限。', 422, 'AI_KEY_UNAUTHORIZED');
    }
    if (response.status === 429) throw configError('AI服务配额已用尽或请求受限。', 429, 'AI_QUOTA_EXCEEDED');
    if (!response.ok) throw configError('AI服务健康检查失败。', 502, 'AI_UPSTREAM_FAILED');
    return { ready: true, model: record.preferences?.model, checkedAt: new Date().toISOString() };
  } catch (error) {
    if (error.name === 'AbortError') throw configError('AI服务健康检查超时。', 504, 'AI_UPSTREAM_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createUserScopedAiClient(baseClient, repository, userId, options = {}) {
  const client = Object.create(baseClient);
  client.health = async () => {
    const record = await repository.get(userId);
    return {
      ready: Boolean(record?.encryptedKey),
      model: record?.preferences?.model || process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus',
      userScoped: true
    };
  };
  client.analyzeVision = async (input) => {
    const record = await repository.get(userId);
    const key = await repository.resolveKey(userId);
    if (!record?.encryptedKey || !key) {
      throw configError('当前用户尚未配置AI Key。', 503, 'AI_KEY_NOT_CONFIGURED');
    }
    const images = Array.isArray(input?.images) ? input.images : [];
    const maxImages = Math.max(1, Math.min(20, Number(record.preferences?.maxImagesPerBatch) || 20));
    if (!images.length || images.length > maxImages) {
      throw configError(`单批图片数量必须为1到${maxImages}张。`, 400, 'AI_BATCH_SIZE_INVALID');
    }
    const content = [{ type: 'text', text: String(input.prompt || '') }];
    for (const image of images) content.push({ type: 'image_url', image_url: { url: image } });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(10000, Math.min(300000, Number(record.preferences?.timeoutMs) || 120000))
    );
    try {
      const fetchImpl = options.fetchImpl || fetch;
      const response = await fetchImpl(
        `${String(process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: record.preferences?.model || 'qwen3-vl-plus',
            messages: [
              { role: 'system', content: '你是一位专业的住区安全体检专家。只输出符合要求的 JSON。' },
              { role: 'user', content }
            ],
            max_tokens: Math.max(500, Math.min(8000, Number(input.maxTokens) || 5000)),
            temperature: Math.max(0, Math.min(1, Number(input.temperature) || 0.2)),
            top_p: Math.max(0.1, Math.min(1, Number(input.topP) || 0.9)),
            response_format: { type: 'json_object' }
          })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        throw configError('AI Key 无效或没有访问权限。', 422, 'AI_KEY_UNAUTHORIZED');
      }
      if (response.status === 429) throw configError('AI服务配额已用尽或请求受限。', 429, 'AI_QUOTA_EXCEEDED');
      if (!response.ok) throw configError(data.message || 'AI模型请求失败。', 502, 'AI_UPSTREAM_FAILED');
      const answer = data.choices?.[0]?.message?.content;
      if (!answer) throw configError('模型没有返回可解析内容。', 502, 'AI_RESPONSE_EMPTY');
      return {
        content: answer,
        requestId: data.request_id || data.id || '',
        model: data.model || record.preferences?.model,
        usage: data.usage || null
      };
    } catch (error) {
      if (error.name === 'AbortError') throw configError('AI模型请求超时。', 504, 'AI_UPSTREAM_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
  return client;
}

export { ALLOWED_MODELS };
