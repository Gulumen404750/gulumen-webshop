/**
 * Checkout szállítási / számlázási adatok – közös Zod séma + típusok.
 */

import { z } from 'zod'

const nonEmpty = (max: number) => z.string().trim().min(1).max(max)

export const ADDRESS_TYPES = ['home', 'business'] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]

export const addressSchema = z.object({
  postalCode: nonEmpty(16),
  city: nonEmpty(100),
  street: nonEmpty(200),
  houseNumber: nonEmpty(32),
})

export const checkoutCustomerSchema = z
  .object({
    email: z.string().email().max(254),
    name: nonEmpty(200),
    phone: z
      .string()
      .trim()
      .min(7, 'phone too short')
      .max(32)
      .regex(/^[+0-9()\-\s]+$/, 'invalid phone'),
    shipping: addressSchema,
    billingSameAsShipping: z.boolean().optional().default(true),
    billing: addressSchema.optional(),
    /** Opcionális futár-megjegyzés / cím pontosítás. */
    deliveryNotes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    /** Lakás/magáncím vs cég/munkahely. */
    addressType: z.enum(ADDRESS_TYPES).optional().default('home'),
  })
  .superRefine((data, ctx) => {
    if (data.billingSameAsShipping === false && !data.billing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'billing address required when different from shipping',
        path: ['billing'],
      })
    }
  })

export type CheckoutAddress = z.infer<typeof addressSchema>
export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>

export type OrderCustomerSnapshot = {
  email: string
  name: string
  phone: string
  shippingPostalCode: string
  shippingCity: string
  shippingStreet: string
  shippingHouseNumber: string
  billingSameAsShipping: boolean
  billingPostalCode: string | null
  billingCity: string | null
  billingStreet: string | null
  billingHouseNumber: string | null
  deliveryNotes: string | null
  addressType: AddressType
}

export function formatAddressTypeLabel(addressType: string | null | undefined): string {
  if (addressType === 'business') return 'Cég / Munkahely'
  if (addressType === 'home') return 'Lakás / Magáncím'
  return addressType?.trim() || '—'
}

export function toOrderCustomerSnapshot(customer: CheckoutCustomerInput): OrderCustomerSnapshot {
  const shipping = customer.shipping
  const billing =
    customer.billingSameAsShipping === false && customer.billing
      ? customer.billing
      : null
  const notes = customer.deliveryNotes?.trim()

  return {
    email: customer.email.trim().toLowerCase(),
    name: customer.name.trim(),
    phone: customer.phone.trim(),
    shippingPostalCode: shipping.postalCode.trim(),
    shippingCity: shipping.city.trim(),
    shippingStreet: shipping.street.trim(),
    shippingHouseNumber: shipping.houseNumber.trim(),
    billingSameAsShipping: billing == null,
    billingPostalCode: billing?.postalCode.trim() ?? null,
    billingCity: billing?.city.trim() ?? null,
    billingStreet: billing?.street.trim() ?? null,
    billingHouseNumber: billing?.houseNumber.trim() ?? null,
    deliveryNotes: notes && notes.length > 0 ? notes : null,
    addressType: customer.addressType ?? 'home',
  }
}
