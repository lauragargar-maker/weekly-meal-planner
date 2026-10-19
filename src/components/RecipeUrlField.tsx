import { RECIPE_URL_MAX_LENGTH, normalizeRecipeUrl, recipeSiteName } from '../lib/recipeLinks'

interface RecipeUrlFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
}

/**
 * The optional "Receta recomendada" link of a dish (docs/shopping-list-spec.md
 * §4.2), in the dish editor and in the guided flow. The caller stores
 * `normalizeRecipeUrl(value)` and blocks saving while that is null for a
 * non-empty value; this field only says so.
 */
export default function RecipeUrlField({ id, value, onChange }: RecipeUrlFieldProps) {
  const trimmed = value.trim()
  const normalized = normalizeRecipeUrl(trimmed)
  const invalid = trimmed !== '' && normalized === null
  return (
    <div className="mt-[18px] lg:mt-5">
      <label className="label-nam" htmlFor={id}>
        Receta recomendada <span className="normal-case tracking-normal text-tinta-400">(opcional)</span>
      </label>
      <input
        id={id}
        type="url"
        inputMode="url"
        value={value}
        maxLength={RECIPE_URL_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enlace a una web de recetas o a tu Drive"
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        className={`input-nam !bg-crema-100 lg:!bg-white ${invalid ? '!border-rojo-500' : ''}`}
      />
      {invalid ? (
        <p id={`${id}-help`} className="error-nam">
          Ese enlace no parece una dirección web. Cópialo desde el navegador o desde Drive.
        </p>
      ) : (
        <p id={`${id}-help`} className="help-nam">
          {normalized ? `Se verá como «Ver receta en ${recipeSiteName(normalized)}».` : 'Un enlace a la receta en una web de cocina.'}
        </p>
      )}
    </div>
  )
}
