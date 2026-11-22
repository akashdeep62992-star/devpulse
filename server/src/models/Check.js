import mongoose from 'mongoose';
import { toJSON } from '../utils/toJSON.js';

const RETENTION_DAYS = 30;

const checkSchema = new mongoose.Schema(
  {
    monitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
    ok: { type: Boolean, required: true },
    statusCode: { type: Number, default: null },
    responseTime: { type: Number, required: true },
    errorMessage: { type: String, default: null },
    checkedAt: { type: Date, default: () => new Date() },
  },
  { toJSON: toJSON('monitor') },
);

checkSchema.index({ monitor: 1, checkedAt: -1 });
// TTL index: MongoDB deletes old checks automatically.
checkSchema.index({ checkedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });

export const Check = mongoose.model('Check', checkSchema);
