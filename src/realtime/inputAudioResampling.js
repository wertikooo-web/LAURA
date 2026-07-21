'use strict';

const { Pcm16MonoResampler } = require('./pcm16Resampler');

// Kept from the proven WINE AI/Lunara PTT pipeline: clients declare either
// 16 kHz PCM16 directly or 24 kHz PCM16, which is resampled once at the
// visible server boundary. xAI Voice accepts 16 kHz PCM input.
const PROVIDER_INPUT_SAMPLE_RATE = 16000;
const ACCEPTED_INPUT_SAMPLE_RATES = new Set([16000, 24000]);

function resolveInputSampleRate(payload = {}) {
    const raw = payload.sampleRate ?? payload.sample_rate ?? PROVIDER_INPUT_SAMPLE_RATE;
    const sampleRate = Number(raw);
    if (!Number.isInteger(sampleRate) || !ACCEPTED_INPUT_SAMPLE_RATES.has(sampleRate)) {
        const error = new Error('unsupported_input_sample_rate');
        error.code = 'unsupported_input_sample_rate';
        error.accepted = Array.from(ACCEPTED_INPUT_SAMPLE_RATES);
        throw error;
    }
    return sampleRate;
}

function createInputResampler(inputSampleRate) {
    if (inputSampleRate === PROVIDER_INPUT_SAMPLE_RATE) return null;
    return new Pcm16MonoResampler({
        inputRate: inputSampleRate,
        outputRate: PROVIDER_INPUT_SAMPLE_RATE,
    });
}

module.exports = {
    PROVIDER_INPUT_SAMPLE_RATE,
    ACCEPTED_INPUT_SAMPLE_RATES,
    resolveInputSampleRate,
    createInputResampler,
};
