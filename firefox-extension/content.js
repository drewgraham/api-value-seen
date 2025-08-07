(() => {
  const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const clone = response.clone();
      const data = await clone.json();
      handleResponse(data, args[0]);
    } catch (e) {
      // Response is not JSON or parsing failed
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const data = JSON.parse(this.responseText);
        handleResponse(data, this._url);
      } catch (e) {
        // Non JSON response
      }
    });
    return originalSend.apply(this, args);
  };

  function handleResponse(data, url) {
    runtime.sendMessage({ action: 'getState' }).then(state => {
      const CHECK_TIMEOUT_MS = state.timeoutMs || 5000;

      const fields = [];
      function traverse(obj, path = []) {
        if (typeof obj === 'object' && obj !== null) {
          for (const key in obj) {
            traverse(obj[key], path.concat(key));
          }
        } else {
          fields.push({
            path: path.join('.'),
            value: String(obj),
            firstSeenMs: null,
            lastCheckedMs: 0
          });
        }
      }
      traverse(data);

      const start = performance.now();
      let finished = false;

      function check() {
        const now = performance.now();
        for (const field of fields) {
          if (field.firstSeenMs !== null) continue;
          if (document.body.innerText.includes(field.value)) {
            field.firstSeenMs = now - start;
            field.lastCheckedMs = field.firstSeenMs;
          } else {
            field.lastCheckedMs = now - start;
          }
        }
        if (fields.every(f => f.firstSeenMs !== null)) {
          finalize();
          observer.disconnect();
        }
      }

      const observer = new MutationObserver(check);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      const timeoutId = setTimeout(() => {
        observer.disconnect();
        check();
        finalize();
      }, CHECK_TIMEOUT_MS);

      function finalize() {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        runtime.sendMessage({ action: 'log', url, fields });
      }

      check();
    });
  }
})();
