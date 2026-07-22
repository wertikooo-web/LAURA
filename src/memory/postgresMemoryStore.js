'use strict';
const { Pool } = require('pg');
const { validateDeviceId, validateMemoryId, validateContent, normalizeMemoryOptions, MAX_MEMORIES_PER_DEVICE } = require('./memoryStore');

class PostgresMemoryStore {
    constructor(connectionString) { this.pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 }); this.available = true; this.persistence = 'postgres'; }
    async getSettings(deviceId) { validateDeviceId(deviceId); const result = await this.pool.query('SELECT enabled FROM laura_memory_settings WHERE device_id = $1', [deviceId]); return { enabled: result.rows[0]?.enabled === true }; }
    async updateSettings(deviceId, { enabled }) {
        validateDeviceId(deviceId); const result = await this.pool.query(`INSERT INTO laura_memory_settings (device_id, enabled, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (device_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW() RETURNING enabled`, [deviceId, enabled === true]);
        return { enabled: result.rows[0].enabled };
    }
    async list(deviceId, { characterId = null } = {}) { validateDeviceId(deviceId); if (characterId) validateMemoryId(characterId); const result = await this.pool.query(`SELECT id::text, content, scope, character_id::text, created_at, updated_at FROM laura_memories WHERE device_id=$1 AND (scope='global_user' OR (scope='character_relationship' AND character_id=$2::uuid)) ORDER BY updated_at DESC LIMIT $3`, [deviceId, characterId, MAX_MEMORIES_PER_DEVICE]); return result.rows; }
    async create(deviceId, content, options = {}) {
        validateDeviceId(deviceId); const normalized = validateContent(content);
        const { scope, characterId } = normalizeMemoryOptions(options);
        const result = await this.pool.query('INSERT INTO laura_memories (device_id, content, scope, character_id) SELECT $1, $2, $3, $4::uuid WHERE (SELECT COUNT(*) FROM laura_memories WHERE device_id = $1) < $5 RETURNING id::text, content, scope, character_id::text, created_at, updated_at', [deviceId, normalized, scope, characterId, MAX_MEMORIES_PER_DEVICE]);
        if (!result.rows[0]) throw Object.assign(new Error('memory_limit_reached'), { code: 'memory_limit_reached' }); return result.rows[0];
    }
    async update(deviceId, memoryId, content) { validateDeviceId(deviceId); validateMemoryId(memoryId); const result = await this.pool.query('UPDATE laura_memories SET content = $3, updated_at = NOW() WHERE device_id = $1 AND id = $2::uuid RETURNING id::text, content, created_at, updated_at', [deviceId, memoryId, validateContent(content)]); return result.rows[0] || null; }
    async delete(deviceId, memoryId) { validateDeviceId(deviceId); validateMemoryId(memoryId); const result = await this.pool.query('DELETE FROM laura_memories WHERE device_id = $1 AND id = $2::uuid', [deviceId, memoryId]); return result.rowCount > 0; }
    async clear(deviceId) { validateDeviceId(deviceId); const result = await this.pool.query('DELETE FROM laura_memories WHERE device_id = $1', [deviceId]); return result.rowCount; }
    async close() { await this.pool.end(); }
}
module.exports = { PostgresMemoryStore };
