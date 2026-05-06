"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Pagination from '@/components/ui/pagination';
import ScrollableTable from '@/components/ui/scrollable-table';
import SearchInput from '@/components/ui/search-input';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDashboardT } from '@/lib/i18n-client';

interface Country {
  id: number;
  code: string;
  name_en: string;
  name_tr: string;
  is_active: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function CountriesPage() {
  const _t = useDashboardT();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [form, setForm] = useState({
    code: '',
    name_en: '',
    name_tr: '',
    is_active: true,
  });

  const fetchCountries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/countries?active=false');
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setCountries(data.data);
      setCurrentPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [_t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCountries();
  }, [fetchCountries]);

  const filteredCountries = useMemo(() => {
    let result = countries;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name_en.toLowerCase().includes(q) ||
          c.name_tr.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((c) => (statusFilter === 'active' ? c.is_active : !c.is_active));
    }
    return result;
  }, [countries, search, statusFilter]);

  const { selectedIds, toggle, toggleAll, clear, isSelected, allSelected, someSelected } = useBulkSelection<number>(filteredCountries.map((c) => c.id));

  const totalPages = Math.ceil(filteredCountries.length / ITEMS_PER_PAGE);
  const paginatedCountries = filteredCountries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
    clear();
  }, [search, statusFilter, clear]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingCountry
      ? `/api/v1/countries?id=${editingCountry.id}`
      : '/api/v1/countries';
    const method = editingCountry ? 'PATCH' : 'POST';

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
      setEditingCountry(null);
      setForm({ code: '', name_en: '', name_tr: '', is_active: true });
      fetchCountries();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(_t('vendor_delete_confirm'))) return;
    try {
      const res = await fetch(`/api/v1/countries?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      fetchCountries();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const message = _t('confirm_bulk_delete').replace('{count}', String(selectedIds.length));
    if (!confirm(message)) return;
    try {
      // Delete one by one since bulk delete isn't implemented in the API
      for (const id of selectedIds) {
        await fetch(`/api/v1/countries?id=${id}`, { method: 'DELETE' });
      }
      clear();
      fetchCountries();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  function handleEdit(country: Country) {
    setEditingCountry(country);
    setForm({
      code: country.code,
      name_en: country.name_en,
      name_tr: country.name_tr,
      is_active: country.is_active,
    });
    setShowForm(true);
  }

  function handleCreate() {
    setEditingCountry(null);
    setForm({ code: '', name_en: '', name_tr: '', is_active: true });
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('countries_title')}</h1>
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
            <h3 className="text-xs font-bold uppercase tracking-wider">{editingCountry ? _t('vendors_edit') : _t('vendors_new')}</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_code')}</label>
                <input type="text" maxLength={2} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_active')}</label>
                <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                  <option value="true">{_t('active')}</option>
                  <option value="false">{_t('inactive')}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_name_en')}</label>
                <input type="text" required value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{_t('label_name_tr')}</label>
                <input type="text" required value={form.name_tr} onChange={(e) => setForm({ ...form, name_tr: e.target.value })} />
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="btn btn-primary text-xs">
                  {editingCountry ? _t('vendor_update') : _t('vendor_save')}
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
            <div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} className="text-xs">
                <option value="all">{_t('all_status')}</option>
                <option value="active">{_t('active')}</option>
                <option value="inactive">{_t('inactive')}</option>
              </select>
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
                  <th className="w-16">{_t('label_code')}</th>
                  <th>{_t('label_name_en')}</th>
                  <th>{_t('label_name_tr')}</th>
                  <th className="w-20">{_t('label_active')}</th>
                  <th className="text-right">{_t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCountries.map((country) => (
                  <tr key={country.id} className={!country.is_active ? 'opacity-50' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(country.id)}
                        onChange={() => toggle(country.id)}
                        className="h-3.5 w-3.5 border-[var(--border-strong)]"
                      />
                    </td>
                    <td className="font-mono text-xs font-bold">{country.code}</td>
                    <td className="text-xs">{country.name_en}</td>
                    <td className="text-xs">{country.name_tr}</td>
                    <td>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${country.is_active ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--muted)]/10 text-[var(--muted)]'}`}>
                        {country.is_active ? _t('yes') : _t('no')}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleEdit(country)} className="btn btn-ghost text-xs mr-1">{_t('edit')}</button>
                      <button onClick={() => handleDelete(country.id)} className="btn btn-ghost text-xs text-[var(--danger)]">{_t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginatedCountries.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted)]">{_t('no_data')}</div>
            )}
          </ScrollableTable>

          <Pagination currentPage={currentPage} totalPages={totalPages} totalRecords={filteredCountries.length} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  );
}
