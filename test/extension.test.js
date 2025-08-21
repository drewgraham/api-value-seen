import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

function createWindow(responseData) {
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

test('content script logs values', { concurrency: false }, async () => {
  const logs = [];
  const state = { recording: true, domains: [], timeoutMs: 50 };
  global.browser = {
    runtime: {
      sendMessage: (msg) => {
        if (msg.action === 'getState') return Promise.resolve(state);
        if (msg.action === 'log') { logs.push(msg); return Promise.resolve(); }
        return Promise.resolve();
      }
    }
  };

  const win = createWindow({ foo: 'bar' });
  global.window = win;
  global.XMLHttpRequest = win.XMLHttpRequest;

  await import('../firefox-extension/content.js');

  await win.fetch('https://example.com/api');
  win.document.body.innerText = 'bar';
  win.triggerMutation();

  await new Promise((r) => setTimeout(r, 0));
  assert.equal(logs.length, 1);
  const field = logs[0].fields[0];
  assert.equal(field.path, 'foo');
  assert.equal(field.value, 'bar');
  assert.ok(field.firstSeenMs > 0);

  delete global.browser;
  delete global.window;
  delete global.XMLHttpRequest;
});
