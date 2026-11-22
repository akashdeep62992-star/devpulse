import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { percent, uptimeColor } from '../format.js';

export default function StatusPage() {
  const { slug } = useParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ['status', slug],
    queryFn: () => api(`/status/${slug}`),
    refetchInterval: 30000,
  });

  if (isLoading) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  if (error) return <p className="p-10 text-center text-slate-400">{error.status === 404 ? 'Status page not found.' : error.message}</p>;

  const noMonitors = data.monitors.length === 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">{data.name}</h1>
        <p className="text-sm text-slate-400">Service status</p>
      </div>

      <div className={`rounded-xl px-5 py-4 text-center font-medium ${noMonitors ? 'bg-slate-800 text-slate-300' : data.allOperational ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
        {noMonitors ? 'No public services yet' : data.allOperational ? 'All systems operational' : 'Some systems are experiencing problems'}
      </div>

      <div className="card divide-y divide-slate-800">
        {data.monitors.map((m) => (
          <div key={m.id} className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{m.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">{percent(m.uptime30d)}</span>
                <StatusBadge status={m.status} />
              </div>
            </div>
            <div className="flex h-8 gap-[2px]">
              {m.days.map((d) => (
                <div key={d.date} className={`flex-1 rounded-sm ${uptimeColor(d.uptime)}`} title={`${d.date}: ${d.uptime == null ? 'no data' : percent(d.uptime)}`} />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-slate-500"><span>30 days ago</span><span>Today</span></div>
          </div>
        ))}
      </div>

      {data.incidents.length > 0 && (
        <div className="card">
          <h2 className="border-b border-slate-800 px-5 py-3 font-medium">Recent incidents</h2>
          <ul className="divide-y divide-slate-800">
            {data.incidents.map((i) => (
              <li key={i.id} className="px-5 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{i.monitorName}</span>
                  <span className={i.resolvedAt ? 'text-emerald-400' : 'text-red-400'}>{i.resolvedAt ? 'Resolved' : 'Ongoing'}</span>
                </div>
                <div className="text-slate-500">{new Date(i.startedAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-center text-xs text-slate-600">Powered by DevPulse</p>
    </div>
  );
}
