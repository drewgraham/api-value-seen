import { interceptResponses, collectFields, observeFields } from '../shared/apiValueTracker.js';

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
