const collectHeadStyles = () => {
  const tags = [];
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    tags.push(node.outerHTML);
  });
  return tags.join('\n');
};

export const downloadPrintableHtml = (elementId, fileName = 'bill.html', title = 'ArthaGST Bill') => {
  const el = document.getElementById(elementId);
  if (!el) return false;

  const clone = el.cloneNode(true);
  clone.querySelectorAll('.no-print').forEach((n) => n.remove());

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${collectHeadStyles()}
  <style>
    body { background: #ffffff !important; padding: 24px; margin: 0; color: #0f172a; }
    .no-print { display: none !important; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div style="max-width: 820px; margin: 0 auto;">
    ${clone.outerHTML}
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 200);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

export const printElement = ({
  elementId,
  title = 'ArthaGST Document',
  fileName = 'document.html',
  onNotify,
}) => {
  const el = elementId ? document.getElementById(elementId) : null;
  let mountRoot = null;

  if (el) {
    mountRoot = document.getElementById('print-mount-root');
    if (!mountRoot) {
      mountRoot = document.createElement('div');
      mountRoot.id = 'print-mount-root';
      document.body.appendChild(mountRoot);
    }
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.no-print').forEach((n) => n.remove());
    mountRoot.innerHTML = '';
    mountRoot.appendChild(clone);
    document.body.classList.add('printing-isolated');
  }

  let beforePrintFired = false;
  const handleBeforePrint = () => {
    beforePrintFired = true;
  };
  const cleanup = () => {
    document.body.classList.remove('printing-isolated');
    if (mountRoot) mountRoot.innerHTML = '';
    window.removeEventListener('beforeprint', handleBeforePrint);
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('beforeprint', handleBeforePrint);
  window.addEventListener('afterprint', cleanup);

  const startedAt = Date.now();
  try {
    window.print();
  } catch {
    // Blocked by sandboxed iframe
  }
  const elapsed = Date.now() - startedAt;

  // Give Chrome a tick in case beforeprint fires asynchronously; if blocked by iframe sandbox, auto-download printable bill
  setTimeout(() => {
    if (!beforePrintFired && elapsed < 120) {
      cleanup();
      if (el) {
        downloadPrintableHtml(elementId, fileName, title);
        onNotify?.(
          'Browser preview blocked print dialog — downloaded printable bill (.html). Open it to print or save PDF.',
          'info'
        );
      } else {
        onNotify?.('Browser preview blocked native print dialog. Try opening the app in a standalone tab.', 'info');
      }
    } else if (!beforePrintFired) {
      cleanup();
    }
  }, 250);
};
