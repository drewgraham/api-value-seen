export function interceptResponses(win, handler) {
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

export function collectFields(data, path = [], fields = []) {
  if (data && typeof data === 'object') {
    for (const key in data) {
      collectFields(data[key], path.concat(key), fields);
    }
  } else {
    fields.push({
      path: path.join('.'),
      value: String(data),
      firstSeenMs: null,
      lastCheckedMs: 0
    });
  }
  return fields;
}

export function observeFields(win, fields, url, log, timeoutMs = 5000) {
  const start = win.performance.now();
  let finished = false;

  function check() {
    const now = win.performance.now();
    for (const field of fields) {
      if (field.firstSeenMs !== null) continue;
      if (win.document.body.innerText.includes(field.value)) {
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

  const observer = new win.MutationObserver(check);
  observer.observe(win.document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  const timeoutId = win.setTimeout(() => {
    observer.disconnect();
    check();
    finalize();
  }, timeoutMs);

  function finalize() {
    if (finished) return;
    finished = true;
    win.clearTimeout(timeoutId);
    const elapsed = win.performance.now() - start;
    for (const field of fields) {
      if (field.firstSeenMs === null) {
        field.lastCheckedMs = Math.max(field.lastCheckedMs, elapsed);
      }
      field.apiPath = `${url}.${field.path}`;
    }
    log({ url, fields });
  }

  check();
  return finalize;
}
