'use client';

import { useState } from 'react';
import { useDashboardT } from '@/lib/i18n-client';

export default function LogoutButton() {
  const _t = useDashboardT();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      } else {
        console.error('Logout failed');
      }
    } catch {
      console.error('Logout error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn btn-secondary w-full text-xs"
    >
      {loading ? _t('loading') : _t('logout')}
    </button>
  );
}
