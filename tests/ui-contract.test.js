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
  assert.match(html, /class="presence-card"[\s\S]*<header class="topbar"[\s\S]*id="connectButton"[\s\S]*id="languageSelect"[\s\S]*id="presence"/);
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
  assert.match(html, /id="speechSpeedSelect"/);
  assert.match(html, /id="voiceExpressionSelect"/);
  assert.match(html, /id="clearButton"/);
  assert.match(html, /class="mouth"/);
  assert.match(styles, /overflow:hidden/);
  assert.match(app, /getByteTimeDomainData/);
  assert.match(styles, /\.presence\[data-state=speaking\] \.mouth\{position:absolute;left:50%;top:50%;transform:translate\(-50%,-50%\)\}/);
});

test('provider audio uses adaptive leveling and a shared safety limiter', () => {
  assert.match(html, /<script src="\/audio-leveling\.js" defer><\/script>[\s\S]*<script src="\/app\.js" defer><\/script>/);
  assert.match(app, /computeAdaptivePlaybackGain\(buffer,state\.playbackLevels\[provider\]\)/);
  assert.match(app, /createDynamicsCompressor\(\)/);
  assert.match(app, /gainNode\.connect\(state\.playbackAnalyser\)/);
  assert.match(app, /state\.playbackLimiter\.connect\(context\.destination\)/);
});

test('temporary device identity and inspectable memory controls are present', () => {
  assert.match(app, /laura_device_id/);
  assert.match(app, /device_id:state\.deviceId/);
  assert.match(html, /id="memoryEnabledToggle"/);
  assert.match(html, /id="memoryList"/);
  assert.match(html, /id="memoryClearButton"/);
});

test('conversation height is stable and recording state is visually obvious', () => {
  assert.match(styles, /\.controls\{position:relative;padding-bottom:26px\}/);
  assert.match(styles, /\.stop-button:disabled\{display:block;visibility:hidden\}/);
  assert.match(styles, /\.talk-button:active,\.talk-button\.recording\{background:#e79a7b/);
});

test('speed and expression are sent at startup and can be changed live', () => {
  assert.match(app, /speech_speed:state\.speechSpeed/);
  assert.match(app, /voice_expression:state\.voiceExpression/);
  assert.match(app, /session\.voice_delivery\.update/);
  assert.match(app, /laura_speech_speed/);
  assert.match(app, /laura_voice_expression/);
});

test('adult style is sent at startup and can be changed live', () => {
  assert.match(app, /adult_mode:state\.adultMode/);
  assert.match(app, /session\.adult_mode\.update/);
  assert.match(app, /laura_adult_mode/);
});

test('session selectors are rendered below conversation modes', () => {
  assert.ok(html.indexOf('class="selectors"') > html.indexOf('class="mode-row"'));
  assert.match(styles, /grid-template-rows:auto minmax\(165px,1fr\) auto auto minmax\(84px,\.52fr\) auto auto/);
  assert.match(styles, /grid-template-rows:auto minmax\(240px,1fr\) auto auto minmax\(104px,\.44fr\) auto auto/);
});

test('realtime provider selection restarts the single shared session', () => {
  assert.match(html, /id="providerSelect"/);
  assert.match(app, /realtime_provider:state\.realtimeProvider/);
  assert.match(app, /socket\.addEventListener\('close',\(\)=>connect\(\),\{once:true\}\)/);
  assert.match(app, /send\(\{type:'session\.stop'\}\);socket\.close\(\)/);
  assert.match(html, /id="metricsTable"/);
});

test('settings use a collapsible desktop panel and a separate mobile screen', () => {
  assert.match(html, /id="settingsPanel"[^>]*class="settings-panel"/);
  assert.match(html, /id="settingsToggleButton"/);
  assert.match(html, /class="topbar-language"[\s\S]*id="languageSelect"/);
  assert.ok(html.indexOf('id="languageSelect"') < html.indexOf('id="settingsPanel"'));
  assert.ok(html.indexOf('id="privacyButton"') > html.indexOf('id="settingsPanel"'));
  assert.match(styles, /grid-template-columns:minmax\(0,650px\) 280px/);
  assert.match(styles, /\.workspace\.settings-collapsed\{grid-template-columns:minmax\(0,650px\) 50px\}/);
  assert.match(styles, /\.settings-panel\{position:fixed;[^}]*height:100dvh/);
  assert.match(styles, /\.topbar\{position:absolute;[^}]*left:0;right:0;[^}]*padding:18px 18px 0/);
  assert.match(app, /laura_settings_collapsed/);
  assert.match(app, /panel\.dataset\.open='false'/);
  assert.match(styles, /@media\(max-width:520px\)\{\.topbar\{padding:26px 14px 0\}\.presence\{top:50%\}/);
});

test('mobile settings trigger sits in the lower-right of the presence card', () => {
    assert.match(html, /<section class="presence-card"[\s\S]*?<button id="settingsOpenButton"/);
    assert.match(styles, /@media\(max-width:520px\)[\s\S]*?\.settings-open-button\{position:absolute;z-index:5;right:14px;bottom:14px\}/);
});

test('character studio offers manual and generated drafts without a second realtime pipeline', () => {
    for (const id of ['characterSelect','characterManageButton','characterDialog','characterManualButton','characterGenerateButton','surpriseMeButton','characterSaveButton']) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, /character_id:state\.characterId/);
    assert.match(app, /result\.variants\[0\]/);
    assert.match(app, /Черновик не сохранён/);
});

test('conversation mode can be changed during an active session', () => {
  assert.match(app, /session\.mode\.update/);
  assert.doesNotMatch(app, /if\s*\(state\.sessionReady\)\s*return;state\.mode/);
});

test('voice preview uses the protected server endpoint and unlocked audio context', () => {
  assert.match(app, /fetch\(['"]\/api\/voice-preview/);
  assert.match(app, /playbackContext\.resume\(\)/);
  assert.match(app, /decodeAudioData/);
  assert.match(app, /provider:state\.realtimeProvider,voice:state\.voice,language:state\.language/);
  assert.match(app, /\['grok','gemini'\]\.includes\(state\.realtimeProvider\)/);
  assert.doesNotMatch(app, /new Audio\(`\/previews\//);
});
