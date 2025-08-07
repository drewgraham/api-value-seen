const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

async function render() {
  const state = await runtime.sendMessage({ action: 'getState' });
  document.getElementById('domains').value = state.domains.join(', ');
  document.getElementById('timeout').value = state.timeoutMs || 5000;
  document.getElementById('start').disabled = state.recording;
  document.getElementById('stop').disabled = !state.recording;
  const formatted = state.logs
    .map(entry => {
      const lines = [`URL: ${entry.url}`];
      entry.fields.forEach(f => {
        lines.push(`  ${f.path}: ${f.value} (firstSeenMs: ${f.firstSeenMs ?? 'n/a'}, lastCheckedMs: ${f.lastCheckedMs})`);
      });
      return lines.join('\n');
    })
    .join('\n\n');
  document.getElementById('output').textContent = formatted;
}

document.getElementById('start').addEventListener('click', async () => {
  const domains = document.getElementById('domains').value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const timeoutMs = parseInt(document.getElementById('timeout').value, 10);
  await runtime.sendMessage({ action: 'start', domains, timeoutMs });
  render();
});

document.getElementById('stop').addEventListener('click', async () => {
  await runtime.sendMessage({ action: 'stop' });
  render();
});

document.getElementById('clear').addEventListener('click', async () => {
  await runtime.sendMessage({ action: 'clear' });
  render();
});

document.getElementById('download').addEventListener('click', async () => {
  const state = await runtime.sendMessage({ action: 'getState' });
  const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'api-report.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.addEventListener('DOMContentLoaded', render);
