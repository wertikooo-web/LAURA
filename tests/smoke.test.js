'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createServer } = require('../src/server');

function nextEvent(socket, predicate, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
        const queuedIndex = socket.eventQueue.findIndex(predicate);
        if (queuedIndex >= 0) {
            const [queued] = socket.eventQueue.splice(queuedIndex, 1);
            resolve(queued);
            return;
        }
        const timer = setTimeout(() => finish(new Error('websocket_event_timeout')), timeoutMs);
        function finish(error, value) {
            clearTimeout(timer);
            socket.off('message', onMessage);
            socket.off('error', onError);
            if (error) reject(error); else resolve(value);
        }
        function onError(error) { finish(error); }
        function onMessage(data) {
            let event;
            try { event = JSON.parse(data.toString()); } catch { return; }
            if (predicate(event)) finish(null, event);
        }
        socket.on('message', onMessage);
        socket.on('error', onError);
    });
}

function openSocket(url) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        socket.eventQueue = [];
        socket.on('message', (data) => {
            try { socket.eventQueue.push(JSON.parse(data.toString())); } catch { /* ignore */ }
        });
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

test('HTTP and realtime mock smoke', async (t) => {
    const { server } = createServer({ env: { REALTIME_PROVIDER: 'mock', HOST: '127.0.0.1', PORT: '3000' } });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
    }));
    const address = server.address();
    const httpBase = `http://127.0.0.1:${address.port}`;
    const wsBase = `ws://127.0.0.1:${address.port}/realtime`;

    const health = await fetch(`${httpBase}/api/health`).then((response) => response.json());
    assert.deepEqual(health, { ok: true, service: 'laura-realtime', provider: 'mock' });
    const config = await fetch(`${httpBase}/api/config`).then((response) => response.json());
    assert.equal(config.adult_confirmation_required, true);
    assert.equal(config.raw_audio_storage, false);
    assert.equal(config.transcript_logging, false);
    assert.deepEqual(config.languages, ['ru', 'ro', 'en', 'fr']);
    assert.deepEqual(config.adult_modes, ['warm', 'flirty', 'sensual', 'direct']);
    assert.deepEqual(config.voice_expressions, ['calm', 'alive', 'passionate']);
    assert.equal(config.default_speech_speed, 0.8);
    assert.deepEqual(config.speech_speed_range, { min: 0.7, max: 1.5 });
    assert.ok(config.voices.some((voice) => voice.id === 'eve'));

    const underAge = await openSocket(wsBase);
    await nextEvent(underAge, (event) => event.type === 'connection.ready');
    underAge.send(JSON.stringify({ type: 'session.start', adult_confirmed: false, sample_rate: 16000 }));
    const rejected = await nextEvent(underAge, (event) => event.type === 'error');
    assert.equal(rejected.code, 'adult_confirmation_required');
    underAge.terminate();

    const adult = await openSocket(wsBase);
    await nextEvent(adult, (event) => event.type === 'connection.ready');
    adult.send(JSON.stringify({
        type: 'session.start',
        adult_confirmed: true,
        sample_rate: 16000,
        mode: 'evening',
        adult_mode: 'sensual',
        voice_expression: 'passionate',
        speech_speed: 0.72,
        language: 'fr',
        voice: 'luna',
        no_save: true,
    }));
    const ready = await nextEvent(adult, (event) => event.type === 'session.ready');
    assert.equal(ready.provider, 'mock');
    assert.equal(ready.no_save, true);
    assert.equal(ready.language, 'fr');
    assert.equal(ready.voice, 'luna');
    assert.equal(ready.adult_mode, 'sensual');
    assert.equal(ready.voice_expression, 'passionate');
    assert.equal(ready.speech_speed, 0.72);
    adult.send(JSON.stringify({ type: 'session.mode.update', mode: 'quiet' }));
    const modeUpdated = await nextEvent(adult, (event) => event.type === 'session.mode.updated');
    assert.equal(modeUpdated.mode, 'quiet');
    adult.send(JSON.stringify({ type: 'session.adult_mode.update', adult_mode: 'direct' }));
    const adultModeUpdated = await nextEvent(adult, (event) => event.type === 'session.adult_mode.updated');
    assert.equal(adultModeUpdated.adult_mode, 'direct');
    adult.send(JSON.stringify({ type: 'session.voice_delivery.update', voice_expression: 'calm', speech_speed: 0.9 }));
    const voiceDeliveryUpdated = await nextEvent(adult, (event) => event.type === 'session.voice_delivery.updated');
    assert.equal(voiceDeliveryUpdated.voice_expression, 'calm');
    assert.equal(voiceDeliveryUpdated.speech_speed, 0.9);
    adult.send(JSON.stringify({ type: 'text.send', text: 'Сегодня был тяжёлый день.' }));
    const reply = await nextEvent(adult, (event) => event.type === 'transcript.model');
    assert.match(reply.text, /Сегодня был тяжёлый день/);
    adult.terminate();
});
