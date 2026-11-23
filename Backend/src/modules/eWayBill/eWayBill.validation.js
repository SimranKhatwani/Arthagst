import { z } from 'zod';

export const generateEWayBillSchema = z
  .object({
    salesInvoiceId: z
      .string({ required_error: 'Sales Invoice ID is required' })
      .trim()
      .min(1, 'Sales Invoice ID cannot be empty'),
    distance: z.coerce
      .number({ required_error: 'Transport distance in kilometers is required' })
      .min(1, 'Distance must be at least 1 km'),
    transportMode: z
      .enum(['1: Road', '2: Rail', '3: Air', '4: Ship', 'road', 'rail', 'air', 'ship'])
      .optional()
      .default('1: Road'),
    transporterId: z.string().trim().optional().default(''),
    transporterName: z.string().trim().optional().default(''),
    vehicleNumber: z.string().trim().optional().default(''),
    vehicleType: z
      .enum(['R: Regular', 'O: Over Dimensional Cargo', 'regular', 'odc'])
      .optional()
      .default('regular'),
    fromPincode: z.string().trim().optional(),
    toPincode: z.string().trim().optional(),
  })
  .refine(
    (data) => Boolean(data.transporterId || data.vehicleNumber),
    {
      message: 'Either Transporter ID or Vehicle Number is mandatory to generate an E-Way Bill',
      path: ['vehicleNumber'],
    }
  );

export const updateVehicleSchema = z.object({
  vehicleNumber: z
    .string({ required_error: 'Vehicle number is required' })
    .trim()
    .min(1, 'Vehicle number cannot be empty'),
  transportMode: z
    .enum(['1: Road', '2: Rail', '3: Air', '4: Ship', 'road', 'rail', 'air', 'ship'])
    .optional()
    .default('1: Road'),
  fromPlace: z.string().trim().optional().default(''),
  fromState: z.string().trim().optional().default(''),
  reasonCode: z.string().trim().optional().default('1: Due to Break Down'),
  reasonRemark: z.string().trim().max(100).optional().default(''),
});

export const updateTransporterSchema = z.object({
  transporterId: z
    .string({ required_error: 'Transporter ID / GSTIN is required' })
    .trim()
    .min(1, 'Transporter ID cannot be empty'),
  transporterName: z.string().trim().optional().default(''),
});

export const extendValiditySchema = z.object({
  remainingDistance: z.coerce
    .number({ required_error: 'Remaining distance is required' })
    .min(1, 'Remaining distance must be at least 1 km'),
  fromPlace: z.string().trim().optional().default(''),
  fromState: z.string().trim().optional().default(''),
  vehicleNumber: z.string().trim().optional(),
  reasonCode: z.string().trim().optional().default('Natural Calamity / Traffic Jam'),
  reasonRemark: z.string().trim().max(100).optional().default(''),
});

export const cancelEWayBillSchema = z.object({
  cancellationReason: z.enum(['1', '2', '3', '4'], {
    required_error: 'Cancellation reason is required (1: Duplicate, 2: Order Cancelled, 3: Data Entry Mistake, 4: Others)',
  }),
  cancellationRemarks: z
    .string({ required_error: 'Cancellation remarks are required' })
    .trim()
    .min(2, 'Cancellation remarks must be at least 2 characters')
    .max(100, 'Cancellation remarks cannot exceed 100 characters'),
});

export const queryEWayBillSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['pending', 'generated', 'active', 'cancelled', 'expired', 'failed']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  generateEWayBillSchema,
  updateVehicleSchema,
  updateTransporterSchema,
  extendValiditySchema,
  cancelEWayBillSchema,
  queryEWayBillSchema,
};
