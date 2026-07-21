'use strict';

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const {
    loadConfig,
    VALID_VOICE_EXPRESSIONS,
    DEFAULT_SPEECH_SPEED,
    MIN_SPEECH_SPEED,
    MAX_SPEECH_SPEED,
    speechSpeed,
} = require('./config/env');
const { createRealtimeProviderRegistry } = require('./providers/createProvider');
const { attachRealtimeServer } = require('./realtime/realtimeServer');
const { createRealtimeMetrics } = require('./realtime/realtimeMetrics');
const { createMemoryStore } = require('./memory/memoryStore');
const { createMemoryApi } = require('./memory/memoryApi');
const { SUPPORTED_LANGUAGES, FEMALE_VOICES, FEMALE_VOICE_IDS, PREVIEW_PHRASES } = require('./voiceCatalog');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
};

function sendJson(response, status, body) {
    const data = Buffer.from(JSON.stringify(body));
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
    });
    response.end(data);
}

function readJson(request, limit = 4096) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        request.on('data', (chunk) => {
            size += chunk.length;
            if (size > limit) {
                reject(Object.assign(new Error('request_too_large'), { code: 'request_too_large' }));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
            catch { reject(Object.assign(new Error('invalid_json'), { code: 'invalid_json' })); }
        });
        request.on('error', reject);
    });
}

function clientAddress(request) {
    return String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function createServer({ env = process.env, memoryStore: providedMemoryStore, providerOverrides = {} } = {}) {
    const config = loadConfig(env);
    const providerRegistry = createRealtimeProviderRegistry(config, providerOverrides);
    const provider = providerRegistry.resolve(config.provider);
    const metrics = createRealtimeMetrics();
    const memoryStore = providedMemoryStore || createMemoryStore(config);
    const handleMemoryApi = createMemoryApi({ memoryStore, sendJson, readJson });
    const publicRoot = path.resolve(__dirname, '..', 'public');
    const previewCache = new Map();
    const previewRate = new Map();

    async function serveVoicePreview(request, response) {
        if (!config.xai.apiKey) return sendJson(response, 503, { error: 'voice_preview_requires_grok' });
        const now = Date.now();
        const address = clientAddress(request);
        const recent = (previewRate.get(address) || []).filter((time) => now - time < 60_000);
        if (recent.length >= 12) return sendJson(response, 429, { error: 'voice_preview_rate_limited' });
        recent.push(now);
        previewRate.set(address, recent);

        let body;
        try { body = await readJson(request); }
        catch (error) { return sendJson(response, error.code === 'request_too_large' ? 413 : 400, { error: error.code || 'invalid_request' }); }
        const voice = String(body.voice || '').toLowerCase();
        const language = String(body.language || '').toLowerCase();
        const previewSpeed = body.speech_speed == null
            ? DEFAULT_SPEECH_SPEED
            : speechSpeed(body.speech_speed, NaN);
        if (!FEMALE_VOICE_IDS.has(voice) || !SUPPORTED_LANGUAGES.includes(language)) {
            return sendJson(response, 400, { error: 'unsupported_voice_or_language' });
        }
        if (!Number.isFinite(previewSpeed)) return sendJson(response, 400, { error: 'unsupported_speech_speed' });

        const cacheKey = `${voice}:${language}:${previewSpeed}`;
        let audio = previewCache.get(cacheKey);
        if (!audio) {
            let upstream;
            try {
                upstream = await fetch('https://api.x.ai/v1/tts', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${config.xai.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: PREVIEW_PHRASES[language],
                        voice_id: voice,
                        // xAI TTS does not currently document Romanian as an explicit language code.
                        language: language === 'ro' ? 'auto' : language,
                        speed: previewSpeed,
                        output_format: { codec: 'mp3' },
                    }),
                    signal: AbortSignal.timeout(20_000),
                });
            } catch {
                return sendJson(response, 502, { error: 'voice_preview_unavailable' });
            }
            if (!upstream.ok) return sendJson(response, 502, { error: 'voice_preview_provider_error' });
            audio = Buffer.from(await upstream.arrayBuffer());
            if (!audio.length || audio.length > 2 * 1024 * 1024) {
                return sendJson(response, 502, { error: 'voice_preview_invalid_audio' });
            }
            previewCache.set(cacheKey, audio);
        }
        response.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audio.length,
            'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
        });
        response.end(audio);
    }

    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (await handleMemoryApi(request, response, url)) return;
        if (request.method === 'GET' && url.pathname === '/api/health') {
            return sendJson(response, 200, { ok: true, service: 'laura-realtime', provider: provider.name });
        }
        if (request.method === 'GET' && url.pathname === '/api/config') {
            return sendJson(response, 200, {
                provider: provider.name,
                model: provider.model,
                voice: provider.voice,
                adult_confirmation_required: true,
                raw_audio_storage: false,
                transcript_logging: config.allowTranscriptLogging,
                modes: ['talk', 'evening', 'quiet'],
                adult_modes: ['warm', 'flirty', 'sensual', 'direct'],
                voice_expressions: [...VALID_VOICE_EXPRESSIONS],
                default_speech_speed: DEFAULT_SPEECH_SPEED,
                speech_speed_range: { min: MIN_SPEECH_SPEED, max: MAX_SPEECH_SPEED },
                languages: SUPPORTED_LANGUAGES,
                voices: FEMALE_VOICES,
                realtime_providers: providerRegistry.list(),
                memory_available: memoryStore.available,
                memory_persistence: memoryStore.persistence,
            });
        }
        if (request.method === 'POST' && url.pathname === '/api/voice-preview') {
            return serveVoicePreview(request, response);
        }
        if (request.method === 'GET' && url.pathname === '/api/realtime-metrics') {
            return sendJson(response, 200, { providers: metrics.summary(), retained_sessions: 200, estimated_cost_note: 'Not calculated until provider pricing is configured.' });
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return sendJson(response, 405, { error: 'method_not_allowed' });
        }

        const requested = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = path.resolve(publicRoot, `.${requested}`);
        if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
            return sendJson(response, 404, { error: 'not_found' });
        }
        fs.stat(filePath, (error, stat) => {
            if (error || !stat.isFile()) return sendJson(response, 404, { error: 'not_found' });
            response.writeHead(200, {
                'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
                'Content-Length': stat.size,
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'no-referrer',
                'Permissions-Policy': 'camera=(), microphone=(self)',
            });
            if (request.method === 'HEAD') return response.end();
            fs.createReadStream(filePath).pipe(response);
        });
    });

    attachRealtimeServer(server, {
        resolveProvider: providerRegistry.resolve,
        defaultProvider: providerRegistry.defaultProvider,
        allowTranscriptLogging: config.allowTranscriptLogging,
        memoryStore,
        metrics,
    });
    server.on('close', () => memoryStore.close?.().catch?.(() => {}));
    return { server, config, provider, providerRegistry, memoryStore, metrics };
}

if (require.main === module) {
    try {
        const { server, config, provider } = createServer();
        server.listen(config.port, config.host, () => {
            console.log(`[LAURA] http://${config.host}:${config.port} provider=${provider.name}`);
        });
    } catch (error) {
        console.error(`[LAURA] startup failed: ${error.code || error.message}`);
        process.exitCode = 1;
    }
}

module.exports = { createServer };
