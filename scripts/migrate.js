'use strict';
require('dotenv').config();
const fs = require('fs'); const path = require('path'); const { Client } = require('pg');
async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
        const migrationsRoot = path.join(__dirname, '..', 'migrations');
        const migrations = fs.readdirSync(migrationsRoot).filter((name) => name.endsWith('.sql')).sort();
        for (const migration of migrations) {
            await client.query(fs.readFileSync(path.join(migrationsRoot, migration), 'utf8'));
            console.log(`[LAURA] migration complete: ${migration}`);
        }
    }
    finally { await client.end(); }
}
main().catch((error) => { console.error(`[LAURA] migration failed: ${error.message}`); process.exitCode = 1; });
