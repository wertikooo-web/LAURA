'use strict';

const { MockRealtimeProvider, DEFAULT_CONFIG } = require('../realtime/mockRealtimeProvider');
const { XaiVoiceProvider } = require('./xaiVoiceProvider');
const { createRealtimeProviderRegistry } = require('./realtimeProviderRegistry');

function createProvider(config) {
    if (config.provider === 'grok') {
        const provider = new XaiVoiceProvider(config.xai);
        return {
            name: 'grok',
            model: config.xai.model,
            voice: config.xai.voice,
            createSession: (options) => provider.createSession(options),
        };
    }
    const provider = new MockRealtimeProvider(DEFAULT_CONFIG);
    return {
        name: 'mock',
        model: 'mock-tone-v1',
        voice: 'mock',
        createSession: (options) => provider.createSession(options),
    };
}

module.exports = { createProvider };
module.exports.createRealtimeProviderRegistry = createRealtimeProviderRegistry;
