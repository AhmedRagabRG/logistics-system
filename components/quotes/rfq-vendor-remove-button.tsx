'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type DashboardLocale } from '@/lib/i18n-dashboard';

interface RfqVendorRemoveButtonProps {
  assignmentId: number;
  vendorName: string;
  locale: DashboardLocale;
}

export default function RfqVendorRemoveButton({ assignmentId, vendorName, locale }: RfqVendorRemoveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!confirm(locale === 'tr' ? `${vendorName} tedarikçisini kaldırmak istediğinize emin misiniz?` : `Are you sure you want to remove ${vendorName}?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/rfqs/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        alert(data.error?.message ?? 'Failed to remove vendor');
      }
    } catch {
      alert(locale === 'tr' ? 'Tedarikçi kaldırılamadı' : 'Failed to remove vendor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="text-[10px] font-semibold uppercase tracking-wider text-[var(--danger)] hover:underline disabled:opacity-50"
    >
      {loading ? (locale === 'tr' ? 'Kaldırılıyor...' : 'Removing...') : (locale === 'tr' ? 'Kaldır' : 'Remove')}
    </button>
  );
}
