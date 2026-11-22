const STYLES = {
  up: ['bg-emerald-500', 'text-emerald-300', 'Up'],
  down: ['bg-red-500', 'text-red-300', 'Down'],
  pending: ['bg-slate-400', 'text-slate-300', 'Pending'],
  paused: ['bg-amber-400', 'text-amber-300', 'Paused'],
};

export function monitorStatus(m) {
  return m.isActive === false ? 'paused' : m.status;
}

export default function StatusBadge({ status }) {
  const [dot, text, label] = STYLES[status] ?? STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${text}`}>
      <span className="relative flex h-2.5 w-2.5">
        {status === 'up' && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-60`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}
