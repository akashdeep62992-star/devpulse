import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { createApp } from './app.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

const here = path.dirname(fileURLToPath(import.meta.url));

await connectDb(config.mongoUri, { dbPath: path.join(here, '..', '.data', 'db') });

const server = createApp().listen(config.port, () => {
  console.log(`[api] DevPulse API listening on http://localhost:${config.port}`);
});
startScheduler();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received, shutting down...`);
  stopScheduler();
  server.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
