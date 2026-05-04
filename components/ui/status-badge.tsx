interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: 'dot' | 'pill';
}

const statusStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active:       { bg: 'bg-[var(--success)]/10', text: 'text-[var(--success)]', border: 'border-[var(--success)]/30', dot: 'bg-[var(--success)]' },
  inactive:     { bg: 'bg-[var(--muted)]/10',   text: 'text-[var(--muted)]',   border: 'border-[var(--muted)]/30',   dot: 'bg-[var(--muted)]' },
  pending:      { bg: 'bg-[var(--warning)]/10',  text: 'text-[var(--warning)]',  border: 'border-[var(--warning)]/30',  dot: 'bg-[var(--warning)]' },
  error:        { bg: 'bg-[var(--danger)]/10',   text: 'text-[var(--danger)]',   border: 'border-[var(--danger)]/30',   dot: 'bg-[var(--danger)]' },
  approved:     { bg: 'bg-[var(--success)]/10',  text: 'text-[var(--success)]',  border: 'border-[var(--success)]/30',  dot: 'bg-[var(--success)]' },
  rejected:     { bg: 'bg-[var(--danger)]/10',   text: 'text-[var(--danger)]',   border: 'border-[var(--danger)]/30',   dot: 'bg-[var(--danger)]' },
  ready_to_send:{ bg: 'bg-[var(--info)]/10',     text: 'text-[var(--info)]',     border: 'border-[var(--info)]/30',     dot: 'bg-[var(--info)]' },
  sent:         { bg: 'bg-[var(--success)]/10',  text: 'text-[var(--success)]',  border: 'border-[var(--success)]/30',  dot: 'bg-[var(--success)]' },
  open:         { bg: 'bg-[var(--info)]/10',     text: 'text-[var(--info)]',     border: 'border-[var(--info)]/30',     dot: 'bg-[var(--info)]' },
  responded:    { bg: 'bg-[var(--success)]/10',  text: 'text-[var(--success)]',  border: 'border-[var(--success)]/30',  dot: 'bg-[var(--success)]' },
  closed:       { bg: 'bg-[var(--muted)]/10',    text: 'text-[var(--muted)]',    border: 'border-[var(--muted)]/30',    dot: 'bg-[var(--muted)]' },
};

export default function StatusBadge({ status, label, variant = 'pill' }: StatusBadgeProps) {
  const style = statusStyles[status] ?? statusStyles.inactive;
  const displayLabel = label ?? status.replace(/_/g, ' ');

  if (variant === 'dot') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
        <span className={`inline-block h-1.5 w-1.5 ${style.dot}`} />
        <span className="uppercase tracking-wider">{displayLabel}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`inline-block h-1.5 w-1.5 ${style.dot}`} />
      {displayLabel}
    </span>
  );
}
