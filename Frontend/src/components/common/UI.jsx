import React, { useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';

export const PageHeader = ({ title, subtitle, breadcrumbs = [], actions }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      {breadcrumbs.length > 0 && (
        <nav className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span aria-hidden="true">/</span>}
              <span className={idx === breadcrumbs.length - 1 ? 'font-medium text-slate-700' : ''}>
                {b}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        {title}
      </h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const StatusLabel = ({ status }) => {
  const s = String(status || '').toLowerCase();
  let colorClass = 'text-slate-700 bg-slate-100';
  let Icon = Info;

  if (
    ['paid', 'finalized', 'completed', 'active', 'matched', 'ready', 'delivered', 'settled', 'resolved', 'generated (demo)', 'active (demo)', 'accepted', 'converted', 'invoiced', 'published', 'issued'].some((k) => s.includes(k))
  ) {
    colorClass = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
    Icon = CheckCircle2;
  } else if (
    ['partial', 'pending', 'draft', 'in progress', 'processing', 'sent', 'dispatched', 'in transit', 'trial', 'tax mismatch', 'gstin mismatch', 'scheduled', 'upcoming', 'open', 'demo prepared'].some((k) => s.includes(k))
  ) {
    colorClass = 'text-amber-700 bg-amber-50 border border-amber-200';
    Icon = AlertTriangle;
  } else if (
    ['unpaid', 'overdue', 'cancelled', 'expired', 'failed', 'inactive', 'missing', 'out of stock', 'high'].some((k) => s.includes(k))
  ) {
    colorClass = 'text-rose-700 bg-rose-50 border border-rose-200';
    Icon = AlertCircle;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${colorClass}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{status}</span>
    </span>
  );
};

export const StatCard = ({ label, value, subtext, onClick, tone = 'neutral' }) => {
  const toneBorder =
    tone === 'success'
      ? 'border-slate-200 hover:border-emerald-300'
      : tone === 'warning'
      ? 'border-slate-200 hover:border-amber-300'
      : tone === 'danger'
      ? 'border-slate-200 hover:border-rose-300'
      : 'border-slate-200 hover:border-indigo-300';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-lg border bg-white p-4 transition-colors ${toneBorder} ${
        onClick ? 'cursor-pointer hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : ''
      }`}
    >
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 font-mono text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
      {subtext && <div className="mt-1 text-xs text-slate-500 truncate">{subtext}</div>}
    </Tag>
  );
};

export const SegmentedTabs = ({ tabs, activeTab, onChange }) => (
  <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
    {tabs.map((tab) => {
      const id = typeof tab === 'string' ? tab : tab.id;
      const label = typeof tab === 'string' ? tab : tab.label;
      const count = typeof tab === 'object' ? tab.count : undefined;
      const active = activeTab === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {label}
          {count !== undefined && (
            <span className="ml-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
              ({count})
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const DataTable = ({
  columns = [],
  data = [],
  searchPlaceholder = 'Search records...',
  searchFields = [],
  filters = null,
  pageSize = 10,
  emptyTitle = 'No records found',
  emptyDescription = 'Adjust your filters or create a new entry.',
  emptyAction = null,
  onRowClick = null,
}) => {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = data;
    if (q) {
      list = data.filter((row) => {
        if (searchFields.length > 0) {
          return searchFields.some((f) =>
            String(row[f] ?? '').toLowerCase().includes(q)
          );
        }
        return Object.values(row).some((val) =>
          String(val ?? '').toLowerCase().includes(q)
        );
      });
    }
    if (sortCol) {
      list = [...list].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return sortDir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''));
      });
    }
    return list;
  }, [data, search, searchFields, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    if (sortCol === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {(searchFields.length > 0 || filters) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        </div>
      )}

      {pagedRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="text-sm font-medium text-slate-900">{emptyTitle}</div>
          <p className="mt-1 max-w-sm text-xs text-slate-500">{emptyDescription}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3.5 py-2.5 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        <span>{col.label}</span>
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors hover:bg-slate-50/80 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 text-slate-700 ${
                        col.align === 'right' ? 'text-right font-mono tabular-nums' : ''
                      } ${col.nowrap ? 'whitespace-nowrap' : ''}`}
                    >
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="tabular-nums">
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} records
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const Modal = ({ open, onClose, title, subtitle, size = 'md', children, footer }) => {
  if (!open) return null;
  const maxWidth =
    size === 'xl'
      ? 'max-w-5xl'
      : size === 'lg'
      ? 'max-w-3xl'
      : size === 'sm'
      ? 'max-w-md'
      : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div
        className={`flex max-h-[90vh] w-full flex-col rounded-xl border border-slate-200 bg-white shadow-xl ${maxWidth}`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const bg =
          t.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : t.type === 'info'
            ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900';
        return (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs font-medium shadow-md ${bg}`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const ConfirmDialog = ({ confirmState }) => {
  if (!confirmState) return null;
  return (
    <Modal
      open={Boolean(confirmState)}
      onClose={confirmState.onCancel}
      title={confirmState.title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={confirmState.onCancel}
            className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmState.onConfirm}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium text-white ${
              confirmState.danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmState.confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{confirmState.message}</p>
    </Modal>
  );
};

export const InputField = ({ label, required, error, children }) => (
  <div>
    {label && (
      <label className="mb-1 block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
    )}
    {children}
    {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
  </div>
);

export const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0';
