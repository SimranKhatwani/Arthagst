import NICEWayBillProvider from './nicEWayBillProvider.js';
import MockEWayBillProvider from './mockEWayBillProvider.js';

export const getEWayBillProvider = () => {
  if (process.env.EWAYBILL_PROVIDER === 'mock') {
    return new MockEWayBillProvider();
  }
  return new NICEWayBillProvider();
};

export default { getEWayBillProvider };
