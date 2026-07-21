'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    XaiVoiceProviderSession,
    buildXaiSessionConfig,
    pronunciationReplacements,
} = require('../src/providers/xaiVoiceProvider');

test('xAI session uses native output speed and spoken-name replacement', () => {
    const session = buildXaiSessionConfig({
        systemInstructionText: 'test prompt',
        voice: 'ursa',
        language: 'ru',
        speechSpeed: 0.72,
    }, { voice: 'eve' });

    assert.equal(session.voice, 'ursa');
    assert.equal(session.audio.output.speed, 0.72);
    assert.equal(session.audio.output.format.rate, 24000);
    assert.equal(session.replace.LAURA, 'ЛА́ура');
    assert.equal(session.replace['Лаура'], 'ЛА́ура');
    assert.equal(session.turn_detection, null);
});

test('voice delivery update sends only documented xAI audio speed shape', () => {
    const providerSession = new XaiVoiceProviderSession({
        config: { voice: 'eve' },
        options: { speechSpeed: 0.8 },
    });
    const messages = [];
    providerSession.sendRaw = (payload) => { messages.push(payload); return true; };

    assert.equal(providerSession.updateVoiceDelivery(0.9), true);
    assert.deepEqual(messages, [{
        type: 'session.update',
        session: { audio: { output: { speed: 0.9 } } },
    }]);
});

test('non-Russian pronunciation replacement still stresses the first syllable', () => {
    assert.equal(pronunciationReplacements('en').LAURA, 'LAU-ra');
});
