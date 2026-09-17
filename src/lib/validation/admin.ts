import { z } from 'zod'

const slug = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers, and hyphens only')

export const PRODUCT_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export const DISCOUNT_TYPE_VALUES = ['PERCENT', 'FIXED'] as const

// -----------------------------------------------------------------------
// Products + variants
// -----------------------------------------------------------------------

export const variantSchema = z.object({
  id: z.string().optional(), // present when editing an existing row
  label: z.string().trim().min(1, 'Size/label is required'),
  sku: z.string().trim().optional(),
  priceDeltaTaka: z.coerce.number(), // added to the product's base price; can be negative
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  isActive: z.boolean(),
})
export type VariantInput = z.infer<typeof variantSchema>

// Every product needs at least one variant, even single-size items --
// CLAUDE.md: "There is no 'stock on product or on variant' branching."
export const productSchema = z
  .object({
    slug,
    name: z.string().trim().min(1, 'Name is required'),
    description: z.string().trim().optional(),
    details: z.string().trim().optional(),
    category: z.string().trim().min(1, 'Category is required'),
    collectionId: z.string(), // '' = none
    dropId: z.string(), // '' = none
    priceTaka: z.coerce.number().min(0, 'Price cannot be negative'),
    compareAtTaka: z.coerce.number().min(0).optional(),
    status: z.enum(PRODUCT_STATUS_VALUES),
    isFeatured: z.boolean(),
    variants: z.array(variantSchema).min(1, 'Add at least one variant'),
  })
  .refine((d) => d.compareAtTaka == null || d.compareAtTaka === 0 || d.compareAtTaka > d.priceTaka, {
    message: 'Compare-at price must be higher than the price',
    path: ['compareAtTaka'],
  })
export type ProductInput = z.infer<typeof productSchema>

// -----------------------------------------------------------------------
// Collections
// -----------------------------------------------------------------------

export const collectionSchema = z.object({
  slug,
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
  season: z.string().trim().optional(),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
})
export type CollectionInput = z.infer<typeof collectionSchema>

// -----------------------------------------------------------------------
// Drops
// -----------------------------------------------------------------------

export const dropSchema = z
  .object({
    slug,
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().trim().optional(),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().optional(),
    earlyAccessAt: z.string().optional(),
    accessKey: z.string().trim().optional(),
    isPublished: z.boolean(),
  })
  .refine((d) => !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt), {
    message: 'End time must be after the start time',
    path: ['endsAt'],
  })
  .refine((d) => !d.earlyAccessAt || new Date(d.earlyAccessAt) <= new Date(d.startsAt), {
    message: 'Early access must be at or before the start time',
    path: ['earlyAccessAt'],
  })
export type DropInput = z.infer<typeof dropSchema>

export const grantDropAccessSchema = z.object({
  emails: z.string().trim().min(1, 'Enter at least one email'),
})
export type GrantDropAccessInput = z.infer<typeof grantDropAccessSchema>

// -----------------------------------------------------------------------
// Articles
// -----------------------------------------------------------------------

export const articleSchema = z.object({
  slug,
  title: z.string().trim().min(1, 'Title is required'),
  abstract: z.string().trim().min(1, 'Abstract is required'),
  content: z.string().trim().min(1, 'Content is required'),
  collectionId: z.string(), // '' = none
  isPublished: z.boolean(),
})
export type ArticleInput = z.infer<typeof articleSchema>

// -----------------------------------------------------------------------
// Discount codes
// -----------------------------------------------------------------------

export const discountCodeSchema = z
  .object({
    code: z.string().trim().min(1, 'Code is required'),
    description: z.string().trim().optional(),
    type: z.enum(DISCOUNT_TYPE_VALUES),
    // PERCENT: a plain 1-100 integer. FIXED: a taka amount, converted to
    // poisha at the mutation boundary -- see toMinor() in src/lib/money.ts.
    value: z.coerce.number().min(1, 'Enter a value'),
    minOrderTaka: z.coerce.number().min(0),
    maxUses: z.coerce.number().int().min(1).optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((d) => d.type !== 'PERCENT' || (d.value >= 1 && d.value <= 100), {
    message: 'A percent discount must be between 1 and 100',
    path: ['value'],
  })
  .refine((d) => !d.startsAt || !d.expiresAt || new Date(d.expiresAt) > new Date(d.startsAt), {
    message: 'Expiry must be after the start time',
    path: ['expiresAt'],
  })
export type DiscountCodeInput = z.infer<typeof discountCodeSchema>

// -----------------------------------------------------------------------
// Store settings
// -----------------------------------------------------------------------

export const storeSettingsSchema = z.object({
  freeShippingThresholdTaka: z.coerce.number().min(0),
  flatShippingTaka: z.coerce.number().min(0),
  bkashNumber: z.string().trim().optional(),
  nagadNumber: z.string().trim().optional(),
  supportEmail: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  supportPhone: z.string().trim().optional(),
  announcement: z.string().trim().optional(),
})
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>

// -----------------------------------------------------------------------
// Order status transitions (admin order detail)
// -----------------------------------------------------------------------

export const orderStatusUpdateSchema = z.object({
  next: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().optional(),
  trackingCode: z.string().trim().optional(),
  courier: z.string().trim().optional(),
})
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>
