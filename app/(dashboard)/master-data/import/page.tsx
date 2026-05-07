"use client";

import { useState, useCallback } from 'react';
import { useDashboardT } from '@/lib/i18n-client';
import * as xlsx from 'xlsx';

type ImportType = 'postal_codes' | 'route_pricing' | 'vendors';

interface ColumnDef {
  key: string;
  label: string | null;
  required: boolean;
  alternatives?: string[];
}

const REQUIREMENTS: Record<
  ImportType,
  {
    sheetNote: string;
    columns: ColumnDef[];
    example: Record<string, string>;
  }
> = {
  postal_codes: {
    sheetNote:
      'Any sheet name containing "Avrupa", or the first sheet if not found. Column headers must match exactly (Turkish or English aliases accepted).',
    columns: [
      { key: 'ISO', label: 'Country Code', required: true, alternatives: ['iso'] },
      {
        key: 'Posta Kodu İlk 2 / Prefix',
        label: 'Postal Prefix',
        required: true,
        alternatives: ['prefix'],
      },
      {
        key: 'Posta Bölgesi / Lojistik Bölge',
        label: 'Region',
        required: true,
        alternatives: ['region'],
      },
    ],
    example: {
      ISO: 'DE',
      'Posta Kodu İlk 2 / Prefix': '01-09',
      'Posta Bölgesi / Lojistik Bölge': 'DE-North',
    },
  },
  route_pricing: {
    sheetNote:
      'First sheet only. The first 2 rows are treated as headers — actual data must start from row 3. Columns are positional (A=index, B=origin, C=destination, D=transport mode, E=export price, F=currency, G=import price). Transport mode: "road" or "sea" (default: road).',
    columns: [
      { key: 'B — Origin Region', label: 'Origin Region', required: true },
      { key: 'C — Destination Region', label: 'Destination Region', required: true },
      { key: 'D — Transport Mode', label: 'Transport Mode (road/sea)', required: false },
      { key: 'E — Export Price', label: 'Export Price', required: true },
      { key: 'F — Currency', label: 'Currency', required: false },
      { key: 'G — Import Price', label: 'Import Price', required: false },
    ],
    example: {
      'B — Origin Region': 'Istanbul',
      'C — Destination Region': 'SI-West',
      'D — Transport Mode': 'road',
      'E — Export Price': '1500',
      'F — Currency': 'EUR',
      'G — Import Price': '1600',
    },
  },
  vendors: {
    sheetNote:
      'Each sheet represents one country/region. Skip the sheet named "ANASAYFA". Turkish column headers are expected.',
    columns: [
      { key: 'FİRMA', label: 'Company Name', required: true, alternatives: ['FIRMA'] },
      {
        key: 'MENŞEİ',
        label: 'Origin City',
        required: false,
        alternatives: ['MENSEI'],
      },
      {
        key: 'MAİL İHRACAT / İTHALAT',
        label: 'Email',
        required: false,
        alternatives: ['MAIL İHRACAT', 'email'],
      },
      { key: 'CEP / TEL', label: 'Phone', required: false, alternatives: ['phone'] },
      { key: 'TELEGRAM', label: 'Telegram Chat ID', required: false, alternatives: ['TELEGRAM CHAT ID', 'telegram_chat_id'] },
      { key: 'NOT', label: 'Notes', required: false, alternatives: ['not'] },
      { key: 'USE CUSTOM MARGIN', label: null, required: false, alternatives: ['use_custom_margin'] },
      { key: 'MARGIN RATE (%)', label: null, required: false, alternatives: ['margin_rate'] },
    ],
    example: {
      FİRMA: 'ABC Lojistik',
      'MENŞEİ': 'İstanbul',
      'MAİL İHRACAT / İTHALAT': 'info@abc.com',
      'CEP / TEL': '+90 532 123 45 67',
      TELEGRAM: '@abc_logistics',
      NOT: 'Ortaklık anlaşması var',
      'USE CUSTOM MARGIN': 'Yes',
      'MARGIN RATE (%)': '15',
    },
  },
};

export default function ImportPage() {
  const _t = useDashboardT();
  const [type, setType] = useState<ImportType>('postal_codes');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importOptions: { value: ImportType; label: string }[] = [
    { value: 'postal_codes', label: _t('import_option_postal_codes') },
    { value: 'route_pricing', label: _t('import_option_route_pricing') },
    { value: 'vendors', label: _t('import_option_vendors') },
  ];

  const req = REQUIREMENTS[type];

  function downloadExample() {
    const currentReq = REQUIREMENTS[type];
    const headers = Object.keys(currentReq.example);
    const values = Object.values(currentReq.example);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, values]);
    xlsx.utils.book_append_sheet(wb, ws, 'Example');

    const filename = `example_${type}.xlsx`;
    xlsx.writeFile(wb, filename);
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) return;

      setLoading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      try {
        const res = await fetch('/api/v1/import', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error?.message || _t('import_error'));
          return;
        }
        setResult(data.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : _t('network_error'));
      } finally {
        setLoading(false);
      }
    },
    [file, type, _t]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{_t('import_title')}</h2>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">{_t('import_error')}</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          <p className="font-medium">{_t('import_result')}</p>
          <p className="mt-1">
            <span className="font-semibold">{result.inserted}</span> {_t('import_records_inserted')},{' '}
            <span className="font-semibold">{result.skipped}</span> {_t('import_records_skipped')}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload Form */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">{_t('import_type')}</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ImportType);
                  setFile(null);
                  setError(null);
                  setResult(null);
                }}
                className="block w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {importOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">{_t('import_file')}</label>
                <button
                  type="button"
                  onClick={downloadExample}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Download example XLSX
                </button>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1.5 text-xs text-gray-500">{_t('import_accepted_formats')}</p>
              {file && (
                <p className="mt-1.5 text-xs text-blue-600">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? _t('import_loading') : _t('import_submit')}
            </button>
          </form>
        </div>

        {/* Requirements Card */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">{_t('import_requirements')}</h3>

          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-semibold">{_t('import_sheet_note')}:</span>{' '}
            {req.sheetNote}
          </div>

          <h4 className="mb-2 text-sm font-semibold text-gray-700">{_t('import_expected_columns')}</h4>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Column Header</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Status</th>
                  {req.columns.some((c) => c.alternatives) && (
                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">Also Accepted</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {req.columns.map((col) => (
                  <tr key={col.key}>
                    <td className="px-4 py-2.5 font-mono text-gray-900">
                      {col.label ?? col.key}
                      <div className="text-xs text-gray-500">{col.key}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {col.required ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          {_t('import_required')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {_t('import_optional')}
                        </span>
                      )}
                    </td>
                    {req.columns.some((c) => c.alternatives) && (
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {col.alternatives ? col.alternatives.join(', ') : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="mb-2 mt-5 text-sm font-semibold text-gray-700">{_t('import_example_row')}</h4>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(req.example).map((k) => (
                    <th key={k} className="px-4 py-2.5 text-left font-medium text-gray-600">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Object.values(req.example).map((v, i) => (
                    <td key={i} className="px-4 py-2.5 font-mono text-gray-700">
                      {v}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
