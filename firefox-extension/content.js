import { collectFields, observeFields } from '../shared/apiValueTracker.js';

function interceptResponses(win, handler) {
  const originalFetch = win.fetch;
  win.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const clone = response.clone();
      const data = await clone.json();
      await handler(data, args[0]);
    } catch (e) {
      // non JSON response
    }
    return response;
  };

  const originalOpen = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = win.XMLHttpRequest.prototype.send;
  win.XMLHttpRequest.prototype.send = function (...sendArgs) {
    this.addEventListener('load', function () {
      try {
        const data = JSON.parse(this.responseText);
        handler(data, this._url);
      } catch (e) {
        // ignore non JSON
      }
    });
    return originalSend.apply(this, sendArgs);
  };
}

(() => {
  const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

  interceptResponses(window, (data, url) => {
    runtime.sendMessage({ action: 'getState' }).then(state => {
      const timeoutMs = state.timeoutMs || 5000;
      if (!state.recording) return;
      if (state.domains && state.domains.length) {
        try {
          const host = new URL(url).hostname;
          if (!state.domains.includes(host)) return;
        } catch (e) {
          return;
        }
      }
      const fields = collectFields(data);
      observeFields(window, fields, url, ({ url, fields }) => {
        runtime.sendMessage({ action: 'log', url, fields });
      }, timeoutMs);
    });
  });
})();
