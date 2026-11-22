/** A monitor is only marked DOWN after this many failures in a row (avoids alert spam from blips). */
export const FAILURE_THRESHOLD = 2;

/**
 * Pure state machine: given the monitor's current state and a check result,
 * returns the next state and whether an alert event happened.
 */
export function evaluate(monitor, result) {
  if (result.ok) {
    return {
      status: 'up',
      consecutiveFailures: 0,
      event: monitor.status === 'down' ? 'recovered' : null,
    };
  }
  const consecutiveFailures = (monitor.consecutiveFailures || 0) + 1;
  const goesDown = consecutiveFailures >= FAILURE_THRESHOLD && monitor.status !== 'down';
  return {
    status: goesDown ? 'down' : monitor.status,
    consecutiveFailures,
    event: goesDown ? 'down' : null,
  };
}
