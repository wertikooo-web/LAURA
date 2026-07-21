'use strict';

const { MockRealtimeProvider, DEFAULT_CONFIG } = require('../realtime/mockRealtimeProvider');
const { XaiVoiceProvider } = require('./xaiVoiceProvider');
const { GeminiLiveProvider, GEMINI_VOICES } = require('./geminiLiveProvider');
const { FEMALE_VOICES } = require('../voiceCatalog');
const { normalizeProviderName, VALID_PROVIDERS } = require('../config/env');

function configurationError(code) { return Object.assign(new Error(code), { code }); }

function createRealtimeProviderRegistry(config, overrides = {}) {
    const instances = new Map();
    const definitions = {
        mock: { label: 'Mock', configured: true, model: 'mock-tone-v1', voice: 'mock', voices: [] },
        grok: { label: 'Grok Voice', configured: Boolean(overrides.grok || (config.xai.apiKey && config.xai.model)), model: config.xai.model, voice: config.xai.voice, voices: FEMALE_VOICES },
        gemini: { label: 'Gemini Live', configured: Boolean(overrides.gemini || (config.gemini.apiKey && config.gemini.model)), model: config.gemini.model, voice: config.gemini.voice, voices: GEMINI_VOICES },
    };

    function create(name) {
        if (overrides[name]) return overrides[name];
        if (name === 'mock') return new MockRealtimeProvider(DEFAULT_CONFIG);
        if (name === 'grok') return new XaiVoiceProvider(config.xai);
        if (name === 'gemini') return new GeminiLiveProvider(config.gemini);
        throw configurationError(`unsupported_realtime_provider:${name}`);
    }

    function resolve(value) {
        const name = normalizeProviderName(value, config.provider);
        if (!VALID_PROVIDERS.has(name)) throw configurationError(`unsupported_realtime_provider:${name}`);
        if (!definitions[name].configured) throw configurationError(`${name}_provider_not_configured`);
        if (!instances.has(name)) instances.set(name, create(name));
        const provider = instances.get(name);
        return { ...definitions[name], name, createSession: (options) => provider.createSession(options) };
    }

    return {
        defaultProvider: config.provider,
        resolve,
        list: () => Object.entries(definitions).filter(([name]) => name !== 'mock' || config.provider === 'mock').map(([id, item]) => ({ id, label: item.label, configured: item.configured, voice: item.voice, voices: item.voices })),
    };
}

module.exports = { createRealtimeProviderRegistry };
