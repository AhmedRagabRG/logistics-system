"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import PricingForm from '@/components/master-data/pricing-form';
import Pagination from '@/components/ui/pagination';
import ScrollableTable from '@/components/ui/scrollable-table';
import SearchInput from '@/components/ui/search-input';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDashboardT } from '@/lib/i18n-client';

interface Pricing {
  id: number;
  origin_region: string;
  destination_region: string;
  base_price: number;
  markup_percent: number;
  currency: string;
  is_sea_active: boolean;
  sea_base_price: number;
  sea_markup_percent: number;
  sea_currency: string;
  is_active: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function PricingPage() {
  const _t = useDashboardT();
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPricing, setEditingPricing] = useState<Pricing | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [seaFilter, setSeaFilter] = useState<'all' | 'with_sea' | 'road_only'>('all');

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/master-data?resource=pricing');
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setPricing(data.data.pricing);
      setCurrentPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [_t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPricing();
  }, [fetchPricing]);

  const currencies = useMemo(() => {
    const set = new Set(pricing.map((p) => p.currency));
    return Array.from(set).sort();
  }, [pricing]);

  const filteredPricing = useMemo(() => {
    let result = pricing;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.origin_region.toLowerCase().includes(q) ||
        p.destination_region.toLowerCase().includes(q) ||
        p.currency.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((p) => (statusFilter === 'active' ? p.is_active : !p.is_active));
    }
    if (currencyFilter !== 'all') {
      result = result.filter((p) => p.currency === currencyFilter);
    }
    if (seaFilter === 'with_sea') {
      result = result.filter((p) => p.is_sea_active);
    } else if (seaFilter === 'road_only') {
      result = result.filter((p) => !p.is_sea_active);
    }
    return result;
  }, [pricing, search, statusFilter, currencyFilter, seaFilter]);

  const { selectedIds, toggle, toggleAll, clear, isSelected, allSelected, someSelected } = useBulkSelection<number>(filteredPricing.map((p) => p.id));

  const totalPages = Math.ceil(filteredPricing.length / ITEMS_PER_PAGE);
  const paginatedPricing = filteredPricing.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
    clear();
  }, [search, statusFilter, currencyFilter, seaFilter, clear]);

  async function handleDelete(id: number) {
    if (!confirm(_t('vendor_delete_confirm'))) return;
    try {
      const res = await fetch(`/api/v1/master-data?resource=pricing&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      fetchPricing();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const message = _t('confirm_bulk_delete').replace('{count}', String(selectedIds.length));
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/v1/master-data?resource=pricing&ids=${selectedIds.join(',')}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      clear();
      fetchPricing();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  function handleEdit(p: Pricing) {
    setEditingPricing(p);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingPricing(null);
    setShowForm(true);
  }

  function handleFormSuccess() {
    setShowForm(false);
    setEditingPricing(null);
    fetchPricing();
  }

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('pricing_title')}</h1>
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
            <h3 className="text-xs font-bold uppercase tracking-wider">{editingPricing ? _t('vendors_edit') : _t('vendors_new')}</h3>
          </div>
          <div className="panel-body">
            <PricingForm initialData={editingPricing ?? undefined} onSuccess={handleFormSuccess} />
            <button onClick={() => setShowForm(false)} className="btn btn-ghost mt-3 text-xs">
              {_t('vendor_cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <SearchInput value={search} onChange={setSearch} placeholder={_t('search_placeholder')} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">{_t('filter_all')}</option>
              <option value="active">{_t('filter_active')}</option>
              <option value="inactive">{_t('filter_inactive')}</option>
            </select>
            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
              <option value="all">{_t('filter_currency')}</option>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={seaFilter} onChange={(e) => setSeaFilter(e.target.value as 'all' | 'with_sea' | 'road_only')}>
              <option value="all">{_t('all_status')}</option>
              <option value="with_sea">{_t('sea_transport')}</option>
              <option value="road_only">{_t('road_transport')}</option>
            </select>
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
                  <th>{_t('label_origin')}</th>
                  <th>{_t('label_destination')}</th>
                  <th className="text-right">{_t('label_price')}</th>
                  <th>{_t('label_currency')}</th>
                  <th className="text-right">{_t('sea_transport')}</th>
                  <th>{_t('label_status')}</th>
                  <th className="text-right">{_t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPricing.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-3.5 w-3.5 border-[var(--border-strong)]"
                      />
                    </td>
                    <td className="font-medium">{p.origin_region}</td>
                    <td>{p.destination_region}</td>
                    <td className="text-right font-mono">{p.base_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="font-mono text-xs">{p.currency}</td>
                    <td className="text-right">
                      {p.is_sea_active ? (
                        <span className="inline-block border border-[var(--info)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--info)]">
                          {p.sea_base_price.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.sea_currency}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.is_active ? 'border-[var(--success)] text-[var(--success)]' : 'border-[var(--muted)] text-[var(--muted)]'}`}>
                        {p.is_active ? _t('status_active') : _t('status_inactive')}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleEdit(p)} className="btn btn-ghost text-xs mr-1">{_t('edit')}</button>
                      <button onClick={() => handleDelete(p.id)} className="btn btn-ghost text-xs text-[var(--danger)]">{_t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginatedPricing.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted)]">{_t('no_data')}</div>
            )}
          </ScrollableTable>

          <Pagination currentPage={currentPage} totalPages={totalPages} totalRecords={filteredPricing.length} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  );
}
