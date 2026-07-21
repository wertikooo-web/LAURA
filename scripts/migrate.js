'use strict';
require('dotenv').config();
const fs = require('fs'); const path = require('path'); const { Client } = require('pg');
async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_laura_memory.sql'), 'utf8')); console.log('[LAURA] memory migration complete'); }
    finally { await client.end(); }
}
main().catch((error) => { console.error(`[LAURA] migration failed: ${error.message}`); process.exitCode = 1; });
