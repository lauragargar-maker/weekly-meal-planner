import { describe, expect, it } from 'vitest'
import { cleanName, toKey } from './nameKey'

describe('toKey', () => {
  it('ignores case and surrounding spaces', () => {
    expect(toKey('  Tomate ')).toBe('tomate')
    expect(toKey('TOMATE')).toBe('tomate')
  })

  it('collapses inner whitespace', () => {
    expect(toKey('Chuletas   de\tcerdo')).toBe('chuletas de cerdo')
  })

  it('drops accents', () => {
    expect(toKey('Calabacín')).toBe('calabacin')
    expect(toKey('Limón')).toBe('limon')
    expect(toKey('Pingüino')).toBe('pinguino')
  })

  it('keeps the ñ, in either case', () => {
    expect(toKey('Piña')).toBe('piña')
    expect(toKey('PIÑA')).toBe('piña')
    expect(toKey('piña')).not.toBe(toKey('pina'))
  })

  it('treats the composed and decomposed forms of an accent alike', () => {
    expect(toKey('Calabacín')).toBe(toKey('Calabacín'))
    expect(toKey('Piña')).toBe('piña')
  })
})

describe('cleanName', () => {
  it('trims and collapses spaces but keeps the case', () => {
    expect(cleanName('  Pimiento   Rojo ')).toBe('Pimiento Rojo')
  })
})
