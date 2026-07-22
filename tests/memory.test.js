'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../src/server');
const { InMemoryMemoryStore } = require('../src/memory/memoryStore');
const { buildRealtimeSystemInstruction } = require('../src/realtime/realtimePrompt');

const DEVICE_ID = '5ed4148b-5df0-47f5-b634-8da80a6c681f';

async function request(base, path, { method = 'GET', body, deviceId = DEVICE_ID } = {}) {
    const response = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-LAURA-DEVICE-ID': deviceId },
        body: body == null ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
}

test('memory API enforces consent and completes CRUD lifecycle', async (t) => {
    const memoryStore = new InMemoryMemoryStore();
    const { server } = createServer({ env: { REALTIME_PROVIDER: 'mock', HOST: '127.0.0.1', NODE_ENV: 'test' }, memoryStore });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}`;

    assert.deepEqual((await request(base, '/api/memory/settings')).body, { enabled: false });
    assert.equal((await request(base, '/api/memory', { method: 'POST', body: { content: 'Люблю сухое вино', explicit_consent: true } })).status, 409);
    assert.equal((await request(base, '/api/memory/settings', { method: 'PATCH', body: { enabled: true } })).body.enabled, true);
    assert.equal((await request(base, '/api/memory', { method: 'POST', body: { content: 'без согласия' } })).status, 400);

    const created = await request(base, '/api/memory', { method: 'POST', body: { content: '  Люблю   сухое вино  ', explicit_consent: true } });
    assert.equal(created.status, 201);
    assert.equal(created.body.content, 'Люблю сухое вино');
    assert.equal((await request(base, '/api/memory')).body.items.length, 1);

    const updated = await request(base, `/api/memory/${created.body.id}`, { method: 'PATCH', body: { content: 'Люблю сухое красное вино' } });
    assert.equal(updated.body.content, 'Люблю сухое красное вино');
    assert.equal((await request(base, `/api/memory/${created.body.id}`, { method: 'DELETE' })).body.deleted, true);
    assert.deepEqual((await request(base, '/api/memory')).body.items, []);
});

test('memory is device-scoped and validates identifiers and content', async () => {
    const store = new InMemoryMemoryStore();
    await store.updateSettings(DEVICE_ID, { enabled: true });
    await store.create(DEVICE_ID, 'Предпочитает русский язык');
    assert.equal((await store.list(DEVICE_ID)).length, 1);
    await assert.rejects(() => store.list('not-a-device'), { code: 'invalid_device_id' });
    await assert.rejects(() => store.create(DEVICE_ID, 'x'.repeat(501)), { code: 'memory_content_too_long' });
});

test('realtime prompt injects approved memory only when supplied', () => {
    const withMemory = buildRealtimeSystemInstruction({ noSave: true, sessionMemory: '1. Любит джаз' }).text;
    assert.match(withMemory, /Любит джаз/);
    assert.match(withMemory, /Explicitly saved facts may still be used/);
    const noSave = buildRealtimeSystemInstruction({ noSave: true }).text;
    assert.match(noSave, /NO-SAVE/);
    assert.doesNotMatch(noSave, /Любит джаз/);
});

test('realtime server loads approved memory independently of no-save transcript mode', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'realtime', 'realtimeServer.js'), 'utf8');
    assert.match(source, /if \(memoryStore\?\.available\)/);
    assert.doesNotMatch(source, /if \(!options\.noSave && memoryStore\?\.available\)/);
});
