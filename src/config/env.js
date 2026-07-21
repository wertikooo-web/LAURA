'use strict';

const { SUPPORTED_LANGUAGES, normalizeVoice } = require('../voiceCatalog');

const VALID_PROVIDERS = new Set(['mock', 'xai']);
const VALID_MODES = new Set(['talk', 'evening', 'quiet']);
const VALID_LANGUAGES = new Set(SUPPORTED_LANGUAGES);

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
    return {
        adultConfirmed: value.adult_confirmed === true,
        mode: VALID_MODES.has(mode) ? mode : 'talk',
        language: VALID_LANGUAGES.has(language) ? language : 'ru',
        voice: normalizeVoice(value.voice, normalizeVoice(defaultVoice)),
        noSave: value.no_save !== false,
    };
}

module.exports = {
    VALID_PROVIDERS,
    VALID_MODES,
    VALID_LANGUAGES,
    loadConfig,
    normalizeSessionOptions,
};
