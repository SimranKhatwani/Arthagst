import EWayBillProviderInterface from './eWayBillProvider.interface.js';

/**
 * Mock E-Way Bill Provider for Local / Sandbox / Automated Verification Testing
 * Clearly labelled test adapter. Used strictly when EWAYBILL_PROVIDER === 'mock'.
 */
export class MockEWayBillProvider extends EWayBillProviderInterface {
  isConfigured() {
    return true;
  }

  async generateEWayBill(payload) {
    const docNo = payload?.docNo || 'INV001';
    // Generate deterministic 12-digit E-Way Bill Number
    const ewbNo = String(Math.floor(100000000000 + Math.random() * 900000000000));
    const generatedDate = new Date();

    // Validity: 1 day per 200 km
    const distance = Number(payload?.transDistance || payload?.actualDist || payload?.distance || 100);
    const validityDays = Math.max(1, Math.ceil(distance / 200));
    const validUntil = new Date(generatedDate.getTime() + validityDays * 24 * 60 * 60 * 1000);

    return {
      eWayBillNumber: ewbNo,
      generatedDate,
      validUntil,
      providerResponse: {
        status: '1',
        data: {
          ewayBillNo: ewbNo,
          ewayBillDate: generatedDate.toISOString(),
          validUpto: validUntil.toISOString(),
        },
        infoDtls: [{ infCd: 'EWB01', desc: 'E-Way Bill generated successfully in test mode' }],
      },
    };
  }

  async updateVehicle({ eWayBillNumber, vehicleNumber, transportMode, fromPlace, fromState, reasonCode, reasonRemark }) {
    const updatedDate = new Date();
    return {
      eWayBillNumber,
      updatedDate,
      providerResponse: {
        status: '1',
        data: {
          ewayBillNo: eWayBillNumber,
          vehUpdDate: updatedDate.toISOString(),
        },
        infoDtls: [{ infCd: 'EWB02', desc: 'Vehicle details updated in test mode' }],
      },
    };
  }

  async updateTransporter({ eWayBillNumber, transporterId }) {
    const updatedDate = new Date();
    return {
      eWayBillNumber,
      updatedDate,
      providerResponse: {
        status: '1',
        data: {
          ewayBillNo: eWayBillNumber,
          transUpdDate: updatedDate.toISOString(),
        },
        infoDtls: [{ infCd: 'EWB03', desc: 'Transporter details updated in test mode' }],
      },
    };
  }

  async extendValidity({ eWayBillNumber, remainingDistance, fromPlace, fromState, vehicleNumber, reasonCode }) {
    const extensionDate = new Date();
    const additionalDays = Math.max(1, Math.ceil(Number(remainingDistance || 100) / 200));
    const extendedUntil = new Date(extensionDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    return {
      eWayBillNumber,
      validUntil: extendedUntil,
      providerResponse: {
        status: '1',
        data: {
          ewayBillNo: eWayBillNumber,
          validUpto: extendedUntil.toISOString(),
        },
        infoDtls: [{ infCd: 'EWB04', desc: 'E-Way Bill validity extended in test mode' }],
      },
    };
  }

  async cancelEWayBill({ eWayBillNumber, reason, remarks }) {
    const cancelDate = new Date();
    return {
      eWayBillNumber,
      cancelDate,
      providerResponse: {
        status: '1',
        data: {
          ewayBillNo: eWayBillNumber,
          cancelDate: cancelDate.toISOString(),
        },
        infoDtls: [{ infCd: 'EWB05', desc: 'E-Way Bill cancelled in test mode' }],
      },
    };
  }
}

export default MockEWayBillProvider;
