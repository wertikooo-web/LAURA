'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, normalizeSessionOptions } = require('../src/config/env');

test('mock is the safe default and logging is disabled', () => {
    const config = loadConfig({});
    assert.equal(config.provider, 'mock');
    assert.equal(config.allowTranscriptLogging, false);
    assert.equal(config.host, '127.0.0.1');
});

test('xAI configuration requires a server-side key and wss URL', () => {
    assert.throws(() => loadConfig({ REALTIME_PROVIDER: 'xai' }), /xai_api_key_missing/);
    assert.throws(() => loadConfig({
        REALTIME_PROVIDER: 'xai',
        XAI_API_KEY: 'test-only',
        XAI_REALTIME_URL: 'ws://insecure.example',
    }), /xai_realtime_url_must_use_wss/);

    const config = loadConfig({ REALTIME_PROVIDER: 'xai', XAI_API_KEY: 'test-only' });
    assert.equal(config.provider, 'xai');
    assert.equal(config.xai.model, 'grok-voice-latest');
});

test('session options fail private and normalize unknown values', () => {
    assert.deepEqual(normalizeSessionOptions({ adult_confirmed: true, mode: 'unknown', language: 'xx' }), {
        adultConfirmed: true,
        mode: 'talk',
        adultMode: 'warm',
        voiceExpression: 'alive',
        speechSpeed: 0.8,
        language: 'ru',
        voice: 'eve',
        noSave: true,
        deviceId: '',
    });
    assert.equal(normalizeSessionOptions({ no_save: false }).noSave, false);
    assert.deepEqual(normalizeSessionOptions({ language: 'ro', voice: 'luna' }, { defaultVoice: 'ara' }), {
        adultConfirmed: false,
        mode: 'talk',
        adultMode: 'warm',
        voiceExpression: 'alive',
        speechSpeed: 0.8,
        language: 'ro',
        voice: 'luna',
        noSave: true,
        deviceId: '',
    });
    assert.equal(normalizeSessionOptions({ voice: 'male-voice' }, { defaultVoice: 'ursa' }).voice, 'ursa');
    assert.equal(normalizeSessionOptions({ adult_mode: 'direct' }).adultMode, 'direct');
    assert.equal(normalizeSessionOptions({ adult_mode: 'unknown' }).adultMode, 'warm');
    assert.equal(normalizeSessionOptions({ voice_expression: 'passionate' }).voiceExpression, 'passionate');
    assert.equal(normalizeSessionOptions({ voice_expression: 'unknown' }).voiceExpression, 'alive');
    assert.equal(normalizeSessionOptions({ speech_speed: 0.72 }).speechSpeed, 0.72);
    assert.equal(normalizeSessionOptions({ speech_speed: 2 }).speechSpeed, 0.8);
});
