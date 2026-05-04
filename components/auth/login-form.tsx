'use client';

import { useState } from 'react';
import { useDashboardT } from '@/lib/i18n-client';

export default function LoginForm() {
  const _t = useDashboardT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || _t('login_failed'));
        return;
      }

      window.location.href = '/';
    } catch {
      setError(_t('network_error_retry'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          {_t('username')}
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          {_t('password')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      {error && (
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? _t('loading') : _t('sign_in')}
      </button>
    </form>
  );
}
