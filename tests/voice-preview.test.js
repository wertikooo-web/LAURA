'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');

test('voice preview validates input, proxies fixed text and caches audio', async (t) => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options, body: JSON.parse(options.body) });
        return new Response(Buffer.from('fake-mp3'), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    };
    t.after(() => { global.fetch = originalFetch; });

    const { server } = createServer({ env: {
        REALTIME_PROVIDER: 'xai', XAI_API_KEY: 'test-only', HOST: '127.0.0.1', PORT: '3000',
    } });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}`;

    const invalid = await originalFetch(`${base}/api/voice-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: 'unknown', language: 'ru' }),
    });
    assert.equal(invalid.status, 400);

    for (let index = 0; index < 2; index += 1) {
        const response = await originalFetch(`${base}/api/voice-preview`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: 'luna', language: 'ro' }),
        });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'fake-mp3');
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.x.ai/v1/tts');
    assert.equal(calls[0].body.voice_id, 'luna');
    assert.equal(calls[0].body.language, 'auto');
    assert.equal(calls[0].body.speed, 0.8);
    assert.match(calls[0].body.text, /Laura/);
    assert.match(calls[0].options.headers.Authorization, /^Bearer /);
});

test('Gemini preview returns a playable wave in the selected voice and language', async (t) => {
    const calls = [];
    const gemini = {
        createSession(options) {
            calls.push({ options });
            return {
                async connect() {},
                async sendText(text, context) {
                    calls.push({ text });
                    context.onAudioChunk({ audio_base64: Buffer.from([1, 2, 3, 4]).toString('base64') });
                    context.onEvent({ type: 'audio.end' });
                },
                close() {},
            };
        },
    };
    const { server } = createServer({
        env: { REALTIME_PROVIDER: 'grok', XAI_API_KEY: 'test-only', HOST: '127.0.0.1', PORT: '3000' },
        providerOverrides: { gemini },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/voice-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'gemini', voice: 'Gacrux', language: 'fr', speech_speed: 0.8 }),
    });
    const wave = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /audio\/wav/);
    assert.equal(wave.subarray(0, 4).toString(), 'RIFF');
    assert.equal(calls[0].options.voice, 'Gacrux');
    assert.match(calls[1].text, /Laura/);
});
