'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardT } from '@/lib/i18n-client';

interface CreateRfqFormProps {
  quoteId: number;
  locale: string;
}

export default function CreateRfqForm({ quoteId, locale }: CreateRfqFormProps) {
  const _t = useDashboardT();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [targetCountry, setTargetCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common countries with vendor coverage — can be expanded or fetched dynamically
  const countryOptions = [
    { code: 'TR', name: locale === 'tr' ? 'Türkiye' : 'Turkey' },
    { code: 'DE', name: locale === 'tr' ? 'Almanya' : 'Germany' },
    { code: 'RU', name: locale === 'tr' ? 'Rusya' : 'Russia' },
    { code: 'PL', name: locale === 'tr' ? 'Polonya' : 'Poland' },
    { code: 'EG', name: locale === 'tr' ? 'Mısır' : 'Egypt' },
    { code: 'UA', name: locale === 'tr' ? 'Ukrayna' : 'Ukraine' },
    { code: 'FR', name: locale === 'tr' ? 'Fransa' : 'France' },
    { code: 'IT', name: locale === 'tr' ? 'İtalya' : 'Italy' },
    { code: 'ES', name: locale === 'tr' ? 'İspanya' : 'Spain' },
    { code: 'NL', name: locale === 'tr' ? 'Hollanda' : 'Netherlands' },
    { code: 'BE', name: locale === 'tr' ? 'Belçika' : 'Belgium' },
    { code: 'AT', name: locale === 'tr' ? 'Avusturya' : 'Austria' },
    { code: 'RO', name: locale === 'tr' ? 'Romanya' : 'Romania' },
    { code: 'BG', name: locale === 'tr' ? 'Bulgaristan' : 'Bulgaria' },
    { code: 'GR', name: locale === 'tr' ? 'Yunanistan' : 'Greece' },
    { code: 'RS', name: locale === 'tr' ? 'Sırbistan' : 'Serbia' },
    { code: 'HU', name: locale === 'tr' ? 'Macaristan' : 'Hungary' },
    { code: 'CZ', name: locale === 'tr' ? 'Çekya' : 'Czech Republic' },
    { code: 'SK', name: locale === 'tr' ? 'Slovakya' : 'Slovakia' },
    { code: 'HR', name: locale === 'tr' ? 'Hırvatistan' : 'Croatia' },
    { code: 'SI', name: locale === 'tr' ? 'Slovenya' : 'Slovenia' },
    { code: 'BA', name: locale === 'tr' ? 'Bosna' : 'Bosnia' },
    { code: 'CH', name: locale === 'tr' ? 'İsviçre' : 'Switzerland' },
    { code: 'GB', name: locale === 'tr' ? 'Birleşik Krallık' : 'United Kingdom' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetCountry.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/create-rfq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_country: targetCountry.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to create RFQ');
        return;
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="btn btn-primary text-xs"
      >
        {locale === 'tr' ? 'RFQ Oluştur' : 'Create RFQ'}
      </button>
    );
  }

  return (
    <div className="panel border border-[var(--accent)]">
      <div className="panel-body space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
          {locale === 'tr' ? 'RFQ Oluştur' : 'Create RFQ'}
        </div>
        <p className="text-[10px] text-[var(--muted)]">
          {locale === 'tr'
            ? 'Bu teklif için bir hedef ülke seçin ve tedarikçilere RFQ gönderin.'
            : 'Select a target country for this quote and send an RFQ to vendors.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">
              {locale === 'tr' ? 'Hedef Ülke' : 'Target Country'}
            </label>
            <select
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              className="w-full text-xs"
              required
            >
              <option value="">{locale === 'tr' ? 'Ülke seçin...' : 'Select country...'}</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-[10px] font-semibold text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !targetCountry}
              className="btn btn-primary text-xs disabled:opacity-50"
            >
              {loading
                ? (locale === 'tr' ? 'Gönderiliyor...' : 'Sending...')
                : (locale === 'tr' ? 'RFQ Gönder' : 'Send RFQ')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary text-xs"
            >
              {locale === 'tr' ? 'İptal' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
