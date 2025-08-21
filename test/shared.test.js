import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { collectFields, observeFields } from '../shared/apiValueTracker.js';

test('collectFields flattens objects', () => {
  const fields = collectFields({ a: { b: 1 }, c: 'd' });
  assert.deepEqual(fields, [
    { path: 'a.b', value: '1', firstSeenMs: null, lastCheckedMs: 0 },
    { path: 'c', value: 'd', firstSeenMs: null, lastCheckedMs: 0 }
  ]);
});

test('observeFields records firstSeenMs', { concurrency: false }, async () => {
  let observerCallback;
  class FakeMutationObserver {
    constructor(cb) {
      observerCallback = cb;
    }
    observe() {}
    disconnect() {}
  }

  const body = { innerText: '' };
  const win = {
    document: { body },
    MutationObserver: FakeMutationObserver,
    performance: { now: () => performance.now() },
    setTimeout,
    clearTimeout
  };

  const fields = collectFields({ foo: 'bar' });
  let logged;
  observeFields(win, fields, 'url', (result) => { logged = result; }, 50);

  body.innerText = 'bar';
  observerCallback();

  await new Promise((r) => setTimeout(r, 0));
  const field = logged.fields[0];
  assert.equal(logged.url, 'url');
  assert.equal(field.path, 'foo');
  assert.equal(field.value, 'bar');
  assert.ok(field.firstSeenMs > 0);
  assert.equal(field.firstSeenMs, field.lastCheckedMs);
});
