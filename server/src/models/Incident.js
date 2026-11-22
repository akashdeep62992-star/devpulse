import mongoose from 'mongoose';
import { toJSON } from '../utils/toJSON.js';

const incidentSchema = new mongoose.Schema(
  {
    monitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true, index: true },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    cause: String,
  },
  { toJSON: toJSON() },
);

incidentSchema.virtual('durationSec').get(function () {
  return Math.round(((this.resolvedAt ?? new Date()) - this.startedAt) / 1000);
});

export const Incident = mongoose.model('Incident', incidentSchema);
