'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Country {
  id: number;
  code: string;
  name_en: string;
  name_tr: string;
  is_active: boolean;
}

export function useCountries(locale: string = 'en') {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/countries?active=true');
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Failed to fetch countries');
        return;
      }
      setCountries(data.data);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const getCountryName = useCallback(
    (country: Country) => {
      return locale === 'tr' ? country.name_tr : country.name_en;
    },
    [locale]
  );

  return { countries, loading, error, refresh: fetchCountries, getCountryName };
}
