import { config } from '../config.js';
import { assertPublicUrl } from './urlGuard.js';

/**
 * Performs one HTTP check. Never throws - always returns a result object:
 * { ok, statusCode, responseTime, error }
 */
export async function runCheck(monitor, { allowPrivate = config.allowPrivateTargets } = {}) {
  if (!allowPrivate) {
    try {
      await assertPublicUrl(monitor.url);
    } catch (err) {
      return { ok: false, statusCode: null, responseTime: 0, error: err.message };
    }
  }

  const timeoutMs = monitor.timeoutMs || 10000;
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  try {
    const res = await fetch(monitor.url, {
      method: monitor.method || 'GET',
      // Redirects are not followed: a redirect to an internal IP would bypass the SSRF guard.
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'DevPulse-Monitor/1.0' },
    });
    const responseTime = elapsed();
    await res.body?.cancel(); // only the status matters; free the socket
    const ok = monitor.expectedStatus
      ? res.status === monitor.expectedStatus
      : res.status >= 200 && res.status < 400;
    return {
      ok,
      statusCode: res.status,
      responseTime,
      error: ok ? null : `Unexpected status code ${res.status}`,
    };
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    return {
      ok: false,
      statusCode: null,
      responseTime: elapsed(),
      error: timedOut
        ? `Timed out after ${timeoutMs}ms`
        : err.cause?.code || err.cause?.message || err.message,
    };
  }
}
