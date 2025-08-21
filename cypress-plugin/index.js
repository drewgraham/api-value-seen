import { interceptResponses, collectFields, observeFields } from '../shared/apiValueTracker.js';

let recording = false;
let domains = [];
let report = [];
let timeoutMs = 5000;
let finalizers = [];

const shouldTrack = (url) =>
  domains.length === 0 || domains.some((d) => url.includes(d));

const unseenOnly = (data = report) =>
  data
    .map(({ url, fields }) => ({
      url,
      fields: fields.filter((f) => f.firstSeenMs === null)
    }))
    .filter((r) => r.fields.length > 0);

const buildTable = (data = unseenOnly()) => {
  const table = [];
  for (const { url, fields } of data) {
    for (const field of fields) {
      table.push({
        request: url,
        field: field.path,
        apiPath: field.apiPath || `${url}.${field.path}`,
        value: field.value,
        seen: false
      });
    }
  }
  return table;
};

Cypress.on('window:before:load', (win) => {
  interceptResponses(win, (data, url) => {
    if (!recording || !shouldTrack(url)) return;
    const fields = collectFields(data);
    const finalize = observeFields(
      win,
      fields,
      url,
      (result) => report.push(result),
      timeoutMs
    );
    finalizers.push(finalize);
  });
});

Cypress.Commands.add('startApiRecording', (options = {}) => {
  domains = (options.domains || []).map((d) => d.trim()).filter(Boolean);
  timeoutMs = options.timeoutMs || 5000;
  report = [];
  recording = true;
  finalizers = [];
});

Cypress.Commands.add('stopApiRecording', () => {
  recording = false;
  finalizers.forEach((fn) => fn());
  const unseen = unseenOnly();
  const table = buildTable(unseen);
  Cypress.log({ name: 'api-values', consoleProps: () => table });
  if (table.length) console.table(table);
  return cy.wrap(unseen);
});

Cypress.Commands.add('getApiReport', () => {
  return cy.wrap(unseenOnly());
});

export const getApiReportTask = (reportData = []) => {
  const unseen = unseenOnly(reportData);
  const table = buildTable(unseen);
  if (table.length) console.table(table);
  return unseen;
};
