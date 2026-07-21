'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');

test('connection control is separate from the push-to-talk control', () => {
  assert.match(html, /<header[\s\S]*id="connectButton"[\s\S]*>CONNECT<\/button>/);
  assert.match(html, /id="talkButton"[\s\S]*data-i18n="talkButton"/);
  assert.match(styles, /\.connection-button/);
  assert.match(styles, /\.talk-button\{[^}]*display:flex/);
});

test('push-to-talk interrupts first, records while held, and commits on release', () => {
  const start = app.search(/send\(\{\s*type:\s*['"]session\.interrupt['"],\s*reason:\s*['"]user_started_speaking/);
  const audioStart = app.search(/send\(\{\s*type:\s*['"]input_audio\.start/);
  const release = app.search(/send\(\{\s*type:\s*['"]input_audio\.end/);

  assert.ok(start >= 0 && audioStart > start, 'interruption must precede new audio');
  assert.ok(release > audioStart, 'release must commit the captured audio');
  assert.match(app, /if\s*\(\s*!state\.pressActive\s*\|\|\s*!state\.sessionReady\s*\)\s*return/);
});

test('localized controls, clear action and talking lips are present', () => {
  assert.match(html, /id="languageSelect"/);
  assert.match(html, /id="voiceSelect"/);
  assert.match(html, /id="adultModeSelect"/);
  assert.match(html, /id="clearButton"/);
  assert.match(html, /class="mouth"/);
  assert.match(styles, /overflow:hidden/);
  assert.match(app, /getByteTimeDomainData/);
});

test('adult style is sent at startup and can be changed live', () => {
  assert.match(app, /adult_mode:state\.adultMode/);
  assert.match(app, /session\.adult_mode\.update/);
  assert.match(app, /laura_adult_mode/);
});

test('session selectors are rendered below conversation modes', () => {
  assert.ok(html.indexOf('class="selectors"') > html.indexOf('class="mode-row"'));
});

test('conversation mode can be changed during an active session', () => {
  assert.match(app, /session\.mode\.update/);
  assert.doesNotMatch(app, /if\s*\(state\.sessionReady\)\s*return;state\.mode/);
});

test('voice preview uses the protected server endpoint and unlocked audio context', () => {
  assert.match(app, /fetch\(['"]\/api\/voice-preview/);
  assert.match(app, /playbackContext\.resume\(\)/);
  assert.match(app, /decodeAudioData/);
  assert.doesNotMatch(app, /new Audio\(`\/previews\//);
});
