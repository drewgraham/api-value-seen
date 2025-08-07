import { test } from 'node:test';
import assert from 'node:assert/strict';

// stub global Cypress object used by the plugin
const added = [];
global.Cypress = {
  on: () => {},
  Commands: {
    add: (name) => added.push(name)
  }
};

test('cypress plugin registers custom commands', async () => {
  await import('../cypress-plugin/index.js');
  assert.deepEqual(added.sort(), ['getApiReport', 'startApiRecording', 'stopApiRecording']);
});
