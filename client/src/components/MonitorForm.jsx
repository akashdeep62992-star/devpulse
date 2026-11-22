import { useState } from 'react';
import { errorMessage } from '../api.js';

const INTERVALS = [30, 60, 300, 600, 1800, 3600];
const EMPTY = { name: '', url: 'https://', method: 'GET', intervalSec: 60, timeoutMs: 10000, expectedStatus: '', isPublic: false };

export default function MonitorForm({ initial, onSubmit, onCancel, submitLabel = 'Create monitor' }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, expectedStatus: initial?.expectedStatus ?? '' }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name,
        url: form.url,
        method: form.method,
        intervalSec: Number(form.intervalSec),
        timeoutMs: Number(form.timeoutMs),
        expectedStatus: form.expectedStatus === '' ? null : Number(form.expectedStatus),
        isPublic: form.isPublic,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label">Name</label>
        <input className="input" required maxLength={80} value={form.name} onChange={set('name')} placeholder="My API" />
      </div>
      <div>
        <label className="label">URL</label>
        <input className="input" required type="url" value={form.url} onChange={set('url')} placeholder="https://api.example.com/health" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Method</label>
          <select className="input" value={form.method} onChange={set('method')}>
            <option>GET</option>
            <option>HEAD</option>
          </select>
        </div>
        <div>
          <label className="label">Check every</label>
          <select className="input" value={form.intervalSec} onChange={set('intervalSec')}>
            {INTERVALS.map((s) => (
              <option key={s} value={s}>{s < 60 ? `${s} sec` : s < 3600 ? `${s / 60} min` : '1 hour'}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Timeout (ms)</label>
          <input className="input" type="number" min={1000} max={30000} step={500} value={form.timeoutMs} onChange={set('timeoutMs')} />
        </div>
        <div>
          <label className="label">Expected status</label>
          <input className="input" type="number" min={100} max={599} value={form.expectedStatus} onChange={set('expectedStatus')} placeholder="Any 2xx/3xx" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
        <input type="checkbox" checked={form.isPublic} onChange={set('isPublic')} className="accent-emerald-500" />
        Show on my public status page (URL stays hidden)
      </label>
      {error && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300 sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
