import { notFound } from 'next/navigation';
import QuoteReviewForm from '@/components/quotes/quote-review-form';
import RfqDetailCard from '@/components/quotes/rfq-detail-card';
import CreateRfqForm from '@/components/quotes/create-rfq-form';
import StatusBadge from '@/components/ui/status-badge';
import AutoRefresh from '@/components/ui/auto-refresh';
import RefreshButton from '@/components/ui/refresh-button';
import pool from '@/lib/db';
import { getDashboardLocale } from '@/lib/i18n-server';
import { t } from '@/lib/i18n-dashboard';
import type { RowDataPacket } from 'mysql2/promise';

interface QuoteDetail {
  id: number;
  origin_region: string;
  destination_region: string;
  origin_postal_code: string | null;
  destination_postal_code: string | null;
  weight_kg: number | null;
  cargo_type: string | null;
  base_price: number;
  markup_percent: number;
  final_price: number;
  currency: string;
  status: string;
  toggle_state_at_creation: string;
  is_oversize: boolean;
  rfq_id: number | null;
  rfq_reference: string | null;
  rfq_status: string | null;
  review_reason: string | null;
  response_text: string | null;
  approved_by: number | null;
  approver_name: string | null;
  approved_at: string | null;
  created_at: string;
  language: string;
  channel: string;
  customer_name: string | null;
  customer_contact: string | null;
  raw_message: string | null;
}

async function fetchQuote(id: number): Promise<QuoteDetail | null> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & QuoteDetail>
  >(
    `SELECT q.id, q.origin_region, q.destination_region, q.origin_postal_code, q.destination_postal_code, q.weight_kg, q.cargo_type,
            q.base_price, q.markup_percent, q.final_price, q.currency, q.status, q.toggle_state_at_creation, q.is_oversize, q.rfq_id, q.review_reason,
            q.response_text, q.approved_by, q.approved_at, q.created_at,
            a.display_name as approver_name,
            r.rfq_reference, r.status as rfq_status,
            s.language, s.channel, s.customer_name, s.customer_contact, s.raw_message
     FROM quotes q
     JOIN shipment_requests s ON s.id = q.shipment_request_id
     LEFT JOIN admin_accounts a ON a.id = q.approved_by
     LEFT JOIN rfq_records r ON r.id = q.rfq_id
     WHERE q.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getDashboardLocale();
  const { id } = await params;
  const quoteId = parseInt(id, 10);
  if (isNaN(quoteId)) notFound();

  const quote = await fetchQuote(quoteId);
  if (!quote) notFound();

  const isPending = quote.status === 'pending';
  const fmt = (n: number) => n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 });

  const statusBorderColors: Record<string, string> = {
    pending: 'border-l-[var(--warning)]',
    approved: 'border-l-[var(--success)]',
    rejected: 'border-l-[var(--danger)]',
    ready_to_send: 'border-l-[var(--info)]',
    sent: 'border-l-[var(--success)]',
  };
  const detailBorder = statusBorderColors[quote.status] ?? 'border-l-[var(--muted)]';

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold tracking-tight uppercase">{t('quote_detail_title', locale)} #{quote.id}</h1>
        <StatusBadge status={quote.status} label={t(`status_${quote.status}` as 'status_pending', locale)} />
        {quote.is_oversize && (
          <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--warning)]/40 text-[var(--warning)] bg-[var(--warning)]/5">
            {t('oversize_badge', locale)}
          </span>
        )}
        {quote.rfq_id ? (
          <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--warning)]/25 text-[var(--warning)] bg-[var(--warning)]/8">
            {t('rfq_badge', locale) || 'RFQ'}
          </span>
        ) : quote.review_reason?.includes('No vendors') ? (
          <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--danger)]/25 text-[var(--danger)] bg-[var(--danger)]/8">
            No Coverage
          </span>
        ) : quote.review_reason?.includes('Missing fields') ? (
          <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--info)]/25 text-[var(--info)] bg-[var(--info)]/8">
            Data Request
          </span>
        ) : (
          <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--accent)]/25 text-[var(--accent)] bg-[var(--accent)]/8">
            {t('internal_pricing_badge', locale) || 'Internal'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <AutoRefresh enabled={quote.rfq_status === 'open'} interval={30000} />
          <RefreshButton />
        </div>
      </div>

      <div className={`panel border-l-[3px] ${detailBorder}`}>
        <div className="panel-body">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {quote.customer_name && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('customer', locale)}</div>
                <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">{quote.customer_name}</div>
                {quote.customer_contact && (
                  <div className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">{quote.customer_contact}</div>
                )}
              </div>
            )}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('origin_region', locale)}</div>
              <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">{quote.origin_region} <span className="font-mono text-xs text-[var(--muted)]">({quote.origin_postal_code ?? '—'})</span></div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('destination_region', locale)}</div>
              <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">{quote.destination_region} <span className="font-mono text-xs text-[var(--muted)]">({quote.destination_postal_code ?? '—'})</span></div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('weight', locale)}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[var(--foreground)]">
                {quote.weight_kg !== null ? `${quote.weight_kg.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${t('unit_kg', locale)}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('base_price', locale)}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[var(--foreground)]">
                {quote.base_price > 0 ? `${fmt(quote.base_price)} ${quote.currency}` : t('na', locale)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('markup', locale)}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[var(--foreground)]">
                {quote.markup_percent > 0 ? `%${quote.markup_percent}` : t('na', locale)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('final_price', locale)}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[var(--accent)]">
                {quote.final_price > 0 ? `${fmt(quote.final_price)} ${quote.currency}` : t('price_pending', locale)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('language_label', locale)}</div>
              <div className="mt-0.5 text-sm font-bold uppercase text-[var(--foreground)]">{quote.language}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('channel_label', locale)}</div>
              <div className="mt-0.5 text-sm font-bold capitalize text-[var(--foreground)]">{quote.channel}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('toggle_state', locale)}</div>
              <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">
                {t(`settings_mode_${quote.toggle_state_at_creation}` as 'settings_mode_manual', locale)}
              </div>
            </div>
            {quote.approved_by && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('processed_by', locale)}</div>
                <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">
                  {quote.approver_name || `${t('admin', locale)} #${quote.approved_by}`}
                </div>
              </div>
            )}
          </div>

          {quote.cargo_type && (
            <div className="mt-4 border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('cargo_type', locale)}</div>
              <div className="mt-0.5 text-xs text-[var(--foreground)]">{quote.cargo_type}</div>
            </div>
          )}

          {quote.review_reason && (
            <div className="mt-4 border border-[var(--warning)] bg-[var(--warning)]/5 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--warning)]">{t('review_reason', locale)}</div>
              <div className="mt-0.5 text-xs text-[var(--foreground)]">{quote.review_reason}</div>
            </div>
          )}

          {quote.response_text && (
            <div className="mt-3 border border-[var(--info)] bg-[var(--info)]/5 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--info)]">{t('response_text', locale)}</div>
              <div className="mt-0.5 text-xs text-[var(--foreground)]">{quote.response_text}</div>
            </div>
          )}

          {quote.raw_message && (
            <div className="mt-4 border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{t('original_message', locale) || 'Original Message'}</div>
              <div className="mt-1 whitespace-pre-wrap text-xs font-mono text-[var(--foreground)]">{quote.raw_message}</div>
            </div>
          )}
        </div>
      </div>

      {quote.rfq_id && (
        <RfqDetailCard rfqId={quote.rfq_id} rfqReference={quote.rfq_reference} locale={locale} quoteStatus={quote.status} />
      )}

      {!quote.rfq_id && quote.status !== 'approved' && quote.status !== 'rejected' && (
        <CreateRfqForm quoteId={quote.id} locale={locale} destinationRegion={quote.destination_region} />
      )}

      {isPending && (
        <QuoteReviewForm quoteId={quote.id} currentFinalPrice={quote.final_price} currency={quote.currency} />
      )}

      {!isPending && quote.approved_at && (
        <div className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-mono text-[var(--secondary)]">
          {t('processed_at', locale)}: {new Date(quote.approved_at).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
        </div>
      )}
    </div>
  );
}
