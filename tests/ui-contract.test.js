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
  assert.match(html, /id="talkButton"[\s\S]*<strong>НАЧАТЬ РАЗГОВОР<\/strong>/);
  assert.match(styles, /\.connection-button\s*\{/);
  assert.match(styles, /\.talk-button\s*\{[^}]*display:\s*flex/);
});

test('push-to-talk interrupts first, records while held, and commits on release', () => {
  const start = app.indexOf("send({ type: 'session.interrupt', reason: 'user_started_speaking' });");
  const audioStart = app.indexOf("send({ type: 'input_audio.start' });");
  const release = app.indexOf("send({ type: 'input_audio.end' });");

  assert.ok(start >= 0 && audioStart > start, 'interruption must precede new audio');
  assert.ok(release > audioStart, 'release must commit the captured audio');
  assert.match(app, /if \(!state\.pressActive \|\| !state\.sessionReady\) return;/);
});
