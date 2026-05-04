"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import VendorForm from '@/components/master-data/vendor-form';
import Pagination from '@/components/ui/pagination';
import ScrollableTable from '@/components/ui/scrollable-table';
import SearchInput from '@/components/ui/search-input';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDashboardT } from '@/lib/i18n-client';

interface Vendor {
  id: number;
  name: string;
  country_coverage: string;
  city: string | null;
  expertise_notes: string | null;
  priority_ranking: number;
  use_custom_margin: boolean;
  margin_rate: number;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_channels: string[] | null;
  is_active: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function VendorsPage() {
  const _t = useDashboardT();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/master-data?resource=vendors');
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || _t('error_loading'));
        return;
      }
      setVendors(data.data.vendors);
      setCurrentPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : _t('network_error'));
    } finally {
      setLoading(false);
    }
  }, [_t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVendors();
  }, [fetchVendors]);

  const filteredVendors = useMemo(() => {
    let result = vendors;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.country_coverage.toLowerCase().includes(q) ||
          (v.contact_email && v.contact_email.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((v) => (statusFilter === 'active' ? v.is_active : !v.is_active));
    }
    return result;
  }, [vendors, search, statusFilter]);

  const {
    selectedIds,
    toggle,
    toggleAll,
    clear,
    isSelected,
    allSelected,
    someSelected,
  } = useBulkSelection<number>(filteredVendors.map((v) => v.id));

  const totalPages = Math.ceil(filteredVendors.length / ITEMS_PER_PAGE);
  const paginatedVendors = filteredVendors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
    clear();
  }, [search, statusFilter, clear]);

  async function handleDelete(id: number) {
    if (!confirm(_t('vendor_delete_confirm'))) return;
    try {
      const res = await fetch(`/api/v1/master-data?resource=vendors&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      fetchVendors();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const message = _t('confirm_bulk_delete').replace('{count}', String(selectedIds.length));
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/v1/master-data?resource=vendors&ids=${selectedIds.join(',')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || _t('error_loading'));
        return;
      }
      clear();
      fetchVendors();
    } catch (e) {
      alert(e instanceof Error ? e.message : _t('network_error'));
    }
  }

  function handleEdit(vendor: Vendor) {
    setEditingVendor(vendor);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingVendor(null);
    setShowForm(true);
  }

  function handleFormSuccess() {
    setShowForm(false);
    setEditingVendor(null);
    fetchVendors();
  }

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight uppercase">{_t('vendors_title')}</h1>
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
            <h3 className="text-xs font-bold uppercase tracking-wider">{editingVendor ? _t('vendors_edit') : _t('vendors_new')}</h3>
          </div>
          <div className="panel-body">
            <VendorForm initialData={editingVendor ?? undefined} onSuccess={handleFormSuccess} />
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
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-3.5 w-3.5 border-[var(--border-strong)]"
                    />
                  </th>
                  <th>{_t('vendor_name')}</th>
                  <th>{_t('vendor_origin')}</th>
                  <th>{_t('vendor_notes')}</th>
                  <th>{_t('vendor_email')} / {_t('vendor_phone')}</th>
                  <th>{_t('vendor_preferred_channels')}</th>
                  <th className="text-right">{_t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(vendor.id)}
                        onChange={() => toggle(vendor.id)}
                        className="h-3.5 w-3.5 border-[var(--border-strong)]"
                      />
                    </td>
                    <td className="font-medium">{vendor.name}</td>
                    <td>
                      {vendor.city ? `${vendor.country_coverage} (${vendor.city})` : vendor.country_coverage}
                    </td>
                    <td className="max-w-xs truncate text-[var(--secondary)]">{vendor.expertise_notes}</td>
                    <td className="text-[var(--secondary)]">
                      {vendor.contact_email && <div className="font-mono text-xs">{vendor.contact_email}</div>}
                      {vendor.contact_phone && <div className="font-mono text-xs">{vendor.contact_phone}</div>}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {vendor.preferred_channels?.map((ch) => (
                          <span key={ch} className="inline-block px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-[var(--border-strong)] bg-[var(--background)] text-[var(--secondary)]">
                            {ch === 'email' ? _t('channel_email') : ch === 'whatsapp' ? _t('channel_whatsapp') : ch}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleEdit(vendor)} className="btn btn-ghost text-xs mr-1">{_t('edit')}</button>
                      <button onClick={() => handleDelete(vendor.id)} className="btn btn-ghost text-xs text-[var(--danger)]">{_t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginatedVendors.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted)]">{_t('no_data')}</div>
            )}
          </ScrollableTable>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={filteredVendors.length}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
