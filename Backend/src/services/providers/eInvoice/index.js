import NICEInvoiceProvider from './nicEInvoiceProvider.js';
import MockEInvoiceProvider from './mockEInvoiceProvider.js';

/**
 * Provider Factory
 * Returns Mock provider if process.env.EINVOICE_PROVIDER === 'mock', otherwise returns real NIC provider
 */
export const getEInvoiceProvider = () => {
  if (process.env.EINVOICE_PROVIDER === 'mock') {
    return new MockEInvoiceProvider();
  }
  return new NICEInvoiceProvider();
};

export default { getEInvoiceProvider };
