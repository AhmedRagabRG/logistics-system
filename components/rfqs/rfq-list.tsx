import StatusBadge from '@/components/ui/status-badge';
import { type DashboardLocale, t } from '@/lib/i18n-dashboard';

interface RFQ {
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

interface RfqListProps {
  rfqs: RFQ[];
  locale?: DashboardLocale;
}

const statusBorderColors: Record<string, string> = {
  open: 'border-l-[var(--info)]',
  responded: 'border-l-[var(--success)]',
  closed: 'border-l-[var(--muted)]',
};

export default function RfqList({ rfqs, locale = 'tr' }: RfqListProps) {
  return (
    <div className="space-y-2">
      {rfqs.map((rfq) => {
        const borderColor = statusBorderColors[rfq.status] ?? 'border-l-[var(--muted)]';
        return (
          <div key={rfq.id} className={`flex items-stretch gap-0 border-l-[3px] ${borderColor} bg-[var(--surface)]`}>
            <div className="flex-1 min-w-0 px-3 py-2.5">
              {/* Row 1: Ref + Status */}
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="font-mono text-[11px] font-bold text-[var(--foreground)]">{rfq.rfq_reference}</span>
                <StatusBadge status={rfq.status} label={t(`rfq_status_${rfq.status}` as 'rfq_status_open', locale)} />
                <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider border border-[var(--border)]/40 text-[var(--secondary)] bg-[var(--background)]">
                  {rfq.vendor_count} vendor{rfq.vendor_count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Row 2: Route */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[11px] text-[var(--secondary)]">
                  {rfq.origin_region} → {rfq.destination_region}
                </span>
                <span className="text-[10px] text-[var(--muted)]">·</span>
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase">
                  {rfq.target_country}
                </span>
              </div>

              {/* Row 3: Meta */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="text-[10px] font-mono text-[var(--muted)]">
                  Quote #{rfq.quote_id}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted)]">
                  {new Date(rfq.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                </span>
              </div>
            </div>

            {/* Right: Status indicator */}
            <div className={`flex flex-col items-center justify-center px-3 py-2.5 border-l border-[var(--border)] min-w-[80px] ${
              rfq.status === 'open' ? 'bg-[var(--info)]/5' :
              rfq.status === 'responded' ? 'bg-[var(--success)]/5' :
              'bg-[var(--background)]/50'
            }`}>
              {rfq.status === 'open' && (
                <>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--info)]">Waiting</span>
                  <span className="text-[9px] font-mono text-[var(--muted)] mt-0.5">Responses</span>
                </>
              )}
              {rfq.status === 'responded' && (
                <>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--success)]">Bids In</span>
                  <span className="text-[9px] font-mono text-[var(--muted)] mt-0.5">Review</span>
                </>
              )}
              {rfq.status === 'closed' && (
                <>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Closed</span>
                  <span className="text-[9px] font-mono text-[var(--muted)] mt-0.5">Done</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
