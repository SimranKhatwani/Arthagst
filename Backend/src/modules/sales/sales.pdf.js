import PDFDocument from 'pdfkit';

/**
 * Generate a clean, professional Tax Invoice PDF using PDFKit
 */
export const generateInvoicePDF = (invoice, tenant, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  // Stream output to HTTP response
  doc.pipe(res);

  // 1. Header & Title
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(tenant.businessName || 'Tax Invoice', { align: 'left' });

  doc
    .fontSize(10)
    .font('Helvetica')
    .text(tenant.businessAddress || '', { align: 'left' })
    .text(`${tenant.city ? tenant.city + ', ' : ''}${tenant.state || ''} ${tenant.pincode ? '- ' + tenant.pincode : ''}`)
    .text(`GSTIN: ${tenant.GSTIN || 'URP'} | PAN: ${tenant.PAN || 'N/A'}`)
    .text(`Email: ${tenant.email} | Phone: ${tenant.phone}`);

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('TAX INVOICE', 400, 40, { align: 'right' });

  doc
    .fontSize(9)
    .font('Helvetica')
    .text(`Invoice #: ${invoice.invoiceNumber}`, 400, 65, { align: 'right' })
    .text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, 400, 78, { align: 'right' })
    .text(`Status: ${invoice.invoiceStatus.toUpperCase()}`, 400, 91, { align: 'right' })
    .text(`Place of Supply: ${invoice.placeOfSupply}`, 400, 104, { align: 'right' });

  doc.moveDown(2);
  doc.moveTo(40, 130).lineTo(555, 130).stroke('#cccccc');

  // 2. Bill To (Buyer)
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Billed To (Customer):', 40, 140);

  doc
    .fontSize(10)
    .font('Helvetica')
    .text(invoice.partyName, 40, 155)
    .text(invoice.billingAddress || invoice.shippingAddress || 'N/A')
    .text(`GSTIN: ${invoice.partyGSTIN || 'Unregistered'} | PAN: ${invoice.partyPAN || 'N/A'}`);

  doc.moveTo(40, 210).lineTo(555, 210).stroke('#cccccc');

  // 3. Table Header
  let y = 220;
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('#', 40, y)
    .text('Item Description', 65, y)
    .text('HSN/SAC', 230, y)
    .text('Qty', 290, y, { width: 35, align: 'right' })
    .text('Rate (₹)', 335, y, { width: 50, align: 'right' })
    .text('Taxable (₹)', 395, y, { width: 55, align: 'right' })
    .text('Tax (₹)', 460, y, { width: 40, align: 'right' })
    .text('Total (₹)', 505, y, { width: 50, align: 'right' });

  doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke('#333333');
  y += 20;

  // 4. Line Items
  doc.font('Helvetica');
  invoice.items.forEach((item, index) => {
    const totalTax = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0) + (item.cess || 0);

    doc
      .fontSize(9)
      .text(String(index + 1), 40, y)
      .text(item.productName, 65, y, { width: 160 })
      .text(item.HSN || item.SAC || '-', 230, y)
      .text(String(item.quantity), 290, y, { width: 35, align: 'right' })
      .text(item.unitPrice.toFixed(2), 335, y, { width: 50, align: 'right' })
      .text(item.taxableValue.toFixed(2), 395, y, { width: 55, align: 'right' })
      .text(totalTax.toFixed(2), 460, y, { width: 40, align: 'right' })
      .text(item.lineTotal.toFixed(2), 505, y, { width: 50, align: 'right' });

    y += 18;
    if (y > 700) {
      doc.addPage();
      y = 40;
    }
  });

  doc.moveTo(40, y).lineTo(555, y).stroke('#cccccc');
  y += 10;

  // 5. Summary Breakdown
  const summaryX = 350;
  doc.fontSize(9).font('Helvetica');

  doc.text('Subtotal:', summaryX, y).text(`₹ ${invoice.subtotal.toFixed(2)}`, 450, y, { align: 'right' });
  y += 14;

  if (invoice.discountTotal > 0) {
    doc.text('Discount:', summaryX, y).text(`- ₹ ${invoice.discountTotal.toFixed(2)}`, 450, y, { align: 'right' });
    y += 14;
  }

  doc.text('Taxable Amount:', summaryX, y).text(`₹ ${invoice.taxableAmount.toFixed(2)}`, 450, y, { align: 'right' });
  y += 14;

  if (invoice.cgstTotal > 0) {
    doc.text('CGST:', summaryX, y).text(`₹ ${invoice.cgstTotal.toFixed(2)}`, 450, y, { align: 'right' });
    y += 14;
  }

  if (invoice.sgstTotal > 0) {
    doc.text('SGST:', summaryX, y).text(`₹ ${invoice.sgstTotal.toFixed(2)}`, 450, y, { align: 'right' });
    y += 14;
  }

  if (invoice.igstTotal > 0) {
    doc.text('IGST:', summaryX, y).text(`₹ ${invoice.igstTotal.toFixed(2)}`, 450, y, { align: 'right' });
    y += 14;
  }

  if (invoice.cessTotal > 0) {
    doc.text('Cess:', summaryX, y).text(`₹ ${invoice.cessTotal.toFixed(2)}`, 450, y, { align: 'right' });
    y += 14;
  }

  if (invoice.roundOff !== 0) {
    doc.text('Round Off:', summaryX, y).text(`₹ ${invoice.roundOff.toFixed(2)}`, 450, y, { align: 'right' });
    y += 14;
  }

  doc.moveTo(summaryX, y).lineTo(555, y).stroke('#333333');
  y += 6;

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Grand Total:', summaryX, y)
    .text(`₹ ${invoice.grandTotal.toFixed(2)}`, 450, y, { align: 'right' });

  y += 20;

  // Notes & Footer
  if (invoice.notes) {
    doc.fontSize(8).font('Helvetica-Oblique').text(`Notes: ${invoice.notes}`, 40, y, { width: 300 });
  }

  doc
    .fontSize(8)
    .font('Helvetica')
    .text('This is a computer-generated tax invoice and does not require physical signature.', 40, 780, {
      align: 'center',
      width: 515,
    });

  doc.end();
};

export default { generateInvoicePDF };
