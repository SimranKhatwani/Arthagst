/**
 * Abstract E-Invoice Provider Interface
 */
export class EInvoiceProviderInterface {
  /**
   * Check if provider credentials and configuration are present
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented');
  }

  /**
   * Generate Invoice Reference Number (IRN)
   * @param {object} payload - Standard INV-01 JSON payload
   * @returns {Promise<object>} - { irn, ackNo, ackDate, signedQRCode, signedInvoice, rawResponse }
   */
  async generateIRN(payload) {
    throw new Error('generateIRN() must be implemented');
  }

  /**
   * Cancel Invoice Reference Number (IRN)
   * @param {object} params - { irn, reason, remarks }
   * @returns {Promise<object>} - { irn, cancelDate, rawResponse }
   */
  async cancelIRN(params) {
    throw new Error('cancelIRN() must be implemented');
  }

  /**
   * Get Details of an IRN
   * @param {string} irn
   * @returns {Promise<object>}
   */
  async getIRNDetails(irn) {
    throw new Error('getIRNDetails() must be implemented');
  }
}

export default EInvoiceProviderInterface;
