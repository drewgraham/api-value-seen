import { interceptResponses, collectFields, observeFields } from '../shared/apiValueTracker.js';

let recording = false;
let domains = [];
let report = [];
let timeoutMs = 5000;

const shouldTrack = (url) =>
  domains.length === 0 || domains.some((d) => url.includes(d));

Cypress.on('window:before:load', (win) => {
  interceptResponses(win, (data, url) => {
    if (!recording || !shouldTrack(url)) return;
    const fields = collectFields(data);
    observeFields(win, fields, url, (result) => report.push(result), timeoutMs);
  });
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
