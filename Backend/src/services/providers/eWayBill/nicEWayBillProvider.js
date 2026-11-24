import EWayBillProviderInterface from './eWayBillProvider.interface.js';

export class EWayBillConfigurationError extends Error {
  constructor(message = 'E-Way Bill provider is not configured. Please configure NIC/GSP API credentials.') {
    super(message);
    this.name = 'EWayBillConfigurationError';
    this.statusCode = 503;
    this.code = 'PROVIDER_NOT_CONFIGURED';
  }
}

/**
 * National Informatics Centre (NIC) / GSP E-Way Bill Provider Adapter
 */
export class NICEWayBillProvider extends EWayBillProviderInterface {
  constructor() {
    super();
    this.clientId = process.env.EWAYBILL_CLIENT_ID || '';
    this.clientSecret = process.env.EWAYBILL_CLIENT_SECRET || '';
    this.username = process.env.EWAYBILL_USERNAME || '';
    this.password = process.env.EWAYBILL_PASSWORD || '';
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.username && this.password);
  }

  async generateEWayBill(payload) {
    if (!this.isConfigured()) {
      throw new EWayBillConfigurationError(
        'E-Way Bill provider is not configured. Please configure NIC/GSP API credentials (EWAYBILL_CLIENT_ID, EWAYBILL_CLIENT_SECRET, EWAYBILL_USERNAME, EWAYBILL_PASSWORD).'
      );
    }
    throw new EWayBillConfigurationError('NIC E-Way Bill connection requires active GSP credentials.');
  }

  async updateVehicle(params) {
    if (!this.isConfigured()) {
      throw new EWayBillConfigurationError('E-Way Bill provider is not configured.');
    }
    throw new EWayBillConfigurationError('NIC E-Way Bill connection requires active GSP credentials.');
  }

  async updateTransporter(params) {
    if (!this.isConfigured()) {
      throw new EWayBillConfigurationError('E-Way Bill provider is not configured.');
    }
    throw new EWayBillConfigurationError('NIC E-Way Bill connection requires active GSP credentials.');
  }

  async extendValidity(params) {
    if (!this.isConfigured()) {
      throw new EWayBillConfigurationError('E-Way Bill provider is not configured.');
    }
    throw new EWayBillConfigurationError('NIC E-Way Bill connection requires active GSP credentials.');
  }

  async cancelEWayBill(params) {
    if (!this.isConfigured()) {
      throw new EWayBillConfigurationError('E-Way Bill provider is not configured.');
    }
    throw new EWayBillConfigurationError('NIC E-Way Bill connection requires active GSP credentials.');
  }
}

export default NICEWayBillProvider;
