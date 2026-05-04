"use client";

import { useState } from 'react';
import { useDashboardT } from '@/lib/i18n-client';

interface PricingFormProps {
  initialData?: {
    id?: number;
    origin_region: string;
    destination_region: string;
    base_price: number;
    markup_percent: number;
    currency: string;
    is_active: boolean;
  };
  onSuccess?: () => void;
}

export default function PricingForm({ initialData, onSuccess }: PricingFormProps) {
  const _t = useDashboardT();
  const [form, setForm] = useState({
    origin_region: initialData?.origin_region ?? '',
    destination_region: initialData?.destination_region ?? '',
    base_price: initialData?.base_price ?? 0,
    markup_percent: initialData?.markup_percent ?? 0,
    currency: initialData?.currency ?? 'EUR',
    is_active: initialData?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = initialData?.id
      ? `/api/v1/master-data?resource=pricing&id=${initialData.id}`
      : '/api/v1/master-data?resource=pricing';
    const method = initialData?.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_origin_region')} *</label>
          <input type="text" required value={form.origin_region} onChange={(e) => setForm({ ...form, origin_region: e.target.value })} placeholder={_t('placeholder_origin_region')} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_destination_region')} *</label>
          <input type="text" required value={form.destination_region} onChange={(e) => setForm({ ...form, destination_region: e.target.value })} placeholder={_t('placeholder_destination_region')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_price')} *</label>
          <input type="number" step="0.01" min="0" required value={form.base_price} onChange={(e) => setForm({ ...form, base_price: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_markup')}</label>
          <input type="number" step="0.01" min="0" max="1000" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_currency')}</label>
          <input type="text" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="h-3.5 w-3.5 border-[var(--border-strong)]"
        />
        {_t('vendor_active')}
      </label>

      <button type="submit" disabled={loading} className="btn btn-primary text-xs">
        {loading ? _t('loading') : initialData?.id ? _t('vendor_update') : _t('vendor_save')}
      </button>
    </form>
  );
}
