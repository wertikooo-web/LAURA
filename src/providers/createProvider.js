'use strict';

const { MockRealtimeProvider, DEFAULT_CONFIG } = require('../realtime/mockRealtimeProvider');
const { XaiVoiceProvider } = require('./xaiVoiceProvider');

function createProvider(config) {
    if (config.provider === 'xai') {
        const provider = new XaiVoiceProvider(config.xai);
        return {
            name: 'xai',
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
