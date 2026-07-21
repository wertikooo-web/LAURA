'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pcm16MonoResampler } = require('../src/realtime/pcm16Resampler');
const {
    PROVIDER_INPUT_SAMPLE_RATE,
    resolveInputSampleRate,
    createInputResampler,
} = require('../src/realtime/inputAudioResampling');

function tone(sampleCount, sampleRate, frequency = 440) {
    const data = Buffer.alloc(sampleCount * 2);
    for (let index = 0; index < sampleCount; index += 1) {
        data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * index / sampleRate) * 10000), index * 2);
    }
    return data;
}

test('16 kHz PCM is byte-identical and 24 kHz is resampled once', () => {
    assert.equal(PROVIDER_INPUT_SAMPLE_RATE, 16000);
    assert.equal(resolveInputSampleRate({ sample_rate: 16000 }), 16000);
    const direct = new Pcm16MonoResampler({ inputRate: 16000, outputRate: 16000 });
    const input = tone(100, 16000);
    assert.deepEqual(direct.process(input), input);

    const resampler = createInputResampler(24000);
    const first = resampler.process(tone(2400, 24000));
    const tail = resampler.flush();
    assert.ok(Math.abs((first.length + tail.length) / 2 - 1600) <= 24);
    assert.equal(createInputResampler(16000), null);
});

test('unsupported sample rates are rejected instead of guessed', () => {
    assert.throws(() => resolveInputSampleRate({ sample_rate: 48000 }), /unsupported_input_sample_rate/);
});
