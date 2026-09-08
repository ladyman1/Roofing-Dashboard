const { initSchema } = require('../db/schema');
const { seedInitialData } = require('../services/seeder');
const { db } = require('../db/knex');

async function main() {
  try {
    console.log('[SEED] Initializing schema...');
    await initSchema();
    console.log('[SEED] Running seed...');
    const result = await seedInitialData(true);
    console.log('[SEED] Done:', result);
    process.exit(0);
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
