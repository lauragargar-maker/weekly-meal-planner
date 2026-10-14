import { describe, expect, it } from 'vitest'
import { isValidRecipeUrl, recipeSiteName } from './recipeLinks'

describe('isValidRecipeUrl', () => {
  it('accepts an https link', () => {
    expect(isValidRecipeUrl('https://www.directoalpaladar.com/recetas-de-legumbres/lentejas')).toBe(true)
  })

  it('tolerates surrounding spaces from a paste', () => {
    expect(isValidRecipeUrl('  https://bonviveur.es/recetas/cocido  ')).toBe(true)
  })

  it('rejects http and links without a scheme', () => {
    expect(isValidRecipeUrl('http://bonviveur.es/recetas/cocido')).toBe(false)
    expect(isValidRecipeUrl('bonviveur.es/recetas/cocido')).toBe(false)
  })

  it('rejects something that is not a web address', () => {
    expect(isValidRecipeUrl('https://')).toBe(false)
    expect(isValidRecipeUrl('https://localhost')).toBe(false)
    expect(isValidRecipeUrl('')).toBe(false)
  })

  it('rejects a link longer than the database allows', () => {
    expect(isValidRecipeUrl('https://a.com/' + 'x'.repeat(500))).toBe(false)
  })
})

describe('recipeSiteName', () => {
  it('names the known sites, with or without www', () => {
    expect(recipeSiteName('https://www.directoalpaladar.com/x')).toBe('Directo al Paladar')
    expect(recipeSiteName('https://bonviveur.es/x')).toBe('Bon Viveur')
    expect(recipeSiteName('https://www.cocinaabierta.co/x')).toBe('Cocina Abierta')
  })

  it('falls back to the bare host', () => {
    expect(recipeSiteName('https://www.example.org/receta')).toBe('example.org')
  })
})
