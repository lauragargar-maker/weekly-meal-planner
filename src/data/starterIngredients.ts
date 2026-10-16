import { StoreSection } from '../types'
import { toKey } from '../lib/nameKey'

export interface StarterIngredient {
  name: string
  section: StoreSection
  /** "Básico de casa" by default. Each household can change it. */
  is_staple?: boolean
}

/**
 * The ingredients the starter catalogue's dishes are written with, and the
 * section each is bought in. docs/shopping-list-spec.md §6.1.
 *
 * Two jobs:
 * - seeding a household's ingredient catalogue (spec §6.2), and
 * - guessing the section and staple flag of an ingredient a user types by hand
 *   (spec §4.2), so "cebolla" lands as a staple and "merluza" in Pescadería
 *   without anyone choosing.
 *
 * Staples are the spec's list (D8): salt, pepper, oils, vinegar, sugar, flour,
 * the usual spices and herbs, water, garlic and onion. Eggs, milk and bread are
 * bought, not staples.
 *
 * Like the dish catalogue, this is a template copied per household: editing it
 * changes new households and the guesses, never what a household already has.
 */
export const STARTER_INGREDIENTS: StarterIngredient[] = [
  // Básicos de casa
  { name: 'Sal', section: 'grocery', is_staple: true },
  { name: 'Pimienta negra', section: 'grocery', is_staple: true },
  { name: 'Aceite de oliva', section: 'grocery', is_staple: true },
  { name: 'Aceite de girasol', section: 'grocery', is_staple: true },
  { name: 'Vinagre', section: 'grocery', is_staple: true },
  { name: 'Azúcar', section: 'grocery', is_staple: true },
  { name: 'Harina', section: 'grocery', is_staple: true },
  { name: 'Pimentón', section: 'grocery', is_staple: true },
  { name: 'Orégano', section: 'grocery', is_staple: true },
  { name: 'Laurel', section: 'grocery', is_staple: true },
  { name: 'Perejil seco', section: 'grocery', is_staple: true },
  { name: 'Comino', section: 'grocery', is_staple: true },
  { name: 'Nuez moscada', section: 'grocery', is_staple: true },
  { name: 'Agua', section: 'drinks', is_staple: true },
  { name: 'Ajo', section: 'produce', is_staple: true },
  { name: 'Cebolla', section: 'produce', is_staple: true },

  // Fruta y verdura
  { name: 'Tomate', section: 'produce' },
  { name: 'Lechuga', section: 'produce' },
  { name: 'Pepino', section: 'produce' },
  { name: 'Pimiento verde', section: 'produce' },
  { name: 'Pimiento rojo', section: 'produce' },
  { name: 'Calabacín', section: 'produce' },
  { name: 'Berenjena', section: 'produce' },
  { name: 'Zanahoria', section: 'produce' },
  { name: 'Patata', section: 'produce' },
  { name: 'Calabaza', section: 'produce' },
  { name: 'Puerro', section: 'produce' },
  { name: 'Apio', section: 'produce' },
  { name: 'Judías verdes', section: 'produce' },
  { name: 'Espinacas', section: 'produce' },
  { name: 'Brócoli', section: 'produce' },
  { name: 'Coliflor', section: 'produce' },
  { name: 'Champiñones', section: 'produce' },
  { name: 'Limón', section: 'produce' },
  { name: 'Melón', section: 'produce' },
  { name: 'Perejil fresco', section: 'produce' },
  { name: 'Albahaca', section: 'produce' },
  { name: 'Plátano', section: 'produce' },
  { name: 'Repollo', section: 'produce' },

  // Carnicería
  { name: 'Pollo entero', section: 'meat' },
  { name: 'Pollo troceado', section: 'meat' },
  { name: 'Pechugas de pollo', section: 'meat' },
  { name: 'Alitas de pollo', section: 'meat' },
  { name: 'Filetes de ternera', section: 'meat' },
  { name: 'Ternera para guisar', section: 'meat' },
  { name: 'Solomillo de ternera', section: 'meat' },
  { name: 'Carne picada', section: 'meat' },
  { name: 'Lomo de cerdo', section: 'meat' },
  { name: 'Chuletas de cerdo', section: 'meat' },
  { name: 'Costillas de cerdo', section: 'meat' },
  { name: 'Chuletas de cordero', section: 'meat' },
  { name: 'Pechuga de pavo', section: 'meat' },
  { name: 'Morcillo de ternera', section: 'meat' },
  { name: 'Hueso de caldo', section: 'meat' },
  { name: 'Gallina', section: 'meat' },

  // Pescadería
  { name: 'Merluza', section: 'fish' },
  { name: 'Salmón', section: 'fish' },
  { name: 'Bacalao', section: 'fish' },
  { name: 'Bonito', section: 'fish' },
  { name: 'Sepia', section: 'fish' },
  { name: 'Lubina', section: 'fish' },
  { name: 'Dorada', section: 'fish' },
  { name: 'Sardinas', section: 'fish' },
  { name: 'Boquerones', section: 'fish' },
  { name: 'Gambas', section: 'fish' },
  { name: 'Calamares', section: 'fish' },
  { name: 'Mejillones', section: 'fish' },
  { name: 'Rape', section: 'fish' },

  // Charcutería y quesos
  { name: 'Jamón serrano', section: 'deli' },
  { name: 'Jamón york', section: 'deli' },
  { name: 'Chorizo', section: 'deli' },
  { name: 'Morcilla', section: 'deli' },
  { name: 'Panceta', section: 'deli' },
  { name: 'Bacon', section: 'deli' },
  { name: 'Lacón', section: 'deli' },
  { name: 'Queso rallado', section: 'deli' },
  { name: 'Queso en lonchas', section: 'deli' },
  { name: 'Mozzarella', section: 'deli' },
  { name: 'Provolone', section: 'deli' },

  // Lácteos y huevos
  { name: 'Huevos', section: 'dairy_eggs' },
  { name: 'Leche', section: 'dairy_eggs' },
  { name: 'Nata para cocinar', section: 'dairy_eggs' },
  { name: 'Mantequilla', section: 'dairy_eggs' },
  { name: 'Yogur natural', section: 'dairy_eggs' },

  // Panadería
  { name: 'Pan', section: 'bakery' },
  { name: 'Pan de molde', section: 'bakery' },
  { name: 'Pan de hamburguesa', section: 'bakery' },
  { name: 'Masa de pizza', section: 'bakery' },
  { name: 'Masa de hojaldre', section: 'bakery' },

  // Alimentación
  { name: 'Macarrones', section: 'grocery' },
  { name: 'Espaguetis', section: 'grocery' },
  { name: 'Fideos', section: 'grocery' },
  { name: 'Fideos de fideuá', section: 'grocery' },
  { name: 'Placas de lasaña', section: 'grocery' },
  { name: 'Pasta corta', section: 'grocery' },
  { name: 'Arroz', section: 'grocery' },
  { name: 'Lentejas', section: 'grocery' },
  { name: 'Garbanzos', section: 'grocery' },
  { name: 'Judías pintas', section: 'grocery' },
  { name: 'Fabes', section: 'grocery' },
  { name: 'Tomate frito', section: 'grocery' },
  { name: 'Tomate triturado', section: 'grocery' },
  { name: 'Atún en lata', section: 'grocery' },
  { name: 'Aceitunas', section: 'grocery' },
  { name: 'Mayonesa', section: 'grocery' },
  { name: 'Pan rallado', section: 'grocery' },
  { name: 'Caldo de pollo', section: 'grocery' },
  { name: 'Caldo de pescado', section: 'grocery' },
  { name: 'Caldo de carne', section: 'grocery' },
  { name: 'Maíz dulce', section: 'grocery' },
  { name: 'Pimientos del piquillo', section: 'grocery' },
  { name: 'Azafrán', section: 'grocery' },
  { name: 'Mostaza', section: 'grocery' },
  { name: 'Miel', section: 'grocery' },
  { name: 'Salsa de soja', section: 'grocery' },
  { name: 'Nueces', section: 'grocery' },
  { name: 'Vino blanco', section: 'drinks' },

  // Congelados
  { name: 'Guisantes', section: 'frozen' },
]

const BY_KEY = new Map(STARTER_INGREDIENTS.map((ingredient) => [toKey(ingredient.name), ingredient]))

/**
 * Section and staple flag for an ingredient typed by hand: the starter entry's
 * when the name matches one, and "Otros", bought, when it doesn't.
 */
export const guessIngredient = (name: string): { section: StoreSection; is_staple: boolean } => {
  const known = BY_KEY.get(toKey(name))
  return { section: known?.section ?? 'other', is_staple: known?.is_staple ?? false }
}
