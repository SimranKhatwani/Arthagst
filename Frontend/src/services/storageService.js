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
    // Strip any legacy fake demo users
    if (Array.isArray(parsed.users)) {
      parsed.users = parsed.users.filter(
        (u) => !u.email?.endsWith('.demo') && !String(u.id).startsWith('usr-')
      );
    }
    // Strip legacy fake demo batches
    if (Array.isArray(parsed.batches)) {
      parsed.batches = parsed.batches.filter(
        (b) =>
          !String(b.id).startsWith('bat-') &&
          !['FOR-26A1', 'FOR-26B4', 'IGB-2605', 'AAS-2609', 'MDH-2604', 'TTG-2608', 'AP-2606'].includes(b.batchNo)
      );
    }
    // Strip legacy fake demo stock movements
    if (Array.isArray(parsed.stockMovements)) {
      parsed.stockMovements = parsed.stockMovements.filter(
        (m) =>
          !String(m.id).startsWith('sm-') &&
          !['PB/26-27/014', 'ST/26-27/019', 'PB/26-27/015', 'ST/26-27/021', 'CN/26-27/005', 'PB/26-27/016', 'ADJ-26-014'].includes(m.reference)
      );
    }
    // Strip legacy fake demo GSTR-2B records
    if (Array.isArray(parsed.gstr2bRecords)) {
      parsed.gstr2bRecords = parsed.gstr2bRecords.filter(
        (r) =>
          !String(r.id).startsWith('2b-') &&
          !r.gstin?.includes('(DEMO)') &&
          !['HAV/RAJ/26-081', 'CRM/MH/840', 'JKP/DL/518', 'PKP/JPR/229', 'MCS/JPR/902', 'AWL/JPR/589'].includes(r.invoiceNo)
      );
    }
    // Strip legacy fake demo e-invoices and e-way bills
    if (Array.isArray(parsed.eInvoices)) {
      parsed.eInvoices = parsed.eInvoices.filter(
        (e) => !String(e.id).startsWith('einv-') && !e.gstin?.includes('(DEMO)')
      );
    }
    if (Array.isArray(parsed.eWayBills)) {
      parsed.eWayBills = parsed.eWayBills.filter(
        (e) => !String(e.id).startsWith('ewb-') && !String(e.status).includes('(Demo)')
      );
    }
    // Strip legacy fake demo notifications and audit logs
    if (Array.isArray(parsed.notifications)) {
      parsed.notifications = parsed.notifications.filter(
        (n) => !String(n.id).startsWith('notif-')
      );
    }
    if (Array.isArray(parsed.auditLogs)) {
      parsed.auditLogs = parsed.auditLogs.filter(
        (a) => !String(a.id).startsWith('aud-')
      );
    }
    saveAppState(parsed);
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
