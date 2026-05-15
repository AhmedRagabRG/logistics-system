import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionFromCookie, validateSession, refreshSessionActivity } from '@/lib/session';
import { getDashboardLocale } from '@/lib/i18n-server';
import { t } from '@/lib/i18n-dashboard';
import { DashboardLocaleProvider } from '@/lib/i18n-client';
import LogoutButton from '@/components/auth/logout-button';
import LanguageSwitcher from '@/components/ui/language-switcher';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = await getSessionFromCookie();
  if (!token) redirect('/login');
  const session = await validateSession(token);
  if (!session.valid) redirect('/login');
  await refreshSessionActivity(token);
  const locale = await getDashboardLocale();

  const navGroups = [
    {
      label: t('nav_operations', locale),
      links: [
        { href: '/', label: t('nav_home', locale) },
        { href: '/quotes', label: t('nav_quotes', locale) },
        { href: '/rfqs', label: t('nav_rfqs', locale) },
        { href: '/unmatched-replies', label: t('nav_unmatched_replies', locale) },
        { href: '/history', label: t('nav_history', locale) },
      ],
    },
    {
      label: t('nav_master_data', locale),
      links: [
        { href: '/master-data/vendors', label: t('nav_vendors', locale) },
        { href: '/master-data/pricing', label: t('nav_pricing', locale) },
        { href: '/master-data/countries', label: t('nav_countries', locale) },
        { href: '/master-data/settings', label: t('nav_settings', locale) },
        { href: '/master-data/admins', label: t('nav_admins', locale) },
        { href: '/master-data/import', label: t('nav_import', locale) },
        { href: '/master-data/test-messaging', label: t('nav_test_messaging', locale) },
      ],
    },
  ];

  return (
    <DashboardLocaleProvider value={locale}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar — fixed, never scrolls */}
        <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col h-full">
          <div className="px-4 py-4 border-b border-[var(--border)]">
            <h1 className="text-sm font-bold tracking-tight text-[var(--foreground)] uppercase">
              {t('app_title', locale)}
            </h1>
            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
              {locale.toUpperCase()}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto py-3">
            {navGroups.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                  {group.label}
                </div>
                <div className="mt-0.5">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="nav-link"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--secondary)]">
                {session.admin?.display_name || session.admin?.username}
              </span>
              <LanguageSwitcher />
            </div>
            <LogoutButton />
          </div>
        </aside>

        {/* Main — scrolls independently */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto">
          <div className="w-full px-5 py-5">{children}</div>
        </main>
      </div>
    </DashboardLocaleProvider>
  );
}
