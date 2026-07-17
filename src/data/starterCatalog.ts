import { NewDishIdea } from '../types'

/**
 * Suggested starter catalog for new households (Spanish home cooking).
 * Sized so the generator's rules are satisfiable out of the box:
 * plenty of non-pasta mains for dinners, 2+ fish dishes, legume lunches,
 * starters and single-course meals, and a few weekend-only classics.
 */
export const STARTER_CATALOG: NewDishIdea[] = [
  // Primeros (starters)
  { name: 'Gazpacho', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Crema de calabacín', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Ensalada mixta', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Sopa de fideos', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredient: 'pasta' },
  { name: 'Judías verdes con patata', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Ensaladilla rusa', category: 'starter', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Crema de verduras', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Puré de calabaza', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Ensalada de tomate y cebolla', category: 'starter', meal_type: 'both', day_type: 'anyday', main_ingredient: 'vegetable' },

  // Segundos de pescado (fish mains)
  { name: 'Merluza a la plancha', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'fish' },
  { name: 'Salmón al horno', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'fish' },
  { name: 'Bacalao con tomate', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'fish' },
  { name: 'Lubina a la espalda', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'fish' },
  { name: 'Sardinas a la plancha', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'fish' },
  { name: 'Sepia con ajo y perejil', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'fish' },

  // Segundos de carne (meat mains)
  { name: 'Pollo asado', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Filete de ternera', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Albóndigas en salsa', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Lomo a la plancha', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Pechuga de pavo', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Hamburguesa casera', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Estofado de ternera', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'meat' },

  // Segundos de huevo (egg mains)
  { name: 'Tortilla de patatas', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredient: 'egg' },
  { name: 'Tortilla francesa', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'egg' },
  { name: 'Huevos rellenos', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'egg' },
  { name: 'Revuelto de champiñones', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'egg' },

  // Segundos de verdura (vegetable mains)
  { name: 'Verduras a la plancha con queso', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Pisto con arroz', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'vegetable' },
  { name: 'Coliflor gratinada', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredient: 'vegetable' },

  // Pasta y arroz para comidas (lunch-only carb mains; the generator never puts pasta at dinner)
  { name: 'Macarrones con tomate', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'pasta' },
  { name: 'Espaguetis a la carbonara', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'pasta' },
  { name: 'Arroz a la cubana', category: 'main', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'pasta' },

  // Platos únicos (single-course lunches)
  { name: 'Paella mixta', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredient: 'pasta' },
  { name: 'Fideuá', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredient: 'pasta' },
  { name: 'Lentejas con verduras', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'legume' },
  { name: 'Cocido de garbanzos', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'legume' },
  { name: 'Fabada asturiana', category: 'single', meal_type: 'lunch', day_type: 'weekendday', main_ingredient: 'legume' },
  { name: 'Garbanzos con espinacas', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'legume' },
  { name: 'Judías pintas con arroz', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'legume' },
  { name: 'Arroz con pollo', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'meat' },
  { name: 'Lasaña de carne', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'pasta' },
  { name: 'Ensalada de pasta', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'pasta' },
  { name: 'Marmitako de atún', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'fish' },
  { name: 'Guiso de patatas con costillas', category: 'single', meal_type: 'lunch', day_type: 'anyday', main_ingredient: 'meat' },
]
