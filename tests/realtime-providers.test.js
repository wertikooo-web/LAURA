'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config/env');
const { createRealtimeProviderRegistry } = require('../src/providers/realtimeProviderRegistry');
const { extractGeminiEvents, GeminiLiveProviderSession } = require('../src/providers/geminiLiveProvider');
const { normalizeProviderError } = require('../src/providers/providerErrors');

function fakeProvider(name, lifecycle) {
    return {
        createSession(options) {
            lifecycle.push({ event: 'create', name, prompt: options.systemInstructionText });
            return {
                async connect() {}, startInput() {}, sendAudio() {}, interrupt() {},
                async endInput(context) { context.onEvent({ type: 'audio.end' }); },
                async sendText(text, context) { context.onEvent({ type: 'transcript.model', text: `${name}:${text}` }); context.onEvent({ type: 'audio.end' }); },
                updateInstructions() { return true; }, updateVoiceDelivery() { return true; },
                close() { lifecycle.push({ event: 'close', name }); },
            };
        },
    };
}

test('provider registry resolves aliases lazily and rejects unconfigured providers', () => {
    const config = loadConfig({ REALTIME_PROVIDER: 'mock' });
    const registry = createRealtimeProviderRegistry(config);
    assert.equal(registry.resolve('mock').name, 'mock');
    assert.throws(() => registry.resolve('gemini'), /gemini_provider_not_configured/);
    assert.throws(() => registry.resolve('unknown'), /unsupported_realtime_provider/);
});

test('Gemini messages normalize to the shared transcript and PCM event contract', () => {
    const events = extractGeminiEvents({ serverContent: {
        inputTranscription: { text: 'hello' }, outputTranscription: { text: 'hi' },
        modelTurn: { parts: [{ inlineData: { data: 'AQI=', mimeType: 'audio/pcm;rate=24000' } }] }, turnComplete: true,
    } }, { responseId: 'r1', turnId: 't1' });
    assert.deepEqual(events.map((event) => event.type), ['transcript.user', 'transcript.model.delta', 'audio.chunk', 'audio.end']);
    assert.equal(events[2].mime_type, 'audio/pcm;rate=24000');
});

test('Gemini adapter uses official Live setup and explicit activity signals without network calls', async () => {
    let connectOptions;
    const sent = [];
    const providerSession = new GeminiLiveProviderSession({
        config: { apiKey: 'test', model: 'gemini-test', voice: 'Aoede' },
        options: { systemInstructionText: 'shared prompt', voice: 'Kore' },
        dependencies: { client: { live: { connect: async (options) => { connectOptions = options; queueMicrotask(() => options.callbacks.onmessage({ setupComplete: {} })); return { sendRealtimeInput: (value) => sent.push(value), sendClientContent: (value) => sent.push(value), close() {} }; } } } },
    });
    await providerSession.connect();
    await providerSession.startInput();
    providerSession.sendAudio(Buffer.from([1, 2]));
    await providerSession.endInput({ signal: {}, log() {}, onEvent() {}, onAudioChunk() {} });
    assert.equal(connectOptions.config.systemInstruction, 'shared prompt');
    assert.equal(connectOptions.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
    assert.deepEqual(connectOptions.config.responseModalities, ['AUDIO']);
    assert.deepEqual(connectOptions.config.realtimeInputConfig, { automaticActivityDetection: { disabled: true } });
    assert.deepEqual(sent.map((value) => Object.keys(value)[0]), ['activityStart', 'audio', 'activityEnd']);
});

test('Gemini adapter reports a safe close diagnostic when setup is rejected', async () => {
    const logs = [];
    const providerSession = new GeminiLiveProviderSession({
        config: { apiKey: 'test', model: 'gemini-test', voice: 'Aoede' },
        options: { systemInstructionText: 'shared prompt' },
        dependencies: { client: { live: { connect: async (options) => {
            queueMicrotask(() => options.callbacks.onclose({ code: 1008, reason: 'invalid setup\n' }));
            return { close() {} };
        } } } },
    });
    await assert.rejects(providerSession.connect((event, data) => logs.push({ event, data })), (error) => error.code === 'connection_closed');
    assert.deepEqual(logs, [{
        event: 'provider_connection_closed',
        data: {
            provider: 'gemini', providerInstanceId: providerSession.instanceId,
            duringSetup: true, closeCode: 1008, closeReason: 'invalid setup',
        },
    }]);
});

test('provider errors share safe categories', () => {
    assert.equal(normalizeProviderError(new Error('API key unauthorized'), 'gemini').code, 'authentication_failed');
    assert.equal(normalizeProviderError(Object.assign(new Error('quota exceeded'), { status: 429 }), 'grok').code, 'rate_limited');
});

test('mocked provider switch closes the old adapter before creating the new one', () => {
    const lifecycle = [];
    const config = loadConfig({ REALTIME_PROVIDER: 'mock' });
    const registry = createRealtimeProviderRegistry(config, { grok: fakeProvider('grok', lifecycle), gemini: fakeProvider('gemini', lifecycle) });
    const promptOptions = { systemInstructionText: 'same shared prompt' };
    const grok = registry.resolve('grok').createSession(promptOptions);
    grok.close();
    const gemini = registry.resolve('gemini').createSession(promptOptions);
    gemini.close();
    assert.deepEqual(lifecycle.map((item) => `${item.event}:${item.name}`), ['create:grok', 'close:grok', 'create:gemini', 'close:gemini']);
    assert.equal(lifecycle[0].prompt, lifecycle[2].prompt);
});
