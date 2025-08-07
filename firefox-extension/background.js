const state = {
  recording: false,
  domains: [],
  logs: [],
  timeoutMs: 5000
};

function shouldTrack(url) {
  if (state.domains.length === 0) return true;
  try {
    const host = new URL(url).hostname;
    return state.domains.includes(host);
  } catch (e) {
    return false;
  }
}

browser.runtime.onMessage.addListener((message) => {
  switch (message.action) {
    case 'start':
      state.recording = true;
      state.domains = message.domains || [];
      state.timeoutMs = message.timeoutMs || 5000;
      state.logs = [];
      return Promise.resolve(state);
    case 'stop':
      state.recording = false;
      return Promise.resolve(state);
    case 'clear':
      state.logs = [];
      return Promise.resolve(state);
    case 'getState':
      return Promise.resolve(state);
    case 'log':
      if (state.recording && shouldTrack(message.url)) {
        state.logs.push({ url: message.url, fields: message.fields });
      }
      break;
    default:
      break;
  }
});
