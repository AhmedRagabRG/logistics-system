"use client";

import { useState, useEffect, useCallback } from 'react';
import RfqList from '@/components/rfqs/rfq-list';
import Pagination from '@/components/ui/pagination';
import SearchInput from '@/components/ui/search-input';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDashboardT, useDashboardLocaleContext } from '@/lib/i18n-client';

interface RFQItem {
  id: number;
  quote_id: number;
  rfq_reference: string;
  target_country: string;
  status: string;
  origin_region: string;
  destination_region: string;
  vendor_count: number;
  created_at: string;
  updated_at: string;
}

const ITEMS_PER_PAGE = 20;

export default function RFQsPage() {
  const locale = useDashboardLocaleContext();
  const _t = useDashboardT();
  const [rfqs, setRfqs] = useState<RFQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchRFQs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(ITEMS_PER_PAGE));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const res = await fetch(`/api/v1/rfqs?${params.toString()}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setRfqs(data.data.rfqs);
      setTotal(data.data.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, fromDate, toDate, _t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRFQs();
  }, [fetchRFQs]);

  const { selectedIds, toggle, clear, isSelected } = useBulkSelection<number>(rfqs.map((r) => r.id));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    clear();
  }, [search, statusFilter, fromDate, toDate, clear]);

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const message = _t('confirm_bulk_delete').replace('{count}', String(selectedIds.length));
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/v1/rfqs?ids=${selectedIds.join(',')}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      clear();
      fetchRFQs();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('rfq_title')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRFQs}
            disabled={loading}
            className="btn btn-secondary text-xs"
            title="Refresh"
          >
            {loading ? '...' : 'Refresh'}
          </button>
          <span className="text-xs font-mono text-[var(--muted)]">{total} RFQ</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SearchInput value={search} onChange={setSearch} placeholder={_t('search_placeholder')} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{_t('filter_all')} — {_t('filter_status')}</option>
              <option value="open">{_t('rfq_status_open')}</option>
              <option value="responded">{_t('rfq_status_responded')}</option>
              <option value="closed">{_t('rfq_status_closed')}</option>
            </select>
            <div className="flex items-end">
              {(fromDate || toDate || statusFilter || search) && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); setStatusFilter(''); setSearch(''); }}
                  className="btn btn-ghost text-xs"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-[var(--muted)] font-mono uppercase tracking-widest">{_t('loading')}</div>
      ) : (
        <>
          {!error && rfqs.length === 0 && (
            <div className="border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center text-xs text-[var(--muted)]">
              {_t('rfq_empty')}
            </div>
          )}

          <div className="space-y-2">
            {rfqs.map((rfq) => (
              <div key={rfq.id} className="group flex items-stretch gap-0 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors">
                <div className="flex items-start pt-3 pl-2 pr-1">
                  <input
                    type="checkbox"
                    checked={isSelected(rfq.id)}
                    onChange={() => toggle(rfq.id)}
                    className="h-3.5 w-3.5 border-[var(--border-strong)] text-[var(--accent)]"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <RfqList rfqs={[rfq]} locale={locale} />
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} totalRecords={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
