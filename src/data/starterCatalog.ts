import { NewDishIdea } from '../types'

/**
 * Suggested starter catalog for new households (Spanish home cooking).
 * Sized so the generator's rules are satisfiable out of the box:
 * plenty of non-pasta mains for dinners, 2+ fish dishes, legume lunches,
 * starters and single-course meals, and a few weekend-only classics.
 *
 * `main_ingredients` lists everything the dish actually brings, not one headline
 * ingredient: a lasagna is pasta AND meat, and the same-day rules only work if
 * both are declared. Sauces and garnishes are left out — the tomato in "bacalao
 * con tomate" is not a serving of vegetables, and tagging it as one would let a
 * household believe a rule was met when it wasn't.
 *
 * This constant is a starting template, not a shared library: it is copied into
 * per-household rows at onboarding, so editing it only affects households
 * created afterwards. Existing households keep whatever they already have.
 *
 * The vegetable starters marked `both` are load-bearing: they are what a
 * two-course dinner draws on once that rule exists.
 */
export const STARTER_CATALOG: NewDishIdea[] = [
  // Primeros (starters)
  { name: 'Gazpacho', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Crema de calabacín', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Ensalada mixta', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Sopa de fideos', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Judías verdes con patata', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'potato'] },
  { name: 'Ensaladilla rusa', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'potato'] },
  { name: 'Crema de verduras', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Puré de calabaza', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Ensalada de tomate y mozarella', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Brócoli con mayonesa', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Ensalada de espinacas', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Salmorejo', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Guisantes con jamón', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Espinacas con bechamel', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Crema fría de melón con jamón', category: 'starter', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['vegetable'] },

  // Segundos de pescado (fish mains)
  { name: 'Merluza a la romana', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Salmón a la plancha', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Bacalao con tomate', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Bonito con tomate', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Sepia con ajo y perejil', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Lubina a la espalda', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Sardinas a la plancha', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Boquerones fritos', category: 'main', meal_type: 'dinner', day_type: 'weekendday', main_ingredients: ['fish'] },
  { name: 'Dorada al horno', category: 'main', meal_type: 'dinner', day_type: 'weekendday', main_ingredients: ['fish'] },

  // Segundos de carne (meat mains)
  { name: 'Pollo asado', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Filete de ternera', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Lomo a la plancha', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pechuga de pavo', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pollo empanado', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Alitas al horno / Airfrier', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Albóndigas en salsa', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Estofado de ternera', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'meat', 'potato'] },
  { name: 'Chuletas de cordero', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Chuleta de cerdo plancha', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Solomillo Wellington', category: 'main', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['meat'] },
  { name: 'Hamburguesa casera', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Croquetas de jamón', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Sandwich mixto', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  // A `main` rather than a `single` so the generator can actually reach it at
  // dinner, and tagged meat rather than pasta so a household that keeps pasta
  // off the evening menu still gets it.
  { name: 'Pizza casera', category: 'main', meal_type: 'dinner', day_type: 'weekendday', main_ingredients: ['meat'] },

  // Segundos de huevo (egg mains)
  { name: 'Tortilla de patatas', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['egg', 'potato'] },
  { name: 'Huevos rellenos de atún', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish', 'egg'] },
  { name: 'Tortilla francesa', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['egg'] },
  { name: 'Huevos rellenos', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['egg'] },
  { name: 'Revuelto de champiñones', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['vegetable', 'egg'] },
  { name: 'Tortilla de calabacín', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['vegetable', 'egg', 'potato'] },
  { name: 'Huevos fritos con bacon', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat', 'egg'] },

  // Segundos de verdura (vegetable mains)
  { name: 'Verduras a la plancha', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Coliflor gratinada', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['vegetable'] },

  // Pasta y arroz para comidas (lunch-only carb mains; the generator never puts pasta at dinner)
  { name: 'Macarrones con tomate', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Espaguetis a la carbonara', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Arroz a la cubana', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['rice', 'egg'] },

  // Filed as a `main` rather than a `single`, deliberately: legumes are one-dish
  // meals in Spanish home cooking, so every other legume dish here is a `single`
  // — and a household that always eats a starter and a main could then never be
  // served one, which is Erika's exact configuration. This gives that household
  // one legume it can reach. A short-term fix; the real answer is either more
  // legume seconds or a generator that accepts a single as a second course.
  { name: 'Lentejas con verduras', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'legume'] },

  // Platos únicos (single-course lunches)
  { name: 'Cocido', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat', 'legume'] },
  { name: 'Garbanzos con espinacas', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'legume'] },
  { name: 'Judías pintas con arroz', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['rice', 'legume'] },
  { name: 'Arroz con pollo', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat', 'rice'] },
  { name: 'Lasaña de carne', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat', 'pasta'] },
  { name: 'Ensalada de pasta', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'pasta'] },
  { name: 'Macarrones con chorizo', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat', 'pasta'] },
  { name: 'Espaguettis boloñesa', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat', 'pasta'] },
  { name: 'Guiso de patatas con costillas', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat', 'potato'] },
  { name: 'Paella mixta', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['meat', 'rice'] },
  { name: 'Fideuá', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['fish', 'pasta'] },
  { name: 'Fabada asturiana', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['meat', 'legume'] },
]
