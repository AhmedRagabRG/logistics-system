import { notFound } from 'next/navigation';
import QuoteReviewForm from '@/components/quotes/quote-review-form';
import RfqDetailCard from '@/components/quotes/rfq-detail-card';
import CreateRfqForm from '@/components/quotes/create-rfq-form';
import QuoteDetailFields from '@/components/quotes/quote-detail-fields';
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
  sea_base_price: number;
  sea_markup_percent: number;
  sea_final_price: number;
  sea_currency: string;
  is_dual_mode: boolean;
  status: string;
  transport_mode: string;
  toggle_state_at_creation: string;
  is_oversize: boolean;
  rfq_id: number | null;
  rfq_reference: string | null;
  rfq_status: string | null;
  rfq_target_country: string | null;
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
             q.base_price, q.markup_percent, q.final_price, q.currency,
             q.sea_base_price, q.sea_markup_percent, q.sea_final_price, q.sea_currency, q.is_dual_mode,
             q.status, q.transport_mode, q.toggle_state_at_creation, q.is_oversize, q.rfq_id, q.review_reason,
             q.response_text, q.approved_by, q.approved_at, q.created_at,
             a.display_name as approver_name,
             r.rfq_reference, r.status as rfq_status, r.target_country as rfq_target_country,
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
        <QuoteDetailFields quote={quote} locale={locale} />
      </div>

      {quote.rfq_id && (
        <RfqDetailCard
          key={`rfq-${quote.rfq_id}-${quote.rfq_target_country ?? 'none'}`}
          rfqId={quote.rfq_id}
          rfqReference={quote.rfq_reference}
          locale={locale}
          quoteStatus={quote.status}
          targetCountry={quote.rfq_target_country}
        />
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
