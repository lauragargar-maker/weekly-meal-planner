# Plan de rediseño: ¡Ñam!

Plan de implementación del rediseño preparado por Claude Design
(paquete `Redesign - handoff docs/`, validado con usuarios).

**Nombre de cara al usuario: ¡Ñam!** En el código, los nombres y la ruta del proyecto
siguen siendo *Weekly Menu* / `weekly-meal-planning-app`. El renombrado es solo de copy.

---

## Principio rector

El rediseño es **visual**. No se toca `menuGenerator.ts`, `catalogCheck.ts`, `analytics.ts`,
`errorMessages.ts`, `types/index.ts`, `AuthProvider`, `lib/supabase.ts` ni `supabase/`.
El árbol de decisión de `AuthGate` y los puntos donde se dispara `trackEvent` se mantienen.

Las excepciones son deliberadas y están marcadas abajo como **[funcionalidad nueva]**.

---

## Hueco entre el handoff y el código actual

El handoff da por existentes cosas que no están implementadas:

| El diseño asume | Realidad |
|---|---|
| Vista "Nuestros platos" con buscador y filtros | No existe ninguna vista de catálogo. `App.tsx` solo renderiza la agenda |
| Botones "Platos" y "Familia" en la cabecera | Ninguno de los dos destinos existe |
| "Borrar este plato" + confirmación | `AddDishModal` solo crea. No hay DELETE |
| "Guardar cambios" al editar un plato | No hay UPDATE de `dish_ideas` |
| Rol admin/miembro | `household_members.role` existe en BD, pero el cliente no lo lee y la RLS no lo aplica |
| Onboarding "PASO 1 DE 3" | El onboarding es de un solo paso |

Decisiones tomadas: el catálogo, "Familia", y borrar/editar platos **entran** en este rediseño.
Los roles y la lista de miembros se aplazan a versiones posteriores (fases 7 y 8).

---

## Fase 0 — Fundaciones

- `tailwind.config.js`: sustituir `theme.extend` completo por el bloque de `design-tokens.md`
  (paleta crema/tinta/verde/amarillo/rojo, `fontFamily`, `borderRadius`, `boxShadow`,
  `transitionTimingFunction`, `transitionDuration`). **Eliminar la escala `primary`.**
- `src/index.css`: sustituir `@layer base` y `@layer components`. Clases nuevas:
  `.btn-dark`, `.btn-danger`, `.card-hoy`, `.card-edit`, `.chip`, `.chip-on`,
  `.input-nam`, `.input-hero`, `.label-nam`, `.help-nam`, `.error-nam`.
  Se conservan los nombres `.btn-primary`, `.btn-secondary` y `.card`.
- `index.html`: fuentes Baloo 2 + Nunito Sans; `<title>` "Menú Semanal" → "¡Ñam!".
- `public/site.webmanifest`: `background_color` `#F9FAFB` → `#fff8ec` (crema-100).
  El `name` y el `theme_color` ya son correctos.
- Barrido de los 35 usos de `primary-*` repartidos en 9 archivos.

Como se conservan los tres nombres de clase existentes, al terminar esta fase la app entera
cambia de aspecto sin haber tocado JSX. Primer punto de verificación visual.

## Fase 1 — Pantallas de acceso

`LoginScreen`, `OnboardingScreen`, `AuthGate`. Superficie pequeña, cero lógica.
Specs: `login-screen.md`, `onboarding-screen.md`, `auth-gate.md`.

**`onboarding-screen.md` no es un restyling: describe otro onboarding.** El diseñado tiene
tres pasos e incluye cosas que no existen —el selector "La semana empieza en" (ver backlog),
un paso 3 de **reglas por hogar** con casillas y steppers de 1 a 7, y un contador que bloquea
el CTA hasta 20 platos— y, a la inversa, **no tiene campo para el código de invitación**,
que `redeem_invite_and_create_household` exige para crear un hogar.

Lo aplicado es la estética nueva sobre el flujo de un paso que ya funciona: chips en los tabs,
`.input-hero`, `.label-nam`, `.help-nam`, `.error-nam`, y el checkbox del catálogo convertido
en las dos tarjetas seleccionables del diseño con el badge "RECOMENDADO" (mismo estado
`seedCatalog`, solo cambia la representación). Se omite la barra "PASO 1 DE 3".

**Desviación en `LoginScreen`:** el enlace "¿Te han dado un código de casa?" del diseño no
tiene destino posible — el código se introduce en el onboarding, que solo existe **después**
de autenticarse. Se ha dejado como texto informativo ("…Entra con tu correo y te lo pediremos
después") en lugar de inventar navegación.

## Fase 2 — Agenda semanal y navegación

El bloque más grande. Spec: `menu-agenda-view.md`.

- Cabecera nueva de `App.tsx`: logotipo ¡Ñam!, nombre del hogar y código, accesos
  "Platos" y "Familia", CTA "Editar la semana".
- `MenuAgendaView`: layout de hoy destacado (340 px) + rejilla 3×2 en semana actual;
  el split 4+3 actual se reserva para la próxima semana; filas compactas en móvil;
  círculos ☀/☾ en lugar de `border-l-4` y emojis; días pasados atenuados.
- Modo edición de toda la semana: banner oscuro + tarjetas de borde discontinuo + filas
  tocables. Es estado de UI local, no lógica. Sustituye al lápiz en `hover`, que en
  táctil es inalcanzable.

Se mantienen `itemsByDay`, `sortedDays`, `firstRowDays`/`secondRowDays`, las props y los
`disabled` de las flechas. `isEditing` vive en `App.tsx`, porque en escritorio el CTA está en
la cabecera y el banner de edición la sustituye por completo.

Decisiones tomadas al implementar:

- **Una fila por plato en modo edición.** El mockup agrupa "Judías verdes · Filete empanado"
  en una sola fila con un único ✎, lo que dejaría al usuario sin forma de elegir qué plato
  cambia. En edición se renderiza una fila por plato editable; en lectura sí se juntan con "·"
  como pide el diseño.
- **Botones "Platos" y "Familia" aplazados a la Fase 3**, para no dejar navegación que no
  lleva a ningún sitio. Mientras tanto "Salir" sigue en la cabecera.
- Rango de fechas reformateado a "25 – 31 de julio" (y "30 de julio – 5 de agosto" cuando la
  semana cruza de mes). Es presentación: `formatDate` de `menuGenerator` no se toca.
- El día de hoy se detecta comparando cadenas `YYYY-MM-DD` en hora local, no con `Date`,
  para no depender de la zona horaria.

**Decisión abierta (menor):** navegación entre vistas con estado local o con
`react-router-dom`, que ya está instalado pero sin usar. Recomendación: router, porque en
PWA standalone el botón atrás del sistema debe volver a la agenda en vez de salir de la app.

## Fase 3 — "Platos" y "Familia" **[funcionalidad nueva]**

- **Catálogo de platos.** Spec: `catalog.md`. Pantalla nueva con buscador y chips de filtro.
  El filtrado es en cliente sobre `dishIdeas`, que `App.tsx` ya carga y mantiene suscrito
  a realtime, así que no hace falta ninguna consulta nueva.
  Sin distinción de rol: todos ven ✎ y "+". Se omiten el aviso verde de miembro y el botón
  "Sugerir un plato" del spec, que dependen de la Fase 7.
- **Familia.** Spec: `familia.md` (añadida al bundle el 2026-07-26). **Se construye parcial**,
  porque de sus cuatro bloques solo dos son viables hoy:
  - Cabecera: nombre de la casa (`h1`) + ✎ para renombrar en línea (Enter/Escape),
    con UPDATE sobre `households`. La RLS ya lo permite (`Members can rename their household`),
    pero no existía UI ni handler. **[funcionalidad nueva]**
  - Tarjeta amarilla del código: `join_code` formateado en dos grupos de 4 al pintar
    (el valor real no se toca) + botón "Compartir" con `navigator.share` y fallback a
    portapapeles, más el toast "Código copiado".
  - "Cerrar sesión" como enlace de acción verde subrayado (`<button>`, no `<a>`).
  - **Se omiten**: la lista de miembros y el subtítulo "N miembros · eres admin" (Fase 8),
    el bloque "Ajustes de la casa" (depende de la Fase 6), y las variantes admin/miembro (Fase 7).

> La cabecera de `familia.md` afirma que "se mantienen" la lista de miembros, el RPC de
> compartir, el ajuste de inicio de semana y que "los permisos por rol ya existen".
> **Ninguna de esas cuatro cosas existe en el repo.** Solo `name`, `join_code` y `signOut`
> son reales. El resto de la spec (medidas, estados, accesibilidad) sí es aplicable tal cual.

Decisiones tomadas al implementar:

- **Navegación con estado local, no con `react-router-dom`.** No hay `vercel.json` en el repo,
  así que `BrowserRouter` daría 404 al recargar `/platos` en producción. Meter el router exige
  añadir *rewrites* de despliegue, y no compensa hacerlo en la misma fase que las escrituras
  nuevas. Coste: en la PWA instalada, el botón atrás del sistema sale de la app en lugar de
  volver a la agenda. Revisable añadiendo `vercel.json` + router en una fase aparte.
- **Cabecera global en todas las vistas.** Las capturas de catálogo y Familia no muestran
  cabecera, así que no había forma de volver. El logotipo "¡Ñam!" actúa de vuelta a la agenda
  y los accesos marcan la vista activa con `aria-current`.
- **El catálogo es de solo lectura en esta fase.** Sin "+" ni ✎, porque el modal de alta y
  edición es Fase 4; así no quedan botones que no hacen nada.
- **"Salir" se ha movido a Familia**, ya con su pantalla destino.
- El renombrado no dispara ningún evento de analítica: no existe uno para esto y no se han
  añadido eventos nuevos sin acordarlo.

## Fase 4 — Edición de platos **[funcionalidad nueva]**

- `DishEditor`: el `<select>` nativo pasa a bottom sheet (móvil) / popover (escritorio) con
  buscador y chips de filtro. **Las reglas de `compatibleDishes` no se tocan** (día de finde,
  `meal_type`, no-pasta en cena, compatibilidad de `slot`).
- `AddDishModal`: los cuatro `<select>` pasan a grupos de chips (`role="radiogroup"`),
  manteniendo estado y valores exactos. Móvil a pantalla completa.
- Modos nuevos: **editar** (UPDATE de `dish_ideas`) y **borrar** (DELETE + modal de
  confirmación `role="alertdialog"`), accesibles desde el catálogo de la Fase 3.

> Renombrar un plato **no** actualiza los menús ya generados, porque `menu_items` guarda
> nombres, no ids. Es el mismo criterio que el handoff aplica al borrado
> ("No afecta a las semanas ya planificadas").

Decisiones tomadas al implementar:

- **`AddDishModal` sirve a dos contextos** con la prop `variant`. En `'menu'` (desde
  `DishEditor`) conserva el bloque "¿Lo guardamos?" y `onConfirm` con sus dos ramas exactas.
  En `'catalog'` siempre persiste, precarga el plato al editar y muestra "Borrar este plato".
  El estado interno (`name`, `mode`, `category`, `formMealType`, `dayType`, `mainIngredient`)
  y `canProceed`/`canSubmit` no cambian de semántica.
- La comprobación de duplicado excluye el propio plato al editar (`d.id !== dish?.id`);
  si no, no se podría guardar un plato sin renombrarlo.
- **El popover de escritorio no va anclado a la fila**, como pedía `dish-editor.md`, sino
  centrado a 380 px. Anclarlo obliga a medir posiciones y a gestionar desbordes; el modal
  centrado es equivalente en función y mucho más robusto.
- **Eventos de analítica nuevos**: `dish_edited` y `dish_deleted`, siguiendo el patrón de
  `dish_added`. Son acciones nuevas, así que no había evento previo que reutilizar.
- Las escrituras filtran también por `household_id`, además de por `id`, como cinturón y
  tirantes sobre la RLS.

**Error corregido durante la implementación:** los chips seleccionados salían vacíos en
escritorio. Combinar `!bg-verde-500` con `lg:!bg-white` en el mismo elemento hace que gane la
variante responsive por el orden del CSS generado por Tailwind, no por el orden en el atributo
`class`: fondo blanco con texto blanco. Se resolvió aplicando `.chip-on` en el estado
seleccionado en lugar de encadenar `!important`.

## Fase 5 — Repaso

`CatalogChecklist` según su spec (círculos de 24 px, contadores, nota "¡Listo para generar
la semana!"). `FeedbackButton` llevado al sistema nuevo sin tocar su comportamiento ni su
`trackEvent`; pierde el botón "Cancelar" porque ya cierra con ✕, scrim y `Escape`.

Animaciones de `animations.md` como clases `.anim-*` en `index.css` (sheet, pop, scrim, toast,
badge, banner), más el bloque global de `prefers-reduced-motion` con la excepción del spinner,
que pasa a pulso de opacidad.

Accesibilidad aplicada:
- Anillo de foco `amarillo-500` sobre el banner oscuro de edición, según `accessibility.md`.
- Flechas de semana: `after:-inset-1` amplía el área táctil a 44 px sin alterar los 36 px
  visuales del diseño.
- En la agenda el logotipo es el `h1` (las otras vistas traen el suyo), vía un envoltorio
  con `display: contents` que no afecta al layout.
- Los grupos de chips se recorren con las flechas del teclado, como pide un `radiogroup`.
- Metadatos informativos subidos de `tinta-300` a `tinta-500` (2.7:1 → 5.3:1), siguiendo
  "para metadatos legibles usar `tinta-500`". Se mantiene `tinta-300` en placeholders, iconos
  `aria-hidden` y el estado "cumplido" del checklist, que además se indica con ✓.

### Contraste — resuelto (decisión de Laura, 2026-07-28)

El handoff se contradecía a sí mismo y dos combinaciones incumplían WCAG AA. Corregidas:

1. **`.label-nam`**: `tinta-300` → `tinta-500`. De 2,70:1 a **5,28:1**.
   `design-tokens.md` la definía en `tinta-300`, pero `accessibility.md` limita ese tono a
   texto ≥ 19 px 700, y la etiqueta es de 13 px.
2. **Blanco sobre verde**: el fondo de `.btn-primary` y `.chip-on` pasa de `verde-500` a
   `verde-600`, y su hover de `verde-600` a `verde-700`. De 3,38:1 a **4,88:1**.
   `accessibility.md` daba por buenos los CTA "porque su texto es 16–17 px 800", pero WCAG
   solo considera texto grande a partir de 18,66 px en negrita.
   Mismo cambio en los cuatro botones verdes con texto que no usan esas clases
   ("✓ Hecho", "Feedback", "+" del catálogo y el ✓ de guardar nombre).

Se mantiene `verde-500` en los elementos **decorativos** (`aria-hidden`), donde no hay texto
que leer y sí identidad de marca: los círculos de ☾ y de ✓, y el punto de selección.

**Pendiente**: el texto pequeño sobre el fondo `verde-500` a sangre de `LoginScreen`
("Sin contraseñas…" a 14 px y el aviso del código de casa a 15 px) sigue en ~3,3:1. Cambiarlo
implica tocar el fondo de la pantalla hero, que es la pieza de marca más visible, así que
queda para una decisión aparte.

---

## Pendiente para versiones posteriores

### Fase 6 — Onboarding en tres pasos ← **prioridad**

`onboarding-screen.md` describe un onboarding guiado en tres pasos que **nunca se implementó**:
en la Fase 1 se aplicó la estética nueva sobre el flujo de un paso que ya funcionaba, y el
resto se aplazó. Los pasos del diseño:

1. Nombre de la familia + selector "La semana empieza en" → "Seguir".
2. Elección de catálogo: "Usar los platos de siempre" (badge RECOMENDADO) / "Prefiero elegirlos yo".
3. Reglas de la casa: una fila por regla con casilla y stepper de 1 a 7, más un contador de
   mínimos que **bloquea el avance hasta llegar a 20 platos**.

> **No es una fase autónoma.** Los pasos 1 y 3 arrastran dos piezas de backend que en su
> momento se separaron a propósito; ver las dos secciones de dependencias más abajo. Medido en
> trabajo real es probablemente la fase más grande de todas, no la más pequeña.

Además, a resolver dentro de esta fase:

- **El código de invitación de la beta no aparece en el diseño**, pero
  `redeem_invite_and_create_household` lo exige para crear un hogar. Hay que decidir en qué
  paso vive, o el onboarding rediseñado no podrá crear hogares.
- El contador de mínimos puede apoyarse en `isCatalogReady` y `CatalogChecklist`, que ya
  calculan lo necesario; hoy simplemente no cortan el flujo.
- Estado de navegación entre pasos (hoy `OnboardingScreen` es un único formulario).

**Beneficio colateral**: cierra de raíz el callejón del catálogo vacío que apareció en las
pruebas (ver más abajo), porque el paso 3 no deja salir del onboarding sin platos suficientes.

Si se aborda, conviene rediseñar el flujo entero de una vez en lugar de trocearlo.

### Fase 7 — Admin vs. miembro

Aplicar la distinción de rol que el diseño ya contempla: ✎ y "+" solo para admin,
"Solo el admin puede editar el plan" en la agenda, badge ADMIN, aviso verde y botón
"Sugerir un plato" para miembros (`catalog.md`, `menu-agenda-view.md`), más las variantes
de Familia: tarjeta de código blanca y sin "Compartir" para miembros, ✎ solo para admin,
ajustes atenuados con la nota "Solo el admin puede cambiar los ajustes de la casa"
(`familia.md` §2, §4, §6).

Estado actual: `household_members.role` (`owner` | `member`) existe desde la migración
`20260711000000_multi_tenant_households.sql`, pero:

- `AuthProvider` hace `select('households(id, name, join_code)')` y **no lee el rol**;
  `Household` en `types/index.ts` no tiene el campo.
- La RLS vigente (`Members manage their household dishes` / `... menus`, ambas `FOR ALL`)
  da permiso de escritura a **cualquier** miembro. Las políticas antiguas de admin fueron
  eliminadas en esa misma migración.

Por tanto no basta con ocultar botones: hacerlo solo en cliente sería seguridad aparente.
Requiere migración de RLS. **Riesgo:** puede bloquear a usuarios de la beta que hoy editan
sin restricción; conviene revisar quién es `owner` en los hogares reales antes de aplicarlo.

### Fase 8 — Lista de miembros en "Familia"

**Solución técnica por decidir.** El problema no es solo de permisos:

1. `household_members` solo se puede leer para uno mismo
   (`Users can view their own membership`, `USING (user_id = auth.uid())`).
   Habría que añadir una policy por `household_id = current_household_id()`.
2. Aun resolviendo (1), la tabla solo guarda `user_id` (UUID): **no hay nombres ni emails**.
   Esos datos viven en `auth.users`, que no es accesible desde el cliente.
   No existe tabla `profiles`.

Opciones a valorar:

- **Tabla `profiles`** con `display_name`, poblada por trigger en `auth.users`.
  Es el patrón habitual en Supabase y sirve para futuras features. La más trabajo.
- **RPC `SECURITY DEFINER`** que devuelva miembros + rol + email de la casa propia.
  Rápida, pero expone emails a toda la casa y no permite renombrarse.
- **Desnormalizar** el email o un alias en `household_members` al unirse.
  La más simple; queda obsoleto si el usuario cambia de email.

Al completarse, la lista rellena el hueco central de Familia (`familia.md` §3): avatares con
inicial y color rotando por índice, nombre, correo y etiqueta ADMIN rectangular de 6 px.
También habilita el subtítulo "N miembros · eres admin" y el estado "Solo un miembro".

> Las fases 7 y 8 tocan la misma tabla y la misma RLS. Conviene diseñarlas y aplicarlas
> juntas en una sola migración, no por separado.

### Dependencia de la Fase 6 — ajuste "La semana empieza en"

Aparece en el paso 1 del onboarding y también en `familia.md` §4. **No existe**: la semana es
sábado–viernes fija en `getCurrentWeekSaturday()` (`App.tsx`), y `households` no tiene columna
para configurarlo. No es un ajuste de presentación sino de lógica de negocio.
Implicaciones a valorar antes de abordarlo:

- `generateWeeklyMenu` y el cálculo de `week_start` / `week_end`.
- Los menús **ya guardados** con el inicio de semana antiguo: ¿se migran, conviven o se descartan?
- `canAccessNextWeek` y `SETTINGS.upcomingWeekUnlockDay`, que asumen que el sábado resetea.
- El cron de los viernes (`generate-menu.yml`), hoy pausado.

Entronca con "reglas configurables por hogar", que ya estaba en el backlog del proyecto.

### Dependencia de la Fase 6 — reglas configurables por hogar

El paso 3 del onboarding pinta las reglas de la casa como casillas con stepper de 1 a 7.
Hoy esas reglas **no son configurables**: viven dentro de `menuGenerator.ts` y en `SETTINGS`
(`config.ts`), que es un objeto global hardcodeado e igual para todos los hogares.

Hacerlas por hogar implica decidir dónde se guardan (columna JSON en `households` o tabla
propia), que `generateWeeklyMenu` las lea en lugar de asumir las suyas, y qué pasa con los
hogares existentes, que necesitarán valores por defecto equivalentes a los actuales para que
sus menús no cambien de comportamiento de un día para otro.

Ya estaba en el backlog del proyecto como "reglas configurables por hogar", anterior al
rediseño.

---

## Corregido tras las pruebas — callejón sin salida con el catálogo vacío

Al elegir "Prefiero elegirlos yo" en el onboarding, el hogar se creaba con el catálogo vacío
y la agenda ofrecía "Generar menú", que es imposible sin platos. Tres fallos encadenados:

1. **Spinner infinito (preexistente, también en producción).** El botón "Reintentar" de la
   pantalla de error hacía `setLoading(true)` y nunca lo devolvía a `false`, porque
   `loadCurrentMenu` no genera nada si `dishIdeas` está vacío y no había `finally`.
   Corregido con `.finally(() => setLoading(false))`.
2. **El CTA del estado vacío era el equivocado.** `menu-agenda-view.md` §"Vacío" pedía
   `.btn-primary` **"Añadir platos"** y el texto "Necesitáis al menos 20 platos en el catálogo";
   en la Fase 2 se mantuvieron los botones antiguos ("Generar menú" + catálogo sugerido) en
   lugar de aplicar el spec. Ahora el CTA lleva a la vista de platos.
3. **"Generar menú" solo aparece si `isCatalogReady`.** Si no lo está, se explica cuántos
   platos hay y el checklist señala qué mínimos faltan, siguiendo la regla de `accessibility.md`
   de explicar por qué un CTA no está disponible.

Es un parche en la salida, no en la causa: la Fase 6 lo cierra de raíz, porque su paso 3 no
deja terminar el onboarding por debajo de 20 platos.

---

## Backlog tras las pruebas de Laura (2026-07-27)

Ninguno es crítico; el rediseño se sube sin ellos. Ordenados de menor a mayor coste.

### 1. "Compartir" se comporta raro en escritorio
`FamilyView.shareCode` usa `navigator.share` si existe y cae a portapapeles si no. En Chrome
de escritorio `navigator.share` **sí existe**, y abre un diálogo del sistema poco útil para
compartir un código de 8 caracteres.

Arreglo propuesto (pequeño): reservar `navigator.share` para dispositivos táctiles
(`matchMedia('(pointer: coarse)')` o `navigator.maxTouchPoints > 0`) y copiar siempre al
portapapeles en escritorio, con el toast "Código copiado" que ya está implementado.

### 2. El logotipo no se percibe como el camino de vuelta — resuelto (ago 2026)
Al estar en Familia o Platos no se veía cómo volver al plan semanal. El logotipo era el botón
de vuelta (decisión de la Fase 3), pero no se leía como tal.

Resuelto con la navegación de tres destinos de `specs/navigation.md` (parte de M6): barra
inferior fija en móvil, pestañas en la cabecera en escritorio, y el logotipo pasa a ser sólo
marca. Ocupa por fin el z-index que `design-tokens.md` §6 reservaba para la "nav inferior".

### 3. El código familiar es largo y confuso
Hoy son **8 caracteres alfanuméricos** en mayúsculas, generados por el `DEFAULT` de la columna:
`upper(substr(md5(gen_random_uuid()::text), 1, 8))` (migración `20260711130000`).
El feedback de usuarios pide algo más corto, del tipo 4 dígitos.

No es un cambio de diseño sino de datos. A resolver antes de tocarlo:
- **Colisiones**: 4 dígitos son 10.000 combinaciones. La columna es `UNIQUE`, así que el
  `DEFAULT` debe pasar a una función con reintento, o el `INSERT` fallará algún día.
- **Códigos ya repartidos**: los hogares de la beta tienen su código. ¿Se regeneran (rompiendo
  los que la gente ya tenga apuntados) o solo aplica a los nuevos?
- `join_household` compara con `upper(trim(...))`; si pasa a numérico, revisar esa normalización.
- El diseño ya lo pinta como 8 **dígitos** en dos grupos ("6767 6767"), no alfanumérico:
  `formatJoinCode` en `FamilyView` habría que ajustarlo al nuevo formato.

### 4. Un plato nuevo puede acabar en un hueco que no le corresponde
Al crear un plato desde el sheet, `handleModalConfirm` llama a `onUpdate(name, category)` y lo
coloca en el hueco actual **sin comprobar** que lo que el usuario acaba de describir encaje ahí.
Se puede marcar un plato como "fin de semana" y quedar colocado en un lunes, o marcarlo "cena"
y quedar en una comida.

Comportamiento preexistente, no introducido por el rediseño. Decidir entre avisar
("Lo has marcado como de fin de semana, ¿lo ponemos igual el lunes?"), ajustar el plato al
contexto, o impedirlo. Toca reglas de negocio.

### 5. No se puede pasar de plato único a primero + segundo de forma explícita
En modo edición, un día con plato único no ofrece ninguna acción para partirlo en dos platos.
La conversión **sí existe** en `updateMenuItem` (`App.tsx`): elegir un plato de categoría
`main` desde un hueco `single` lo convierte y añade un primero **al azar**. Pero está escondida
dentro de la elección de plato y el usuario no elige el primero.

Necesita una acción explícita en el sheet o en la tarjeta del día ("Quiero primero y segundo"),
y decidir si el primero se elige o se sigue sorteando. Toca reglas de negocio.

## Verificación

No hay tests en el repo. Cada fase se verifica levantando el dev server y comparando contra
`screenshots/`, en móvil y escritorio, además de `npm run build` y `npm run lint`.
