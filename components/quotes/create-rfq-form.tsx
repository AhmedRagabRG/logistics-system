'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardT } from '@/lib/i18n-client';

interface CreateRfqFormProps {
  quoteId: number;
  locale: string;
  destinationRegion?: string | null;
}

export default function CreateRfqForm({ quoteId, locale, destinationRegion }: CreateRfqFormProps) {
  const _t = useDashboardT();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [targetCountry, setTargetCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect country from destination region when form opens
  const detectCountry = (region: string | null | undefined): string => {
    if (!region) return '';
    const r = region.toLowerCase();
    if (r.includes('turkey') || r.includes('türkiye') || r.includes('ankara') || r.includes('istanbul') || r.includes('izmir') || r.includes('mersin') || r.includes('bursa') || r.includes('antalya')) return 'TR';
    if (r.includes('germany') || r.includes('almanya') || r.includes('berlin') || r.includes('munich') || r.includes('münih') || r.includes('hamburg') || r.includes('frankfurt') || r.includes('köln') || r.includes('cologne') || r.includes('stuttgart') || r.includes('düsseldorf')) return 'DE';
    if (r.includes('egypt') || r.includes('mısır') || r.includes('cairo') || r.includes('alexandria') || r.includes('luxor')) return 'EG';
    if (r.includes('france') || r.includes('fransa') || r.includes('paris') || r.includes('lyon') || r.includes('marseille')) return 'FR';
    if (r.includes('italy') || r.includes('italya') || r.includes('rome') || r.includes('milano') || r.includes('milan') || r.includes('napoli') || r.includes('naples')) return 'IT';
    if (r.includes('spain') || r.includes('ispanya') || r.includes('madrid') || r.includes('barcelona')) return 'ES';
    if (r.includes('netherlands') || r.includes('hollanda') || r.includes('amsterdam') || r.includes('rotterdam')) return 'NL';
    if (r.includes('belgium') || r.includes('belçika') || r.includes('brussels') || r.includes('bruxelles')) return 'BE';
    if (r.includes('austria') || r.includes('avusturya') || r.includes('vienna') || r.includes('wien')) return 'AT';
    if (r.includes('poland') || r.includes('polonya') || r.includes('warsaw') || r.includes('warszawa') || r.includes('krakow')) return 'PL';
    if (r.includes('czech') || r.includes('çekya') || r.includes('prague') || r.includes('praha')) return 'CZ';
    if (r.includes('hungary') || r.includes('macaristan') || r.includes('budapest')) return 'HU';
    if (r.includes('romania') || r.includes('romanya') || r.includes('bucharest') || r.includes('bucuresti')) return 'RO';
    if (r.includes('bulgaria') || r.includes('bulgaristan') || r.includes('sofia')) return 'BG';
    if (r.includes('greece') || r.includes('yunanistan') || r.includes('athens') || r.includes('athina')) return 'GR';
    if (r.includes('serbia') || r.includes('sırbistan') || r.includes('belgrade') || r.includes('beograd')) return 'RS';
    if (r.includes('croatia') || r.includes('hirvatistan') || r.includes('zagreb')) return 'HR';
    if (r.includes('slovenia') || r.includes('slovenya') || r.includes('ljubljana')) return 'SI';
    if (r.includes('slovakia') || r.includes('slovakya') || r.includes('bratislava')) return 'SK';
    if (r.includes('bosnia') || r.includes('bosna') || r.includes('sarajevo')) return 'BA';
    if (r.includes('switzerland') || r.includes('isviçre') || r.includes('zurich') || r.includes('zürich') || r.includes('geneva') || r.includes('genève')) return 'CH';
    if (r.includes('uk') || r.includes('united kingdom') || r.includes('birleşik krallık') || r.includes('england') || r.includes('london') || r.includes('manchester')) return 'GB';
    if (r.includes('russia') || r.includes('rusya') || r.includes('moscow') || r.includes('moskova') || r.includes('russian federation')) return 'RU';
    if (r.includes('ukraine') || r.includes('ukrayna') || r.includes('kyiv') || r.includes('kiev')) return 'UA';
    return '';
  };

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
