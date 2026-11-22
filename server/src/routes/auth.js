import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const email = z.string().trim().toLowerCase().email().max(254);
const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

// Compared against when the email doesn't exist, so the response time doesn't
// reveal which emails are registered (user-enumeration protection).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

function makeSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'status';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

router.post('/register', validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, config.bcryptRounds),
    statusSlug: makeSlug(name),
  });
  res.status(201).json({ token: signToken(user._id), user });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');
  res.json({ token: signToken(user._id), user });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'User no longer exists');
  res.json({ user });
});

export default router;
