"use client";

import { useState, useEffect, useCallback } from 'react';
import SettingsForm from '@/components/master-data/settings-form';
import { useDashboardT } from '@/lib/i18n-client';

interface Settings {
  master_logic_toggle: 'auto_send' | 'low_confidence_only' | 'manual_approval';
  default_currency: string;
  oversize_weight_threshold_tons: number;
  waiting_period: string;
  global_markup_percent: number;
  vendor_msg_email: string | null;
  vendor_msg_telegram: string | null;
  is_paused: boolean;
  rfq_send_mode: 'auto' | 'manual';
}

export default function SettingsPage() {
  const _t = useDashboardT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/master-data?resource=settings');
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setSettings(data.data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [_t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  function handleSuccess() {
    setSaved(true);
    fetchSettings();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('settings_title')}</h1>
      </div>

      {error && (
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>
      )}

      {saved && (
        <div className="border border-[var(--success)] bg-[var(--success)]/5 px-3 py-2 text-xs text-[var(--success)] font-mono uppercase tracking-widest">
          {_t('ok')} — Saved
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-[var(--muted)] font-mono uppercase tracking-widest">{_t('loading')}</div>
      ) : (
        <div className="panel max-w-xl">
          <div className="panel-body">
            <SettingsForm initialData={settings ?? undefined} onSuccess={handleSuccess} />
          </div>
        </div>
      )}
    </div>
  );
}
