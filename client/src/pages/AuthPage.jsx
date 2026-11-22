import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errorMessage } from '../api.js';
import { Logo } from '../components/Layout.jsx';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="text-2xl"><Logo /></div>
          <p className="text-sm text-slate-400">Know when your sites and APIs go down, before your users do.</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold">{isLogin ? 'Log in' : 'Create your account'}</h1>
          {!isLogin && (
            <div>
              <label className="label">Name</label>
              <input className="input" required value={form.name} onChange={set('name')} autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={isLogin ? 1 : 8}
              value={form.password}
              onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>
          {error && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
          </button>
          <p className="text-center text-sm text-slate-400">
            {isLogin ? 'No account? ' : 'Already have an account? '}
            <Link className="text-emerald-400 hover:underline" to={isLogin ? '/register' : '/login'}>
              {isLogin ? 'Sign up' : 'Log in'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
