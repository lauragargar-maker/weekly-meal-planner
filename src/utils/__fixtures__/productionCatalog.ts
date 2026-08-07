import { NewDishIdea } from '../../types'

/**
 * The real catalogue of the founder household, as it stood in production on
 * 2026-08-05, with the ingredients the M1 data patch assigns.
 *
 * It exists because the starter catalogue is a poor test subject: it was built
 * so the generator's rules are satisfiable, so it proves nothing about a
 * household that grew its own list. This one did — 63 dishes, roughly half of
 * them meat, only two legume lunches and both weekday-only — and it is the
 * catalogue that will break first when the rules become configurable.
 *
 * A snapshot, not a live mirror. It is here to be a hard case, so it stays as it
 * was even if the household edits its dishes afterwards.
 */
export const PRODUCTION_CATALOG: NewDishIdea[] = [
  { name: 'Alitas de pollo', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Arroz a la cubana', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['rice', 'egg'] },
  { name: 'Bonito con tomate', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Boquerones', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Brócoli', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Chuleta de cordero', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Chuletas de cerdo', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Cocido', category: 'single', meal_type: 'lunch', day_type: 'weekday', main_ingredients: ['meat', 'legume'] },
  { name: 'Codillo de cerdo', category: 'main', meal_type: 'lunch', day_type: 'weekday', main_ingredients: ['meat'] },
  { name: 'Coliflor', category: 'starter', meal_type: 'lunch', day_type: 'weekday', main_ingredients: ['vegetable'] },
  { name: 'Crema de calabacín', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Crema de calabaza', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Crema de verduras', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Crema fría de melón con jamón', category: 'starter', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['vegetable'] },
  { name: 'Croquetas', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Dorada a la plancha', category: 'main', meal_type: 'both', day_type: 'weekday', main_ingredients: ['fish'] },
  { name: 'Dorada al horno', category: 'main', meal_type: 'dinner', day_type: 'weekendday', main_ingredients: ['fish'] },
  { name: 'Empanadas Malvón', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Ensalada de pasta', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable', 'pasta'] },
  { name: 'Entrecot de ternera', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Espinacas con bechamel', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Gazpacho', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Hamburguesa', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Huevos fritos', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['egg'] },
  { name: 'Judías verdes', category: 'starter', meal_type: 'both', day_type: 'weekday', main_ingredients: ['vegetable'] },
  { name: 'Lasaña casera', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['pasta', 'meat'] },
  { name: 'Lentejas', category: 'single', meal_type: 'lunch', day_type: 'weekday', main_ingredients: ['vegetable', 'legume'] },
  { name: 'Lomo de cerdo', category: 'main', meal_type: 'both', day_type: 'weekday', main_ingredients: ['meat'] },
  { name: 'Lubina a la plancha', category: 'main', meal_type: 'both', day_type: 'weekday', main_ingredients: ['fish'] },
  { name: 'Lubina al horno', category: 'main', meal_type: 'dinner', day_type: 'weekendday', main_ingredients: ['fish'] },
  { name: 'Macarrones con chistorra', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta', 'meat'] },
  { name: 'Macarrones con queso', category: 'single', meal_type: 'lunch', day_type: 'weekday', main_ingredients: ['pasta'] },
  { name: 'Merluza a la romana', category: 'main', meal_type: 'both', day_type: 'weekday', main_ingredients: ['fish'] },
  { name: 'Merluza con bechamel', category: 'main', meal_type: 'dinner', day_type: 'weekendday', main_ingredients: ['fish'] },
  { name: 'Mini hamburguesas', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Ñoquis', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['potato'] },
  { name: 'Paella', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['rice', 'meat'] },
  { name: 'Panecito', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pasta al pesto', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Pincho moruno', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pizza', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pizzapan', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pollo a la plancha', category: 'main', meal_type: 'lunch', day_type: 'weekday', main_ingredients: ['meat'] },
  { name: 'Pollo al horno', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Pollo con frutos secos', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['meat'] },
  { name: 'Pollo empanado', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Quesadillas', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Quiche Lorraine', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['egg'] },
  { name: 'Risotto', category: 'main', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['rice'] },
  { name: 'Salmón a la plancha', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['fish'] },
  { name: 'Salmorejo', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['vegetable'] },
  { name: 'Sandwich mixto', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Solomillo con roquefort', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Solomillo de ternera', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Solomillo Wellington', category: 'main', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['meat'] },
  { name: 'Sopa de fideos', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Sopa de letras', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Spaguetti boloñesa', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta', 'meat'] },
  { name: 'Spaguetti carbonara', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['pasta'] },
  { name: 'Tacos', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredients: ['meat'] },
  { name: 'Ternera a la plancha', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredients: ['meat'] },
  { name: 'Tortilla de patatas', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['egg', 'potato'] },
  { name: 'Tortilla francesa', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['egg'] },
]
