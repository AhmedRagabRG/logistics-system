"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import QuoteCard from '@/components/quotes/quote-card';
import Pagination from '@/components/ui/pagination';
import SearchInput from '@/components/ui/search-input';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDashboardT, useDashboardLocaleContext } from '@/lib/i18n-client';

interface QuoteItem {
  id: number;
  origin_region: string;
  destination_region: string;
  final_price: number;
  currency: string;
  status: string;
  is_oversize: boolean;
  rfq_id: number | null;
  review_reason: string | null;
  created_at: string;
  origin_postal_code: string;
  destination_postal_code: string;
  weight_kg: number;
  channel: string;
  language: string;
  customer_name: string | null;
}

const ITEMS_PER_PAGE = 20;

export default function QuotesPage() {
  const locale = useDashboardLocaleContext();
  const _t = useDashboardT();
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(ITEMS_PER_PAGE));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (channelFilter) params.set('channel', channelFilter);
      if (languageFilter) params.set('language', languageFilter);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const res = await fetch(`/api/v1/quotes?${params.toString()}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setQuotes(data.data.quotes);
      setTotal(data.data.pagination.total);

      // Extract unique languages from results for dynamic filter
      const langs = Array.from(new Set((data.data.quotes as QuoteItem[]).map((q: QuoteItem) => q.language).filter(Boolean))) as string[];
      if (langs.length > 0) setAvailableLanguages(langs.sort());
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, channelFilter, languageFilter, fromDate, toDate, _t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQuotes();
  }, [fetchQuotes]);

  const { selectedIds, toggle, clear, isSelected } = useBulkSelection<number>(quotes.map((q) => q.id));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    clear();
  }, [search, statusFilter, channelFilter, languageFilter, fromDate, toDate, clear]);

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const message = _t('confirm_bulk_delete').replace('{count}', String(selectedIds.length));
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/v1/quotes?ids=${selectedIds.join(',')}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      clear();
      fetchQuotes();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('quotes_title')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchQuotes}
            disabled={loading}
            className="btn btn-secondary text-xs"
            title="Refresh"
          >
            {loading ? '...' : 'Refresh'}
          </button>
          <span className="text-xs font-mono text-[var(--muted)]">
            {total} {locale === 'tr' ? 'kayıt' : 'records'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="panel-body">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SearchInput value={search} onChange={setSearch} placeholder={_t('search_placeholder')} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{_t('filter_all')} — {_t('filter_status')}</option>
              <option value="pending">{_t('status_pending')}</option>
              <option value="approved">{_t('status_approved')}</option>
              <option value="rejected">{_t('status_rejected')}</option>
              <option value="ready_to_send">{_t('status_ready')}</option>
              <option value="sent">{_t('status_sent')}</option>
            </select>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="">{_t('filter_all')} — {_t('filter_channel')}</option>
              <option value="whatsapp">{_t('channel_whatsapp')}</option>
              <option value="telegram">{_t('channel_telegram')}</option>
              <option value="email">{_t('channel_email')}</option>
            </select>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="">{_t('filter_all')} — {_t('filter_language')}</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              {(fromDate || toDate || statusFilter || channelFilter || languageFilter || search) && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); setStatusFilter(''); setChannelFilter(''); setLanguageFilter(''); setSearch(''); }}
                  className="btn btn-ghost text-xs"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex items-end justify-end">
              {selectedIds.length > 0 && (
                <button onClick={handleBulkDelete} className="btn btn-danger text-xs">
                  {_t('delete_selected')} ({selectedIds.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-[var(--muted)] font-mono uppercase tracking-widest">{_t('loading')}</div>
      ) : (
        <>
          {!error && quotes.length === 0 && (
            <div className="border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center text-xs text-[var(--muted)]">
              {_t('quotes_empty')}
            </div>
          )}

          <div className="space-y-2">
            {quotes.map((quote) => (
              <div key={quote.id} className="group flex items-stretch gap-0 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors">
                <div className="flex items-start pt-3 pl-2 pr-1">
                  <input
                    type="checkbox"
                    checked={isSelected(quote.id)}
                    onChange={() => toggle(quote.id)}
                    className="h-3.5 w-3.5 border-[var(--border-strong)] text-[var(--accent)]"
                  />
                </div>
                <Link href={`/quotes/${quote.id}`} className="block flex-1 min-w-0">
                  <QuoteCard quote={quote} locale={locale} />
                </Link>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} totalRecords={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
