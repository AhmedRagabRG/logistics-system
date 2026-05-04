"use client";

import { useState, useCallback } from 'react';

export function useBulkSelection<T extends string | number>(items: T[], maxSelect = 500) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelect) {
        next.add(id);
      }
      return next;
    });
  }, [maxSelect]);

  const toggleAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(items.slice(0, maxSelect)) : new Set());
  }, [items, maxSelect]);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback(
    (id: T) => selected.has(id),
    [selected]
  );

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && selected.size < items.length;
  const selectedIds = Array.from(selected);
  const isMaxed = selected.size >= maxSelect;

  return { selected, selectedIds, toggle, toggleAll, clear, isSelected, allSelected, someSelected, isMaxed, maxSelect };
}
