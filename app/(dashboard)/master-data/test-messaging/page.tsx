"use client";

import { useState } from 'react';
import { useDashboardT } from '@/lib/i18n-client';

export default function TestMessagingPage() {
  const _t = useDashboardT();
  const [channel, setChannel] = useState<'telegram' | 'whatsapp' | 'email'>('telegram');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient.trim() || !message.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/v1/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, recipient: recipient.trim(), message: message.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({ success: true, text: `${_t('test_messaging_success')}: ${data.data?.messageId || 'OK'}` });
      } else {
        setResult({ success: false, text: data.error?.message || _t('test_messaging_failed') });
      }
    } catch (e) {
      setResult({ success: false, text: e instanceof Error ? e.message : _t('test_messaging_failed') });
    } finally {
      setLoading(false);
    }
  }

  const placeholderRecipient =
    channel === 'telegram' ? '123456789' :
    channel === 'whatsapp' ? '+905551234567' :
    'test@example.com';

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('test_messaging_title')}</h1>
      </div>

      <div className="panel">
        <div className="panel-body">
          <form onSubmit={handleSubmit} className="space-y-3 max-w-lg">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('test_messaging_channel')}</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as 'telegram' | 'whatsapp' | 'email')} className="w-full text-xs">
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('test_messaging_recipient')}</label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={placeholderRecipient}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('test_messaging_message')}</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Test message..."
                className="w-full text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn btn-primary text-xs disabled:opacity-50">
                {loading ? '...' : _t('test_messaging_send')}
              </button>
            </div>
          </form>

          {result && (
            <div className={`mt-4 border px-3 py-2 text-xs ${result.success ? 'border-[var(--success)] bg-[var(--success)]/5 text-[var(--success)]' : 'border-[var(--danger)] bg-[var(--danger)]/5 text-[var(--danger)]'}`}>
              <strong>{_t('test_messaging_result')}:</strong> {result.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
