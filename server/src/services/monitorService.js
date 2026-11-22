import { Monitor } from '../models/Monitor.js';
import { Check } from '../models/Check.js';
import { Incident } from '../models/Incident.js';
import { User } from '../models/User.js';
import { evaluate } from './monitorState.js';
import { sendAlert } from './alerts.js';

/** Saves a check result, updates monitor state, opens/closes incidents and sends alerts. */
export async function recordResult(monitor, result) {
  const checkedAt = new Date();
  await Check.create({
    monitor: monitor._id,
    ok: result.ok,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    errorMessage: result.error,
    checkedAt,
  });

  const next = evaluate(monitor, result);
  await Monitor.updateOne(
    { _id: monitor._id },
    {
      $set: {
        status: next.status,
        consecutiveFailures: next.consecutiveFailures,
        lastCheckedAt: checkedAt,
        lastResponseTime: result.responseTime,
        lastError: result.error,
      },
    },
  );

  if (next.event === 'down') {
    await Incident.create({ monitor: monitor._id, startedAt: checkedAt, cause: result.error });
    await notifyOwner(
      monitor,
      `[DOWN] ${monitor.name}`,
      `${monitor.name} (${monitor.url}) is DOWN.\nReason: ${result.error}\nTime: ${checkedAt.toISOString()}`,
    );
  } else if (next.event === 'recovered') {
    const incident = await Incident.findOneAndUpdate(
      { monitor: monitor._id, resolvedAt: null },
      { $set: { resolvedAt: checkedAt } },
      { new: true },
    );
    const mins = incident ? Math.round((checkedAt - incident.startedAt) / 60000) : null;
    await notifyOwner(
      monitor,
      `[RECOVERED] ${monitor.name}`,
      `${monitor.name} (${monitor.url}) is back UP${mins != null ? ` after ${mins} min` : ''}.\nResponse time: ${result.responseTime}ms`,
    );
  }

  return { ...next, checkedAt };
}

async function notifyOwner(monitor, subject, text) {
  const owner = await User.findById(monitor.owner).select('email').lean();
  if (owner) await sendAlert({ to: owner.email, subject, text });
}

/** Deletes a monitor together with its checks and incidents. */
export async function deleteMonitorCascade(monitorId) {
  await Promise.all([
    Monitor.deleteOne({ _id: monitorId }),
    Check.deleteMany({ monitor: monitorId }),
    Incident.deleteMany({ monitor: monitorId }),
  ]);
}
