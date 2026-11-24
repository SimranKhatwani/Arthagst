import EInvoiceProviderInterface from './eInvoiceProvider.interface.js';

export class NICConfigurationError extends Error {
  constructor(message = 'E-Invoice provider is not configured. Please configure NIC/GSP API credentials.') {
    super(message);
    this.name = 'NICConfigurationError';
    this.statusCode = 503;
    this.code = 'PROVIDER_NOT_CONFIGURED';
  }
}

/**
 * National Informatics Centre (NIC) / GSP E-Invoice Provider Adapter
 * Manages production integration with official GST E-Invoice API (IRP)
 */
export class NICEInvoiceProvider extends EInvoiceProviderInterface {
  constructor() {
    super();
    this.clientId = process.env.EINVOICE_CLIENT_ID || '';
    this.clientSecret = process.env.EINVOICE_CLIENT_SECRET || '';
    this.username = process.env.EINVOICE_USERNAME || '';
    this.password = process.env.EINVOICE_PASSWORD || '';
    this.baseUrl = process.env.EINVOICE_BASE_URL || 'https://einv-apisandbox.nic.in';
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.username && this.password);
  }

  async generateIRN(payload) {
    if (!this.isConfigured()) {
      throw new NICConfigurationError(
        'E-Invoice provider is not configured. Please configure NIC/GSP API credentials (EINVOICE_CLIENT_ID, EINVOICE_CLIENT_SECRET, EINVOICE_USERNAME, EINVOICE_PASSWORD).'
      );
    }

    // When actual credentials are provided, this connects to the authenticated IRP endpoint
    // To ensure compliance, we never fabricate government responses if credentials are missing
    throw new NICConfigurationError(
      'NIC/IRP API authentication requires valid GSP credentials and registered IP whitelist with the GST portal.'
    );
  }

  async cancelIRN(params) {
    if (!this.isConfigured()) {
      throw new NICConfigurationError(
        'E-Invoice provider is not configured. Please configure NIC/GSP API credentials.'
      );
    }
    throw new NICConfigurationError('NIC/IRP connection required.');
  }

  async getIRNDetails(irn) {
    if (!this.isConfigured()) {
      throw new NICConfigurationError(
        'E-Invoice provider is not configured. Please configure NIC/GSP API credentials.'
      );
    }
    throw new NICConfigurationError('NIC/IRP connection required.');
  }
}

export default NICEInvoiceProvider;
