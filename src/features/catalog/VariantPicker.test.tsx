/**
 * The Phase 4 gate: sold-out variants are disabled on the PDP, not hidden.
 * No seeded product variant is actually at 0 stock (checked directly against
 * the database), so this is the only place that path gets exercised.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariantPicker } from './VariantPicker'

const variants = [
  { id: 'v-s', label: 'S', stock: 10, is_active: true },
  { id: 'v-m', label: 'M', stock: 0, is_active: true }, // sold out
  { id: 'v-l', label: 'L', stock: 5, is_active: false }, // deactivated by admin
]

describe('VariantPicker', () => {
  it('disables a sold-out variant', () => {
    render(<VariantPicker variants={variants} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'M' })).toBeDisabled()
  })

  it('disables a deactivated variant even with stock left', () => {
    render(<VariantPicker variants={variants} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'L' })).toBeDisabled()
  })

  it('leaves an in-stock, active variant enabled and clickable', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<VariantPicker variants={variants} selectedId={null} onSelect={onSelect} />)

    const sizeS = screen.getByRole('radio', { name: 'S' })
    expect(sizeS).toBeEnabled()

    await user.click(sizeS)
    expect(onSelect).toHaveBeenCalledWith('v-s')
  })

  it('does not call onSelect when a disabled variant is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<VariantPicker variants={variants} selectedId={null} onSelect={onSelect} />)

    await user.click(screen.getByRole('radio', { name: 'M' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows the sold-out/deactivated variant, not hides it', () => {
    render(<VariantPicker variants={variants} selectedId={null} onSelect={vi.fn()} />)
    // All three render -- the point is a customer sees the size exists.
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })
})
