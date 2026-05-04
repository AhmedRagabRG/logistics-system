"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDashboardT } from '@/lib/i18n-client';

interface QuoteFiltersProps {
  status?: string;
  channel?: string;
  language?: string;
}

export default function QuoteFilters({ status, channel, language }: QuoteFiltersProps) {
  const router = useRouter();
  const _t = useDashboardT();

  function buildLink(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    const current = { status: status || '', channel: channel || '', language: language || '' };
    Object.entries({ ...current, ...overrides }).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    return `/quotes?${next.toString()}`;
  }

  function handleSelectChange(key: string, value: string) {
    router.push(buildLink({ [key]: value }));
  }

  const statuses = [
    { value: '', label: _t('filter_all') },
    { value: 'pending', label: _t('status_pending') },
    { value: 'approved', label: _t('status_approved') },
    { value: 'rejected', label: _t('status_rejected') },
    { value: 'ready_to_send', label: _t('status_ready') },
  ];

  const channels = [
    { value: '', label: _t('filter_all') },
    { value: 'whatsapp', label: _t('channel_whatsapp') },
    { value: 'telegram', label: _t('channel_telegram') },
    { value: 'email', label: _t('channel_email') },
  ];

  const languages = [
    { value: '', label: _t('filter_all') },
    { value: 'ar', label: _t('language_arabic') },
    { value: 'tr', label: _t('language_turkish') },
    { value: 'en', label: _t('language_english') },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">{_t('filter_status')}:</span>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <Link
              key={s.value}
              href={buildLink({ status: s.value })}
              className={`rounded-md px-3 py-1 text-sm ${status === s.value || (!status && !s.value) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">{_t('filter_channel')}:</span>
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700"
          onChange={(e) => handleSelectChange('channel', e.target.value)}
          value={channel || ''}
        >
          {channels.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">{_t('filter_language')}:</span>
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700"
          onChange={(e) => handleSelectChange('language', e.target.value)}
          value={language || ''}
        >
          {languages.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
