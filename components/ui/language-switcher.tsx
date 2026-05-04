"use client";

import { useDashboardLocaleContext, useDashboardT } from '@/lib/i18n-client';
import { supportedLocales, type DashboardLocale } from '@/lib/i18n-dashboard';

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function LanguageSwitcher() {
  const locale = useDashboardLocaleContext();
  const _t = useDashboardT();

  function handleChange(next: DashboardLocale) {
    if (next === locale) return;
    setCookie('dashboard_lang', next);
    window.location.reload();
  }

  return (
    <div className="flex items-center border border-[var(--border-strong)]">
      {supportedLocales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase transition-colors ${
            locale === loc
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface)] text-[var(--secondary)] hover:text-[var(--foreground)]'
          }`}
          aria-label={_t('aria_switch_language')}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
