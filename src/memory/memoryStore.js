'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MEMORY_CHARS = 500;
const MAX_MEMORIES_PER_DEVICE = 100;
const MEMORY_SCOPES = new Set(['global_user', 'character_relationship']);

function validateDeviceId(value) {
    const deviceId = String(value || '').trim();
    if (!DEVICE_ID_RE.test(deviceId)) throw Object.assign(new Error('invalid_device_id'), { code: 'invalid_device_id' });
    return deviceId;
}

function validateContent(value) {
    const content = String(value || '').replace(/\s+/g, ' ').trim();
    if (!content) throw Object.assign(new Error('memory_content_required'), { code: 'memory_content_required' });
    if (content.length > MAX_MEMORY_CHARS) throw Object.assign(new Error('memory_content_too_long'), { code: 'memory_content_too_long' });
    return content;
}

function validateMemoryId(value) { return validateDeviceId(value); }
function normalizeMemoryOptions(options = {}) {
    const scope = options.scope || 'global_user';
    if (!MEMORY_SCOPES.has(scope)) throw Object.assign(new Error('invalid_memory_scope'), { code: 'invalid_memory_scope' });
    const characterId = options.characterId ? validateMemoryId(options.characterId) : null;
    if (scope === 'character_relationship' && !characterId) throw Object.assign(new Error('memory_character_required'), { code: 'memory_character_required' });
    return { scope, characterId };
}

class InMemoryMemoryStore {
    constructor(seed = {}) {
        this.memories = new Map(Object.entries(seed.memories || {}));
        this.settings = new Map(Object.entries(seed.settings || {}));
        this.available = true;
        this.persistence = 'memory';
    }
    async getSettings(deviceId) { validateDeviceId(deviceId); return { enabled: this.settings.get(deviceId)?.enabled === true }; }
    async updateSettings(deviceId, { enabled }) { validateDeviceId(deviceId); const value = { enabled: enabled === true }; this.settings.set(deviceId, value); return value; }
    async list(deviceId, { characterId = null } = {}) { validateDeviceId(deviceId); if (characterId) validateMemoryId(characterId); return (this.memories.get(deviceId) || []).filter((item) => !item.scope || item.scope === 'global_user' || (item.scope === 'character_relationship' && item.character_id === characterId)).map((item) => ({ scope: item.scope || 'global_user', character_id: item.character_id || null, ...item })); }
    async create(deviceId, content, options = {}) {
        validateDeviceId(deviceId); const normalized = validateContent(content); const items = this.memories.get(deviceId) || [];
        if (items.length >= MAX_MEMORIES_PER_DEVICE) throw Object.assign(new Error('memory_limit_reached'), { code: 'memory_limit_reached' });
        const { scope, characterId } = normalizeMemoryOptions(options);
        const now = new Date().toISOString(); const item = { id: crypto.randomUUID(), content: normalized, scope, character_id: characterId, created_at: now, updated_at: now };
        items.unshift(item); this.memories.set(deviceId, items); return { ...item };
    }
    async update(deviceId, memoryId, content) {
        validateDeviceId(deviceId); const normalized = validateContent(content); const item = (this.memories.get(deviceId) || []).find((candidate) => candidate.id === memoryId);
        if (!item) return null; item.content = normalized; item.updated_at = new Date().toISOString(); return { ...item };
    }
    async delete(deviceId, memoryId) {
        validateDeviceId(deviceId); const items = this.memories.get(deviceId) || []; const next = items.filter((item) => item.id !== memoryId);
        this.memories.set(deviceId, next); return next.length !== items.length;
    }
    async clear(deviceId) { validateDeviceId(deviceId); const count = (this.memories.get(deviceId) || []).length; this.memories.set(deviceId, []); return count; }
}

class FileMemoryStore extends InMemoryMemoryStore {
    constructor(filePath) {
        let seed = {}; try { seed = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        super(seed); this.filePath = filePath; this.persistence = 'local-file';
    }
    async persist() {
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
        const temporary = `${this.filePath}.${process.pid}.tmp`;
        const payload = JSON.stringify({ memories: Object.fromEntries(this.memories), settings: Object.fromEntries(this.settings) }, null, 2);
        await fs.promises.writeFile(temporary, payload, { encoding: 'utf8', mode: 0o600 }); await fs.promises.rename(temporary, this.filePath);
    }
    async updateSettings(...args) { const result = await super.updateSettings(...args); await this.persist(); return result; }
    async create(...args) { const result = await super.create(...args); await this.persist(); return result; }
    async update(...args) { const result = await super.update(...args); if (result) await this.persist(); return result; }
    async delete(...args) { const result = await super.delete(...args); if (result) await this.persist(); return result; }
    async clear(...args) { const result = await super.clear(...args); if (result) await this.persist(); return result; }
}

class UnavailableMemoryStore {
    constructor(reason = 'memory_storage_not_configured') { this.available = false; this.persistence = 'unavailable'; this.reason = reason; }
    fail() { throw Object.assign(new Error(this.reason), { code: this.reason }); }
    async getSettings() { this.fail(); } async updateSettings() { this.fail(); } async list() { this.fail(); }
    async create() { this.fail(); } async update() { this.fail(); } async delete() { this.fail(); } async clear() { this.fail(); }
}

function createMemoryStore({ nodeEnv = 'development', memoryFilePath = '', databaseUrl = '' } = {}) {
    if (databaseUrl) { const { PostgresMemoryStore } = require('./postgresMemoryStore'); return new PostgresMemoryStore(databaseUrl); }
    if (nodeEnv !== 'production') return new FileMemoryStore(path.resolve(memoryFilePath || path.join(process.cwd(), '.data', 'memory.json')));
    return new UnavailableMemoryStore();
}

function formatMemoryContext(items) { return items.slice(0, 50).map((item, index) => `${index + 1}. [${item.scope === 'character_relationship' ? 'this relationship' : 'global user fact'}] ${item.content}`).join('\n'); }

module.exports = { MAX_MEMORY_CHARS, MAX_MEMORIES_PER_DEVICE, MEMORY_SCOPES, validateDeviceId, validateMemoryId, validateContent, normalizeMemoryOptions, InMemoryMemoryStore, FileMemoryStore, UnavailableMemoryStore, createMemoryStore, formatMemoryContext };
