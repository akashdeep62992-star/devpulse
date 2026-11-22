import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage } from '../api.js';
import MonitorForm from '../components/MonitorForm.jsx';
import StatusBadge, { monitorStatus } from '../components/StatusBadge.jsx';
import { duration, intervalLabel, ms, percent, timeAgo, uptimeColor } from '../format.js';

const RANGES = ['24h', '7d', '30d'];

function Metric({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [range, setRange] = useState('24h');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const opts = { refetchInterval: 15000 };
  const monitorQ = useQuery({ queryKey: ['monitor', id], queryFn: () => api(`/monitors/${id}`), ...opts });
  const statsQ = useQuery({ queryKey: ['monitor', id, 'stats', range], queryFn: () => api(`/monitors/${id}/stats?range=${range}`), ...opts });
  const incidentsQ = useQuery({ queryKey: ['monitor', id, 'incidents'], queryFn: () => api(`/monitors/${id}/incidents`), ...opts });
  const checksQ = useQuery({ queryKey: ['monitor', id, 'checks'], queryFn: () => api(`/monitors/${id}/checks?limit=20`), ...opts });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['monitor', id] });

  async function action(fn, successMsg) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fn();
      if (successMsg) setFlash({ ok: true, text: typeof successMsg === 'function' ? successMsg(res) : successMsg });
      await refresh();
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    } catch (err) {
      setFlash({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (monitorQ.error) {
    return (
      <div className="space-y-3">
        <p className="text-red-400">{monitorQ.error.message}</p>
        <Link to="/" className="text-emerald-400">← Back to monitors</Link>
      </div>
    );
  }
  const m = monitorQ.data?.monitor;
  if (!m) return <p className="text-slate-500">Loading…</p>;

  const stats = statsQ.data;
  const chartData = (stats?.series ?? []).map((p) => ({
    ...p,
    label: new Date(p.time).toLocaleString([], range === '24h' ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit' }),
  }));

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← All monitors</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold">{m.name}</h1>
            <StatusBadge status={monitorStatus(m)} />
          </div>
          <a href={m.url} target="_blank" rel="noreferrer" className="break-all text-sm text-slate-400 hover:underline">{m.method} {m.url}</a>
          <p className="mt-1 text-xs text-slate-500">
            Checked every {intervalLabel(m.intervalSec)} · last check {timeAgo(m.lastCheckedAt)}
            {m.lastError && <span className="text-red-400"> · {m.lastError}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => action(
            () => api(`/monitors/${id}/check`, { method: 'POST' }),
            (r) => (r.result.ok ? `Up: ${r.result.statusCode} in ${r.result.responseTime} ms` : `Failed: ${r.result.error}`),
          )}>Check now</button>
          <button className="btn-ghost" disabled={busy} onClick={() => action(() => api(`/monitors/${id}`, { method: 'PATCH', body: { isActive: !m.isActive } }))}>
            {m.isActive ? 'Pause' : 'Resume'}
          </button>
          <button className="btn-ghost" onClick={() => setEditing((e) => !e)}>Edit</button>
          <button className="btn-danger" disabled={busy} onClick={async () => {
            if (!window.confirm(`Delete "${m.name}" and all its history?`)) return;
            await api(`/monitors/${id}`, { method: 'DELETE' });
            queryClient.invalidateQueries({ queryKey: ['monitors'] });
            navigate('/');
          }}>Delete</button>
        </div>
      </div>

      {flash && <p className={`rounded-lg px-3 py-2 text-sm ${flash.ok ? 'bg-emerald-950/60 text-emerald-300' : 'bg-red-950/60 text-red-300'}`}>{flash.text}</p>}

      {editing && (
        <div className="card p-5">
          <h2 className="mb-4 font-medium">Edit monitor</h2>
          <MonitorForm
            initial={m}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await api(`/monitors/${id}`, { method: 'PATCH', body });
              await refresh();
              setEditing(false);
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-medium">Performance</h2>
        <div className="flex rounded-lg border border-slate-800 p-0.5">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1 text-sm ${r === range ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Uptime" value={percent(stats?.summary.uptime)} />
        <Metric label="Avg response" value={ms(stats?.summary.avgResponse)} />
        <Metric label="p95 response" value={ms(stats?.summary.p95Response)} />
        <Metric label="Checks" value={stats?.summary.totalChecks ?? '–'} />
      </div>

      <div className="card p-4">
        {chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No checks in this range yet. The first check runs within a few seconds.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} minTickGap={30} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" ms" width={60} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => (name === 'avgResponse' ? [`${v} ms`, 'Avg response'] : [v, name])}
                />
                <Area type="monotone" dataKey="avgResponse" stroke="#34d399" strokeWidth={2} fill="url(#rt)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex h-6 gap-px" title="Uptime per time bucket">
              {chartData.map((p) => (
                <div key={p.time} className={`flex-1 rounded-sm ${uptimeColor(p.uptime)}`} title={`${p.label}: ${percent(p.uptime)}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="border-b border-slate-800 px-5 py-3 font-medium">Incidents</h2>
          {incidentsQ.data?.incidents.length ? (
            <ul className="divide-y divide-slate-800">
              {incidentsQ.data.incidents.map((i) => (
                <li key={i.id} className="px-5 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className={i.resolvedAt ? 'text-slate-300' : 'font-medium text-red-400'}>{i.resolvedAt ? 'Resolved' : 'Ongoing'}</span>
                    <span className="text-slate-500">{new Date(i.startedAt).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-400">{i.cause} · lasted {duration(i.durationSec)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No incidents. 🎉</p>
          )}
        </div>

        <div className="card">
          <h2 className="border-b border-slate-800 px-5 py-3 font-medium">Recent checks</h2>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {(checksQ.data?.checks ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-2"><span className={`inline-block h-2 w-2 rounded-full ${c.ok ? 'bg-emerald-500' : 'bg-red-500'}`} /></td>
                    <td className="py-2 text-slate-400">{new Date(c.checkedAt).toLocaleTimeString()}</td>
                    <td className="py-2">{c.statusCode ?? '–'}</td>
                    <td className="py-2">{c.responseTime} ms</td>
                    <td className="max-w-40 truncate py-2 pr-5 text-red-300" title={c.errorMessage ?? ''}>{c.errorMessage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
