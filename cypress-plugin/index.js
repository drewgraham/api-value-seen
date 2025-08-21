import { interceptResponses, collectFields, observeFields } from '../shared/apiValueTracker.js';

let recording = false;
let domains = [];
let report = [];
let timeoutMs = 5000;

const shouldTrack = (url) =>
  domains.length === 0 || domains.some((d) => url.includes(d));

const buildTable = (data = report) => {
  const table = [];
  for (const { url, fields } of data) {
    for (const field of fields) {
      table.push({
        request: url,
        field: field.path,
        value: field.value,
        seen: field.firstSeenMs !== null
      });
    }
  }
  return table;
};

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
  const table = buildTable();
  Cypress.log({ name: 'api-values', consoleProps: () => table });
  if (table.length) console.table(table);
  return cy.wrap(report);
});

Cypress.Commands.add('getApiReport', () => {
  return cy.wrap(report);
});

export const getApiReportTask = (reportData = []) => {
  const table = buildTable(reportData);
  if (table.length) console.table(table);
  return table;
};
