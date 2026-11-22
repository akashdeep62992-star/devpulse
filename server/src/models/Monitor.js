import mongoose from 'mongoose';
import { toJSON } from '../utils/toJSON.js';

const monitorSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true },
    method: { type: String, enum: ['GET', 'HEAD'], default: 'GET' },
    intervalSec: { type: Number, default: 60, min: 30, max: 86400 },
    timeoutMs: { type: Number, default: 10000, min: 1000, max: 30000 },
    expectedStatus: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'up', 'down'], default: 'pending' },
    consecutiveFailures: { type: Number, default: 0 },
    lastCheckedAt: Date,
    lastResponseTime: Number,
    lastError: String,
    nextCheckAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, toJSON: toJSON('consecutiveFailures', 'nextCheckAt') },
);

// The scheduler's hot query: "active monitors that are due".
monitorSchema.index({ isActive: 1, nextCheckAt: 1 });

export const Monitor = mongoose.model('Monitor', monitorSchema);
