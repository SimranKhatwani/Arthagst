/**
 * Abstract E-Way Bill Provider Interface
 */
export class EWayBillProviderInterface {
  isConfigured() {
    throw new Error('isConfigured() must be implemented');
  }

  async generateEWayBill(payload) {
    throw new Error('generateEWayBill() must be implemented');
  }

  async updateVehicle(params) {
    throw new Error('updateVehicle() must be implemented');
  }

  async updateTransporter(params) {
    throw new Error('updateTransporter() must be implemented');
  }

  async extendValidity(params) {
    throw new Error('extendValidity() must be implemented');
  }

  async cancelEWayBill(params) {
    throw new Error('cancelEWayBill() must be implemented');
  }
}

export default EWayBillProviderInterface;
