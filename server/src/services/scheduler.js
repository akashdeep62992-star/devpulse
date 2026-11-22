import { Monitor } from '../models/Monitor.js';
import { runCheck } from './checker.js';
import { recordResult } from './monitorService.js';

const TICK_MS = 5000;
const BATCH_SIZE = 100;
const CONCURRENCY = 10;

let timer = null;
let ticking = false;

export function startScheduler() {
  if (timer) return;
  const safeTick = () => tick().catch((e) => console.error('[scheduler]', e));
  timer = setInterval(safeTick, TICK_MS);
  safeTick();
  console.log(`[scheduler] started (tick every ${TICK_MS / 1000}s)`);
}

export function stopScheduler() {
  clearInterval(timer);
  timer = null;
}

/**
 * One scheduler pass: find due monitors, "claim" each one with an atomic
 * conditional update (so several server instances never check the same
 * monitor twice), then run the checks with bounded concurrency.
 */
export async function tick() {
  if (ticking) return 0;
  ticking = true;
  try {
    const now = Date.now();
    const due = await Monitor.find({ isActive: true, nextCheckAt: { $lte: new Date(now) } })
      .sort({ nextCheckAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    const claimed = [];
    for (const m of due) {
      const { modifiedCount } = await Monitor.updateOne(
        { _id: m._id, nextCheckAt: m.nextCheckAt },
        { $set: { nextCheckAt: new Date(now + m.intervalSec * 1000) } },
      );
      if (modifiedCount === 1) claimed.push(m);
    }

    await runPool(claimed, CONCURRENCY, async (m) => recordResult(m, await runCheck(m)));
    return claimed.length;
  } finally {
    ticking = false;
  }
}

async function runPool(items, limit, worker) {
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        await worker(item);
      } catch (err) {
        console.error(`[scheduler] check failed for monitor ${item._id}:`, err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
