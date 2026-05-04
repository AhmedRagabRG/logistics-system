"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Pagination from '@/components/ui/pagination';
import ScrollableTable from '@/components/ui/scrollable-table';
import SearchInput from '@/components/ui/search-input';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDashboardT } from '@/lib/i18n-client';

interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

const ITEMS_PER_PAGE = 20;

export default function ExchangeRatesPage() {
  const _t = useDashboardT();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    from_currency: '',
    to_currency: '',
    rate: 0,
    effective_date: new Date().toISOString().split('T')[0],
  });

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/master-data?resource=rates');
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setRates(data.data.rates);
      setCurrentPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [_t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRates();
  }, [fetchRates]);

  const filteredRates = useMemo(() => {
    if (!search.trim()) return rates;
    const q = search.toLowerCase();
    return rates.filter((r) =>
      r.from_currency.toLowerCase().includes(q) ||
      r.to_currency.toLowerCase().includes(q) ||
      r.effective_date.includes(q)
    );
  }, [rates, search]);

  const { selectedIds, toggle, toggleAll, clear, isSelected, allSelected, someSelected } = useBulkSelection<number>(filteredRates.map((r) => r.id));

  const totalPages = Math.ceil(filteredRates.length / ITEMS_PER_PAGE);
  const paginatedRates = filteredRates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
    clear();
  }, [search, clear]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingRate
      ? `/api/v1/master-data?resource=rates&id=${editingRate.id}`
      : '/api/v1/master-data?resource=rates';
    const method = editingRate ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      setShowForm(false);
      setEditingRate(null);
      setForm({ from_currency: '', to_currency: '', rate: 0, effective_date: new Date().toISOString().split('T')[0] });
      fetchRates();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(_t('vendor_delete_confirm'))) return;
    try {
      const res = await fetch(`/api/v1/master-data?resource=rates&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      fetchRates();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const message = _t('confirm_bulk_delete').replace('{count}', String(selectedIds.length));
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/v1/master-data?resource=rates&ids=${selectedIds.join(',')}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      clear();
      fetchRates();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  function handleEdit(rate: ExchangeRate) {
    setEditingRate(rate);
    setForm({
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      rate: rate.rate,
      effective_date: rate.effective_date,
    });
    setShowForm(true);
  }

  function handleCreate() {
    setEditingRate(null);
    setForm({ from_currency: '', to_currency: '', rate: 0, effective_date: new Date().toISOString().split('T')[0] });
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('exchange_rates_title')}</h1>
        <button onClick={handleCreate} className="btn btn-primary text-xs">
          {_t('vendors_add')}
        </button>
      </div>

      {error && (
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>
      )}

      {showForm && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-xs font-bold uppercase tracking-wider">{editingRate ? _t('vendors_edit') : _t('vendors_new')}</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_from')}</label>
                <input type="text" maxLength={3} required value={form.from_currency} onChange={(e) => setForm({ ...form, from_currency: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_to')}</label>
                <input type="text" maxLength={3} required value={form.to_currency} onChange={(e) => setForm({ ...form, to_currency: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_rate')}</label>
                <input type="number" step="0.000001" min="0" required value={form.rate} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_effective_date')}</label>
                <input type="date" required value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="btn btn-primary text-xs">
                  {editingRate ? _t('vendor_update') : _t('vendor_save')}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-xs">
                  {_t('vendor_cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <SearchInput value={search} onChange={setSearch} placeholder={_t('search_placeholder')} />
            </div>
            {selectedIds.length > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-danger text-xs">
                {_t('delete_selected')} ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-[var(--muted)] font-mono uppercase tracking-widest">{_t('loading')}</div>
      ) : (
        <>
          <ScrollableTable>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-3.5 w-3.5 border-[var(--border-strong)]"
                    />
                  </th>
                  <th>{_t('label_from')} → {_t('label_to')}</th>
                  <th className="text-right">{_t('label_rate')}</th>
                  <th>{_t('label_effective')}</th>
                  <th className="text-right">{_t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRates.map((rate) => (
                  <tr key={rate.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(rate.id)}
                        onChange={() => toggle(rate.id)}
                        className="h-3.5 w-3.5 border-[var(--border-strong)]"
                      />
                    </td>
                    <td className="font-mono text-xs font-bold">{rate.from_currency} → {rate.to_currency}</td>
                    <td className="text-right font-mono text-xs">{rate.rate}</td>
                    <td className="font-mono text-xs">{rate.effective_date}</td>
                    <td className="text-right">
                      <button onClick={() => handleEdit(rate)} className="btn btn-ghost text-xs mr-1">{_t('edit')}</button>
                      <button onClick={() => handleDelete(rate.id)} className="btn btn-ghost text-xs text-[var(--danger)]">{_t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginatedRates.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted)]">{_t('no_data')}</div>
            )}
          </ScrollableTable>

          <Pagination currentPage={currentPage} totalPages={totalPages} totalRecords={filteredRates.length} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  );
}
