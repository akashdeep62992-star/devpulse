import { Router } from 'express';
import { User } from '../models/User.js';
import { Monitor } from '../models/Monitor.js';
import { Check } from '../models/Check.js';
import { Incident } from '../models/Incident.js';
import { HttpError } from '../utils/httpError.js';
import { pct } from '../utils/stats.js';

const router = Router();
const DAYS = 30;
const DAY_MS = 86400e3;

// GET /api/status/:slug - public status page (no auth). Only monitors marked isPublic; URLs are not exposed.
router.get('/:slug', async (req, res) => {
  const user = await User.findOne({ statusSlug: req.params.slug }).lean();
  if (!user) throw new HttpError(404, 'Status page not found');

  const monitors = await Monitor.find({ owner: user._id, isPublic: true }).sort({ createdAt: 1 }).lean();
  const ids = monitors.map((m) => m._id);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (DAYS - 1) * DAY_MS);

  const [daily, incidents] = await Promise.all([
    Check.aggregate([
      { $match: { monitor: { $in: ids }, checkedAt: { $gte: start } } },
      {
        $group: {
          _id: { monitor: '$monitor', day: { $dateTrunc: { date: '$checkedAt', unit: 'day' } } },
          total: { $sum: 1 },
          up: { $sum: { $cond: ['$ok', 1, 0] } },
        },
      },
    ]),
    Incident.find({ monitor: { $in: ids } }).sort({ startedAt: -1 }).limit(10).lean(),
  ]);

  const key = (monitorId, day) => `${monitorId}|${day.toISOString()}`;
  const byKey = new Map(daily.map((d) => [key(d._id.monitor, d._id.day), d]));
  const names = new Map(monitors.map((m) => [String(m._id), m.name]));

  const result = monitors.map((m) => {
    let total = 0;
    let up = 0;
    const days = Array.from({ length: DAYS }, (_, i) => {
      const day = new Date(start.getTime() + i * DAY_MS);
      const d = byKey.get(key(m._id, day));
      if (d) {
        total += d.total;
        up += d.up;
      }
      return { date: day.toISOString().slice(0, 10), uptime: d ? pct(d.up, d.total) : null };
    });
    return {
      id: m._id,
      name: m.name,
      status: m.isActive ? m.status : 'paused',
      uptime30d: pct(up, total),
      days,
    };
  });

  res.json({
    name: user.name,
    allOperational: result.every((m) => m.status !== 'down'),
    monitors: result,
    incidents: incidents.map((i) => ({
      id: i._id,
      monitorName: names.get(String(i.monitor)),
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      cause: i.cause,
    })),
  });
});

export default router;
