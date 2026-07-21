'use strict';

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config/env');
const { createProvider } = require('./providers/createProvider');
const { attachRealtimeServer } = require('./realtime/realtimeServer');

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

function createServer({ env = process.env } = {}) {
    const config = loadConfig(env);
    const provider = createProvider(config);
    const publicRoot = path.resolve(__dirname, '..', 'public');

    const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
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
                languages: ['auto', 'ru', 'en'],
            });
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
        providerFactory: provider.createSession,
        providerMetadata: provider,
        allowTranscriptLogging: config.allowTranscriptLogging,
    });
    return { server, config, provider };
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
