import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  nodeEnv,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: '7d',
  bcryptRounds: nodeEnv === 'test' ? 4 : 12,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Built client to serve from the API (set SERVE_CLIENT=true, e.g. on Render).
  clientDist:
    process.env.SERVE_CLIENT === 'true'
      ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist')
      : '',
  allowPrivateTargets: process.env.ALLOW_PRIVATE_TARGETS === 'true',
  maxMonitorsPerUser: 20,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.ALERT_FROM || 'DevPulse <alerts@devpulse.local>',
  },
};

if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production');
  if (!config.mongoUri) throw new Error('MONGO_URI must be set in production');
}
