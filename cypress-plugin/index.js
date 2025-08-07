let recording = false;
let domains = [];
let report = [];

const shouldTrack = (url) =>
  domains.length === 0 || domains.some((d) => url.includes(d));

let timeoutMs = 5000;

function handleResponse(win, data, url) {
  const fields = [];
  function traverse(obj, path = []) {
    if (obj && typeof obj === 'object') {
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
    report.push({ url, fields });
  }

  check();
}

Cypress.on('window:before:load', (win) => {
  const originalFetch = win.fetch;
  win.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    if (recording && shouldTrack(args[0])) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        handleResponse(win, data, args[0]);
      } catch (e) {
        // non JSON response
      }
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
      if (recording && shouldTrack(this._url)) {
        try {
          const data = JSON.parse(this.responseText);
          handleResponse(win, data, this._url);
        } catch (e) {
          // ignore non JSON
        }
      }
    });
    return originalSend.apply(this, sendArgs);
  };
});

Cypress.Commands.add('startApiRecording', (options = {}) => {
  domains = (options.domains || []).map((d) => d.trim()).filter(Boolean);
  timeoutMs = options.timeoutMs || 5000;
  report = [];
  recording = true;
});

Cypress.Commands.add('stopApiRecording', () => {
  recording = false;
  return cy.wrap(report);
});

Cypress.Commands.add('getApiReport', () => {
  return cy.wrap(report);
});
