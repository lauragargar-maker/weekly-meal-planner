/**
 * What each starter-catalogue dish takes, and the recipe it recommends.
 * docs/shopping-list-spec.md §6.1.
 *
 * Keyed by the dish's name exactly as `STARTER_CATALOG` spells it; a test
 * checks every dish has an entry and every ingredient is in
 * `STARTER_INGREDIENTS`. Ingredients go in the order the dish sheet shows them:
 * what gets bought first, the staples after.
 *
 * Everything that has to be in the kitchen counts, sauces and garnishes
 * included — the tomato in "Bacalao con tomate" is bought even though
 * `main_ingredients` leaves it out on purpose.
 *
 * Every recipe link was checked on 2026-10-14 against the site's own index: it
 * exists and it is that dish. A dish with no good match has no link rather than
 * a near miss.
 */
export const STARTER_DISH_DETAILS: Record<string, { ingredients: string[]; recipe_url?: string }> = {
  // Primeros
  Gazpacho: {
    ingredients: ['Tomate', 'Pimiento verde', 'Pepino', 'Pan', 'Ajo', 'Aceite de oliva', 'Vinagre', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/gazpacho-andaluz-casero',
  },
  'Crema de calabacín': {
    ingredients: ['Calabacín', 'Patata', 'Puerro', 'Nata para cocinar', 'Cebolla', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/crema-calabacin',
  },
  'Ensalada mixta': {
    ingredients: ['Lechuga', 'Tomate', 'Zanahoria', 'Huevos', 'Atún en lata', 'Maíz dulce', 'Aceitunas', 'Cebolla', 'Aceite de oliva', 'Vinagre', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/ensalada-mixta',
  },
  'Sopa de fideos': {
    ingredients: ['Fideos', 'Caldo de pollo', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/sopa-de-fideos',
  },
  'Judías verdes con patata': {
    ingredients: ['Judías verdes', 'Patata', 'Ajo', 'Pimentón', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/judias-verdes-patatas',
  },
  'Ensaladilla rusa': {
    ingredients: ['Patata', 'Zanahoria', 'Huevos', 'Atún en lata', 'Guisantes', 'Aceitunas', 'Mayonesa', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/ensaladilla-rusa-casera',
  },
  'Crema de verduras': {
    ingredients: ['Calabaza', 'Zanahoria', 'Puerro', 'Apio', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal', 'Pimienta negra'],
    recipe_url: 'https://www.bonviveur.es/recetas/crema-verduras',
  },
  'Puré de calabaza': {
    ingredients: ['Calabaza', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/pure-calabaza',
  },
  'Ensalada de tomate y mozarella': {
    ingredients: ['Tomate', 'Mozzarella', 'Albahaca', 'Aceite de oliva', 'Sal', 'Pimienta negra'],
    recipe_url: 'https://www.bonviveur.es/recetas/ensalada-caprese',
  },
  'Brócoli con mayonesa': {
    ingredients: ['Brócoli', 'Mayonesa', 'Sal'],
    // How to boil it; the mayonnaise needs no recipe.
    recipe_url: 'https://www.bonviveur.es/recetas/brocoli-cocido',
  },
  'Ensalada de espinacas': {
    ingredients: ['Espinacas', 'Champiñones', 'Nueces', 'Aceite de oliva', 'Vinagre', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/ensalada-espinacas',
  },
  Salmorejo: {
    ingredients: ['Tomate', 'Pan', 'Huevos', 'Jamón serrano', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/salmorejo-casero',
  },
  'Guisantes con jamón': {
    ingredients: ['Guisantes', 'Jamón serrano', 'Cebolla', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/guisantes-jamon',
  },
  'Espinacas con bechamel': {
    ingredients: ['Espinacas', 'Leche', 'Mantequilla', 'Queso rallado', 'Harina', 'Nuez moscada', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/espinacas-con-bechamel',
  },
  'Crema fría de melón con jamón': {
    ingredients: ['Melón', 'Jamón serrano', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/sopa-de-melon-con-jamon',
  },

  // Segundos de pescado
  'Merluza a la romana': {
    ingredients: ['Merluza', 'Huevos', 'Limón', 'Harina', 'Aceite de girasol', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/merluza-a-la-romana',
  },
  'Salmón a la plancha': {
    ingredients: ['Salmón', 'Limón', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/salmon-a-la-plancha',
  },
  'Bacalao con tomate': {
    ingredients: ['Bacalao', 'Tomate triturado', 'Perejil fresco', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal', 'Pimienta negra'],
    recipe_url: 'https://www.bonviveur.es/recetas/bacalao-con-tomate',
  },
  'Bonito con tomate': {
    ingredients: ['Bonito', 'Tomate triturado', 'Pimiento verde', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/bonito-con-tomate',
  },
  'Sepia con ajo y perejil': {
    ingredients: ['Sepia', 'Perejil fresco', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/sepia-a-la-plancha',
  },
  'Lubina a la espalda': {
    ingredients: ['Lubina', 'Patata', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/lubina-a-la-espalda',
  },
  'Sardinas a la plancha': {
    ingredients: ['Sardinas', 'Limón', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/sardinas-a-la-plancha',
  },
  'Boquerones fritos': {
    ingredients: ['Boquerones', 'Limón', 'Harina', 'Aceite de girasol', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/boquerones-fritos-rebozados-al-limon',
  },
  'Dorada al horno': {
    ingredients: ['Dorada', 'Patata', 'Vino blanco', 'Cebolla', 'Ajo', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/dorada-al-horno',
  },

  // Segundos de carne
  'Pollo asado': {
    ingredients: ['Pollo entero', 'Patata', 'Vino blanco', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal', 'Pimienta negra'],
    recipe_url: 'https://www.bonviveur.es/recetas/pollo-asado-horno-patatas',
  },
  'Filete de ternera': {
    ingredients: ['Filetes de ternera', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/filete-de-ternera-a-la-plancha',
  },
  'Lomo a la plancha': {
    ingredients: ['Lomo de cerdo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/lomo-de-cerdo-a-la-plancha',
  },
  'Pechuga de pavo': {
    ingredients: ['Pechuga de pavo', 'Ajo', 'Perejil seco', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/pechugas-de-pavo-a-la-plancha',
  },
  'Pollo empanado': {
    ingredients: ['Pechugas de pollo', 'Huevos', 'Pan rallado', 'Aceite de girasol', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/pechugas-de-pollo-empanadas',
  },
  'Alitas al horno / Airfrier': {
    ingredients: ['Alitas de pollo', 'Miel', 'Salsa de soja', 'Mostaza', 'Limón', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/alitas-de-pollo-en-el-horno',
  },
  'Albóndigas en salsa': {
    ingredients: ['Carne picada', 'Huevos', 'Pan', 'Leche', 'Zanahoria', 'Vino blanco', 'Caldo de carne', 'Cebolla', 'Ajo', 'Harina', 'Perejil seco', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/albondigas-en-salsa-de-la-abuela',
  },
  'Estofado de ternera': {
    ingredients: ['Ternera para guisar', 'Patata', 'Zanahoria', 'Guisantes', 'Tomate triturado', 'Vino blanco', 'Caldo de carne', 'Cebolla', 'Ajo', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/estofado-de-ternera-con-patatas-y-verduras',
  },
  'Chuletas de cordero': {
    ingredients: ['Chuletas de cordero', 'Perejil fresco', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/chuletas-de-cordero-a-la-plancha',
  },
  'Chuleta de cerdo plancha': {
    ingredients: ['Chuletas de cerdo', 'Aceite de oliva', 'Sal'],
    recipe_url:
      'https://www.directoalpaladar.com/recetas-de-carnes-y-aves/como-hacer-mejores-chuletas-cerdo-a-plancha-jugosas-churruscaditas',
  },
  'Solomillo Wellington': {
    ingredients: ['Solomillo de ternera', 'Masa de hojaldre', 'Champiñones', 'Mostaza', 'Huevos', 'Cebolla', 'Aceite de oliva', 'Sal', 'Pimienta negra'],
    recipe_url: 'https://www.bonviveur.es/recetas/solomillo-wellington-tradicional',
  },
  'Hamburguesa casera': {
    ingredients: ['Carne picada', 'Pan de hamburguesa', 'Queso en lonchas', 'Lechuga', 'Tomate', 'Cebolla', 'Aceite de oliva', 'Sal', 'Pimienta negra'],
    recipe_url: 'https://www.bonviveur.es/recetas/hamburguesas-de-carne-de-ternera',
  },
  'Croquetas de jamón': {
    ingredients: ['Jamón serrano', 'Leche', 'Mantequilla', 'Huevos', 'Pan rallado', 'Cebolla', 'Harina', 'Nuez moscada', 'Aceite de girasol', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/croquetas-de-jamon-caseras',
  },
  'Sandwich mixto': {
    ingredients: ['Pan de molde', 'Jamón york', 'Queso en lonchas', 'Mantequilla'],
    recipe_url: 'https://www.bonviveur.es/recetas/sandwich-mixto',
  },
  'Pizza casera': {
    ingredients: ['Masa de pizza', 'Tomate frito', 'Jamón york', 'Champiñones', 'Mozzarella', 'Orégano'],
    recipe_url: 'https://www.directoalpaladar.com/recetas-de-panes/receta-de-pizza-de-jamon-y-champinones',
  },

  // Segundos de huevo
  'Tortilla de patatas': {
    ingredients: ['Patata', 'Huevos', 'Cebolla', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/tortilla-patatas',
  },
  'Huevos rellenos de atún': {
    ingredients: ['Huevos', 'Atún en lata', 'Mayonesa', 'Tomate frito', 'Sal'],
    recipe_url:
      'https://www.directoalpaladar.com/recetas-de-huevos-y-tortillas/huevos-rellenos-atun-receta-clasica-facil-sabrosa-que-apetece-siempre',
  },
  'Tortilla francesa': {
    ingredients: ['Huevos', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/tortilla-francesa-casera',
  },
  'Huevos rellenos': {
    ingredients: ['Huevos', 'Atún en lata', 'Mayonesa', 'Pimientos del piquillo', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/huevos-rellenos',
  },
  'Revuelto de champiñones': {
    ingredients: ['Champiñones', 'Huevos', 'Ajo', 'Perejil seco', 'Aceite de oliva', 'Sal'],
    recipe_url:
      'https://www.directoalpaladar.com/recetas-de-huevos-y-tortillas/revuelto-champinones-mejor-receta-solo-10-minutos',
  },
  'Tortilla de calabacín': {
    ingredients: ['Calabacín', 'Patata', 'Huevos', 'Cebolla', 'Aceite de oliva', 'Sal'],
    recipe_url:
      'https://www.directoalpaladar.com/n/que-mucha-gente-tiene-tortilla-patata-calabacin-como-su-receta-favorita-este-clasico',
  },
  'Huevos fritos con bacon': {
    ingredients: ['Huevos', 'Bacon', 'Aceite de oliva', 'Sal'],
    // How to fry the eggs; the bacon goes in the same pan first.
    recipe_url: 'https://www.bonviveur.es/recetas/huevos-fritos',
  },

  // Segundos de verdura y de lácteos
  'Verduras a la plancha': {
    ingredients: ['Calabacín', 'Berenjena', 'Pimiento rojo', 'Champiñones', 'Zanahoria', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/parrillada-de-verduras-a-la-plancha',
  },
  'Coliflor gratinada': {
    ingredients: ['Coliflor', 'Leche', 'Mantequilla', 'Queso rallado', 'Harina', 'Nuez moscada', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/coliflor-gratinada-al-horno',
  },
  'Provolone al horno': {
    ingredients: ['Provolone', 'Tomate', 'Orégano', 'Aceite de oliva'],
    recipe_url: 'https://www.bonviveur.es/recetas/provolone-al-horno',
  },

  // Pasta y arroz
  'Macarrones con tomate': {
    ingredients: ['Macarrones', 'Tomate triturado', 'Queso rallado', 'Cebolla', 'Ajo', 'Orégano', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/macarrones-con-tomate-casero',
  },
  'Espaguetis a la carbonara': {
    ingredients: ['Espaguetis', 'Panceta', 'Huevos', 'Queso rallado', 'Pimienta negra', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/espaguetis-carbonara-caseros',
  },
  'Arroz a la cubana': {
    ingredients: ['Arroz', 'Plátano', 'Huevos', 'Tomate frito', 'Ajo', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/arroz-cubana',
  },
  'Lentejas con verduras': {
    ingredients: ['Lentejas', 'Zanahoria', 'Patata', 'Pimiento verde', 'Tomate', 'Cebolla', 'Ajo', 'Pimentón', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/lentejas-con-verduras',
  },

  // Platos únicos
  Cocido: {
    ingredients: ['Garbanzos', 'Morcillo de ternera', 'Gallina', 'Hueso de caldo', 'Panceta', 'Chorizo', 'Morcilla', 'Patata', 'Zanahoria', 'Repollo', 'Fideos', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/cocido-madrileno-casero',
  },
  'Garbanzos con espinacas': {
    ingredients: ['Garbanzos', 'Espinacas', 'Pan', 'Tomate frito', 'Ajo', 'Comino', 'Pimentón', 'Vinagre', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.directoalpaladar.com/recetas-vegetarianas/garbanzos-con-espinacas-receta-tradicional',
  },
  'Judías pintas con arroz': {
    ingredients: ['Judías pintas', 'Arroz', 'Pimiento verde', 'Tomate triturado', 'Cebolla', 'Ajo', 'Pimentón', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/judias-pintas-arroz',
  },
  'Arroz con pollo': {
    ingredients: ['Pollo troceado', 'Arroz', 'Pimiento rojo', 'Zanahoria', 'Guisantes', 'Tomate triturado', 'Caldo de pollo', 'Azafrán', 'Vino blanco', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/arroz-con-pollo-casero',
  },
  'Lasaña de carne': {
    ingredients: ['Placas de lasaña', 'Carne picada', 'Tomate triturado', 'Zanahoria', 'Leche', 'Mantequilla', 'Queso rallado', 'Cebolla', 'Ajo', 'Harina', 'Nuez moscada', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/lasana-de-carne',
  },
  'Ensalada de pasta': {
    ingredients: ['Pasta corta', 'Tomate', 'Pepino', 'Pimiento rojo', 'Maíz dulce', 'Atún en lata', 'Aceitunas', 'Aceite de oliva', 'Vinagre', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/ensalada-de-pasta-casera',
  },
  'Macarrones con chorizo': {
    ingredients: ['Macarrones', 'Chorizo', 'Tomate frito', 'Queso rallado', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/macarrones-con-chorizo',
  },
  'Espaguettis boloñesa': {
    ingredients: ['Espaguetis', 'Carne picada', 'Tomate triturado', 'Zanahoria', 'Apio', 'Vino blanco', 'Cebolla', 'Ajo', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/espaguetis-bolonesa',
  },
  'Guiso de patatas con costillas': {
    ingredients: ['Costillas de cerdo', 'Patata', 'Pimiento rojo', 'Tomate triturado', 'Vino blanco', 'Caldo de carne', 'Cebolla', 'Ajo', 'Pimentón', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/patatas-con-costillas-de-cerdo',
  },
  'Paella mixta': {
    ingredients: ['Arroz', 'Pollo troceado', 'Calamares', 'Gambas', 'Mejillones', 'Pimiento rojo', 'Tomate triturado', 'Caldo de pescado', 'Azafrán', 'Ajo', 'Pimentón', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/paella-mixta',
  },
  Fideuá: {
    ingredients: ['Fideos de fideuá', 'Rape', 'Sepia', 'Gambas', 'Tomate triturado', 'Caldo de pescado', 'Azafrán', 'Ajo', 'Pimentón', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.directoalpaladar.com/recetario/fideua-receta',
  },
  'Fabada asturiana': {
    ingredients: ['Fabes', 'Chorizo', 'Morcilla', 'Lacón', 'Panceta', 'Azafrán', 'Cebolla', 'Ajo', 'Laurel', 'Aceite de oliva', 'Sal'],
    recipe_url: 'https://www.bonviveur.es/recetas/fabada',
  },
}
