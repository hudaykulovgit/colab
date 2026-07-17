const { neon } = require('@neondatabase/serverless');

let _sql = null;

// Lazy init: avoids throwing at module-load time (e.g. during build)
// if DATABASE_URL isn't set yet.
function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Add the Neon integration in the Vercel dashboard (Storage tab) for this project.');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

module.exports = { getSql };
