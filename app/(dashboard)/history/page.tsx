"use client";

import { useState, useEffect, useCallback } from 'react';
import Pagination from '@/components/ui/pagination';
import ScrollableTable from '@/components/ui/scrollable-table';
import SearchInput from '@/components/ui/search-input';
import { useDashboardT } from '@/lib/i18n-client';

interface HistoryEvent {
  id: number;
  event_type: string;
  admin: { id: number; username: string; display_name: string | null } | null;
  quote_id: number | null;
  rfq_id: number | null;
  rfq_reference: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export default function HistoryPage() {
  const _t = useDashboardT();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    event_type: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.from_date) params.set('from_date', filters.from_date);
      if (filters.to_date) params.set('to_date', filters.to_date);
      if (filters.event_type) params.set('event_type', filters.event_type);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/v1/history?${params.toString()}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setEvents(data.data.events);
      setTotal(data.data.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, _t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, [fetchHistory]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function exportCSV() {
    const headers = [_t('label_id'), _t('event_type'), 'Quote #', 'RFQ Ref', _t('admin'), _t('details'), _t('date')];
    const rows = events.map((e) => [
      e.id,
      _t(`event_${e.event_type}` as 'event_login'),
      e.quote_id ?? '',
      e.rfq_reference ?? '',
      e.admin ? e.admin.display_name || e.admin.username : _t('system_label'),
      e.details ? JSON.stringify(e.details) : '',
      new Date(e.created_at).toISOString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('history_title')}</h1>
        <button onClick={exportCSV} disabled={events.length === 0} className="btn btn-secondary text-xs">
          {_t('history_export_csv')}
        </button>
      </div>

      <div className="panel">
        <div className="panel-body">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('date')} ({_t('label_from')})</label>
              <input type="date" value={filters.from_date} onChange={(e) => handleFilterChange('from_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('date')} ({_t('label_to')})</label>
              <input type="date" value={filters.to_date} onChange={(e) => handleFilterChange('to_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('event_type')}</label>
              <select value={filters.event_type} onChange={(e) => handleFilterChange('event_type', e.target.value)}>
                <option value="">{_t('filter_all')}</option>
                <option value="quote_created">{_t('event_quote_created')}</option>
                <option value="quote_ready">{_t('event_quote_ready')}</option>
                <option value="quote_approved">{_t('event_quote_approved')}</option>
                <option value="quote_rejected">{_t('event_quote_rejected')}</option>
                <option value="rfq_initiated">{_t('event_rfq_initiated')}</option>
                <option value="vendor_selected">{_t('event_vendor_selected')}</option>
                <option value="vendor_response_received">{_t('event_vendor_response')}</option>
                <option value="login">{_t('event_login')}</option>
                <option value="logout">{_t('event_logout')}</option>
                <option value="data_imported">{_t('event_data_imported')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('search_placeholder')}</label>
              <SearchInput value={filters.search} onChange={(v) => handleFilterChange('search', v)} placeholder={_t('search_placeholder')} />
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
          <ScrollableTable>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{_t('event_type')}</th>
                  <th>Quote #</th>
                  <th>RFQ Ref</th>
                  <th>{_t('admin')}</th>
                  <th>{_t('details')}</th>
                  <th>{_t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getEventBadgeStyle(event.event_type)}`}>
                        {_t(`event_${event.event_type}` as 'event_login')}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-[var(--secondary)]">
                      {event.quote_id ? (
                        <a href={`/quotes/${event.quote_id}`} className="text-[var(--accent)] hover:underline">
                          #{event.quote_id}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="font-mono text-[10px] text-[var(--secondary)]">
                      {event.rfq_reference ? (
                        <a href={`/rfqs/${event.rfq_id}`} className="text-[var(--accent)] hover:underline">
                          {event.rfq_reference}
                        </a>
                      ) : event.rfq_id ? (
                        `#${event.rfq_id}`
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-[var(--secondary)]">
                      {event.admin ? event.admin.display_name || event.admin.username : _t('system_label')}
                    </td>
                    <td>
                      {event.details ? (
                        <pre className="max-w-xs overflow-x-auto bg-[var(--background)] p-1.5 text-[10px] font-mono">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="font-mono text-[10px] text-[var(--secondary)]">
                      {new Date(event.created_at).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted)]">{_t('no_data')}</div>
            )}
          </ScrollableTable>

          <Pagination currentPage={page} totalPages={totalPages} totalRecords={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function getEventBadgeStyle(eventType: string): string {
  switch (eventType) {
    case 'quote_ready': return 'border-[var(--success)] text-[var(--success)] bg-[var(--success)]/5';
    case 'quote_approved': return 'border-[var(--info)] text-[var(--info)] bg-[var(--info)]/5';
    case 'quote_rejected': return 'border-[var(--danger)] text-[var(--danger)] bg-[var(--danger)]/5';
    case 'quote_created': return 'border-[var(--warning)] text-[var(--warning)] bg-[var(--warning)]/5';
    case 'rfq_initiated': return 'border-[var(--info)] text-[var(--info)] bg-[var(--info)]/5';
    case 'vendor_selected':
    case 'vendor_response_received': return 'border-[var(--secondary)] text-[var(--secondary)] bg-[var(--secondary)]/5';
    default: return 'border-[var(--border-strong)] text-[var(--muted)] bg-[var(--background)]';
  }
}
