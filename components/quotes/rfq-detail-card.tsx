import { type DashboardLocale, t } from '@/lib/i18n-dashboard';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';
import RfqVendorSelector from './rfq-vendor-selector';
import RfqDraftActions from './rfq-draft-actions';
import RfqVendorRemoveButton from './rfq-vendor-remove-button';

interface RfqDetailProps {
  rfqId: number;
  rfqReference: string | null;
  locale: DashboardLocale;
  quoteStatus?: string;
  targetCountry?: string | null;
}

function getWaitingPeriodSeconds(period: string): number {
  const match = period.match(/^(\d+)([mhd])$/);
  if (!match) return 30 * 60;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 60 * 60;
  if (unit === 'd') return value * 24 * 60 * 60;
  return 30 * 60;
}

function formatDuration(seconds: number, locale: DashboardLocale): string {
  if (seconds <= 0) return locale === 'tr' ? 'Süre doldu' : 'Expired';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return locale === 'tr' ? `${hours}s ${mins}dk` : `${hours}h ${mins}m`;
  }
  return locale === 'tr' ? `${mins}dk` : `${mins}m`;
}

export default async function RfqDetailCard({ rfqId, rfqReference, locale, quoteStatus, targetCountry }: RfqDetailProps) {
  // Get RFQ record
  const [rfqRows] = await pool.execute<
    Array<RowDataPacket & {
      id: number;
      rfq_reference: string;
      target_country: string;
      status: string;
      generated_quote_price: number | null;
      selected_vendor_id: number | null;
      created_at: Date;
    }>
  >(
    'SELECT id, rfq_reference, target_country, status, generated_quote_price, selected_vendor_id, created_at FROM rfq_records WHERE id = ? LIMIT 1',
    [rfqId]
  );

  if (!rfqRows || rfqRows.length === 0) return null;
  const rfq = rfqRows[0];

  // Get vendor assignments with vendor names
  const [vendorRows] = await pool.execute<
    Array<RowDataPacket & {
      id: number;
      vendor_id: number;
      vendor_name: string;
      contact_channel: string;
      contact_id: string;
      status: string;
      response_price: number | null;
      response_currency: string | null;
      responded_at: Date | null;
      created_at: Date;
    }>
  >(
    `SELECT a.id, a.vendor_id, v.name as vendor_name, a.contact_channel, a.contact_id,
            a.status, a.response_price, a.response_currency, a.responded_at, a.created_at
     FROM rfq_vendor_assignments a
     JOIN vendors v ON v.id = a.vendor_id
     WHERE a.rfq_id = ?
     ORDER BY a.status DESC, a.response_price ASC`,
    [rfqId]
  );

  // Get system waiting period
  const [settingsRows] = await pool.execute<
    Array<RowDataPacket & { waiting_period: string }>
  >(
    'SELECT waiting_period FROM system_settings ORDER BY id DESC LIMIT 1'
  );
  const waitingPeriod = settingsRows?.[0]?.waiting_period ?? '30m';
  const waitingSeconds = getWaitingPeriodSeconds(waitingPeriod);

  // Calculate time remaining
  const createdAt = new Date(rfq.created_at).getTime();
  const expiresAt = createdAt + waitingSeconds * 1000;
  const now = Date.now();
  const secondsRemaining = Math.floor((expiresAt - now) / 1000);

  const respondedCount = vendorRows.filter((v) => v.status === 'responded').length;
  const totalCount = vendorRows.length;
  const isExpired = secondsRemaining <= 0;
  const isClosed = rfq.status === 'closed';
  const isPending = quoteStatus === 'pending';
  const isDraft = rfq.status === 'draft';

  const statusColor = isClosed
    ? 'text-[var(--success)]'
    : isDraft
      ? 'text-[var(--accent)]'
      : isExpired
        ? 'text-[var(--danger)]'
        : 'text-[var(--warning)]';

  return (
    <div className="panel">
      <div className="panel-body space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-tight text-[var(--foreground)]">
            {locale === 'tr' ? 'RFQ Detayları' : 'RFQ Details'}
          </h2>
          <div className="flex items-center gap-2">
            {isDraft && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-white rounded">
                {locale === 'tr' ? 'Taslak' : 'Draft'}
              </span>
            )}
            <span className={`text-xs font-bold uppercase tracking-wider ${statusColor}`}>
              {rfq.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              {locale === 'tr' ? 'RFQ Kodu' : 'RFQ Reference'}
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[var(--foreground)]">{rfq.rfq_reference}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              {locale === 'tr' ? 'Hedef Ülke' : 'Target Country'}
            </div>
            <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">{rfq.target_country}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              {locale === 'tr' ? 'Kalan Süre' : 'Time Remaining'}
            </div>
            <div className={`mt-0.5 font-mono text-sm font-bold ${isExpired || isClosed ? 'text-[var(--muted)]' : 'text-[var(--warning)]'}`}>
              {isClosed ? (locale === 'tr' ? 'Kapalı' : 'Closed') : formatDuration(secondsRemaining, locale)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              {locale === 'tr' ? 'Yanıtlar' : 'Responses'}
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[var(--foreground)]">
              {respondedCount}/{totalCount}
            </div>
          </div>
        </div>

        {/* Draft actions */}
        {isDraft && (
          <RfqDraftActions
            rfqId={rfqId}
            rfqReference={rfq.rfq_reference}
            targetCountry={targetCountry ?? rfq.target_country}
            locale={locale}
          />
        )}

        {rfq.generated_quote_price && (
          <div className="border border-[var(--accent)] bg-[var(--accent)]/5 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              {locale === 'tr' ? 'Otomatik Fiyat' : 'Auto-Generated Price'}
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[var(--foreground)]">
              {rfq.generated_quote_price.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {/* Vendor list with selection for pending quotes */}
        {isPending && respondedCount > 0 ? (
          <RfqVendorSelector
            rfqId={rfqId}
            vendors={vendorRows.map((v) => ({
              vendor_id: v.vendor_id,
              vendor_name: v.vendor_name,
              response_price: v.response_price,
              response_currency: v.response_currency,
              status: v.status,
              assignment_id: v.id,
            }))}
            selectedVendorId={rfq.selected_vendor_id}
            locale={locale}
          />
        ) : (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
              {locale === 'tr' ? 'Tedarikçiler' : 'Vendors'}
            </div>
            <div className="space-y-px border border-[var(--border)] bg-[var(--border)]">
              {vendorRows.map((v) => {
                const isSelected = rfq.selected_vendor_id === v.vendor_id;
                return (
                  <div key={v.vendor_id} className={`flex items-center justify-between px-3 py-2 ${isSelected ? 'bg-[var(--success)]/5 border-l-2 border-l-[var(--success)]' : 'bg-[var(--surface)]'}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-[var(--foreground)]">{v.vendor_name}</div>
                        {isSelected && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--success)] text-white rounded">
                            {locale === 'tr' ? 'Seçildi' : 'Selected'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--muted)]">
                        {v.contact_channel} · {v.contact_id}
                      </div>
                    </div>
                     <div className="text-right flex-shrink-0 ml-3">
                       {v.status === 'responded' && v.response_price ? (
                         <>
                           <div className={`font-mono text-sm font-bold ${isSelected ? 'text-[var(--success)]' : 'text-[var(--foreground)]'}`}>
                             {(typeof v.response_price === 'string' ? parseFloat(v.response_price) : v.response_price).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })} {v.response_currency ?? '—'}
                           </div>
                           {!v.response_currency && (
                             <div className="text-[10px] font-semibold uppercase text-[var(--danger)]">
                               {locale === 'tr' ? 'Para birimi eksik' : 'Currency missing'}
                             </div>
                           )}
                           <div className="text-[10px] font-mono text-[var(--muted)]">
                             {v.responded_at ? new Date(v.responded_at).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US') : ''}
                           </div>
                         </>
                       ) : (
                         <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                           {locale === 'tr' ? 'Bekliyor' : 'Pending'}
                         </span>
                       )}
                       {isDraft && (
                         <div className="mt-1">
                           <RfqVendorRemoveButton
                             assignmentId={v.id}
                             vendorName={v.vendor_name}
                             locale={locale}
                           />
                         </div>
                       )}
                     </div>
                   </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
