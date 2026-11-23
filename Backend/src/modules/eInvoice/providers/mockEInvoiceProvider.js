import crypto from 'crypto';
import EInvoiceProviderInterface from './eInvoiceProvider.interface.js';

/**
 * Mock E-Invoice Provider for Local / Sandbox / Automated Verification Testing
 * Clearly labelled test adapter. Used strictly when EINVOICE_PROVIDER === 'mock'.
 */
export class MockEInvoiceProvider extends EInvoiceProviderInterface {
  isConfigured() {
    return true;
  }

  async generateIRN(payload) {
    const docNo = payload?.DocDtls?.No || 'INV001';
    const gstin = payload?.SellerDtls?.Gstin || '27AAAAA0000A1Z5';
    const timestamp = Date.now().toString();

    // Deterministic 64-character hex IRN hash
    const rawString = `${gstin}${payload?.DocDtls?.Typ || 'INV'}${docNo}${timestamp}`;
    const irn = crypto.createHash('sha256').update(rawString).digest('hex');
    const ackNo = String(Math.floor(100000000000000 + Math.random() * 900000000000000));
    const ackDate = new Date();

    const signedQRCode = JSON.stringify({
      sellerGstin: gstin,
      buyerGstin: payload?.BuyerDtls?.Gstin || 'URP',
      docNo,
      docTyp: payload?.DocDtls?.Typ || 'INV',
      docDt: payload?.DocDtls?.Dt || '',
      totInvVal: payload?.ValDtls?.TotInvVal || 0,
      itemCnt: payload?.ItemList?.length || 1,
      mainHsnCode: payload?.ItemList?.[0]?.HsnCd || '',
      irn,
    });

    return {
      irn,
      acknowledgementNumber: ackNo,
      acknowledgementDate: ackDate,
      signedQRCode,
      signedInvoice: `JWT-MOCK-SIGNED-${irn.substring(0, 16)}`,
      providerResponse: {
        Status: '1',
        Data: {
          AckNo: ackNo,
          AckDt: ackDate.toISOString(),
          Irn: irn,
          SignedInvoice: `JWT-MOCK-SIGNED-${irn.substring(0, 16)}`,
          SignedQRCode: signedQRCode,
        },
        InfoDtls: [{ InfCd: 'INF01', Desc: 'IRN generated successfully in test mode' }],
      },
    };
  }

  async cancelIRN({ irn, reason, remarks }) {
    const cancelDate = new Date();
    return {
      irn,
      cancelDate,
      providerResponse: {
        Status: '1',
        Data: {
          Irn: irn,
          CancelDate: cancelDate.toISOString(),
        },
        InfoDtls: [{ InfCd: 'INF02', Desc: 'IRN cancelled successfully in test mode' }],
      },
    };
  }

  async getIRNDetails(irn) {
    return {
      irn,
      status: 'ACT',
      providerResponse: {
        Status: '1',
        Data: { Irn: irn, Status: 'ACT' },
      },
    };
  }
}

export default MockEInvoiceProvider;
