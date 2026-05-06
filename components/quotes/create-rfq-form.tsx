'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardT } from '@/lib/i18n-client';
import { useCountries } from '@/hooks/use-countries';

interface CreateRfqFormProps {
  quoteId: number;
  locale: string;
  destinationRegion?: string | null;
}

export default function CreateRfqForm({ quoteId, locale, destinationRegion }: CreateRfqFormProps) {
  const _t = useDashboardT();
  const router = useRouter();
  const { countries, loading: countriesLoading } = useCountries(locale);
  const [showForm, setShowForm] = useState(false);
  const [targetCountry, setTargetCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect country from destination region when form opens
  const detectCountry = (region: string | null | undefined): string => {
    if (!region) return '';
    const r = region.toLowerCase();
    for (const c of countries) {
      const names = [c.name_en.toLowerCase(), c.name_tr.toLowerCase(), c.code.toLowerCase()];
      if (names.some((n) => r.includes(n))) return c.code;
    }
    return '';
  };

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
        onClick={() => {
          const detected = detectCountry(destinationRegion);
          if (detected) setTargetCountry(detected);
          setShowForm(true);
        }}
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
              {countriesLoading ? (
                <option value="" disabled>Loading...</option>
              ) : (
                countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {locale === 'tr' ? c.name_tr : c.name_en} ({c.code})
                  </option>
                ))
              )}
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
