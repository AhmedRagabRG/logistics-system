'use client';

import { useState } from 'react';
import EditableField from './editable-field';
import { useDashboardT } from '@/lib/i18n-client';

interface QuoteDetailFieldsProps {
  quote: {
    id: number;
    origin_region: string;
    destination_region: string;
    origin_postal_code: string | null;
    destination_postal_code: string | null;
    weight_kg: number | null;
    cargo_type: string | null;
    base_price: number;
    markup_percent: number;
    final_price: number;
    currency: string;
    status: string;
    toggle_state_at_creation: string;
    is_oversize: boolean;
    review_reason: string | null;
    response_text: string | null;
    approved_by: number | null;
    approver_name: string | null;
    approved_at: string | null;
    created_at: string;
    language: string;
    channel: string;
    customer_name: string | null;
    customer_contact: string | null;
    raw_message: string | null;
  };
  locale: string;
}

export default function QuoteDetailFields({ quote: initialQuote, locale }: QuoteDetailFieldsProps) {
  const _t = useDashboardT();
  const [quote, setQuote] = useState(initialQuote);
  const fmt = (n: number) => n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 });

  const handleUpdate = (field: string, newValue: string | number | null) => {
    setQuote((prev) => ({ ...prev, [field]: newValue }));
  };

  return (
    <div className="panel-body">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {quote.customer_name && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{_t('customer')}</div>
            <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">{quote.customer_name}</div>
            {quote.customer_contact && (
              <div className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">{quote.customer_contact}</div>
            )}
          </div>
        )}

        <EditableField
          label={_t('origin_region')}
          value={quote.origin_region}
          field="origin_region"
          quoteId={quote.id}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('destination_region')}
          value={quote.destination_region}
          field="destination_region"
          quoteId={quote.id}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('origin_postal_code') || 'Origin Postal'}
          value={quote.origin_postal_code}
          field="origin_postal_code"
          quoteId={quote.id}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('destination_postal_code') || 'Destination Postal'}
          value={quote.destination_postal_code}
          field="destination_postal_code"
          quoteId={quote.id}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('weight')}
          value={quote.weight_kg}
          field="weight_kg"
          quoteId={quote.id}
          type="number"
          displayValue={quote.weight_kg !== null ? `${quote.weight_kg.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} ${_t('unit_kg')}` : '—'}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('cargo_type') || 'Cargo Type'}
          value={quote.cargo_type}
          field="cargo_type"
          quoteId={quote.id}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('base_price')}
          value={quote.base_price}
          field="base_price"
          quoteId={quote.id}
          type="number"
          displayValue={quote.base_price > 0 ? `${fmt(quote.base_price)} ${quote.currency}` : _t('na')}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('markup')}
          value={quote.markup_percent}
          field="markup_percent"
          quoteId={quote.id}
          type="number"
          displayValue={quote.markup_percent > 0 ? `%${quote.markup_percent}` : _t('na')}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('final_price')}
          value={quote.final_price}
          field="final_price"
          quoteId={quote.id}
          type="number"
          displayValue={quote.final_price > 0 ? `${fmt(quote.final_price)} ${quote.currency}` : _t('price_pending')}
          onUpdate={handleUpdate}
        />
        <EditableField
          label={_t('currency') || 'Currency'}
          value={quote.currency}
          field="currency"
          quoteId={quote.id}
          onUpdate={handleUpdate}
        />

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{_t('language_label')}</div>
          <div className="mt-0.5 text-sm font-bold uppercase text-[var(--foreground)]">{quote.language}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{_t('channel_label')}</div>
          <div className="mt-0.5 text-sm font-bold capitalize text-[var(--foreground)]">{quote.channel}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{_t('toggle_state')}</div>
          <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">
            {_t(`settings_mode_${quote.toggle_state_at_creation}` as 'settings_mode_manual')}
          </div>
        </div>
        {quote.approved_by && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{_t('processed_by')}</div>
            <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">
              {quote.approver_name || `${_t('admin')} #${quote.approved_by}`}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <EditableField
          label={_t('review_reason')}
          value={quote.review_reason}
          field="review_reason"
          quoteId={quote.id}
          type="textarea"
          onUpdate={handleUpdate}
        />
      </div>

      <div className="mt-4">
        <EditableField
          label={_t('response_text')}
          value={quote.response_text}
          field="response_text"
          quoteId={quote.id}
          type="textarea"
          onUpdate={handleUpdate}
        />
      </div>

      {quote.raw_message && (
        <div className="mt-4 border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{_t('original_message') || 'Original Message'}</div>
          <div className="mt-1 whitespace-pre-wrap text-xs font-mono text-[var(--foreground)]">{quote.raw_message}</div>
        </div>
      )}
    </div>
  );
}
