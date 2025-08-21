import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const commands = {};
let windowHandler;
const tables = [];
const logs = [];

console.table = (data) => {
  tables.push(data);
};

global.Cypress = {
  on: (event, fn) => {
    if (event === 'window:before:load') {
      windowHandler = fn;
    }
  },
  log: (opts) => {
    logs.push(opts);
  },
  Commands: {
    add: (name, fn) => {
      commands[name] = fn;
    }
  }
};

global.cy = { wrap: (x) => x };

await import('../cypress-plugin/index.js');

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

test('does not report values that appear in the DOM', { concurrency: false }, async () => {
  const win = createWin({ foo: 'bar' });
  windowHandler(win);

  commands.startApiRecording({ timeoutMs: 100 });

  await win.fetch('https://example.com/api');

  win.document.body.innerText = 'bar';
  win.triggerMutation();

  await new Promise((r) => setTimeout(r, 0));

  tables.length = 0;
  logs.length = 0;
  const report = commands.stopApiRecording();
  assert.equal(report.length, 0);
  assert.deepEqual(commands.getApiReport(), []);
  assert.equal(tables.length, 0);
  assert.equal(logs[0].name, 'api-values');
  assert.deepEqual(logs[0].consoleProps(), []);
});

test('reports unseen values when they never appear', { concurrency: false }, async () => {
  const win = createWin({ missing: { deeper: { secret: 'value', other: 'alt' } } });
  windowHandler(win);

  commands.startApiRecording({ timeoutMs: 30 });

  await win.fetch('https://example.com/api');

  await new Promise((r) => setTimeout(r, 60));

  tables.length = 0;
  logs.length = 0;
  const report = commands.stopApiRecording();
  assert.equal(report.length, 1);
  assert.equal(report[0].fields.length, 2);
  const field1 = report[0].fields[0];
  const field2 = report[0].fields[1];
  assert.equal(field1.path, 'missing.deeper.secret');
  assert.equal(field1.value, 'value');
  assert.equal(field1.firstSeenMs, null);
  assert.ok(field1.lastCheckedMs >= 30);
  assert.ok(field1.lastCheckedMs < 100);
  assert.equal(field2.path, 'missing.deeper.other');
  assert.equal(field2.value, 'alt');
  assert.equal(field2.firstSeenMs, null);
  assert.ok(field2.lastCheckedMs >= 30);
  assert.ok(field2.lastCheckedMs < 100);
  const expectedTable = [
    {
      request: 'https://example.com/api',
      field: 'missing.deeper.secret',
      apiPath: 'https://example.com/api.missing.deeper.secret',
      value: 'value',
      seen: false
    },
    {
      request: 'https://example.com/api',
      field: 'missing.deeper.other',
      apiPath: 'https://example.com/api.missing.deeper.other',
      value: 'alt',
      seen: false
    }
  ];
  assert.deepEqual(tables[0], expectedTable);
  assert.equal(logs[0].name, 'api-values');
  assert.deepEqual(logs[0].consoleProps(), expectedTable);
});

test('ignores fetches to disallowed domains', { concurrency: false }, async () => {
  const win = createWin({ foo: 'bar' });
  windowHandler(win);

  commands.startApiRecording({ domains: ['allowed.com'], timeoutMs: 30 });

  await win.fetch('https://allowed.com/api');
  await win.fetch('https://other.com/api');

  await new Promise((r) => setTimeout(r, 60));

  tables.length = 0;
  logs.length = 0;
  const report = commands.stopApiRecording();
  assert.equal(report.length, 1);
  assert.equal(report[0].url, 'https://allowed.com/api');
  const expectedTable = [
    {
      request: 'https://allowed.com/api',
      field: 'foo',
      apiPath: 'https://allowed.com/api.foo',
      value: 'bar',
      seen: false
    }
  ];
  assert.deepEqual(tables[0], expectedTable);
  assert.equal(logs[0].name, 'api-values');
  assert.deepEqual(logs[0].consoleProps(), expectedTable);
});
