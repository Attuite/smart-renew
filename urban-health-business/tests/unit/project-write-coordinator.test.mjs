import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectWriteCoordinator } from '../../server/services/project-write-coordinator.mjs';

test('writes for the same project are serialized while different projects stay independent', async () => {
  const coordinator = new ProjectWriteCoordinator();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = coordinator.run('P-1', async () => {
    events.push('first:start');
    await firstGate;
    events.push('first:end');
  });
  const second = coordinator.run('P-1', async () => {
    events.push('second:start');
    events.push('second:end');
  });
  const other = coordinator.run('P-2', async () => {
    events.push('other:start');
    events.push('other:end');
  });

  await other;
  assert.equal(events.includes('second:start'), false);
  releaseFirst();
  await Promise.all([first, second]);
  assert.ok(events.indexOf('first:end') < events.indexOf('second:start'));
  assert.ok(events.indexOf('other:start') < events.indexOf('first:end'));
});
