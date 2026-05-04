"use client";

import { useState, useEffect, useCallback } from 'react';
import Pagination from '@/components/ui/pagination';
import { useDashboardT, useDashboardLocaleContext } from '@/lib/i18n-client';

interface UnmatchedReply {
  id: number;
  contact_id: string;
  contact_channel: string;
  reply_text: string;
  parsed_price: number | null;
  parsed_currency: string | null;
  status: 'unmatched' | 'resolved' | 'ignored';
  matched_rfq_id: number | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

const ITEMS_PER_PAGE = 20;

export default function UnmatchedRepliesPage() {
  const locale = useDashboardLocaleContext();
  const _t = useDashboardT();
  const [replies, setReplies] = useState<UnmatchedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [attachId, setAttachId] = useState<number | null>(null);
  const [attachRfqRef, setAttachRfqRef] = useState('');

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(ITEMS_PER_PAGE));
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const res = await fetch(`/api/v1/unmatched-replies?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error || _t('error_loading'));
        return;
      }
      setReplies(data.replies || []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, fromDate, toDate, _t]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, fromDate, toDate]);

  async function handleDelete(id: number) {
    if (!confirm(_t('unmatched_replies_delete_confirm'))) return;
    try {
      const res = await fetch(`/api/v1/unmatched-replies?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(_t('unmatched_replies_delete_failed'));
        return;
      }
      fetchReplies();
    } catch {
      alert(_t('unmatched_replies_delete_failed'));
    }
  }

  async function handleStatusChange(id: number, status: 'resolved' | 'ignored') {
    try {
      const res = await fetch('/api/v1/unmatched-replies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(status === 'resolved' ? _t('unmatched_replies_mark_resolved_failed') : _t('unmatched_replies_mark_ignored_failed'));
        return;
      }
      fetchReplies();
    } catch {
      alert(status === 'resolved' ? _t('unmatched_replies_mark_resolved_failed') : _t('unmatched_replies_mark_ignored_failed'));
    }
  }

  async function handleAttachToRFQ(replyId: number, rfqReference: string) {
    if (!rfqReference.trim()) {
      alert('Please enter an RFQ reference');
      return;
    }
    try {
      const res = await fetch('/api/v1/unmatched-replies/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unmatched_reply_id: replyId, rfq_reference: rfqReference.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to attach reply');
        return;
      }
      alert(`Attached successfully! Price: ${data.data.price} ${data.data.currency}`);
      fetchReplies();
    } catch {
      alert('Failed to attach reply');
    }
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      unmatched: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30',
      resolved: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30',
      ignored: 'bg-[var(--muted)]/10 text-[var(--muted)] border-[var(--muted)]/30',
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded ${styles[status] ?? styles.unmatched}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('unmatched_replies_title')}</h1>
        <span className="text-xs font-mono text-[var(--muted)]">{total} {locale === 'tr' ? 'kayıt' : 'records'}</span>
      </div>

      <div className="panel">
        <div className="panel-body">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{_t('filter_all')} — {_t('filter_status')}</option>
              <option value="unmatched">Unmatched</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              {(fromDate || toDate || statusFilter) && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); setStatusFilter(''); }}
                  className="btn btn-ghost text-xs"
                >
                  Clear filters
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
          {!error && replies.length === 0 && (
            <div className="border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center text-xs text-[var(--muted)]">
              {_t('unmatched_replies_empty')}
            </div>
          )}

          <div className="space-y-px border border-[var(--border)] bg-[var(--border)]">
            {replies.map((reply) => (
              <div key={reply.id} className="bg-[var(--surface)] px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {statusBadge(reply.status)}
                      <span className="text-[10px] font-mono text-[var(--muted)] uppercase">{reply.contact_channel}</span>
                      <span className="text-[10px] font-mono text-[var(--secondary)]">{reply.contact_id}</span>
                      {reply.parsed_price != null && (
                        <span className="text-[10px] font-semibold text-[var(--accent)]">
                          {reply.parsed_price} {reply.parsed_currency ?? ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{reply.reply_text}</p>
                    <div className="mt-1.5 text-[10px] text-[var(--muted)] font-mono">
                      {_t('unmatched_replies_created')}: {new Date(reply.created_at).toLocaleString(locale)}
                      {reply.resolved_at && ` · ${_t('unmatched_replies_resolved')}: ${new Date(reply.resolved_at).toLocaleString(locale)}`}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {reply.status === 'unmatched' && (
                      <>
                        {attachId === reply.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={attachRfqRef}
                              onChange={(e) => setAttachRfqRef(e.target.value)}
                              placeholder="RFQ-20260504-001"
                              className="text-[10px] px-2 py-1 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded w-40"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAttachToRFQ(reply.id, attachRfqRef);
                                  setAttachId(null);
                                  setAttachRfqRef('');
                                }
                              }}
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  handleAttachToRFQ(reply.id, attachRfqRef);
                                  setAttachId(null);
                                  setAttachRfqRef('');
                                }}
                                className="btn btn-primary text-[10px] px-2 py-1"
                              >
                                Attach
                              </button>
                              <button
                                onClick={() => {
                                  setAttachId(null);
                                  setAttachRfqRef('');
                                }}
                                className="btn btn-secondary text-[10px] px-2 py-1"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setAttachId(reply.id);
                                setAttachRfqRef('');
                              }}
                              className="btn btn-primary text-[10px] px-2 py-1"
                            >
                              Attach to RFQ
                            </button>
                            <button
                              onClick={() => handleStatusChange(reply.id, 'resolved')}
                              className="btn btn-primary text-[10px] px-2 py-1"
                            >
                              {_t('unmatched_replies_mark_resolved')}
                            </button>
                            <button
                              onClick={() => handleStatusChange(reply.id, 'ignored')}
                              className="btn btn-secondary text-[10px] px-2 py-1"
                            >
                              {_t('unmatched_replies_mark_ignored')}
                            </button>
                          </>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(reply.id)}
                      className="btn btn-danger text-[10px] px-2 py-1"
                    >
                      {_t('delete')}
                    </button>
                  </div>
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
