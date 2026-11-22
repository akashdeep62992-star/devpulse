import mongoose from 'mongoose';
import { toJSON } from '../utils/toJSON.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    statusSlug: { type: String, required: true, unique: true },
  },
  { timestamps: true, toJSON: toJSON('passwordHash') },
);

export const User = mongoose.model('User', userSchema);
