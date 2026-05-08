"use client";

import { useState } from 'react';
import { useDashboardT } from '@/lib/i18n-client';

interface SettingsFormProps {
  initialData?: {
    master_logic_toggle: 'auto_send' | 'low_confidence_only' | 'manual_approval';
    default_currency: string;
    oversize_weight_threshold_tons: number;
    waiting_period?: string;
    global_markup_percent?: number;
    vendor_msg_email?: string | null;
    vendor_msg_telegram?: string | null;
  };
  onSuccess?: () => void;
}

function parseWaitingPeriod(value: string | undefined): { num: number; unit: 'm' | 'h' | 'd' } {
  if (!value) return { num: 30, unit: 'm' };
  const match = value.match(/^(\d+)([mhd])$/);
  if (match) {
    return { num: parseInt(match[1], 10), unit: match[2] as 'm' | 'h' | 'd' };
  }
  return { num: 30, unit: 'm' };
}

export default function SettingsForm({ initialData, onSuccess }: SettingsFormProps) {
  const _t = useDashboardT();
  const parsed = parseWaitingPeriod(initialData?.waiting_period);
  const [form, setForm] = useState({
    master_logic_toggle: initialData?.master_logic_toggle ?? 'manual_approval',
    default_currency: initialData?.default_currency ?? 'TRY',
    oversize_weight_threshold_tons: typeof initialData?.oversize_weight_threshold_tons === 'string'
      ? parseFloat(initialData.oversize_weight_threshold_tons) || 22
      : (initialData?.oversize_weight_threshold_tons ?? 22.00),
    waiting_period_num: parsed.num,
    waiting_period_unit: parsed.unit,
    global_markup_percent: typeof initialData?.global_markup_percent === 'string'
      ? parseFloat(initialData.global_markup_percent) || 0
      : (initialData?.global_markup_percent ?? 0),
    vendor_msg_email: initialData?.vendor_msg_email ?? '',
    vendor_msg_telegram: initialData?.vendor_msg_telegram ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      master_logic_toggle: form.master_logic_toggle,
      default_currency: form.default_currency,
      oversize_weight_threshold_tons: typeof form.oversize_weight_threshold_tons === 'string'
        ? parseFloat(form.oversize_weight_threshold_tons) || 22
        : form.oversize_weight_threshold_tons,
      waiting_period: `${form.waiting_period_num}${form.waiting_period_unit}`,
      global_markup_percent: typeof form.global_markup_percent === 'string'
        ? parseFloat(form.global_markup_percent) || 0
        : form.global_markup_percent,
      vendor_msg_email: form.vendor_msg_email.trim() || null,
      vendor_msg_telegram: form.vendor_msg_telegram.trim() || null,
    };

    try {
      const res = await fetch('/api/v1/master-data?resource=settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>}

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('settings_title')}</label>
        <select value={form.master_logic_toggle} onChange={(e) => setForm({ ...form, master_logic_toggle: e.target.value as 'auto_send' | 'low_confidence_only' | 'manual_approval' })}>
          <option value="auto_send">{_t('settings_mode_auto_send')}</option>
          <option value="low_confidence_only">{_t('settings_mode_low_confidence')}</option>
          <option value="manual_approval">{_t('settings_mode_manual')}</option>
        </select>
        <p className="mt-1 text-[10px] text-[var(--muted)]">{_t('settings_mode_description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_default_currency')}</label>
          <input type="text" maxLength={3} value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_oversize_threshold')}</label>
          <input type="number" step="0.01" min="0" value={form.oversize_weight_threshold_tons} onChange={(e) => setForm({ ...form, oversize_weight_threshold_tons: parseFloat(e.target.value) || 22 })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_waiting_period')}</label>
          <input
            type="number"
            min={1}
            value={form.waiting_period_num}
            onChange={(e) => setForm({ ...form, waiting_period_num: parseInt(e.target.value, 10) || 1 })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_waiting_period_unit')}</label>
          <select
            value={form.waiting_period_unit}
            onChange={(e) => setForm({ ...form, waiting_period_unit: e.target.value as 'm' | 'h' | 'd' })}
          >
            <option value="m">m ({_t('unit_minutes')})</option>
            <option value="h">h ({_t('unit_hours')})</option>
            <option value="d">d ({_t('unit_days')})</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Global Markup (%)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          max="1000"
          value={form.global_markup_percent}
          onChange={(e) => setForm({ ...form, global_markup_percent: parseFloat(e.target.value) || 0 })}
        />
        <p className="mt-1 text-[10px] text-[var(--muted)]">Applied to lowest vendor bid when auto-closing RFQs</p>
      </div>

      <div className="pt-2 border-t border-[var(--border)]">
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Vendor Message Templates</label>
        <p className="mb-3 text-[10px] text-[var(--muted)]">
          Leave blank to use OpenAI-generated messages. Available variables: {'{{vendor_name}}'}, {'{{rfq_reference}}'}, {'{{origin_region}}'}, {'{{destination_region}}'}, {'{{weight_kg}}'}, {'{{cargo_type}}'}, {'{{target_country}}'}
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Email Template</label>
            <textarea
              rows={4}
              value={form.vendor_msg_email}
              onChange={(e) => setForm({ ...form, vendor_msg_email: e.target.value })}
              placeholder="Hi {{vendor_name}}, we have a shipment from {{origin_region}} to {{destination_region}} ({{weight_kg}}kg). Please quote RFQ {{rfq_reference}}."
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Telegram Template</label>
            <textarea
              rows={4}
              value={form.vendor_msg_telegram}
              onChange={(e) => setForm({ ...form, vendor_msg_telegram: e.target.value })}
              placeholder="Quote request {{rfq_reference}}: {{origin_region}} → {{destination_region}}, {{weight_kg}}kg. Reply with price in TRY."
              className="w-full"
            />
          </div>
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary text-xs">
        {loading ? _t('loading') : _t('save')}
      </button>
    </form>
  );
}
