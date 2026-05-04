'use client';

import { useEffect } from 'react';

interface AutoRefreshProps {
  enabled: boolean;
  interval?: number; // milliseconds
}

export default function AutoRefresh({ enabled, interval = 30000 }: AutoRefreshProps) {
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      window.location.reload();
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, interval]);

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--muted)]">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
      </span>
      Auto-refreshing every {interval / 1000}s
    </div>
  );
}
