import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const commands = {};
let windowHandler;

global.Cypress = {
  on: (event, fn) => {
    if (event === 'window:before:load') {
      windowHandler = fn;
    }
  },
  Commands: {
    add: (name, fn) => {
      commands[name] = fn;
    }
  }
};

global.cy = { wrap: (x) => x };

await import('cypress-api-value-seen');

test('cypress plugin registers custom commands', () => {
  assert.deepEqual(Object.keys(commands).sort(), ['getApiReport', 'startApiRecording', 'stopApiRecording']);
});

function createWin(responseData) {
  const body = { innerText: '' };
  let observerCallback;
  class FakeMutationObserver {
    constructor(cb) {
      observerCallback = cb;
    }
    observe() {}
    disconnect() {}
  }

  const win = {
    document: { body },
    MutationObserver: FakeMutationObserver,
    performance: { now: () => performance.now() },
    setTimeout,
    clearTimeout,
    fetch: async () => new ResponseStub(responseData),
    XMLHttpRequest: function () {}
  };

  win.XMLHttpRequest.prototype = {
    open() {},
    send() {},
    addEventListener() {}
  };

  win.triggerMutation = () => observerCallback && observerCallback();

  return win;
}

class ResponseStub {
  constructor(data) {
    this.data = data;
  }
  clone() {
    return new ResponseStub(this.data);
  }
  async json() {
    return this.data;
  }
}

test('records firstSeenMs when value appears in DOM', { concurrency: false }, async () => {
  const win = createWin({ foo: 'bar' });
  windowHandler(win);

  commands.startApiRecording({ timeoutMs: 100 });

  await win.fetch('https://example.com/api');

  win.document.body.innerText = 'bar';
  win.triggerMutation();

  await new Promise((r) => setTimeout(r, 0));

  const report = commands.stopApiRecording();
  assert.equal(report.length, 1);
  const field = report[0].fields[0];
  assert.equal(field.path, 'foo');
  assert.equal(field.value, 'bar');
  assert.ok(field.firstSeenMs > 0);
  assert.equal(field.firstSeenMs, field.lastCheckedMs);
  assert.ok(field.firstSeenMs < 100);
  assert.deepEqual(commands.getApiReport(), report);
});

test('uses timeout when value never appears', { concurrency: false }, async () => {
  const win = createWin({ missing: 'value' });
  windowHandler(win);

  commands.startApiRecording({ timeoutMs: 30 });

  await win.fetch('https://example.com/api');

  await new Promise((r) => setTimeout(r, 60));

  const report = commands.stopApiRecording();
  assert.equal(report.length, 1);
  const field = report[0].fields[0];
  assert.equal(field.path, 'missing');
  assert.equal(field.value, 'value');
  assert.equal(field.firstSeenMs, null);
  assert.ok(field.lastCheckedMs >= 30);
  assert.ok(field.lastCheckedMs < 100);
});

test('ignores fetches to disallowed domains', { concurrency: false }, async () => {
  const win = createWin({ foo: 'bar' });
  windowHandler(win);

  commands.startApiRecording({ domains: ['allowed.com'], timeoutMs: 30 });

  await win.fetch('https://allowed.com/api');
  await win.fetch('https://other.com/api');

  await new Promise((r) => setTimeout(r, 60));

  const report = commands.stopApiRecording();
  assert.equal(report.length, 1);
  assert.equal(report[0].url, 'https://allowed.com/api');
});
