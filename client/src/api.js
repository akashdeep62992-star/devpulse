const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'devpulse_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Small fetch wrapper: JSON in/out, bearer token, consistent errors. */
export async function api(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new ApiError(data.error || res.statusText, res.status, data.details);
  }
  return data;
}

/** Turns an ApiError into a readable message, including field validation details. */
export function errorMessage(err) {
  if (!err) return '';
  if (err.details?.length) return err.details.map((d) => `${d.path || 'field'}: ${d.message}`).join(' · ');
  return err.message;
}
