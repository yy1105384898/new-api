import { describe, expect, it } from 'vitest'

import type { PricingModel } from '../../types'
import { formatRequestPrice } from '../price'

function requestModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'seedance-2.0-1080p',
    quota_type: 1,
    model_ratio: 0,
    completion_ratio: 0,
    model_price: 1.6,
    enable_groups: ['default'],
    ...overrides,
  }
}

describe('formatRequestPrice', () => {
  it('uses seconds when billing mode is per_second', () => {
    const price = formatRequestPrice(
      requestModel({ billing_mode: 'per_second', request_unit: 'request' }),
      false,
      1,
      1,
      undefined,
      (key) => (key === 'billingUnit.second' ? '秒' : key)
    )

    expect(price).toMatch(/\/秒$/)
  })

  it('uses the configured request unit for per-request billing', () => {
    const price = formatRequestPrice(
      requestModel({ billing_mode: 'per_request', request_unit: 'call' }),
      false,
      1,
      1,
      undefined,
      (key) => (key === 'billingUnit.call' ? '次调用' : key)
    )

    expect(price).toMatch(/\/次调用$/)
  })
})
