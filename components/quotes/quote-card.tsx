import StatusBadge from '@/components/ui/status-badge';
import { type DashboardLocale, t } from '@/lib/i18n-dashboard';

interface QuoteCardProps {
  quote: {
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
    origin_postal_code: string | null;
    destination_postal_code: string | null;
    weight_kg: number | null;
    channel?: string;
    language?: string;
    customer_name?: string | null;
  };
  locale?: DashboardLocale;
}

const statusBorderColors: Record<string, string> = {
  pending: 'border-l-[var(--warning)]',
  approved: 'border-l-[var(--success)]',
  rejected: 'border-l-[var(--danger)]',
  ready_to_send: 'border-l-[var(--info)]',
};

const coverageBadge = (quote: QuoteCardProps['quote'], locale: DashboardLocale) => {
  if (quote.rfq_id) {
    return { label: 'RFQ', color: 'text-[var(--warning)] bg-[var(--warning)]/8 border-[var(--warning)]/25' };
  }
  if (quote.review_reason?.includes('No vendors')) {
    return { label: 'No Coverage', color: 'text-[var(--danger)] bg-[var(--danger)]/8 border-[var(--danger)]/25' };
  }
  if (quote.review_reason?.includes('Missing fields')) {
    return { label: 'Data Request', color: 'text-[var(--info)] bg-[var(--info)]/8 border-[var(--info)]/25' };
  }
  return { label: 'Internal', color: 'text-[var(--accent)] bg-[var(--accent)]/8 border-[var(--accent)]/25' };
};

export default function QuoteCard({ quote, locale = 'tr' }: QuoteCardProps) {
  const borderColor = statusBorderColors[quote.status] ?? 'border-l-[var(--muted)]';
  const cov = coverageBadge(quote, locale);
  const fmt = (n: number) => n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 });

  const formattedPrice = quote.final_price > 0
    ? `${fmt(quote.final_price)} ${quote.currency}`
    : quote.status === 'pending'
      ? t('price_pending', locale)
      : `0.00 ${quote.currency}`;

  return (
    <div className={`flex items-stretch gap-0 border-l-[3px] ${borderColor} bg-[var(--surface)]`}>
      {/* Main content */}
      <div className="flex-1 min-w-0 px-3 py-2.5">
        {/* Row 1: ID, Status, Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="font-mono text-[11px] font-bold text-[var(--foreground)]">#{quote.id}</span>
          <StatusBadge status={quote.status} label={t(`status_${quote.status}` as 'status_pending', locale)} />
          {quote.is_oversize && (
            <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--warning)]/40 text-[var(--warning)] bg-[var(--warning)]/5">
              Oversize
            </span>
          )}
          <span className={`px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border ${cov.color}`}>
            {cov.label}
          </span>
        </div>

        {/* Row 2: Customer + Route */}
        <div className="flex items-baseline gap-2 mb-1">
          {quote.customer_name ? (
            <span className="text-xs font-semibold text-[var(--foreground)] truncate">{quote.customer_name}</span>
          ) : (
            <span className="text-xs font-semibold text-[var(--muted)]">Anonymous</span>
          )}
          <span className="text-[10px] text-[var(--muted)]">·</span>
          <span className="text-[11px] text-[var(--secondary)]">
            {quote.origin_region} → {quote.destination_region}
          </span>
        </div>

        {/* Row 3: Meta data grid */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {quote.weight_kg !== null && (
            <span className="text-[10px] font-mono text-[var(--muted)]">
              {quote.weight_kg.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} kg
            </span>
          )}
          {quote.origin_postal_code && (
            <span className="text-[10px] font-mono text-[var(--muted)]">
              Origin: {quote.origin_postal_code}
            </span>
          )}
          {quote.destination_postal_code && (
            <span className="text-[10px] font-mono text-[var(--muted)]">
              Dest: {quote.destination_postal_code}
            </span>
          )}
          {quote.channel && (
            <span className="text-[10px] font-mono uppercase text-[var(--muted)]">
              {quote.channel}
            </span>
          )}
          {quote.language && (
            <span className="text-[10px] font-mono uppercase text-[var(--muted)]">
              {quote.language}
            </span>
          )}
        </div>
      </div>

      {/* Right: Price + Date */}
      <div className="flex flex-col items-end justify-center px-3 py-2.5 border-l border-[var(--border)] bg-[var(--background)]/50 min-w-[100px]">
        <span className={`font-mono text-sm font-bold ${quote.status === 'approved' ? 'text-[var(--success)]' : quote.status === 'rejected' ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'}`}>
          {formattedPrice}
        </span>
        <span className="text-[9px] font-mono text-[var(--muted)] mt-0.5">
          {new Date(quote.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
        </span>
      </div>
    </div>
  );
}
