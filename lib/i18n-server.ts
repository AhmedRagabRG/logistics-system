import { cookies } from 'next/headers';
import { isValidLocale, DEFAULT_LOCALE, type DashboardLocale } from './i18n-dashboard';

const DASHBOARD_LANG_COOKIE = 'dashboard_lang';

export async function getDashboardLocale(): Promise<DashboardLocale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(DASHBOARD_LANG_COOKIE)?.value;
  if (value && isValidLocale(value)) return value;
  return DEFAULT_LOCALE;
}
