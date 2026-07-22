'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeAdaptivePlaybackGain } = require('../public/audio-leveling');

function audioBuffer(samples) {
  return {
    length: samples.length,
    numberOfChannels: 1,
    getChannelData() { return Float32Array.from(samples); },
  };
}

function constantVoice(level, count = 1024) {
  return Array.from({ length: count }, (_, index) => index % 2 ? level : -level);
}

test('adaptive playback raises quiet speech and lowers loud speech', () => {
  const quiet = computeAdaptivePlaybackGain(audioBuffer(constantVoice(0.05)));
  const loud = computeAdaptivePlaybackGain(audioBuffer(constantVoice(0.28)));
  assert.ok(quiet.gain > 1, `expected quiet gain above 1, got ${quiet.gain}`);
  assert.ok(loud.gain < 1, `expected loud gain below 1, got ${loud.gain}`);
  assert.ok(quiet.gain > loud.gain);
});

test('adaptive playback respects peak headroom and keeps silence stable', () => {
  const peaked = constantVoice(0.02);
  peaked[100] = 1;
  const limited = computeAdaptivePlaybackGain(audioBuffer(peaked));
  assert.ok(limited.gain <= 0.9);
  assert.equal(computeAdaptivePlaybackGain(audioBuffer(new Array(1024).fill(0)), 1.4).gain, 1.4);
});

test('adaptive playback smooths gain changes between chunks', () => {
  const first = computeAdaptivePlaybackGain(audioBuffer(constantVoice(0.05)));
  const next = computeAdaptivePlaybackGain(audioBuffer(constantVoice(0.09)), first.gain);
  const rawNext = computeAdaptivePlaybackGain(audioBuffer(constantVoice(0.09)));
  assert.ok(next.gain > rawNext.gain);
  assert.ok(next.gain < first.gain);
});
