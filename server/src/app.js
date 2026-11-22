import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import monitorsRouter from './routes/monitors.js';
import statusRouter from './routes/status.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json({ limit: '10kb' }));
  if (config.nodeEnv === 'development') app.use(morgan('dev'));

  const limiter = (limit, windowMs) =>
    rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => config.isTest });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  app.use('/api', limiter(600, 15 * 60e3));
  app.use('/api/auth', limiter(20, 15 * 60e3), authRouter);
  app.use('/api/monitors', requireAuth, monitorsRouter);
  app.use('/api/status', statusRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
