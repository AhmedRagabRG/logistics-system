import Link from 'next/link';
import StatusBadge from '@/components/ui/status-badge';
import { getDashboardLocale } from '@/lib/i18n-server';
import { t } from '@/lib/i18n-dashboard';
import { getAnalytics } from '@/lib/db-queries';

export default async function DashboardHomePage() {
  const locale = await getDashboardLocale();
  let analytics: Awaited<ReturnType<typeof getAnalytics>> | null = null;
  let error: string | null = null;

  try {
    analytics = await getAnalytics();
  } catch (e) {
    error = e instanceof Error ? e.message : t('unknown_error', locale);
  }

  const stats = analytics
    ? [
        { label: t('stat_total_requests', locale), value: analytics.summary.total_requests },
        { label: t('stat_total_quotes', locale), value: analytics.summary.total_quotes },
        { label: t('stat_pending_quotes', locale), value: analytics.summary.pending_quotes, warn: analytics.summary.pending_quotes > 0 },
        { label: t('stat_approved_quotes', locale), value: analytics.summary.approved_quotes },
        { label: t('stat_rejected_quotes', locale), value: analytics.summary.rejected_quotes },
        { label: t('stat_avg_response', locale), value: analytics.summary.avg_response_time_minutes ? Math.round(analytics.summary.avg_response_time_minutes) : '-' },
        { label: t('stat_approval_rate', locale), value: `${analytics.summary.approval_rate_percent}%` },
      ]
    : [];

  const kpiStats = analytics
    ? [
        { label: 'Revenue', value: `${analytics.summary.total_revenue.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} TRY`, accent: true },
        { label: 'Active Vendors', value: analytics.summary.active_vendors },
        { label: 'Open RFQs', value: analytics.summary.open_rfqs, warn: analytics.summary.open_rfqs > 0 },
        { label: 'Unmatched Replies', value: analytics.summary.unmatched_replies, warn: analytics.summary.unmatched_replies > 0 },
        { label: 'System Mode', value: analytics.summary.system_toggle.replace('_', ' ') },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{t('nav_home', locale)}</h1>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
          {new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
        </span>
      </div>

      {error && (
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
          {t('error_loading', locale)}: {error}
        </div>
      )}

      {analytics && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-5">
            {kpiStats.map((s) => (
              <div key={s.label} className="bg-[var(--surface)] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                  {s.label}
                </div>
                <div className={`mt-1 font-mono text-xl font-bold ${s.warn ? 'text-[var(--accent)]' : s.accent ? 'text-[var(--success)]' : 'text-[var(--foreground)]'}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4 lg:grid-cols-7">
            {stats.map((s) => (
              <div key={s.label} className="bg-[var(--surface)] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                  {s.label}
                </div>
                <div className={`mt-1 font-mono text-xl font-bold ${s.warn ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Coverage + RFQ + Vendor Stats */}
          <div className="grid grid-cols-1 gap-px border border-[var(--border)] bg-[var(--border)] lg:grid-cols-3">
            <div className="bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">Coverage Breakdown</h3>
              </div>
              <div className="px-3 py-2">
                {analytics.coverage_breakdown.length === 0 && (
                  <p className="text-xs text-[var(--muted)]">{t('no_data', locale)}</p>
                )}
                {analytics.coverage_breakdown.map((item) => (
                  <div key={item.type} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-medium text-[var(--secondary)]">{item.type}</span>
                    <span className="font-mono text-xs font-bold text-[var(--foreground)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">RFQ Status</h3>
              </div>
              <div className="px-3 py-2">
                {analytics.rfq_status_breakdown.length === 0 && (
                  <p className="text-xs text-[var(--muted)]">{t('no_data', locale)}</p>
                )}
                {analytics.rfq_status_breakdown.map((item) => (
                  <div key={item.status} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-medium uppercase text-[var(--secondary)]">{item.status}</span>
                    <span className="font-mono text-xs font-bold text-[var(--foreground)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">Vendor Response</h3>
              </div>
              <div className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--secondary)]">Total Assignments</span>
                  <span className="font-mono text-xs font-bold">{analytics.vendor_response_stats.total_assignments}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
                  <span className="text-xs text-[var(--secondary)]">Responded</span>
                  <span className="font-mono text-xs font-bold">{analytics.vendor_response_stats.responded_count}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
                  <span className="text-xs text-[var(--secondary)]">Response Rate</span>
                  <span className="font-mono text-xs font-bold">{analytics.vendor_response_stats.response_rate_percent}%</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--secondary)]">Avg Bid</span>
                  <span className="font-mono text-xs font-bold">{analytics.vendor_response_stats.avg_bid ? Math.round(analytics.vendor_response_stats.avg_bid).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US') : '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Channel & Language */}
          <div className="grid grid-cols-1 gap-px border border-[var(--border)] bg-[var(--border)] lg:grid-cols-2">
            <div className="bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">{t('channel_distribution', locale)}</h3>
              </div>
              <div className="px-3 py-2">
                {analytics.channel_distribution.length === 0 && (
                  <p className="text-xs text-[var(--muted)]">{t('no_data', locale)}</p>
                )}
                {analytics.channel_distribution.map((item) => (
                  <div key={item.channel} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-medium uppercase text-[var(--secondary)]">{item.channel}</span>
                    <span className="font-mono text-xs font-bold text-[var(--foreground)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">{t('language_distribution', locale)}</h3>
              </div>
              <div className="px-3 py-2">
                {analytics.language_distribution.length === 0 && (
                  <p className="text-xs text-[var(--muted)]">{t('no_data', locale)}</p>
                )}
                {analytics.language_distribution.map((item) => (
                  <div key={item.language} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-medium uppercase text-[var(--secondary)]">{item.language}</span>
                    <span className="font-mono text-xs font-bold text-[var(--foreground)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Routes */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-xs font-bold uppercase tracking-wider">Top Routes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th className="text-right">Quotes</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.top_routes.length === 0 && (
                    <tr><td colSpan={3} className="text-[var(--muted)]">{t('no_data', locale)}</td></tr>
                  )}
                  {analytics.top_routes.map((route) => (
                    <tr key={`${route.origin}-${route.destination}`}>
                      <td className="text-xs">{route.origin}</td>
                      <td className="text-xs">{route.destination}</td>
                      <td className="text-right font-mono text-xs font-bold">{route.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Pending Quotes */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider">Recent Pending Quotes</h3>
              <Link href="/quotes?status=pending" className="text-[10px] text-[var(--accent)] hover:underline">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Route</th>
                    <th>Customer</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recent_pending.length === 0 && (
                    <tr><td colSpan={5} className="text-[var(--muted)]">No pending quotes</td></tr>
                  )}
                  {analytics.recent_pending.map((q) => {
                    const ageHours = Math.round((Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60));
                    return (
                      <tr key={q.id}>
                        <td className="font-mono text-xs">
                          <Link href={`/quotes/${q.id}`} className="text-[var(--accent)] hover:underline">#{q.id}</Link>
                        </td>
                        <td className="text-xs">{q.origin_region} → {q.destination_region}</td>
                        <td className="text-xs">{q.customer_name || '—'}</td>
                        <td className="text-right font-mono text-xs">{q.final_price > 0 ? `${q.final_price.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${q.currency}` : 'Pending'}</td>
                        <td className="text-right font-mono text-xs">{ageHours}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Volume */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-xs font-bold uppercase tracking-wider">{t('daily_volume', locale)}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('date', locale)}</th>
                    <th className="text-right">{t('requests', locale)}</th>
                    <th className="text-right">{t('quotes', locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.daily_volume.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-[var(--muted)]">{t('no_data', locale)}</td>
                    </tr>
                  )}
                  {analytics.daily_volume.map((day) => (
                    <tr key={day.date}>
                      <td className="font-mono text-xs">{day.date}</td>
                      <td className="text-right font-mono text-xs">{day.requests}</td>
                      <td className="text-right font-mono text-xs">{day.quotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
            <Link href="/quotes" className="group bg-[var(--surface)] px-4 py-4 hover:bg-[var(--surface-hover)] transition-colors">
              <h3 className="text-sm font-bold uppercase tracking-wider">{t('nav_quotes', locale)}</h3>
              <p className="mt-1 text-xs text-[var(--secondary)]">{t('route_pricing_desc', locale)}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status="pending" label={t('status_pending', locale)} />
                <span className="font-mono text-xs text-[var(--muted)]">{analytics.summary.pending_quotes}</span>
              </div>
            </Link>
            <Link href="/rfqs" className="group bg-[var(--surface)] px-4 py-4 hover:bg-[var(--surface-hover)] transition-colors">
              <h3 className="text-sm font-bold uppercase tracking-wider">{t('nav_rfqs', locale)}</h3>
              <p className="mt-1 text-xs text-[var(--secondary)]">{t('vendors_desc', locale)}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status="pending" label="Open" />
                <span className="font-mono text-xs text-[var(--muted)]">{analytics.summary.open_rfqs}</span>
              </div>
            </Link>
            <Link href="/unmatched-replies" className="group bg-[var(--surface)] px-4 py-4 hover:bg-[var(--surface-hover)] transition-colors">
              <h3 className="text-sm font-bold uppercase tracking-wider">Unmatched</h3>
              <p className="mt-1 text-xs text-[var(--secondary)]">Vendor replies needing attention</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status="pending" label="New" />
                <span className="font-mono text-xs text-[var(--muted)]">{analytics.summary.unmatched_replies}</span>
              </div>
            </Link>
            <Link href="/master-data/pricing" className="group bg-[var(--surface)] px-4 py-4 hover:bg-[var(--surface-hover)] transition-colors">
              <h3 className="text-sm font-bold uppercase tracking-wider">{t('nav_pricing', locale)}</h3>
              <p className="mt-1 text-xs text-[var(--secondary)]">{t('route_pricing_desc', locale)}</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
