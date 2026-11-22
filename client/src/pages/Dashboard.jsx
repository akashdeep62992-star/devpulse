import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import MonitorForm from '../components/MonitorForm.jsx';
import StatusBadge, { monitorStatus } from '../components/StatusBadge.jsx';
import { intervalLabel, ms, percent, timeAgo } from '../format.js';

function Stat({ label, value, tone = 'text-slate-100' }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['monitors'],
    queryFn: () => api('/monitors'),
    refetchInterval: 10000,
  });
  const monitors = data?.monitors ?? [];
  const count = (s) => monitors.filter((m) => monitorStatus(m) === s).length;

  async function create(body) {
    await api('/monitors', { method: 'POST', body });
    await queryClient.invalidateQueries({ queryKey: ['monitors'] });
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monitors</h1>
          <p className="text-sm text-slate-400">Live status refreshes every 10 seconds.</p>
        </div>
        {!adding && <button className="btn-primary" onClick={() => setAdding(true)}>+ Add monitor</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total" value={monitors.length} />
        <Stat label="Up" value={count('up')} tone="text-emerald-400" />
        <Stat label="Down" value={count('down')} tone={count('down') ? 'text-red-400' : 'text-slate-100'} />
        <Stat label="Paused" value={count('paused')} tone="text-amber-300" />
      </div>

      {adding && (
        <div className="card p-5">
          <h2 className="mb-4 font-medium">New monitor</h2>
          <MonitorForm onSubmit={create} onCancel={() => setAdding(false)} />
        </div>
      )}

      {error && <p className="text-red-400">Failed to load monitors: {error.message}</p>}
      {isLoading && <p className="text-slate-500">Loading…</p>}

      {!isLoading && monitors.length === 0 && !adding && (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-lg font-medium">No monitors yet</p>
          <p className="max-w-md text-sm text-slate-400">Add the URL of a website or API health endpoint and DevPulse will check it on a schedule and alert you when it goes down.</p>
          <button className="btn-primary" onClick={() => setAdding(true)}>Add your first monitor</button>
        </div>
      )}

      {monitors.length > 0 && (
        <div className="card divide-y divide-slate-800 overflow-hidden">
          {monitors.map((m) => (
            <Link key={m.id} to={`/monitors/${m.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition hover:bg-slate-800/40 md:grid-cols-[1.2fr_repeat(4,minmax(0,7rem))]">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="truncate font-medium">{m.name}</span>
                  {m.isPublic && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">public</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{m.method} {m.url} · every {intervalLabel(m.intervalSec)}</div>
              </div>
              <StatusBadge status={monitorStatus(m)} />
              <div className="hidden text-sm md:block"><div className="text-xs text-slate-500">Uptime 24h</div>{percent(m.uptime24h)}</div>
              <div className="hidden text-sm md:block"><div className="text-xs text-slate-500">Avg response</div>{ms(m.avgResponse24h)}</div>
              <div className="hidden text-sm md:block"><div className="text-xs text-slate-500">Last check</div>{timeAgo(m.lastCheckedAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
