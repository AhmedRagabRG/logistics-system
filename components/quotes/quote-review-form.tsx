"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardT } from '@/lib/i18n-client';

interface QuoteReviewFormProps {
  quoteId: number;
  currentFinalPrice: number;
  currency: string;
}

export default function QuoteReviewForm({ quoteId, currentFinalPrice, currency }: QuoteReviewFormProps) {
  const router = useRouter();
  const _t = useDashboardT();
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [revisedPrice, setRevisedPrice] = useState<string>(currentFinalPrice > 0 ? String(currentFinalPrice) : '');
  const [notes, setNotes] = useState('');
  const [responseText, setResponseText] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {};
    if (revisedPrice) {
      const parsed = parseFloat(revisedPrice);
      if (!isNaN(parsed) && parsed > 0) {
        body.revised_price = parsed;
      }
    }
    if (notes.trim()) body.notes = notes.trim();
    if (responseText.trim()) body.response_text = responseText.trim();

    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        setError(text ? `Server error (${res.status}): ${text.slice(0, 200)}` : `Server error (${res.status})`);
        return;
      }
      if (!data.success) {
        setError(data.error?.message || _t('approve_failed'));
        return;
      }
      router.push('/quotes');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = { reason: reason.trim() };
    if (responseText.trim()) body.response_text = responseText.trim();

    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        setError(text ? `Server error (${res.status}): ${text.slice(0, 200)}` : `Server error (${res.status})`);
        return;
      }
      if (!data.success) {
        setError(data.error?.message || _t('reject_failed'));
        return;
      }
      router.push('/quotes');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel border-l-[3px] border-l-[var(--warning)]">
      <div className="panel-header">
        <h3 className="text-xs font-bold uppercase tracking-wider">{_t('review_decision')}</h3>
      </div>
      <div className="panel-body">
        {error && (
          <div className="mb-3 border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('approve')}
            className={`btn text-xs ${mode === 'approve' ? 'btn-primary' : 'btn-secondary'}`}
          >
            {_t('approve')}
          </button>
          <button
            type="button"
            onClick={() => setMode('reject')}
            className={`btn text-xs ${mode === 'reject' ? 'btn-danger' : 'btn-secondary'}`}
          >
            {_t('reject')}
          </button>
        </div>

        {mode === 'approve' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">
                {_t('revised_price')} ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={revisedPrice}
                onChange={(e) => setRevisedPrice(e.target.value)}
                placeholder={`${_t('placeholder_current_price')}: ${currentFinalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">{_t('keep_current_price')}</p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('notes')}</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('customer_response_text')}</label>
              <textarea rows={3} value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder={_t('placeholder_customer_response')} />
            </div>
            <button type="button" onClick={handleApprove} disabled={loading} className="btn btn-primary text-xs">
              {loading ? _t('approving') : _t('confirm_approval')}
            </button>
          </div>
        )}

        {mode === 'reject' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">
                {_t('rejection_reason')} <span className="text-[var(--danger)]">*</span>
              </label>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('customer_response_text')}</label>
              <textarea rows={3} value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder={_t('placeholder_customer_response')} />
            </div>
            <button type="button" onClick={handleReject} disabled={loading || !reason.trim()} className="btn btn-danger text-xs">
              {loading ? _t('rejecting') : _t('confirm_rejection')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
