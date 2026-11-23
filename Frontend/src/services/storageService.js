import { createInitialDemoState } from '../data/demoData';

const STORAGE_KEY = 'arthagst_prototype_state_v1';

export const loadAppState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialDemoState();
      saveAppState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.business || !Array.isArray(parsed.invoices)) {
      const initial = createInitialDemoState();
      saveAppState(initial);
      return initial;
    }
    return parsed;
  } catch {
    return createInitialDemoState();
  }
};

export const saveAppState = (state) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues in demo environment
  }
};

export const resetDemoData = () => {
  const initial = createInitialDemoState();
  saveAppState(initial);
  return initial;
};

export const exportAppDataJSON = (state) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arthagst-demo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToCSV = (filename, headers, rows) => {
  const escapeCell = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
