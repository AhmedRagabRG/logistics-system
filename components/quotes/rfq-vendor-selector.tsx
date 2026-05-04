'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Vendor {
  vendor_id: number;
  vendor_name: string;
  response_price: number | string | null;
  response_currency: string | null;
  status: string;
}

interface RfqVendorSelectorProps {
  rfqId: number;
  vendors: Vendor[];
  selectedVendorId: number | null;
  locale: string;
}

export default function RfqVendorSelector({ rfqId, vendors, selectedVendorId, locale }: RfqVendorSelectorProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const respondedVendors = vendors.filter((v) => v.status === 'responded' && v.response_price !== null);

  async function handleSelect(vendorId: number) {
    if (loading) return;
    setLoading(vendorId);
    setError(null);

    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/generate-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_vendor_id: vendorId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to select vendor');
        return;
      }

      // Refresh the page to show updated selection and price
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(null);
    }
  }

  if (respondedVendors.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
        {locale === 'tr' ? 'Tedarikçi Seçimi' : 'Vendor Selection'}
      </div>
      <div className="space-y-px border border-[var(--border)] bg-[var(--border)]">
        {respondedVendors.map((v) => {
          const price = typeof v.response_price === 'string' ? parseFloat(v.response_price) : v.response_price!;
          const isSelected = selectedVendorId === v.vendor_id;
          const isLowest = respondedVendors.every((other) => {
            const otherPrice = typeof other.response_price === 'string' ? parseFloat(other.response_price) : other.response_price!;
            return other.vendor_id === v.vendor_id || price <= otherPrice;
          });

          return (
            <div
              key={v.vendor_id}
              className={`flex items-center justify-between px-3 py-2 ${
                isSelected ? 'bg-[var(--success)]/5 border-l-2 border-l-[var(--success)]' : 'bg-[var(--surface)]'
              }`}
            >
              <div className="min-w-0 flex items-center gap-2">
                <div className="text-xs font-bold text-[var(--foreground)]">{v.vendor_name}</div>
                {isSelected && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--success)] text-white rounded">
                    {locale === 'tr' ? 'Seçildi' : 'Selected'}
                  </span>
                )}
                {!isSelected && isLowest && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-white rounded">
                    {locale === 'tr' ? 'En Düşük' : 'Lowest'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <div className={`font-mono text-sm font-bold ${isSelected ? 'text-[var(--success)]' : 'text-[var(--foreground)]'}`}>
                  {price.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })} {v.response_currency}
                </div>
                {!isSelected && (
                  <button
                    onClick={() => handleSelect(v.vendor_id)}
                    disabled={loading !== null}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loading === v.vendor_id
                      ? (locale === 'tr' ? 'İşleniyor...' : 'Processing...')
                      : (locale === 'tr' ? 'Seç' : 'Select')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="text-[10px] font-semibold text-[var(--danger)]">
          {error}
        </div>
      )}
    </div>
  );
}
