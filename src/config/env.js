'use strict';

const { SUPPORTED_LANGUAGES, normalizeVoice } = require('../voiceCatalog');

const VALID_PROVIDERS = new Set(['mock', 'xai']);
const VALID_MODES = new Set(['talk', 'evening', 'quiet']);
const VALID_ADULT_MODES = new Set(['warm', 'flirty', 'sensual', 'direct']);
const VALID_VOICE_EXPRESSIONS = new Set(['calm', 'alive', 'passionate']);
const VALID_LANGUAGES = new Set(SUPPORTED_LANGUAGES);
const DEFAULT_SPEECH_SPEED = 0.8;
const MIN_SPEECH_SPEED = 0.7;
const MAX_SPEECH_SPEED = 1.5;

function bool(value, fallback = false) {
    if (value == null || value === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(value));
}

function int(value, fallback, { min, max } = {}) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    if (Number.isFinite(min) && parsed < min) return fallback;
    if (Number.isFinite(max) && parsed > max) return fallback;
    return parsed;
}

function speechSpeed(value, fallback = DEFAULT_SPEECH_SPEED) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < MIN_SPEECH_SPEED || parsed > MAX_SPEECH_SPEED) return fallback;
    return Math.round(parsed * 100) / 100;
}

function loadConfig(env = process.env) {
    const provider = String(env.REALTIME_PROVIDER || 'mock').trim().toLowerCase();
    if (!VALID_PROVIDERS.has(provider)) {
        throw Object.assign(new Error(`unsupported_realtime_provider:${provider}`), {
            code: 'unsupported_realtime_provider',
        });
    }

    const config = {
        host: String(env.HOST || '127.0.0.1'),
        port: int(env.PORT, 3000, { min: 1, max: 65535 }),
        provider,
        allowTranscriptLogging: bool(env.ALLOW_TRANSCRIPT_LOGGING, false),
        xai: {
            apiKey: String(env.XAI_API_KEY || ''),
            realtimeUrl: String(env.XAI_REALTIME_URL || 'wss://api.x.ai/v1/realtime'),
            model: String(env.XAI_MODEL || 'grok-voice-latest'),
            voice: normalizeVoice(env.XAI_VOICE, 'eve'),
        },
    };

    if (provider === 'xai' && !config.xai.apiKey) {
        throw Object.assign(new Error('xai_api_key_missing'), { code: 'xai_api_key_missing' });
    }
    if (!/^wss:\/\//i.test(config.xai.realtimeUrl)) {
        throw Object.assign(new Error('xai_realtime_url_must_use_wss'), {
            code: 'xai_realtime_url_must_use_wss',
        });
    }
    return config;
}

function normalizeSessionOptions(value = {}, { defaultVoice = 'eve' } = {}) {
    const mode = String(value.mode || 'talk').toLowerCase();
    const language = String(value.language || value.lang || 'ru').toLowerCase();
    const adultMode = String(value.adult_mode || value.adultMode || 'warm').toLowerCase();
    const voiceExpression = String(value.voice_expression || value.voiceExpression || 'alive').toLowerCase();
    return {
        adultConfirmed: value.adult_confirmed === true,
        mode: VALID_MODES.has(mode) ? mode : 'talk',
        adultMode: VALID_ADULT_MODES.has(adultMode) ? adultMode : 'warm',
        voiceExpression: VALID_VOICE_EXPRESSIONS.has(voiceExpression) ? voiceExpression : 'alive',
        speechSpeed: speechSpeed(value.speech_speed ?? value.speechSpeed),
        language: VALID_LANGUAGES.has(language) ? language : 'ru',
        voice: normalizeVoice(value.voice, normalizeVoice(defaultVoice)),
        noSave: value.no_save !== false,
    };
}

module.exports = {
    VALID_PROVIDERS,
    VALID_MODES,
    VALID_ADULT_MODES,
    VALID_VOICE_EXPRESSIONS,
    VALID_LANGUAGES,
    DEFAULT_SPEECH_SPEED,
    MIN_SPEECH_SPEED,
    MAX_SPEECH_SPEED,
    speechSpeed,
    loadConfig,
    normalizeSessionOptions,
};
