"use client";

import { useContext, createContext, useCallback } from 'react';
import { type DashboardLocale, t } from './i18n-dashboard';

const LocaleContext = createContext<DashboardLocale>('tr');

export const DashboardLocaleProvider = LocaleContext.Provider;

export function useDashboardLocaleContext(): DashboardLocale {
  return useContext(LocaleContext);
}

export function useDashboardT() {
  const locale = useDashboardLocaleContext();
  return useCallback((key: Parameters<typeof t>[0]) => t(key, locale), [locale]);
}
