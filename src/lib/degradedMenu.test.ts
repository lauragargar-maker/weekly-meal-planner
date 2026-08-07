import { describe, expect, it } from 'vitest'
import { describeDegradedMenu } from './degradedMenu'
import { CatalogRequirement } from '../utils/catalogCheck'

const req = (
  label: string,
  have: number,
  need: number,
  hint?: string
): CatalogRequirement => ({ label, have, need, met: have >= need, hint })

describe('describeDegradedMenu', () => {
  it('blames the rules, not the catalogue, when every minimum is met', () => {
    // The counts add up and the week still could not be built: telling this
    // household to add dishes would be bad advice, because dishes are not the
    // problem.
    const { title, detail } = describeDegradedMenu([])

    expect(title).toContain('no cumple todas vuestras reglas')
    expect(detail).toContain('suavizar')
    expect(detail).not.toContain('Faltan')
  })

  it('names the shortfall with both numbers', () => {
    const { title, detail } = describeDegradedMenu([req('Platos de pescado', 1, 4)])

    expect(title).toContain('platos de pescado')
    expect(detail).toContain('4')
    expect(detail).toContain('1')
  })

  it('leads with the biggest gap, not the first one', () => {
    // Fixing the widest gap is the best use of the next five minutes, and it is
    // the one most likely to have actually blocked the generator.
    const { title } = describeDegradedMenu([
      req('Platos de pescado', 3, 4),
      req('Primeros para cenas', 1, 7),
      req('Platos únicos', 2, 3),
    ])

    expect(title).toContain('primeros para cenas')
  })

  it('uses the requirement\'s own hint when it has one', () => {
    const { detail } = describeDegradedMenu([
      req('Platos de legumbre para comidas', 0, 1, 'Guárdala como segundo, no como plato único.'),
    ])

    expect(detail).toContain('Guárdala como segundo')
  })

  it('falls back to generic advice when the requirement has no hint', () => {
    const { detail } = describeDegradedMenu([req('Platos de pescado', 0, 2)])

    expect(detail).toContain('Ajustes de la casa')
  })

  it('mentions how many other minimums are short, with the right plural', () => {
    const two = describeDegradedMenu([req('A', 0, 5), req('B', 0, 2)])
    expect(two.detail).toContain('1 mínimo más')

    const three = describeDegradedMenu([req('A', 0, 5), req('B', 0, 2), req('C', 0, 2)])
    expect(three.detail).toContain('2 mínimos más')

    const one = describeDegradedMenu([req('A', 0, 5)])
    expect(one.detail).not.toContain('más sin cubrir')
  })
})
