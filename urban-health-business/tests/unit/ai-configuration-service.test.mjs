import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AiConfigurationRepository } from '../../server/repositories/ai-configuration-repository.mjs';
import {
  createUserScopedAiClient,
  publicAiConfiguration,
  updateAiPreferences
} from '../../server/services/ai-configuration-service.mjs';

test('AI keys are encrypted per user and public metadata never returns plaintext', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-config-'));
  try {
    const repository = new AiConfigurationRepository(root);
    const first = await repository.setKey('user-a', '用户A', 'sk-user-a-secret-123456', {
      now: '2026-08-09T00:00:00.000Z'
    });
    await repository.setKey('user-b', '用户B', 'sk-user-b-secret-654321');
    assert.equal(await repository.resolveKey('user-a'), 'sk-user-a-secret-123456');
    assert.equal(await repository.resolveKey('user-b'), 'sk-user-b-secret-654321');
    const publicMeta = publicAiConfiguration(first);
    assert.equal(publicMeta.ready, true);
    assert.equal(publicMeta.keyHint, '****3456');
    assert.equal('encryptedKey' in publicMeta, false);
    const files = await readdir(root);
    const stored = await Promise.all(files.filter((name) => name.endsWith('.json'))
      .map((name) => readFile(path.join(root, name), 'utf8')));
    assert.equal(stored.some((text) => text.includes('sk-user-')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('user-scoped AI client uses only the selected user key and preferences', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-client-'));
  try {
    const repository = new AiConfigurationRepository(root);
    const configured = await repository.setKey('user-a', '用户A', 'sk-user-a-secret-123456');
    await updateAiPreferences(repository, { userId: 'user-a', displayName: '用户A' }, {
      model: 'qwen3-vl-flash',
      timeoutMs: 30000,
      maxImagesPerBatch: 5,
      expectedRevision: configured.revision
    });
    let authorization = '';
    let requestedModel = '';
    const client = createUserScopedAiClient({}, repository, 'user-a', {
      async fetchImpl(_url, options) {
        authorization = options.headers.Authorization;
        requestedModel = JSON.parse(options.body).model;
        return {
          ok: true,
          status: 200,
          async json() {
            return { id: 'REQ-1', model: requestedModel, choices: [{ message: { content: '{"issues":[]}' } }] };
          }
        };
      }
    });
    assert.equal((await client.health()).ready, true);
    const result = await client.analyzeVision({
      images: ['data:image/jpeg;base64,AA=='],
      prompt: '检查',
      maxTokens: 1000
    });
    assert.equal(authorization, 'Bearer sk-user-a-secret-123456');
    assert.equal(requestedModel, 'qwen3-vl-flash');
    assert.equal(result.content, '{"issues":[]}');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
