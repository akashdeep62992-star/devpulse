import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l3-8 4 16 3-8h6" />
      </svg>
      DevPulse
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3 text-sm">
            <a href={`/status/${user.statusSlug}`} target="_blank" rel="noreferrer" className="hidden text-slate-400 hover:text-slate-200 sm:inline">
              Public status page ↗
            </a>
            <span className="hidden text-slate-500 md:inline">{user.email}</span>
            <button onClick={logout} className="btn-ghost py-1.5">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
