import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

export function signToken(userId) {
  return jwt.sign({}, config.jwtSecret, { subject: String(userId), expiresIn: config.jwtExpiresIn });
}

/** Requires a valid `Authorization: Bearer <jwt>` header; sets req.userId. */
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  req.userId = payload.sub;
  next();
}
