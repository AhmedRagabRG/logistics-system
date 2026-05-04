import LoginForm from '@/components/auth/login-form';
import { redirect } from 'next/navigation';
import { getSessionFromCookie, validateSession } from '@/lib/session';
import { getDashboardLocale } from '@/lib/i18n-server';
import { t } from '@/lib/i18n-dashboard';

export default async function LoginPage() {
  const token = await getSessionFromCookie();
  if (token) {
    const session = await validateSession(token);
    if (session.valid) {
      redirect('/');
    }
  }

  const locale = await getDashboardLocale();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm space-y-6 border border-[var(--border-strong)] bg-[var(--surface)] p-8">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight uppercase text-[var(--foreground)]">{t('app_title', locale)}</h1>
          <div className="mt-2 h-px w-12 bg-[var(--accent)] mx-auto" />
          <p className="mt-3 text-xs text-[var(--secondary)] uppercase tracking-widest">{t('login_subtitle', locale)}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
