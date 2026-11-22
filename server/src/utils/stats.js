/** Percentage rounded to 2 decimals, or null when there is no data. */
export function pct(part, total) {
  return total ? Math.round((part / total) * 10000) / 100 : null;
}

export function round(n) {
  return n == null ? null : Math.round(n);
}
