import { z } from 'zod'

const phone = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .regex(/^\+?[0-9 -]{7,20}$/, 'Enter a valid phone number')

export const deliverySchema = z.object({
  customerName: z.string().trim().min(1, 'Name is required'),
  phone,
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  line1: z.string().trim().min(1, 'Address is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required'),
  district: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  paymentMethod: z.enum(['COD', 'BKASH', 'NAGAD']),
})
export type DeliveryInput = z.infer<typeof deliverySchema>

export const mfsSubmissionSchema = z.object({
  senderMsisdn: phone,
  trxId: z
    .string()
    .trim()
    .min(1, 'Transaction ID is required')
    .max(50, 'That transaction ID looks too long'),
})
export type MfsSubmissionInput = z.infer<typeof mfsSubmissionSchema>
