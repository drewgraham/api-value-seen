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
