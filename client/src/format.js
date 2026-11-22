export function timeAgo(date) {
  if (!date) return 'never';
  const sec = Math.round((Date.now() - new Date(date)) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function duration(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  return h < 24 ? `${h}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export const ms = (v) => (v == null ? '–' : `${v} ms`);
export const percent = (v) => (v == null ? '–' : `${v.toFixed(2)}%`);

export function intervalLabel(sec) {
  return sec < 60 ? `${sec}s` : sec < 3600 ? `${sec / 60} min` : `${sec / 3600} h`;
}

export function uptimeColor(v) {
  if (v == null) return 'bg-slate-800';
  if (v >= 99) return 'bg-emerald-500';
  if (v >= 95) return 'bg-amber-400';
  return 'bg-red-500';
}
