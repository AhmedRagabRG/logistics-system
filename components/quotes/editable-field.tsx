'use client';

import { useState } from 'react';

interface EditableFieldProps {
  label: string;
  value: string | number | null;
  field: string;
  quoteId: number;
  type?: 'text' | 'number' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  displayValue?: string;
  onUpdate?: (field: string, newValue: string | number | null) => void;
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function EditableField({
  label,
  value,
  field,
  quoteId,
  type = 'text',
  options,
  displayValue,
  onUpdate,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(value !== null && value !== undefined ? String(value) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    let parsedValue: string | number | null = editValue;
    if (type === 'number') {
      parsedValue = editValue.trim() === '' ? null : parseFloat(editValue);
      if (editValue.trim() !== '' && isNaN(parsedValue as number)) {
        setError('Invalid number');
        setLoading(false);
        return;
      }
    } else if (type === 'text' || type === 'textarea' || type === 'select') {
      parsedValue = editValue.trim() === '' ? null : editValue.trim();
    }

    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: parsedValue }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Update failed');
        return;
      }
      setIsEditing(false);
      if (onUpdate) onUpdate(field, parsedValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value !== null && value !== undefined ? String(value) : '');
    setIsEditing(false);
    setError(null);
  };

  const showValue = displayValue ?? (value !== null && value !== undefined ? String(value) : '—');

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
            title="Edit"
          >
            <PencilIcon />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-1">
          {type === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
              className="w-full text-xs"
              disabled={loading}
            />
          ) : type === 'select' && options ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full text-xs"
              disabled={loading}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={type === 'number' ? 'number' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full text-xs"
              disabled={loading}
              step={type === 'number' ? '0.01' : undefined}
            />
          )}
          {error && <div className="mt-1 text-[10px] text-[var(--danger)]">{error}</div>}
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded bg-[var(--success)]/10 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--success)] hover:bg-[var(--success)]/20 disabled:opacity-50"
            >
              <CheckIcon /> Save
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded bg-[var(--muted)]/10 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--muted)] hover:bg-[var(--muted)]/20 disabled:opacity-50"
            >
              <XIcon /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-0.5 text-sm font-bold text-[var(--foreground)]">{showValue}</div>
      )}
    </div>
  );
}
