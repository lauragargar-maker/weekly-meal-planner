import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { getErrorMessage, translateError } from '../lib/errorMessages'
import { Household } from '../types'

interface FamilyViewProps {
  household: Household
}

/** "67676767" → "6767 6767", for display only. */
const formatJoinCode = (code: string): string =>
  code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code

export default function FamilyView({ household }: FamilyViewProps) {
  const { session, signOut, refreshHousehold } = useAuth()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(household.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingName])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const startEditing = () => {
    setName(household.name)
    setError(null)
    setEditingName(true)
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    if (trimmed === household.name) {
      setEditingName(false)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('households')
        .update({ name: trimmed })
        .eq('id', household.id)
      if (updateError) throw updateError
      await refreshHousehold()
      setEditingName(false)
    } catch (err) {
      console.error('Error renaming household:', err)
      setError(translateError(getErrorMessage(err), 'No se pudo cambiar el nombre'))
    } finally {
      setSaving(false)
    }
  }

  const shareCode = async () => {
    const text = `Únete a ${household.name} en ¡Ñam! con el código ${household.join_code}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(household.join_code)
      setToast('Código copiado')
    } catch (err) {
      // The user dismissing the share sheet lands here too; only report real failures.
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Error sharing join code:', err)
      setToast('No se pudo compartir el código')
    }
  }

  return (
    <div>
      <header>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveName()
                }
                if (e.key === 'Escape') setEditingName(false)
              }}
              readOnly={saving}
              aria-label="Nombre de la casa"
              className="flex-1 rounded-[14px] border-2 border-tinta-900 bg-white px-3 py-2 text-xl font-extrabold text-tinta-900 focus:outline-none focus:ring-2 focus:ring-verde-500 lg:text-2xl"
            />
            <button
              onClick={saveName}
              disabled={saving}
              aria-label="Guardar el nombre"
              className="flex-none rounded-xl bg-verde-600 px-3.5 py-2 text-white transition-colors duration-120 hover:bg-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving ? (
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                '✓'
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold lg:text-[30px]">{household.name}</h1>
            <button
              onClick={startEditing}
              aria-label="Editar el nombre de la casa"
              className="text-tinta-300 hover:text-tinta-500 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 rounded-full p-1 lg:text-xl"
            >
              ✎
            </button>
          </div>
        )}
        {error && (
          <p className="error-nam" role="alert">
            {error}
          </p>
        )}
      </header>

      {/* Single column while the members list is pending; becomes grid-cols-2 when it lands. */}
      <div className="mt-4 max-w-[620px] lg:mt-6">
        <div className="rounded-card bg-amarillo-500 py-[18px] px-5 shadow-pop-sm lg:py-6 lg:px-[26px]">
          <p className="text-[13px] font-extrabold tracking-[0.08em] text-amarillo-700">
            CÓDIGO DE LA CASA
          </p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <p
              className="text-[32px] font-extrabold tracking-[0.08em] text-tinta-900 lg:text-[40px]"
              aria-label={`Código de la casa: ${household.join_code.split('').join(' ')}`}
            >
              {formatJoinCode(household.join_code)}
            </p>
            <button
              onClick={shareCode}
              className="flex-none rounded-full bg-tinta-900 px-[18px] py-2 text-sm font-extrabold text-crema-100 transition-colors duration-120 hover:bg-tinta-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-tinta-900 lg:px-6 lg:py-2.5 lg:text-[15px]"
            >
              Compartir
            </button>
          </div>
          <p className="mt-2 text-[13px] font-bold font-sans text-amarillo-700 lg:text-sm">
            Con este código tu familia entra a ver el plan.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={() => signOut()}
          className="rounded-full px-3.5 py-2.5 text-[15px] font-extrabold text-verde-500 underline decoration-2 underline-offset-4 transition-colors duration-120 hover:text-verde-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
        >
          Cerrar sesión
        </button>
        <p className="mt-1 px-3.5 text-[13px] font-bold font-sans text-tinta-500">
          {session?.user?.email}
        </p>
      </div>

      {toast && (
        <div
          className="anim-toast fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-tinta-900 px-5 py-3 text-sm font-extrabold text-crema-100 shadow-toast"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
