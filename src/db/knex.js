const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/roofing.db';
const isPg = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://') || process.env.DB_CLIENT === 'pg';

let knexConfig;

if (isPg) {
  knexConfig = {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    }
  };
} else {
  // SQLite configuration
  let filePath = dbUrl.replace(/^sqlite:(\/\/)?/, '');
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(process.cwd(), filePath);
  }

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  knexConfig = {
    client: 'sqlite3',
    connection: {
      filename: filePath
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  };
}

const knex = require('knex')(knexConfig);

function getDbDialect() {
  return isPg ? 'postgresql' : 'sqlite';
}

module.exports = {
  db: knex,
  getDbDialect,
  isPg
};
