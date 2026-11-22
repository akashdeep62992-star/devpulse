import mongoose from 'mongoose';
import fs from 'node:fs';

let memoryServer;

/**
 * Connects to MongoDB. Without a URI, starts an embedded MongoDB
 * (mongodb-memory-server). Pass `dbPath` to keep its data between restarts.
 */
export async function connectDb(uri, { dbPath } = {}) {
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const instance = {};
    if (dbPath) {
      fs.mkdirSync(dbPath, { recursive: true });
      Object.assign(instance, { dbPath, storageEngine: 'wiredTiger' });
    }
    memoryServer = await MongoMemoryServer.create({ instance });
    uri = memoryServer.getUri('devpulse');
    if (dbPath) console.warn(`[db] MONGO_URI not set - using embedded MongoDB at ${dbPath}`);
  }
  await mongoose.connect(uri);
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  memoryServer = undefined;
}
