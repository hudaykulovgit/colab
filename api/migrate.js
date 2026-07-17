// One-time migration endpoint: creates tables and seeds the 29 contracts
// bundled in index.html's SEED_DATA. Protected by a token so it can't be
// triggered by anyone browsing the (unauthenticated) app. Delete this
// file after running it once.

const fs = require('fs');
const path = require('path');
const { getSql } = require('../lib/db');
const { upsertContract } = require('../lib/contracts');

const MIGRATE_TOKEN = 'fad056fb8b7f54db970ade38dacd977ee8f67a449ac1c3c4';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.query.token !== MIGRATE_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const sql = getSql();
    const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    const statements = schema.split(';').map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) {
      await sql.query(statement);
    }

    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const match = html.match(/const SEED_DATA = ([\s\S]*?);\s*\n\s*const STORAGE_KEY/);
    if (!match) throw new Error('Could not find SEED_DATA in index.html');
    // eslint-disable-next-line no-eval
    const SEED_DATA = eval('(' + match[1] + ')');

    let seeded = 0;
    for (const contract of SEED_DATA.contracts) {
      await upsertContract(contract);
      seeded += 1;
    }

    return res.status(200).json({ tablesCreated: true, seeded });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
