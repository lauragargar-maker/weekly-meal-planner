# Lista de la compra, ingredientes y receta recomendada

Especificación funcional y técnica de la v1. Recoge las decisiones tomadas con Laura el
2026-10-12 y el 2026-10-13. Lo que sigue marcado con **[propuesta]** es de detalle y no
bloquea la implementación: se puede ajustar en diseño o en la revisión de cada PR.

---

## 0. Decisiones cerradas

| # | Tema | Decisión |
|---|---|---|
| D1 | Cantidades | **No hay cantidades en la v1.** Cada artículo es solo un nombre. |
| D2 | Compartir | La lista **se comparte dentro del hogar** (todos los miembros ven la misma y los checks se sincronizan). Además se puede **copiar como texto**. No hay enlace público. |
| D3 | Días sin menú | **Se avisa**, y la lista se genera solo con los días que tienen platos planificados. Ñam no genera menús por su cuenta para completar el rango. |
| D4 | Menú cambiado después de generar la lista | La lista **se queda congelada** y aparece un **aviso** con la opción de regenerarla. |
| D5 | Artículos a mano | **Sí**: se pueden añadir artículos que no salen de ningún plato. |
| D6 | Orden de la lista | **Agrupada por sección del súper.** |
| D7 | Ficha del plato | Al tocar un plato se abre una **ficha de consulta**, con un botón **"Editar"** que lleva al editor. |
| D8 | Básicos por defecto | La lista de §6.1, **con ajo y cebolla incluidos** como básicos. |
| D9 | Periodo preseleccionado | **5 días**: de mañana a mañana + 4. |
| D10 | Granularidad del selector | **Días completos**: la comida y la cena del día entran juntas. |
| D11 | Artículos quitados a mano | **Vuelven a salir al regenerar** la lista. Recordarlos queda en el backlog (§12). |
| D12 | Fin de la lista | La lista se **cierra** sola cuando **han pasado todos sus días** o cuando **está todo comprado**. Una lista cerrada deja de ser la que abre el botón de Semana (§5.10). |
| D13 | Botón para otra lista | Se llama **"Elegir otros días"** (antes "Nueva lista"). |

## 1. Alcance

**Entra en la v1**

1. Ingredientes por plato, que se pueden consultar y editar en la sección **Platos**.
2. Dos tipos de ingrediente: **de compra** y **básico** (disponibilidad general). Los básicos no salen en la lista.
3. Ingredientes y receta recomendada para todos los platos del catálogo semilla (`STARTER_CATALOG`, 65 platos).
4. Un **enlace a la receta recomendada** en la ficha de cada plato.
5. Generación manual de la lista de la compra desde **Semana**, con selector de días.
6. Un flujo guiado para completar los ingredientes de los platos que no los tienen.
7. Lista compartida en el hogar, con checks sincronizados en tiempo real, artículos a mano, copiar y compartir como texto.

**No entra en la v1**

- Cantidades, unidades y raciones.
- Enlace público para personas sin cuenta.
- Uso sin conexión: marcar checks sin red no está soportado (§7.6).
- Histórico de listas (cada hogar tiene una sola lista, en curso o cerrada; §5.10).
- Gestión independiente del catálogo de ingredientes: no hay pantalla propia para renombrar, fusionar o borrar ingredientes.
- Plurales y sinónimos: "cebolla" y "cebollas" son ingredientes distintos. El autocompletado lo mitiga.
- Exportar a apps concretas (Bring!, Google Keep…). Se cubre con copiar y compartir texto.
- Platos marcados como "no necesitan compra" (sobras, cena fuera).

## 2. Conceptos y vocabulario

Hay que evitar dos confusiones con lo que ya existe.

- **Ingrediente principal** (`main_ingredients`: Verdura, Carne, Pasta…). Ya existe y alimenta las reglas del generador. **No se toca**, y es independiente de los ingredientes nuevos. En código hay que mantener los nombres separados: el tipo `Ingredient` actual es el ingrediente principal. Los nuevos se llamarán `PantryItem`/`ShoppingIngredient` **[propuesta: `ShoppingIngredient`]**.
- **Ingrediente** (nuevo). Lo que hay que tener para cocinar el plato: "Chuletas de cerdo", "Cebolla", "Sal".
- **Básico** (nuevo). Un ingrediente que el hogar tiene siempre en casa, como la sal o el aceite. En la interfaz se llama **"Básico de casa"**, y **no** "despensa", porque "Despensa" sería también el nombre natural de una sección del súper (la de pasta y legumbres). Esa sección se llamará **"Alimentación"**.
- **Artículo**. Una línea de la lista de la compra. Sale de los ingredientes de compra de los platos o se añade a mano.

### Qué se apunta como ingrediente

Al contrario que en `main_ingredients`, aquí **sí** entra todo lo que hay que comprar, incluidas salsas y guarniciones. El tomate de "Bacalao con tomate" es un ingrediente. La regla es: "si no estuviera en casa, ¿habría que comprarlo para hacer este plato?". Los ingredientes opcionales o de adorno se pueden omitir.

## 3. Modelo de datos

Todas las tablas nuevas llevan `household_id` y RLS `household_id = current_household_id()` para SELECT, INSERT, UPDATE y DELETE, igual que `dish_ideas` y `weekly_menus`. Todos los miembros del hogar tienen los mismos permisos.

### 3.1 `ingredients`: catálogo de ingredientes del hogar

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | UUID NOT NULL FK → households ON DELETE CASCADE | |
| `name` | TEXT NOT NULL | Como lo escribió el usuario, recortado. 1–40 caracteres. |
| `name_key` | TEXT NOT NULL | Clave normalizada: minúsculas, sin tildes, espacios colapsados. La calcula el frontend con la misma función de §3.6. |
| `section` | TEXT NOT NULL | Uno de los valores de §3.5. CHECK de lista permitida. |
| `is_staple` | BOOLEAN NOT NULL DEFAULT false | `true` = básico de casa, no sale en la lista. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Trigger `update_updated_at_column`. |

`UNIQUE (household_id, name_key)`. "Tomate" y "tomate" son el mismo ingrediente.

La clasificación **básico / de compra** y la **sección** son del ingrediente a nivel de hogar, no del plato. Si un hogar marca "Ajo" como básico, deja de salir en todas sus listas.

### 3.2 `dish_ingredients`: ingredientes de cada plato

| Columna | Tipo | Notas |
|---|---|---|
| `dish_id` | UUID NOT NULL FK → dish_ideas ON DELETE CASCADE | |
| `ingredient_id` | UUID NOT NULL FK → ingredients ON DELETE CASCADE | |
| `household_id` | UUID NOT NULL | Para la RLS y los filtros de realtime. |
| `position` | SMALLINT NOT NULL | Orden en la ficha, el que eligió el usuario. |

PK `(dish_id, ingredient_id)`: un ingrediente no se repite dentro de un plato. Hay un máximo de **30 ingredientes por plato**, validado en el frontend.

### 3.3 Cambios en `dish_ideas`

| Columna | Tipo | Notas |
|---|---|---|
| `recipe_url` | TEXT NULL | CHECK `recipe_url ~ '^https://'` y longitud ≤ 500. |

Un plato **"tiene ingredientes"** si tiene al menos una fila en `dish_ingredients`, aunque todos sean básicos. Un plato **"sin ingredientes"** es el que tiene cero filas. No se añade ninguna columna de estado.

### 3.4 Cambios en `households`

| Columna | Tipo | Notas |
|---|---|---|
| `ingredients_seeded_at` | TIMESTAMPTZ NULL | Marca que la semilla de ingredientes ya se aplicó (§6). |
| `shopping_guide_seen_at` | TIMESTAMPTZ NULL | Marca que el hogar ya pasó por el flujo guiado completo (§5.3). Es **por hogar**, no por persona: los ingredientes son del hogar, así que si un miembro ya los completó, el otro no necesita la guía. |

### 3.5 Secciones del súper

Tienen un orden fijo, que es el que se muestra en la lista y en el selector. En la base de datos se guarda el valor y en la interfaz se muestra la etiqueta.

| Valor | Etiqueta |
|---|---|
| `produce` | Fruta y verdura |
| `meat` | Carnicería |
| `fish` | Pescadería |
| `deli` | Charcutería y quesos |
| `dairy_eggs` | Lácteos y huevos |
| `bakery` | Panadería |
| `grocery` | Alimentación (pasta, arroz, legumbres, conservas, aceites, especias…) |
| `frozen` | Congelados |
| `drinks` | Bebidas |
| `household` | Droguería y hogar |
| `other` | Otros |

Como en `INGREDIENTS`, una sección nueva va **al final** de la lista, nunca en medio.

### 3.6 Normalización de nombres

`toKey(name)`: `trim` → colapsar espacios → `toLowerCase('es')` → quitar diacríticos (NFD y eliminar `\p{M}`), **conservando la ñ**. La usan el catálogo de ingredientes, la búsqueda de platos por nombre (§4.3) y la fusión de artículos. Va en `src/lib/` con tests unitarios.

### 3.7 `shopping_lists`: la lista del hogar

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | UUID NOT NULL UNIQUE | **Una lista por hogar**, en curso o cerrada (§5.10). Una lista nueva sustituye a la anterior (§5.6). |
| `days` | DATE[] NOT NULL | Días seleccionados que **sí** tenían menú y entraron en la lista. |
| `skipped_days` | DATE[] NOT NULL DEFAULT '{}' | Días seleccionados sin menú, para el aviso. |
| `missing_dishes` | TEXT[] NOT NULL DEFAULT '{}' | Platos del rango sin ingredientes o no encontrados (§4.3), para el aviso. |
| `fingerprint` | TEXT NOT NULL | Huella del menú y de los ingredientes en el momento de generar (§5.7). |
| `generated_by` | UUID FK → auth.users | |
| `generated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

### 3.8 `shopping_list_items`: artículos de la lista

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `list_id` | UUID NOT NULL FK → shopping_lists ON DELETE CASCADE | |
| `household_id` | UUID NOT NULL | Para la RLS y el filtro de realtime. |
| `ingredient_id` | UUID NULL FK → ingredients ON DELETE SET NULL | NULL en un artículo a mano sin ingrediente asociado. |
| `name` | TEXT NOT NULL | Copia del nombre en el momento de generar. La lista está congelada (D4). |
| `section` | TEXT NOT NULL | Copia de la sección, con la misma lista permitida de §3.5. |
| `origin` | TEXT NOT NULL | `menu` \| `manual`. |
| `sources` | JSONB NOT NULL DEFAULT '[]' | `[{ dish: "Lentejas", day: "2026-10-14", meal: "lunch" }]`. Vacío si es manual. |
| `checked` | BOOLEAN NOT NULL DEFAULT false | |
| `checked_by` | UUID NULL | |
| `checked_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | Desempata el orden de los artículos a mano. |

Las dos tablas de la lista se añaden a la publicación de realtime de Supabase.

### 3.9 Migración

Un solo archivo, `supabase/migrations/2026MMDD000000_shopping_list.sql`, que crea las tablas, columnas, CHECKs, índices, RLS y la publicación de realtime, más una consulta de verificación comentada al final (convención de `supabase/migrations/README.md`). **No inserta datos**: la semilla se aplica desde el frontend (§6). Primero se ejecuta en dev y después en producción, **antes** de mergear el frontend.

## 4. Ingredientes y receta en Platos

### 4.1 Ficha del plato (consulta)

Al tocar un plato en **Platos** se abre su **ficha**. Hoy ese toque abre directamente el editor. La ficha es de solo lectura y tiene un botón "Editar" que abre el editor actual ampliado (D7). La ficha muestra:

1. El nombre y los datos actuales (tipo, comida/cena, día).
2. **Ingredientes**: la lista completa, en el orden del plato. Los básicos van al final, en gris y con la etiqueta "Básico de casa".
3. **Receta recomendada**, si existe `recipe_url`: un enlace con el texto *"Ver receta en {nombre del sitio}"* y un icono de enlace externo. Se abre en una pestaña nueva (`target="_blank" rel="noopener noreferrer"`). El nombre del sitio sale de una tabla de dominios conocidos (`directoalpaladar.com` → Directo al Paladar, `bonviveur.es` → Bon Viveur, `cocinaabierta.co` → Cocina Abierta…). Si el dominio no está en la tabla, se usa el dominio sin `www.`.
4. Si el plato no tiene ingredientes, se muestra el estado vacío *"Este plato aún no tiene ingredientes"* con el botón "Añadirlos".

En la lista de Platos, un plato sin ingredientes lleva un indicador discreto (un punto o la etiqueta "Sin ingredientes"). Además hay un filtro nuevo, **"Sin ingredientes"**, junto a Todos, Primeros, Segundos y Únicos.

### 4.2 Edición

El editor de plato (`AddDishModal`) gana dos bloques:

**Ingredientes**
- Un campo con autocompletado sobre el catálogo del hogar (`ingredients`), buscando por `name_key`. Pulsar Intro o elegir una sugerencia añade el ingrediente como chip.
- Si el texto no existe en el catálogo, se crea el ingrediente al guardar el plato. Su sección se **infiere** de la tabla de ingredientes semilla (§6) si coincide por `name_key`; si no, se usa `other`. El tipo por defecto es **de compra**.
- Cada chip se puede quitar. Los ingredientes se muestran en el orden en que se añadieron; reordenarlos arrastrando queda en el backlog (§12).
- Al tocar un chip se abre un pequeño menú con:
  - Sección: selector.
  - "Básico de casa (no lo añadas a la lista)": interruptor.

  Al cambiar uno de estos dos valores se cambia **el ingrediente del hogar**, y por tanto afecta a todos los platos que lo usan. El menú lo avisa con el texto: *"Se aplicará en todos tus platos"*.

**Receta recomendada**
- Un campo URL opcional. Se valida que empiece por `https://` y que tenga 500 caracteres o menos. Si no es válida, aparece el error *"Pega un enlace que empiece por https://"*.

Al crear un plato nuevo, el bloque de ingredientes aparece en el editor pero es **opcional**. No se bloquea el guardado sin ingredientes.

### 4.3 Cómo se encuentra un plato desde el menú

`MenuItem` guarda **nombres** de plato (`starter`, `main`, `single`), no IDs. Para sacar los ingredientes de un día, cada nombre se busca en los `dish_ideas` del hogar comparando `toKey(name)`.

- **Encontrado y con ingredientes**: se usan sus ingredientes.
- **Encontrado sin ingredientes**, o **no encontrado** (el plato se renombró o se borró después de planificar): el nombre va a `missing_dishes` y se avisa (§5.5). Un plato no encontrado no se puede completar desde el flujo guiado. El aviso lo explica (§5.3).

Migrar `MenuItem` a IDs queda fuera de la v1.

## 5. Lista de la compra

### 5.1 Punto de entrada

En **Semana** hay un botón **"Lista de la compra"** con icono de carrito.

- En móvil va en la cabecera de la pantalla, junto a `WeekNav`. En escritorio va en la cabecera, junto a los botones existentes. **[propuesta: ubicación exacta en diseño]**
- **Si el hogar no tiene lista, o la que tiene está cerrada** (§5.10), el botón abre el **selector de días** (§5.2).
- **Si tiene una lista en curso**, abre **la lista** (§5.5). Dentro de la lista, "Elegir otros días" lleva al selector.
- El botón muestra un **contador con los artículos pendientes** solo cuando hay una lista en curso. Con la lista cerrada, o sin lista, no hay contador.

La lista es una vista a pantalla completa por encima de Semana: no es un cuarto destino de la navegación. "Atrás" vuelve a Semana.

### 5.2 Selector de días

- **Días que se pueden elegir**: desde **hoy** hasta el **domingo de la semana siguiente**, que es hasta donde llega la navegación (`WEEK_RANGE.max = 1`). Los días pasados no aparecen.
- **Preselección**: los **5 días que empiezan mañana**, de mañana a mañana + 4 (D9). Hoy aparece, pero sin marcar. Por ejemplo, el lunes 12 se preseleccionan del martes 13 al sábado 17 ambos incluidos. Esa preselección cabe siempre dentro del rango elegible.
- La granularidad es **por día** (D10): la comida y la cena del día entran juntas, con todos sus platos (primero, segundo o único). Elegir comida o cena por separado no entra en la v1.
- Cada día muestra su fecha ("mar 13") y los platos planificados en pequeño (reutilizando `CompactMeals`).
- **Días sin menú**: se pueden marcar, pero llevan la etiqueta *"Sin menú"*. Para pintar el selector se cargan los `weekly_menus` de la semana actual y de la siguiente **solo en lectura**. Abrir el selector **nunca genera** un menú (D3).
- Atajos: "Próximos 5 días" (vuelve a la preselección), "Solo esta semana" y "Ninguno".
- Botón principal: **"Generar lista"**. Se deshabilita si ningún día marcado tiene menú.
- **Lista anterior**: si el hogar tiene una lista cerrada, bajo el título aparece el enlace *"Ver la lista anterior ({rango})"*, que la abre tal como quedó (§5.10).
- **Aviso de días sin menú (D3).** Si hay días marcados sin menú, encima del botón aparece:
  > *"{n} días no tienen menú planificado y no entrarán en la lista: {lista de días}."*

  Incluye un enlace secundario **"Ver semana siguiente"**, que cierra el selector y navega a esa semana, donde el flujo actual la genera. El usuario puede generar la lista igualmente.

### 5.3 Platos sin ingredientes: aviso y flujo guiado

Al pulsar "Generar lista", Ñam reúne los platos de los días elegidos que tienen menú y comprueba cuáles no tienen ingredientes, según §4.3. Solo cuentan **los platos del rango elegido**, no todo el catálogo.

**Si no falta ninguno**, la lista se genera directamente.

**Si faltan y el hogar no ha visto la guía** (`shopping_guide_seen_at IS NULL`), se abre el **flujo guiado completo**:

1. **Pantalla de introducción**:
   > *"Para hacer la lista necesitamos saber qué lleva cada plato. Los platos del catálogo de Ñam ya vienen completos; te faltan {n} platos tuyos. Te llevará un par de minutos y solo hay que hacerlo una vez por plato."*

   Botones: "Empezar" y "Ahora no, generar sin ellos".
2. **Un paso por plato**, con un indicador "2 de 5". Cada paso muestra el nombre del plato, el editor de ingredientes de §4.2 (autocompletado y chips) y el campo de receta, que es opcional. El paso incluye una ayuda breve la primera vez: qué es un básico de casa y que hay que apuntar todo lo que se compra, salsas incluidas. Botones: "Siguiente" (guarda el plato), "Saltar este plato" y "Terminar más tarde" (genera la lista con lo que haya).
3. Al terminar o salir del flujo por cualquier vía, se marca `shopping_guide_seen_at = now()` y se genera la lista.

**Si faltan y el hogar ya vio la guía**, se muestra un **aviso ligero** (una hoja inferior):
> *"{n} platos no tienen ingredientes: {nombres}. No saldrán en la lista."*

Botones: "Completarlos ahora" (abre los mismos pasos del flujo guiado, sin la introducción) y "Generar igualmente".

**Platos no encontrados** (renombrados o borrados): aparecen en el aviso con la nota *"ya no está en tus platos"* y no tienen paso en el flujo guiado.

### 5.4 Cálculo de la lista

1. Para cada día de `days`, y para cada comida y plato, se encuentra el plato (§4.3) y se toman sus ingredientes.
2. Se **descartan los básicos** (`is_staple = true`).
3. Se **fusionan por `ingredient_id`**: un ingrediente que aparece en varios platos o varios días da **un único artículo**. Su campo `sources` acumula cada aparición, así que un plato repetido dos días aporta dos fuentes.
4. Cada artículo copia `name` y `section` del ingrediente en ese momento.
5. Se guarda la lista con `days`, `skipped_days`, `missing_dishes` y `fingerprint`.

Es lógica pura y va en `src/lib/shoppingList.ts` con tests unitarios: fusión, básicos, platos repetidos, platos no encontrados, días sin menú y nombres con distinta capitalización.

### 5.5 Pantalla de la lista

**Cabecera**
- Título "Lista de la compra" y subtítulo con el rango: *"mar 13 – sáb 17 oct · 5 días"*.
- *"Generada por {nombre} {hace 2 h}"* **[propuesta]**.
- Si la lista está **cerrada**, debajo de la cabecera aparece una tarjeta con el motivo y el botón principal **"Elegir otros días"** (§5.10).

**Avisos, encima de la lista, cada uno descartable.** En una lista cerrada no se muestra ninguno.
- **Lista desactualizada** (D4, §5.7):
  > *"El menú ha cambiado desde que hiciste esta lista."*

  Botón: "Regenerar".
- **Días sin menú**, si `skipped_days` no está vacío: *"No incluye {días}: no tenían menú."*
- **Platos sin información**, si `missing_dishes` no está vacío: *"No incluye ingredientes de {platos}."* Botón: "Completar" (abre el flujo de §5.3 y después ofrece regenerar).

**Cuerpo**
- Los artículos van **agrupados por sección** (D6), en el orden de §3.5. Las secciones vacías no se muestran.
- Dentro de cada sección: pendientes primero, en orden alfabético (`localeCompare('es')`). Los **marcados** bajan al final de su sección, tachados y atenuados.
- Cada artículo muestra:
  - un **check**;
  - el **nombre**;
  - debajo, en pequeño, de dónde sale, como *"Lentejas (mié) · Cocido (vie)"*. Si hay más de 2 fuentes, se muestra *"Lentejas (mié) y 2 más"*, y al tocar se ven todas. Los artículos a mano muestran *"Añadido a mano"*.
- **Acciones por artículo**, en un menú "⋯" o deslizando:
  - **Quitar de la lista**: lo borra de esta lista, para lo que ya hay en casa.
  - **"Siempre lo tengo en casa"**: lo quita de la lista **y** marca el ingrediente como básico (`is_staple = true`), con el aviso *"No volverá a salir en tus listas. Puedes cambiarlo en la ficha de cualquier plato."* Solo aparece en artículos con `ingredient_id`.
- Si todos los artículos están marcados, la lista se cierra y aparece la tarjeta *"¡Todo comprado!"* (§5.10).

**Añadir a mano (D5)**
- Hay un campo fijo **"Añadir artículo…"** al principio de la lista, con autocompletado sobre el catálogo de ingredientes del hogar.
  - Si se elige un ingrediente existente, el artículo hereda su `ingredient_id` y su `section`.
  - Si es texto nuevo, se crea solo como artículo, con `ingredient_id` NULL. Su sección se infiere de la semilla y, si no, es `other`. Tras añadirlo se puede cambiar la sección desde "⋯". **No** se crea un ingrediente en el catálogo, para no llenarlo de "papel de cocina".
- Si el artículo ya está en la lista (mismo `name_key`) y pendiente, no se duplica: se resalta el existente. Si estaba marcado, se desmarca.
- Máximo 60 caracteres.

**Acciones de la lista**, en la cabecera o en un menú "⋯":
- **Copiar**: copia el texto de §5.8 al portapapeles y muestra la confirmación *"Lista copiada"*.
- **Compartir**: usa `navigator.share({ text })` con el mismo texto. Si no hay soporte, copia (igual que `FamilyView.shareCode`).
- **Elegir otros días**: abre el selector (§5.2). Si la lista actual está en curso, al generar pide confirmación (§5.6).
- **Borrar marcados**: elimina los artículos ya comprados **[propuesta]**.

### 5.6 Regenerar o elegir otros días

Las dos acciones sustituyen la lista del hogar (`household_id` es UNIQUE).

- **Regenerar** (desde el aviso de lista desactualizada, solo en una lista en curso) usa **los mismos días** que la lista actual. **Elegir otros días** usa los días del selector.
- **Si la lista actual está en curso**, se pide confirmación: *"Se sustituirá la lista actual. Conservaremos lo que ya has marcado y lo que añadiste a mano."* Al sustituir:
  - Los artículos **a mano** se mantienen tal cual.
  - Si un artículo nuevo ya existía marcado en la lista anterior (mismo `ingredient_id`, o mismo `name_key` si no tiene), **se mantiene marcado**.
  - Los artículos quitados a mano ("Quitar de la lista") **vuelven a salir** al regenerar (D11). Recordarlos está en el backlog (§12).
- **Si la lista actual está cerrada**, se sustituye **sin confirmación** y la nueva empieza limpia: **no se hereda ninguna marca**, porque lo comprado para la semana pasada no está comprado para esta. Solo pasan a la nueva lista los **artículos a mano que quedaron sin marcar** (lo que se apuntó y no se llegó a comprar).

### 5.7 Detección de lista desactualizada (D4)

`fingerprint` es un hash estable de:
- para cada día de `days` y de `skipped_days`: los nombres de los platos planificados, normalizados;
- para cada plato encontrado: los `ingredient_id` de compra, ordenados.

Al abrir la lista, y cuando llega un evento realtime de `weekly_menus` o de los ingredientes, el frontend recalcula la huella con los datos actuales. Si no coincide con la guardada, muestra el aviso de lista desactualizada. Por tanto, el aviso aparece cuando:
- cambia un plato de un día incluido (editar día, intercambiar días, regenerar semana);
- se genera el menú de un día que estaba en `skipped_days`;
- cambian los ingredientes de compra de un plato incluido, incluido marcar o desmarcar un básico.

La lista **nunca cambia sola**: solo cambia al pulsar "Regenerar".

### 5.8 Formato del texto copiado y compartido

```
🛒 Lista de la compra · 13–17 oct

FRUTA Y VERDURA
- Cebolla
- Calabacín

CARNICERÍA
- Chuletas de cerdo

OTROS
- Papel de cocina
```

- Solo se incluyen los artículos **pendientes**, porque los marcados ya están comprados.
- No se incluyen las fuentes (los platos de los que sale cada artículo).
- Si no queda nada pendiente, Copiar y Compartir se deshabilitan.

### 5.9 Sincronización en el hogar (D2)

- La pantalla de la lista se suscribe por realtime a `shopping_lists` y `shopping_list_items`, filtrando por `household_id`, igual que hoy se hace con `weekly_menus`.
- Un check se aplica primero en pantalla (actualización optimista) y después se guarda. Si el guardado falla, se revierte y aparece el aviso *"No se pudo guardar. Revisa la conexión."*
- Si dos personas marcan a la vez, gana el último en guardar. No hay más resolución de conflictos.
- Si otra persona sustituye la lista mientras la estás viendo, la vista se recarga con la nueva y muestra el aviso *"{nombre} ha hecho una lista nueva"*.

### 5.10 Ciclo de vida (D12)

La lista del hogar está siempre en uno de estos estados. Ninguno se guarda en la base de datos: se **calculan** al pintar, a partir de `days` y de los artículos.

| Estado | Cuándo | Botón de Semana | Al abrir la lista |
|---|---|---|---|
| **Sin lista** | El hogar nunca ha generado una. | Sin contador. Abre el selector. | — |
| **En curso** | Hay lista, alguno de sus días es hoy o posterior, y queda al menos un artículo sin marcar. También una lista sin ningún artículo. | Contador de pendientes. Abre la lista. | Lista normal, con sus avisos. |
| **Cerrada: todo comprado** | Tiene al menos un artículo y están todos marcados. | Sin contador. Abre el selector. | Tarjeta *"¡Todo comprado! Cuando quieras, haz la siguiente."* + "Elegir otros días". |
| **Cerrada: caducada** | Ha pasado el último día de `days` (comparando fechas locales), aunque queden artículos sin marcar. | Sin contador. Abre el selector. | Tarjeta *"Esta lista era para {rango} y esos días ya han pasado."* + "Elegir otros días". |

Reglas:

- **Una lista cerrada se puede seguir consultando y tocando**: desde el enlace "Ver la lista anterior" del selector se abre tal como quedó, y se pueden marcar, desmarcar y copiar artículos. No aparecen los avisos de lista desactualizada, días sin menú o platos sin información.
- **"Todo comprado" se puede deshacer**: si alguien desmarca un artículo de una lista que no ha caducado, vuelve a estar en curso. Una lista caducada no vuelve a estar en curso.
- **Cierre en directo**: con la lista abierta, al marcar el último artículo aparece la tarjeta de "¡Todo comprado!" en ese momento, también para los demás miembros que la tengan abierta (§5.9). La lista no se cierra ni se borra sola en la base de datos: queda guardada hasta que se sustituye.
- **Sustitución**: una lista cerrada se sustituye sin confirmación y sin heredar marcas (§5.6).

## 6. Semilla: ingredientes y receta del catálogo por defecto

### 6.1 Contenido

Hay un archivo nuevo, `src/data/starterIngredients.ts`, con:
- `STARTER_INGREDIENTS`: cada ingrediente semilla con su `name`, `section` y `is_staple` por defecto. Se usa también para inferir la sección de ingredientes nuevos (§4.2).
- `STARTER_DISH_DETAILS`: un mapa de nombre de plato semilla → `{ ingredients: string[], recipe_url?: string }`, con una entrada para **cada uno** de los platos de `STARTER_CATALOG`. Un test comprueba que no falta ninguno y que cada ingrediente existe en `STARTER_INGREDIENTS`.

**Básicos por defecto** (D8): sal, pimienta negra, aceite de oliva, aceite de girasol, vinagre, azúcar, harina, pimentón, orégano, laurel, perejil seco, comino, nuez moscada, agua, **ajo y cebolla**. Los huevos, la leche y el pan son **de compra**. Cada hogar puede cambiar cualquiera de ellos (§4.2, §5.5).

**Recetas**: preferentemente de Directo al Paladar, Bon Viveur o Cocina Abierta. Cada URL se comprueba a mano al redactar la semilla: que la página existe, que es la receta de ese plato y que tiene sentido para la familia. Si no hay una buena, el plato se queda sin `recipe_url`. Es mejor no tener enlace que tener uno equivocado. **Laura revisa la tabla completa antes de mergear.**

### 6.2 Aplicación

La semilla se aplica **desde el frontend**, como la de platos (`handleSeedCatalog`), y no con SQL, para no mantener la misma tabla en TypeScript y en dos bases de datos distintas.

- **Hogares nuevos**: se aplica justo después de sembrar los platos en el onboarding.
- **Hogares existentes**: se aplica una vez, al abrir la app, si `ingredients_seeded_at IS NULL`.

La operación es idempotente:
1. Inserta en `ingredients` los de `STARTER_INGREDIENTS` cuyo `name_key` no exista ya en el hogar.
2. Para cada plato del hogar cuyo `toKey(name)` coincida con un plato semilla **y que no tenga ingredientes**, inserta sus `dish_ingredients`. Si además no tiene `recipe_url`, rellena también la receta.
3. Los platos con ingredientes ya puestos, o renombrados respecto a la semilla, **no se tocan**: cuentan como platos del usuario.
4. Marca `ingredients_seeded_at = now()`.

Si el proceso falla, no se marca nada y se reintenta en la siguiente carga.

## 7. Detalles transversales

### 7.1 Permisos
Todos los miembros del hogar pueden hacer todo: editar ingredientes, generar, regenerar, marcar y borrar.

### 7.2 Validaciones y límites
| Campo | Límite |
|---|---|
| Nombre de ingrediente | 1–40 caracteres |
| Ingredientes por plato | ≤ 30 |
| Artículo a mano | 1–60 caracteres |
| `recipe_url` | `https://`, ≤ 500 |

### 7.3 Accesibilidad
- Los checks son `<input type="checkbox">` con su etiqueta.
- Las secciones son encabezados.
- Los avisos usan `role="status"`.
- Los enlaces externos llevan el texto accesible "(se abre en otra pestaña)".

### 7.4 Escritorio
- La lista ocupa una columna centrada de ancho máximo, igual que las demás vistas.
- El selector de días es un panel modal.

### 7.5 Errores
Los mensajes nuevos van en `src/lib/errorMessages.ts`.

### 7.6 Sin conexión
No está soportado en la v1. Si se marca un check sin red, el cambio se revierte con el aviso de §5.9. **Riesgo conocido**: en el súper la cobertura suele ser mala. Si el feedback lo confirma, el siguiente paso es guardar en local y sincronizar después.

## 8. Analítica

Se añaden eventos a `docs/analytics-events.md`, en una sección nueva "Lista de la compra":

| Evento | Propiedades |
|---|---|
| `shopping_list_opened` | `has_list` (bool) |
| `shopping_list_generated` | `trigger` (`new` \| `regenerate`), `previous` (`none` \| `active` \| `all_checked` \| `expired`), `days_selected`, `days_included`, `days_skipped`, `item_count`, `missing_dish_count` |
| `shopping_list_completed` | `item_count`, `days_left` (días de la lista que aún no habían pasado) — se envía al marcar el último artículo |
| `shopping_list_stale_shown` | — |
| `shopping_item_checked` | `checked` (bool), `origin` |
| `shopping_item_added_manually` | `from_catalog` (bool) |
| `shopping_item_removed` | `marked_staple` (bool) |
| `shopping_list_copied` | `item_count` |
| `shopping_list_shared` | `item_count` |
| `ingredient_guide_started` | `missing_dish_count`, `mode` (`full` \| `light`) |
| `ingredient_guide_dish_saved` | `ingredient_count` |
| `ingredient_guide_finished` | `completed`, `skipped`, `exit` (`done` \| `later` \| `not_now`) |
| `dish_ingredients_saved` | `ingredient_count`, `has_recipe` (desde el editor de Platos) |
| `recipe_link_opened` | `domain`, `is_starter` |

**[propuesta]** Hay un KPI candidato para `docs/product-kpis.md`: el porcentaje de hogares activos que generan al menos una lista a la semana.

## 9. Criterios de aceptación

1. Un hogar nuevo tiene ingredientes en los 65 platos semilla nada más terminar el onboarding. Los platos que tienen receta muestran el enlace en la ficha.
2. En un hogar existente, la primera carga después del despliegue rellena los platos semilla sin ingredientes y no toca los platos renombrados ni los editados.
3. En la ficha de un plato se ven todos sus ingredientes, con los básicos diferenciados. Desde el editor se pueden añadir, quitar, cambiar de sección y marcar o desmarcar como básico.
4. Al abrir el selector, sin tocar nada, están marcados de mañana a mañana + 4. Hoy aparece sin marcar y no hay días pasados.
5. Con días sin menú en la selección, aparece el aviso con esos días. La lista se genera solo con los días con menú y no se genera ningún menú.
6. La primera vez que faltan ingredientes en platos del rango, aparece el flujo guiado completo. Las siguientes veces aparece el aviso ligero. En ambos casos se puede generar la lista sin completar.
7. Un ingrediente que aparece en tres platos sale una sola vez, con sus tres fuentes. Los básicos no salen.
8. La lista está agrupada por secciones en el orden de §3.5, con los marcados al final de su sección.
9. Si un miembro marca un artículo, otro miembro con la lista abierta lo ve marcado sin recargar.
10. Un artículo añadido a mano se mantiene al regenerar, y los artículos marcados siguen marcados si vuelven a salir.
11. Si se cambia un plato de un día incluido después de generar la lista, el aviso de lista desactualizada aparece y la lista no cambia hasta pulsar "Regenerar".
12. Copiar genera el texto de §5.8 con solo los artículos pendientes, y Compartir abre la hoja del sistema en móvil.
13. "Siempre lo tengo en casa" sobre un artículo hace que ese ingrediente deje de salir en las listas siguientes y aparezca como básico en la ficha.
14. El día después del último día de la lista, el botón de Semana no muestra contador y abre el selector, que ofrece "Ver la lista anterior".
15. Al marcar el último artículo aparece "¡Todo comprado!" y el botón de Semana pierde el contador. Al desmarcar uno, si la lista no ha caducado, vuelve a estar en curso.
16. Al generar una lista cuando la anterior está cerrada, no se pide confirmación, ningún artículo sale marcado y solo pasan los artículos a mano que quedaron sin marcar.
17. `npm run lint`, `npm test` y el build pasan. Hay tests nuevos para `toKey`, el cálculo de la lista (§5.4), la huella (§5.7), el estado de la lista (§5.10) y la completitud de la semilla (§6.1).

## 10. Plan de entrega sugerido

Hay cuatro PRs, y cada una se puede desplegar por separado:

1. **Datos e ingredientes en Platos**: la migración, `toKey`, la ficha y el editor de ingredientes y receta, y el filtro "Sin ingredientes". La semilla se puede dejar aún sin URLs.
2. **Semilla completa**: `starterIngredients.ts` con los ingredientes y las recetas revisadas por Laura, y la aplicación de §6.2.
3. **Lista de la compra**: el botón, el selector, el cálculo, la pantalla, los artículos a mano, copiar y compartir, el realtime y la detección de lista desactualizada.
4. **Flujo guiado y analítica**: §5.3, los eventos de §8 y la actualización de `analytics-events.md`.

## 11. Pendiente de validar

Nada: todas las decisiones funcionales están cerradas. Los detalles de interfaz marcados con **[propuesta]** se cierran con el prototipo de Claude Design: https://claude.ai/artifact/XRbS5ZjNdYvDcv8CnFaTSD (privado; hay que compartirlo desde el propio canvas).

## 12. Backlog

Ideas fuera de la v1, apuntadas para no perderlas:

1. **Recordar los artículos quitados a mano al regenerar.** Hoy, si quitas "Cebolla" de la lista (porque ya la tienes) y regeneras, vuelve a salir (D11). Habría que guardar qué se quitó en la lista anterior y no volver a añadirlo.
2. **Cantidades** y raciones por hogar (D1).
3. **Enlace público** para compartir la lista con alguien sin cuenta (D2).
4. **Uso sin conexión**: guardar los checks en local y sincronizar después (§7.6).
5. **Elegir comida o cena por separado** en el selector de días (D10).
6. **Guardar en el menú IDs de plato** en lugar de nombres (§4.3).
7. **Reordenar los ingredientes de un plato** arrastrándolos en la ficha (§4.2).
