"use client";

import { useState } from 'react';
import { useDashboardT } from '@/lib/i18n-client';
import { useCountries } from '@/hooks/use-countries';
import { useDashboardLocaleContext } from '@/lib/i18n-client';

interface VendorFormProps {
  initialData?: {
    id?: number;
    name: string;
    country_coverage: string | null;
    city: string | null;
    authorized_person_name: string | null;
    expertise_notes: string | null;
    priority_ranking: number;
    use_custom_margin: boolean;
    margin_rate: number;
    contact_email: string | null;
    contact_phone: string | null;
    telegram_chat_id: string | null;
    preferred_channels: string[] | null;
    is_active: boolean;
  };
  onSuccess?: () => void;
}

export default function VendorForm({ initialData, onSuccess }: VendorFormProps) {
  const _t = useDashboardT();
  const locale = useDashboardLocaleContext();
  const { countries, loading: countriesLoading } = useCountries(locale);

  // Normalize stored country_coverage to a value that matches one of the <option> values.
  const matchedCountry = countries.find(
    (c) =>
      c.name_en.toLowerCase() === (initialData?.country_coverage ?? '').toLowerCase() ||
      c.name_tr.toLowerCase() === (initialData?.country_coverage ?? '').toLowerCase() ||
      c.code.toLowerCase() === (initialData?.country_coverage ?? '').toLowerCase()
  );
  const normalizedCountryCoverage = matchedCountry
    ? (locale === 'tr' ? matchedCountry.name_tr : matchedCountry.name_en)
    : (initialData?.country_coverage ?? '');

  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    country_coverage: normalizedCountryCoverage,
    city: initialData?.city ?? '',
    authorized_person_name: initialData?.authorized_person_name ?? '',
    expertise_notes: initialData?.expertise_notes ?? '',
    priority_ranking: initialData?.priority_ranking ?? 100,
    use_custom_margin: initialData?.use_custom_margin ?? false,
    margin_rate: initialData?.margin_rate ?? 0,
    contact_email: initialData?.contact_email ?? '',
    contact_phone: initialData?.contact_phone ?? '',
    telegram_chat_id: initialData?.telegram_chat_id ?? '',
    preferred_channels:
      Array.isArray(initialData?.preferred_channels)
        ? initialData.preferred_channels
        : typeof initialData?.preferred_channels === 'string'
          ? JSON.parse(initialData.preferred_channels)
          : [],
    is_active: initialData?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = initialData?.id
      ? `/api/v1/master-data?resource=vendors&id=${initialData.id}`
      : '/api/v1/master-data?resource=vendors';
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

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_name')} *</label>
        <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_origin')} *</label>
          <select required value={form.country_coverage} onChange={(e) => setForm({ ...form, country_coverage: e.target.value })}>
            <option value="">{_t('vendor_select_country')}</option>
            {countriesLoading ? (
              <option value="" disabled>Loading...</option>
            ) : (
              countries.map((c) => (
                <option key={c.code} value={locale === 'tr' ? c.name_tr : c.name_en}>
                  {locale === 'tr' ? c.name_tr : c.name_en}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_city')}</label>
          <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={_t('vendor_city_placeholder')} />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_authorized_person')}</label>
        <input type="text" value={form.authorized_person_name} onChange={(e) => setForm({ ...form, authorized_person_name: e.target.value })} placeholder={_t('vendor_authorized_person_placeholder')} />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_notes')}</label>
        <textarea rows={3} value={form.expertise_notes} onChange={(e) => setForm({ ...form, expertise_notes: e.target.value })} placeholder={_t('vendor_notes_placeholder')} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_priority')}</label>
          <input type="number" min={1} value={form.priority_ranking} onChange={(e) => setForm({ ...form, priority_ranking: parseInt(e.target.value, 10) || 100 })} />
          <p className="mt-1 text-[10px] text-[var(--muted)]">{_t('vendor_priority_hint')}</p>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input type="checkbox" checked={form.use_custom_margin} onChange={(e) => setForm({ ...form, use_custom_margin: e.target.checked })} className="h-3.5 w-3.5 border-[var(--border-strong)]" />
            {'Use vendor-specific margin'}
          </label>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-3.5 w-3.5 border-[var(--border-strong)]" />
            {_t('vendor_active')}
          </label>
        </div>
      </div>

      {form.use_custom_margin && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_margin')}</label>
          <input type="number" min={0} max={100} step="0.01" value={form.margin_rate} onChange={(e) => setForm({ ...form, margin_rate: parseFloat(e.target.value) || 0 })} />
          <p className="mt-1 text-[10px] text-[var(--muted)]">{_t('vendor_margin_hint')}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_email')}</label>
          <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_phone')}</label>
          <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('vendor_telegram')}</label>
          <input type="text" value={form.telegram_chat_id} onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })} placeholder="@username or chat ID" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">{_t('vendor_preferred_channels')}</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={form.preferred_channels.includes('email')}
              onChange={(e) => {
                const channels = new Set(form.preferred_channels);
                if (e.target.checked) channels.add('email');
                else channels.delete('email');
                setForm({ ...form, preferred_channels: Array.from(channels) });
              }}
              className="h-3.5 w-3.5 border-[var(--border-strong)]"
            />
            {_t('channel_email')}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={form.preferred_channels.includes('whatsapp')}
              onChange={(e) => {
                const channels = new Set(form.preferred_channels);
                if (e.target.checked) channels.add('whatsapp');
                else channels.delete('whatsapp');
                setForm({ ...form, preferred_channels: Array.from(channels) });
              }}
              className="h-3.5 w-3.5 border-[var(--border-strong)]"
            />
            {_t('channel_whatsapp')}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={form.preferred_channels.includes('telegram')}
              onChange={(e) => {
                const channels = new Set(form.preferred_channels);
                if (e.target.checked) channels.add('telegram');
                else channels.delete('telegram');
                setForm({ ...form, preferred_channels: Array.from(channels) });
              }}
              className="h-3.5 w-3.5 border-[var(--border-strong)]"
            />
            {_t('channel_telegram')}
          </label>
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary text-xs">
        {loading ? _t('loading') : initialData?.id ? _t('vendor_update') : _t('vendor_save')}
      </button>
    </form>
  );
}
