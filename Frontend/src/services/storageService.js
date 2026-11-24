import { createInitialDemoState } from '../data/demoData';

const STORAGE_KEY = 'arthagst_prototype_state_v1';

export const loadAppState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const token = window.localStorage.getItem('arthagst_token');
    if (!raw) {
      const initial = createInitialDemoState();
      initial.isAuthenticated = Boolean(token);
      if (!token) {
        initial.currentUser = null;
        initial.currentTenant = null;
      }
      saveAppState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.business || !Array.isArray(parsed.invoices)) {
      const initial = createInitialDemoState();
      initial.isAuthenticated = Boolean(token);
      if (!token) {
        initial.currentUser = null;
        initial.currentTenant = null;
      }
      saveAppState(initial);
      return initial;
    }
    // Strictly validate authentication status by token presence
    parsed.isAuthenticated = Boolean(token);
    if (!token) {
      parsed.currentUser = null;
      parsed.currentTenant = null;
    }
    return parsed;
  } catch {
    const initial = createInitialDemoState();
    initial.isAuthenticated = false;
    initial.currentUser = null;
    initial.currentTenant = null;
    return initial;
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
