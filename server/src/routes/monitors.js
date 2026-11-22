import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { Monitor } from '../models/Monitor.js';
import { Check } from '../models/Check.js';
import { Incident } from '../models/Incident.js';
import { validate } from '../middleware/validate.js';
import { runCheck } from '../services/checker.js';
import { recordResult, deleteMonitorCascade } from '../services/monitorService.js';
import { assertPublicUrl } from '../services/urlGuard.js';
import { HttpError } from '../utils/httpError.js';
import { pct, round } from '../utils/stats.js';

const router = Router();

const url = z.string().trim().max(2048).refine((v) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}, 'Must be a valid http:// or https:// URL');

const fields = {
  name: z.string().trim().min(1).max(80),
  url,
  method: z.enum(['GET', 'HEAD']),
  intervalSec: z.number().int().min(30).max(86400),
  timeoutMs: z.number().int().min(1000).max(30000),
  expectedStatus: z.number().int().min(100).max(599).nullable(),
  isPublic: z.boolean(),
};
const createSchema = z.object({
  ...fields,
  method: fields.method.default('GET'),
  intervalSec: fields.intervalSec.default(60),
  timeoutMs: fields.timeoutMs.default(10000),
  expectedStatus: fields.expectedStatus.default(null),
  isPublic: fields.isPublic.default(false),
});
const updateSchema = z.object({ ...fields, isActive: z.boolean() }).partial();

const RANGES = {
  '24h': { ms: 86400e3, unit: 'minute', binSize: 15 },
  '7d': { ms: 7 * 86400e3, unit: 'hour', binSize: 2 },
  '30d': { ms: 30 * 86400e3, unit: 'hour', binSize: 12 },
};

const checkNowLimiter = rateLimit({
  windowMs: 60e3,
  limit: 10,
  skip: () => config.isTest,
  message: { error: 'Too many manual checks, try again in a minute' },
});

async function ensurePublic(targetUrl) {
  if (config.allowPrivateTargets) return;
  try {
    await assertPublicUrl(targetUrl);
  } catch (err) {
    throw new HttpError(400, err.message);
  }
}

async function loadOwned(req) {
  const monitor = await Monitor.findOne({ _id: req.params.id, owner: req.userId });
  if (!monitor) throw new HttpError(404, 'Monitor not found');
  return monitor;
}

// GET /api/monitors - list with 24h uptime & avg response time
router.get('/', async (req, res) => {
  const monitors = await Monitor.find({ owner: req.userId }).sort({ createdAt: 1 });
  const stats = await Check.aggregate([
    { $match: { monitor: { $in: monitors.map((m) => m._id) }, checkedAt: { $gte: new Date(Date.now() - 86400e3) } } },
    {
      $group: {
        _id: '$monitor',
        total: { $sum: 1 },
        up: { $sum: { $cond: ['$ok', 1, 0] } },
        avg: { $avg: { $cond: ['$ok', '$responseTime', null] } },
      },
    },
  ]);
  const byId = new Map(stats.map((s) => [String(s._id), s]));
  res.json({
    monitors: monitors.map((m) => {
      const s = byId.get(String(m._id));
      return { ...m.toJSON(), uptime24h: s ? pct(s.up, s.total) : null, avgResponse24h: s ? round(s.avg) : null };
    }),
  });
});

router.post('/', validate(createSchema), async (req, res) => {
  const count = await Monitor.countDocuments({ owner: req.userId });
  if (count >= config.maxMonitorsPerUser) {
    throw new HttpError(403, `Limit of ${config.maxMonitorsPerUser} monitors reached`);
  }
  await ensurePublic(req.body.url);
  const monitor = await Monitor.create({ ...req.body, owner: req.userId, nextCheckAt: new Date() });
  res.status(201).json({ monitor });
});

router.get('/:id', async (req, res) => {
  res.json({ monitor: await loadOwned(req) });
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const monitor = await loadOwned(req);
  const changes = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined));

  if (changes.url && changes.url !== monitor.url) {
    await ensurePublic(changes.url);
    Object.assign(changes, { status: 'pending', consecutiveFailures: 0, nextCheckAt: new Date() });
  }
  if (changes.isActive === true && !monitor.isActive) changes.nextCheckAt = new Date();

  monitor.set(changes);
  await monitor.save();
  res.json({ monitor });
});

router.delete('/:id', async (req, res) => {
  const monitor = await loadOwned(req);
  await deleteMonitorCascade(monitor._id);
  res.status(204).end();
});

// POST /api/monitors/:id/check - run a check right now
router.post('/:id/check', checkNowLimiter, async (req, res) => {
  const monitor = await loadOwned(req);
  const result = await runCheck(monitor);
  const state = await recordResult(monitor, result);
  res.json({ result, status: state.status });
});

// GET /api/monitors/:id/stats?range=24h|7d|30d
router.get('/:id/stats', async (req, res) => {
  const monitor = await loadOwned(req);
  const range = Object.hasOwn(RANGES, req.query.range) ? req.query.range : '24h';
  const { ms, unit, binSize } = RANGES[range];
  const match = { monitor: monitor._id, checkedAt: { $gte: new Date(Date.now() - ms) } };
  const okResponseTime = { $cond: ['$ok', '$responseTime', null] };

  const [[summary], series] = await Promise.all([
    Check.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          up: { $sum: { $cond: ['$ok', 1, 0] } },
          avg: { $avg: okResponseTime },
          min: { $min: okResponseTime },
          max: { $max: okResponseTime },
          p95: { $percentile: { input: okResponseTime, p: [0.95], method: 'approximate' } },
        },
      },
    ]),
    Check.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateTrunc: { date: '$checkedAt', unit, binSize } },
          total: { $sum: 1 },
          up: { $sum: { $cond: ['$ok', 1, 0] } },
          avg: { $avg: okResponseTime },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    range,
    summary: {
      totalChecks: summary?.total ?? 0,
      uptime: summary ? pct(summary.up, summary.total) : null,
      avgResponse: round(summary?.avg),
      minResponse: round(summary?.min),
      maxResponse: round(summary?.max),
      p95Response: round(summary?.p95?.[0]),
    },
    series: series.map((b) => ({ time: b._id, avgResponse: round(b.avg), uptime: pct(b.up, b.total), checks: b.total })),
  });
});

// GET /api/monitors/:id/checks?limit=50 - most recent raw checks
router.get('/:id/checks', async (req, res) => {
  const monitor = await loadOwned(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const checks = await Check.find({ monitor: monitor._id }).sort({ checkedAt: -1 }).limit(limit);
  res.json({ checks });
});

router.get('/:id/incidents', async (req, res) => {
  const monitor = await loadOwned(req);
  const incidents = await Incident.find({ monitor: monitor._id }).sort({ startedAt: -1 }).limit(50);
  res.json({ incidents });
});

export default router;
