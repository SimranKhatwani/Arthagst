/**
 * Convert tabular data to RFC 4180 compliant CSV string
 *
 * @param {Array<{ key: string, label: string }>} columns - Array of column definitions
 * @param {Array<Object>} rows - Array of row objects
 * @returns {string} Formatted CSV string
 */
export const convertToCsv = (columns, rows) => {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '';
  }

  // Format header line
  const headerLine = columns
    .map((col) => `"${(col.label || col.key).replace(/"/g, '""')}"`)
    .join(',');

  // Format data lines
  const dataLines = (rows || []).map((row) => {
    return columns
      .map((col) => {
        let val = row[col.key];
        if (val === null || val === undefined) {
          val = '';
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        } else if (typeof val === 'object') {
          val = JSON.stringify(val);
        } else {
          val = String(val);
        }
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  return [headerLine, ...dataLines].join('\r\n');
};

/**
 * Send CSV file as HTTP response attachment
 *
 * @param {import('express').Response} res - Express response
 * @param {string} filename - Desired download filename
 * @param {Array<{ key: string, label: string }>} columns - Column definitions
 * @param {Array<Object>} rows - Data rows
 */
export const sendCsvResponse = (res, filename, columns, rows) => {
  const csvData = convertToCsv(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csvData);
};

export default { convertToCsv, sendCsvResponse };
