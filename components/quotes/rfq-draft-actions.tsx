'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type DashboardLocale, t } from '@/lib/i18n-dashboard';

interface RfqDraftActionsProps {
  rfqId: number;
  rfqReference: string;
  targetCountry: string;
  locale: DashboardLocale;
}

export default function RfqDraftActions({ rfqId, rfqReference, targetCountry, locale }: RfqDraftActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCountryForm, setShowCountryForm] = useState(false);
  const [newCountry, setNewCountry] = useState(targetCountry);

  async function handleSendMessages() {
    setLoading('send');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/send-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? 'Failed to send messages');
      } else {
        setSuccess(
          locale === 'tr'
            ? `${data.data.messages_sent} tedarikçiye mesaj gönderildi.`
            : `Messages sent to ${data.data.messages_sent} vendors.`
        );
        router.refresh();
      }
    } catch {
      setError(locale === 'tr' ? 'Mesaj gönderilemedi' : 'Failed to send messages');
    } finally {
      setLoading(null);
    }
  }

  async function handleChangeCountry(e: React.FormEvent) {
    e.preventDefault();
    setLoading('country');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/change-country`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_country: newCountry.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? 'Failed to change country');
      } else {
        setSuccess(
          locale === 'tr'
            ? `Hedef ülke ${data.data.new_country} olarak değiştirildi. ${data.data.vendor_count} tedarikçi seçildi.`
            : `Target country changed to ${data.data.new_country}. ${data.data.vendor_count} vendors selected.`
        );
        setShowCountryForm(false);
        router.refresh();
      }
    } catch {
      setError(locale === 'tr' ? 'Ülke değiştirilemedi' : 'Failed to change country');
    } finally {
      setLoading(null);
    }
  }

  async function handleRemoveVendor(assignmentId: number, vendorName: string) {
    if (!confirm(locale === 'tr' ? `${vendorName} tedarikçisini kaldırmak istediğinize emin misiniz?` : `Are you sure you want to remove ${vendorName}?`)) {
      return;
    }
    setLoading(`remove-${assignmentId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/rfqs/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? 'Failed to remove vendor');
      } else {
        setSuccess(
          locale === 'tr'
            ? `${vendorName} kaldırıldı.`
            : `${vendorName} removed.`
        );
        router.refresh();
      }
    } catch {
      setError(locale === 'tr' ? 'Tedarikçi kaldırılamadı' : 'Failed to remove vendor');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSendMessages}
          disabled={loading === 'send'}
          className="btn btn--accent btn--sm"
        >
          {loading === 'send'
            ? (locale === 'tr' ? 'Gönderiliyor...' : 'Sending...')
            : (locale === 'tr' ? 'Tedarikçilere Gönder' : 'Send to Vendors')}
        </button>
        <button
          onClick={() => setShowCountryForm(!showCountryForm)}
          disabled={loading === 'country'}
          className="btn btn--sm"
        >
          {locale === 'tr' ? 'Ülkeyi Değiştir' : 'Change Country'}
        </button>
      </div>

      {showCountryForm && (
        <form onSubmit={handleChangeCountry} className="flex items-center gap-2">
          <input
            type="text"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
            placeholder={locale === 'tr' ? 'Yeni ülke kodu (örn: DE)' : 'New country code (e.g., DE)'}
            maxLength={2}
            className="input input--sm w-32"
            required
          />
          <button type="submit" disabled={loading === 'country'} className="btn btn--sm">
            {loading === 'country'
              ? (locale === 'tr' ? 'Güncelleniyor...' : 'Updating...')
              : (locale === 'tr' ? 'Güncelle' : 'Update')}
          </button>
          <button type="button" onClick={() => setShowCountryForm(false)} className="btn btn--sm btn--ghost">
            {locale === 'tr' ? 'İptal' : 'Cancel'}
          </button>
        </form>
      )}

      {error && (
        <div className="text-xs font-semibold text-[var(--danger)]">
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs font-semibold text-[var(--success)]">
          {success}
        </div>
      )}
    </div>
  );
}
