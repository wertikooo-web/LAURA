'use strict';

const { validateDeviceId, validateMemoryId } = require('./memoryStore');

function deviceIdFrom(request) { return validateDeviceId(request.headers['x-laura-device-id']); }

function statusFor(error) {
    if (error.code === 'memory_storage_not_configured') return 503;
    if (error.code === 'memory_limit_reached') return 409;
    if (String(error.code || '').startsWith('invalid_') || String(error.code || '').startsWith('memory_content')) return 400;
    return 500;
}

function createMemoryApi({ memoryStore, sendJson, readJson }) {
    return async function handleMemoryApi(request, response, url) {
        if (!url.pathname.startsWith('/api/memory')) return false;
        try {
            if (url.pathname === '/api/memory/status' && request.method === 'GET') {
                sendJson(response, 200, { available: memoryStore.available, persistence: memoryStore.persistence }); return true;
            }
            const deviceId = deviceIdFrom(request);
            if (!memoryStore.available) throw Object.assign(new Error('memory_storage_not_configured'), { code: 'memory_storage_not_configured' });
            if (url.pathname === '/api/memory/settings') {
                if (request.method === 'GET') { sendJson(response, 200, await memoryStore.getSettings(deviceId)); return true; }
                if (request.method === 'PATCH') {
                    const body = await readJson(request);
                    if (typeof body.enabled !== 'boolean') throw Object.assign(new Error('invalid_memory_setting'), { code: 'invalid_memory_setting' });
                    sendJson(response, 200, await memoryStore.updateSettings(deviceId, { enabled: body.enabled })); return true;
                }
            }
            if (url.pathname === '/api/memory') {
                if (request.method === 'GET') { sendJson(response, 200, { items: await memoryStore.list(deviceId) }); return true; }
                if (request.method === 'POST') {
                    const body = await readJson(request);
                    if (body.explicit_consent !== true) throw Object.assign(new Error('invalid_explicit_consent'), { code: 'invalid_explicit_consent' });
                    const settings = await memoryStore.getSettings(deviceId);
                    if (!settings.enabled) { sendJson(response, 409, { error: 'memory_not_enabled' }); return true; }
                    sendJson(response, 201, await memoryStore.create(deviceId, body.content)); return true;
                }
                if (request.method === 'DELETE') { sendJson(response, 200, { deleted: await memoryStore.clear(deviceId) }); return true; }
            }
            const match = url.pathname.match(/^\/api\/memory\/([^/]+)$/);
            if (match) {
                const memoryId = validateMemoryId(match[1]);
                if (request.method === 'PATCH') {
                    const item = await memoryStore.update(deviceId, memoryId, (await readJson(request)).content);
                    sendJson(response, item ? 200 : 404, item || { error: 'memory_not_found' }); return true;
                }
                if (request.method === 'DELETE') {
                    const deleted = await memoryStore.delete(deviceId, memoryId);
                    sendJson(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: 'memory_not_found' }); return true;
                }
            }
            sendJson(response, 405, { error: 'method_not_allowed' }); return true;
        } catch (error) {
            sendJson(response, statusFor(error), { error: error.code || 'memory_request_failed' }); return true;
        }
    };
}

module.exports = { createMemoryApi };
