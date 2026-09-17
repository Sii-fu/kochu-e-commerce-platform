import { describe, expect, it } from 'vitest'
import { adminErrorMessage, checkoutErrorMessage } from './errors'

describe('checkoutErrorMessage', () => {
  it('maps every raise exception code from create_order() to real copy', () => {
    // These strings have to match the literal 'CODE' create_order() and
    // submit_mfs_transaction() raise in 0006_functions.sql byte-for-byte --
    // PostgREST surfaces the raised message unprefixed on error.message.
    expect(checkoutErrorMessage(new Error('CART_EMPTY'))).toMatch(/empty/i)
    expect(checkoutErrorMessage(new Error('INSUFFICIENT_STOCK'))).toMatch(/stock/i)
    expect(checkoutErrorMessage(new Error('PRODUCT_UNAVAILABLE'))).toMatch(/available/i)
    expect(checkoutErrorMessage(new Error('DROP_NOT_OPEN'))).toMatch(/drop/i)
    expect(checkoutErrorMessage(new Error('INVALID_DISCOUNT'))).toMatch(/discount/i)
    expect(checkoutErrorMessage(new Error('TRX_ID_ALREADY_USED'))).toMatch(/transaction/i)
  })

  it('never leaks a raw, unrecognized error to the customer', () => {
    expect(checkoutErrorMessage(new Error('duplicate key value violates unique constraint'))).not.toMatch(
      /constraint|violat/i,
    )
  })
})

describe('adminErrorMessage', () => {
  it('maps every raise exception code from admin_update_order_status() and verify_mfs_transaction()', () => {
    // Literal 'CODE' strings must match 0006_functions.sql byte-for-byte.
    expect(adminErrorMessage(new Error('FORBIDDEN'))).toMatch(/permission/i)
    expect(adminErrorMessage(new Error('INVALID_STATUS_TRANSITION'))).toMatch(/status/i)
    expect(adminErrorMessage(new Error('TRANSACTION_ALREADY_REVIEWED'))).toMatch(/reviewed/i)
    expect(adminErrorMessage(new Error('TRANSACTION_NOT_FOUND'))).toMatch(/not be found/i)
  })

  it('never leaks a raw, unrecognized error to the admin', () => {
    expect(adminErrorMessage(new Error('null value in column violates not-null constraint'))).not.toMatch(
      /constraint|violat/i,
    )
  })
})
