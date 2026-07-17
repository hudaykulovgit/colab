// One-time setup: creates the tables (if missing) and seeds the current
// 29 contracts embedded in index.html into Neon. Safe to re-run --
// upsertContract does INSERT ... ON CONFLICT DO UPDATE.
//
// Usage:
//   npx dotenv -e .env.local -- node scripts/migrate.js

const fs = require('fs');
const path = require('path');
const { getSql } = require('../lib/db');
const { upsertContract } = require('../lib/contracts');

async function main() {
  const sql = getSql();

  console.log('Creating tables (if not present)...');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const statements = schema.split(';').map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log('Extracting SEED_DATA from index.html...');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/const SEED_DATA = ([\s\S]*?);\s*\n\s*const STORAGE_KEY/);
  if (!match) throw new Error('Could not find SEED_DATA in index.html');
  // eslint-disable-next-line no-eval
  const SEED_DATA = eval('(' + match[1] + ')');

  console.log(`Seeding ${SEED_DATA.contracts.length} contracts...`);
  for (const contract of SEED_DATA.contracts) {
    await upsertContract(contract);
    process.stdout.write('.');
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
