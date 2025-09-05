# api-value-seen

A Firefox extension and Cypress plugin that intercept API requests, records fields from JSON responses, and tracks when those values first appear in the page's DOM.

## Repository Structure
- `firefox-extension/` – temporary Firefox add-on with popup UI, background script, and content script.
- `cypress-plugin/` – Cypress plugin for recording API field usage during tests.

## Firefox Extension

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on...** and choose `firefox-extension/manifest.json`.
3. Use the extension popup to **Start Recording**, optionally specifying a comma-separated list of domains to monitor (leave blank for all domains) and a timeout in milliseconds (default 5000) to wait for field values to appear in the DOM.
4. Browse as normal; logs will accumulate across pages until you **Stop Recording**.
5. Review captured entries and timing details in the popup or click **Download Report** to save them as `api-report.json`.

## Cypress Plugin

1. Install the plugin and load it from your Cypress support file:

   ```bash
   npm install cypress-api-value-seen
   ```

   ```js
   import 'cypress-api-value-seen';
   ```

2. Start recording at the beginning of your test and optionally restrict domains or adjust the timeout (in ms):

   ```js
   cy.startApiRecording({ domains: ['api.example.com'], timeoutMs: 5000 });
   ```

3. Run your test actions. When finished, stop recording and save the report:

   ```js
   cy.stopApiRecording().then((report) => {
     cy.writeFile('api-report.json', report);
   });
  ```

   `stopApiRecording` logs a table of any API field values that never
   appeared in the DOM. When running `cypress run`, you can register a task
   to print the same table from the Node process:

   ```js
   // cypress.config.js
   import { getApiReportTask } from 'cypress-api-value-seen';
   export default defineConfig({
     e2e: {
       setupNodeEvents(on) {
         on('task', { getApiReport: getApiReportTask });
       }
     }
   });

   // support or spec file
   after(() => {
     cy.getApiReport().then((report) => cy.task('getApiReport', report));
   });
   ```

The plugin uses `cy.intercept` to watch API requests across page loads and records how long it takes for each field value to appear in the DOM (up to the configured timeout, default five seconds). Only unseen values are included in the final report and logs.

## Development

Run the test suite:

```bash
npm test
```

(There are currently no external dependencies, but the test confirms the Cypress plugin registers custom commands.)

To run the Cypress end-to-end tests, first install Cypress and then execute the test runner:

```bash
npm install --save-dev cypress
npx cypress run
```
