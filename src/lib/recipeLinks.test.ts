import { describe, expect, it } from 'vitest'
import { isValidRecipeUrl, normalizeRecipeUrl, recipeSiteName } from './recipeLinks'

describe('normalizeRecipeUrl', () => {
  it('keeps an https link as it is', () => {
    expect(normalizeRecipeUrl('https://www.directoalpaladar.com/recetas-de-legumbres/lentejas')).toBe(
      'https://www.directoalpaladar.com/recetas-de-legumbres/lentejas'
    )
  })

  it('accepts a Google Drive file and a plain http site', () => {
    expect(normalizeRecipeUrl('https://drive.google.com/file/d/abc123/view?usp=sharing')).not.toBeNull()
    expect(normalizeRecipeUrl('http://recetasdelaabuela.es/cocido')).toBe('http://recetasdelaabuela.es/cocido')
  })

  it('adds https:// to a link pasted without it, and trims spaces', () => {
    expect(normalizeRecipeUrl('  bonviveur.es/recetas/cocido  ')).toBe('https://bonviveur.es/recetas/cocido')
  })

  it('refuses anything a browser would not open as a web page', () => {
    expect(normalizeRecipeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeRecipeUrl('data:text/html,hola')).toBeNull()
    expect(normalizeRecipeUrl('mi receta favorita')).toBeNull()
    expect(normalizeRecipeUrl('https://localhost')).toBeNull()
    expect(normalizeRecipeUrl('')).toBeNull()
  })

  it('refuses a link longer than the database allows', () => {
    expect(normalizeRecipeUrl('https://a.com/' + 'x'.repeat(500))).toBeNull()
  })

  it('agrees with isValidRecipeUrl', () => {
    expect(isValidRecipeUrl('bonviveur.es/x')).toBe(true)
    expect(isValidRecipeUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('recipeSiteName', () => {
  it('names the known sites, with or without www', () => {
    expect(recipeSiteName('https://www.directoalpaladar.com/x')).toBe('Directo al Paladar')
    expect(recipeSiteName('https://bonviveur.es/x')).toBe('Bon Viveur')
    expect(recipeSiteName('https://www.cocinaabierta.co/x')).toBe('Cocina Abierta')
  })

  it('names Google Drive and Docs', () => {
    expect(recipeSiteName('https://drive.google.com/file/d/abc/view')).toBe('Google Drive')
    expect(recipeSiteName('https://docs.google.com/document/d/abc')).toBe('Google Docs')
  })

  it('falls back to the bare host', () => {
    expect(recipeSiteName('https://www.example.org/receta')).toBe('example.org')
  })
})
