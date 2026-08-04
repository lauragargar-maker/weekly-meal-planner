# Plan de beta: must-have para abrir ¡Ñam! a más familias

Hasta ahora la app la usa una sola familia (la de Laura). Este plan recoge lo
imprescindible para meter familias desconocidas.

Tres fuentes: las entrevistas de `User Research/` (Erika, 2026-07-24; Cristina,
2026-07-27), las fases 6-8 pendientes de `docs/redesign-plan.md`, y el backlog de
ese mismo documento.

**Criterio de must-have**: que un hogar nuevo pueda entrar sin ayuda de Laura, que
el menú generado le sirva a una familia que no es la suya, y que no haya callejones
sin salida.

---

## Estado

| | Estado |
|---|---|
| M7 — código de familia de 6 dígitos | **En producción** (PR #9, ago 2026) |
| M8 — login por código | **En producción** (PR #9, ago 2026) |
| M1, M2, M2b, M4, M5, M6, M9, M10 | Pendientes |

Siguiente bloque de trabajo: **M1 → M2 → M2b** es la cadena larga y la que más valor
trae; **M5 → M10** es independiente y barata; **M4, M6 y M9** esperan a las specs de
Claude Design (`docs/brief-claude-design.md`).

> **Aviso operativo tras M8.** Las plantillas de correo de producción ya **no**
> contienen `{{ .ConfirmationURL }}`: solo mandan el código. Eso significa que
> **revertir el frontend ya no es seguro** — una versión anterior de la app espera un
> enlace que el correo no manda, y nadie podría entrar. Si hiciera falta volver atrás,
> hay que restaurar antes el `{{ .ConfirmationURL }}` en las dos plantillas
> (*Magic Link* y *Confirm signup*).

---

## Lo que dijeron las entrevistas

Cinco de las seis peticiones marcadas como must-have por las usuarias son **la misma
pieza**: las reglas de generación, hoy hardcodeadas en `menuGenerator.ts` y `SETTINGS`.

| Petición | Quién | Dónde cae |
|---|---|---|
| No repetir ingrediente base en comida y cena del mismo día | Erika + Cristina | M2 |
| Frecuencia semanal de pasta | Erika | M2 |
| Evitar carne en la cena | Erika | M2 |
| Verdura obligatoria en cada comida y cena | Cristina | M1 + M2 |
| Cena de dos componentes (verdura + proteína) | Cristina — bloqueante literal | M2 |
| Ver siempre la semana siguiente | Cristina | M5 |

**Ninguna de las dos pidió nada de la Fase 7 (roles) ni de la Fase 8 (lista de
miembros).** Ambas quedan fuera de la beta.

---

## Decisiones tomadas (2026-07-31)

- **Semana fija de lunes a domingo, no configurable.** El inicio de semana en sábado
  existía para poder comprar el viernes lo de la semana siguiente; con M5 esa
  necesidad desaparece. La inmensa mayoría de familias españolas cuentan la semana
  desde el lunes. → M10.
- **Onboarding por pasos sueltos**, no rehacer el flujo entero que describe
  `onboarding-screen.md`. Se añaden los pasos que hacen falta al flujo actual.

  > Nota: al meter los bloques C y D en el onboarding, el flujo queda en la práctica
  > con tres pasos (reglas de estructura → reglas de contenido → platos) más el nombre
  > de la casa y el código de invitación. Es muy parecido al onboarding de tres pasos
  > del diseño original, aunque con contenido distinto. La decisión de "pasos sueltos"
  > sigue valiendo como método —se construye sobre el flujo que ya funciona— pero
  > conviene saber que el resultado ya no es un flujo corto.

- **Las reglas se preguntan antes que los platos**, para que los mínimos de catálogo
  que se enseñan estén calculados con las reglas del hogar. → M4.
- **Reglas como conjunto cerrado** con activar/desactivar y stepper. Nada de motor
  genérico; se replanteará si la beta demuestra que da valor.
- **Login por OTP**, no arreglo del magic link (ver M8: no existe tal arreglo en iOS).
- **Código de familia de 6 dígitos**, regenerando los existentes.
- **Varios ingredientes principales por plato**, no uno solo. La lasaña es `pasta` y
  `meat`, y hoy no hay forma de decirlo: de ahí los días que repiten grupo sin que las
  reglas lo detecten. → M1.
- **Los menús históricos de Laura no se migran** al pasar la semana a lunes. Quedarán
  invisibles desde la vista de semana anterior. Asumido. → M10.

---

## Must-have

### M1 — Completar la clasificación de platos

Los valores del enum (`pasta|meat|fish|egg|legume|vegetable`) se mantienen: sirven a
la vez para el grupo de alimento y para el subtipo, y aplanarlos a
proteína/hidrato/verdura perdería "frecuencia de pasta" y "no carne en cena".
Lo que cambia es cuántos puede llevar un plato y qué falta en la lista.

1. **Varios ingredientes por plato.** Hoy `main_ingredient` es un valor único, así que
   la lasaña solo puede ser `pasta` **o** `meat`, y por eso salen días que repiten
   grupo sin que las reglas lo vean. Pasa a `main_ingredients TEXT[]` con
   `CHECK (main_ingredients <@ ARRAY[...])` para validar los valores.

   No hace falta designar un ingrediente principal con otros secundarios: **los ~15
   usos de `main_ingredient` en `menuGenerator.ts` son todos comprobaciones de
   pertenencia**, ninguno necesita la identidad del plato. Un array plano basta.

   Tampoco tabla de unión: es un enum cerrado sin atributos propios, y una tabla
   aparte obligaría a duplicar políticas RLS sin ganar nada.

   A comprobar antes de migrar: la columna es hoy **nullable**. Hay que ver cuántos
   platos reales tienen `NULL` y decidir si se rellenan a mano o entran como array
   vacío — un plato sin etiquetar es invisible para todas las reglas.
   El índice `idx_dish_ideas_main_ingredient` se puede tirar: el cliente carga todos
   los platos del hogar y filtra en JS.

2. **Hidratos ausentes**: hoy solo existe `pasta`. No hay `rice` ni `potato`, así que
   un arroz con pollo se etiqueta `meat` y la regla de no repetir hidrato no lo ve.
   Cristina rota pasta / legumbre / guiso de carne / arroz / pescado.
   → mismo `ALTER` sobre el CHECK de `supabase/schema.sql:10`.

3. **Mapa de grupos, en código y no en base de datos**: constante en `menuGenerator`
   con `pasta|rice|potato → hidrato`, `meat|fish|egg|legume → proteína`,
   `vegetable → verdura`. Habilita "no repetir grupo de proteína" y "no repetir
   hidrato" sin tocar datos ni UI.
   `legume` va a proteína: Cristina trata las lentejas como plato proteico completo.

4. **Reetiquetar los 44 platos de `starterCatalog.ts`.** Es el trabajo manual y es
   donde está el valor: lasaña `{pasta, meat}`, lentejas con chorizo `{legume, meat}`,
   pollo asado con verduras `{meat, vegetable}`.

> El booleano `includes_vegetable` que se contemplaba antes **desaparece**: con varios
> ingredientes por plato, `vegetable` es una etiqueta más y el caso queda cubierto sin
> añadir un concepto especial.

**Efecto sobre las reglas**: la comprobación de no repetir pasa de "¿son iguales?" a
"¿se cruzan?". Es lo que se busca, pero es **bastante más estricto**. Hoy el cruce solo
aplica a `fish` y `egg`, etiquetas poco frecuentes; en cuanto medio catálogo lleve
`meat`, encontrar siete días válidos se complica. De ahí que la regla deba ser
configurable por eje (M2) y que el fallback silencioso deje de serlo (M2b).

**Dos trampas concretas:**

- **`vegetable` tendrá dos sentidos.** "Brócoli" *es* un plato de verdura; "pollo asado
  con verduras" *lleva* verdura, y ambos llevarán la etiqueta. Para la regla de verdura
  obligatoria da igual, pero `catalogCheck` contaría el pollo como plato de verdura
  apto para cena. Hay que contar por `category`, no solo por etiqueta.
- **`AddDishModal` deja de ser un `radiogroup`.** El grupo de chips de ingrediente usa
  `role="radiogroup"` con navegación por flechas desde la Fase 4; pasa a selección
  múltiple, lo que cambia el rol ARIA y el manejo de teclado.

**Va primero por calendario, no por diseño**: hoy los datos a reetiquetar son los de
una familia. Con 15 hogares creando platos, la migración se vuelve cara y arriesgada.
El argumento se refuerza al no ser ya una columna añadida sino una columna cambiada de
forma.

Fuera: partir `meat` y `fish` para la rotación fina de Cristina (carne blanca / cerdo
/ pescado blanco / pescado azul). Es refinamiento, no bloqueante. → backlog.

Deuda a no olvidar: `supabase/functions/generate-weekly-menu/` tiene su propia copia
del generador y quedará incoherente con el esquema. Está pausada, pero hay que
actualizarla antes de reactivarla.

Tamaño: M. Depende de: nada.
Riesgo: toca el núcleo de un algoritmo de 582 líneas sin ningún test. Ver Verificación.

### M2 — Reglas configurables por hogar

Conjunto cerrado de reglas, cada una con activar/desactivar y, donde aplique, stepper.
Sustituye a lo hardcodeado en `menuGenerator.ts` y en `SETTINGS` (`config.ts`).

Se parte de las reglas que el generador ya aplica hoy: **todas tienen que acabar como
regla o como valor por defecto**, o los menús de los hogares existentes cambian de
comportamiento sin avisar.

#### Bloque A — Estructura de las comidas

Cambia la *forma* del plan, no solo su contenido. Por eso va primero.

| Regla | Control | Por defecto |
|---|---|---|
| En la comida queremos… | Plato único / Primero y segundo / Indistinto | Indistinto |
| En la cena queremos… | Un plato / Dos platos | Un plato |

Hoy la comida elige al azar entre plato único y primero+segundo
(`menuGenerator.ts:404`). **No le sirve a ninguna de las dos entrevistadas**: Erika
siempre come primero y segundo, Cristina siempre plato único contundente. Son
opuestas y el azar las decepciona a las dos.

La cena de dos platos es el bloqueante de Cristina. No se modela como
"verdura + proteína": son dos platos, y que uno deba ser verdura lo decide el bloque C.

#### Bloque B — No repetir en el mismo día

| Regla | Control | Por defecto |
|---|---|---|
| No repetir el hidrato entre comida y cena *(pasta, arroz, patata)* | Sí/No | Sí |
| No repetir el grupo de proteína entre comida y cena *(carne, pescado, huevo, legumbre)* | Sí/No | Sí |

Separado por eje a propósito: repetir carne molesta mucho menos que repetir pasta, y
con varios ingredientes por plato (M1) la comprobación es de intersección, no de
igualdad. Un interruptor único haría que el chorizo de unas lentejas bloqueara el
pollo de la cena, y como la carne es la etiqueta más frecuente de cualquier catálogo,
casi ninguna semana sería válida.

*Ya existe a medias*: `menuGenerator.ts:136` cruza comida y cena solo para `fish` y
`egg`. Resuelve la queja nº1 de ambas usuarias (los macarrones a mediodía con ensalada
de pasta por la noche).

> **Esto cambia los menús de Laura.** Hoy la carne repetida está permitida. Poner el
> grupo de proteína a Sí por defecto es un superconjunto de lo actual y es lo que piden
> las dos usuarias, pero sus semanas saldrán distintas. Decisión asumida.

#### Bloque C — Frecuencias de la semana

| Regla | Control | Por defecto |
|---|---|---|
| Pescado al menos… | Stepper 0-7 días | 2 |
| Legumbre… | Stepper 0-7 comidas | 1 |
| Pasta como mucho… | Stepper 0-7 veces | 2 |
| Verdura en todas las cenas | Sí/No | No |

**Fallo encontrado al revisar**: hoy la legumbre no es un mínimo, es *exactamente una*
(`menuGenerator.ts:101`, `legumeCount !== 1`). Un menú con dos comidas de legumbre se
rechaza. Cristina come legumbre 2-3 veces por semana, así que la regla actual la
excluye activamente.

La regla de verdura **solo se muestra si en el bloque A se ha elegido cena de dos
platos**. Con un solo plato exigir verdura obliga a que ese plato la contenga, lo que
es restrictivo y difícil de explicar.

#### Bloque D — Qué no queremos por la noche

| Regla | Control | Por defecto |
|---|---|---|
| En la cena, nada de… | Chips múltiples: pasta, arroz, patata, carne, legumbre | pasta |

Hoy la exclusión de pasta está hardcodeada como filtro duro (`menuGenerator.ts:231` y
`:445`). Convertirla en lista configurable es el mismo código, y "no carne en cena"
(Erika) sale gratis.

#### Dónde se pregunta cada bloque

- **Onboarding, paso 1**: bloque A.
- **Onboarding, paso 2**: bloques C y D. La regla de verdura aparece o no según lo
  contestado en el paso 1 — **es la primera dependencia entre pasos del onboarding**,
  que deja de poder ser un formulario plano.
- **Familia → Ajustes de la casa**: los cuatro bloques, editables. El bloque B vive
  solo aquí, con sus defectos activados: es la regla que el usuario no sabe que quiere
  hasta que se la incumplen, y preguntarla en el onboarding cuesta atención sin
  aportar.

`familia.md` §4 ya diseñó el bloque "Ajustes de la casa"; se omitió en la Fase 3
precisamente porque dependía de esto.

#### Dos cosas técnicas

**Hay dos tipos de regla y se comportan distinto.** Los bloques A y D son filtros: se
aplican al elegir cada plato y nunca hacen imposible una semana, solo exigen más
catálogo. Los bloques B y C se validan sobre la semana entera y **sí pueden ser
insatisfacibles**. Es exactamente la lista que M2b debe saber nombrar cuando el
generador no encuentra solución.

**Cambiar una regla no toca los menús ya generados.** Se aplica a partir de la
siguiente generación, más un "Regenerar esta semana" explícito. Regenerar en silencio
borraría ediciones manuales, y pasar de uno a dos platos en la cena no puede rellenar
retroactivamente el plato que falta.

Dónde se guardan las reglas: columna JSONB en `households` o tabla propia — a decidir
al implementar. Los hogares existentes necesitan valores por defecto equivalentes a
los actuales, salvo la excepción anotada en el bloque B.

**Queda como invariante interna, sin interruptor**: que ningún plato se repita en la
semana, y el filtro de solapamiento de palabras del mismo día.

Tamaño: L. Depende de: M1.

### M2b — Consecuencias de M2 que no son la regla en sí

1. **`catalogCheck.ts` tiene que ser consciente de las reglas.** Los mínimos son hoy
   fijos (`catalogCheck.ts:41`). Un hogar que active la cena de dos grupos necesita
   ~7 platos de verdura aptos para cena que hoy nadie le exige; si el checklist no lo
   refleja, `generateWeeklyMenu` cae en silencio a `generateBasicMenu` y el usuario no
   entiende por qué. Es el mismo callejón sin salida que ya se parcheó con el catálogo
   vacío.
2. **El catálogo semilla se queda corto, y el agujero es concreto.**
   Los 44 platos actuales son 9 primeros, 6 pescados, 7 carnes, 4 huevos, 3 verduras,
   3 de pasta/arroz y 12 platos únicos.

   Hoy una semana consume como mucho 21 platos distintos (ningún plato se repite en la
   semana). **Con "primero y segundo" siempre y cena de dos platos, pasa a 28.** El
   problema no es el total, son los huecos por tipo:

   | Hueco | Tiene | Necesita, con holgura para el solver |
   |---|---|---|
   | Platos de verdura utilizables en cena | 7 | ~14 |
   | Segundos para cena | 17 | ~14, sin margen |

   Los 7 de verdura son engañosos: **5 son primeros, y hoy el generador nunca pone un
   primero en la cena** — `pickDinner` solo elige de `allDinnerMains`, categoría
   `main`. Para las cenas de dos platos, la mitad de verdura tiene que salir de ahí,
   así que el generador debe componer la cena igual que compone la comida.

   Parte del arreglo es gratis: hay primeros marcados `lunch` que en cena son
   normales — "Judías verdes con patata" es literalmente el ejemplo de Cristina.
   Pasarlos a `both` no cuesta nada.

   Dos etiquetados mal que M1 arregla de paso: **"Arroz a la cubana" está marcado como
   `pasta`** (`starterCatalog.ts:52`), así que hoy el generador lo prohíbe en la cena
   como si fuera pasta y una regla de frecuencia de pasta lo contaría; y "Lasaña de
   carne" es solo `pasta`.

   Estimación: **de 44 a ~75 platos**, concentrando el crecimiento en verduras para
   cena y segundos de cena.
3. **Override manual "hoy quiero dos platos".** La regla gobierna la generación; el
   cambio puntual en modo edición es UI. Cubre el punto 5 del backlog del rediseño
   (pasar de plato único a primero + segundo) y la petición de Erika de elegir el
   segundo plato de la comida.
4. **El fallback tiene que dejar de ser silencioso.** Cuando `generateWeeklyMenu`
   agota sus 200 intentos cae a `generateBasicMenu` (`menuGenerator.ts:561`), que
   ignora casi todas las reglas, y solo deja un `console.warn`. El usuario recibe un
   menú que incumple lo que acaba de configurar y no se entera.

   Hoy no se nota porque las reglas son fijas y satisfacibles. Con reglas
   configurables y varios ingredientes por plato, **los usuarios crearán
   combinaciones imposibles**: es cuestión de tiempo, no de si pasa. El generador debe
   devolver qué regla no ha podido cumplir y la UI debe decirlo.

Tamaño: M. Depende de: M2.

### M4 — Poda del catálogo semilla en el onboarding

Erika recibió macarrones con chistorra y no puede comer chistorra. No se construye un
motor de alergias: el onboarding deja repasar y descartar los platos semilla antes de
generar nada. **El borrado ya existe** desde la Fase 4 del rediseño; falta ponerlo en
el camino. Cristina pide lo mismo por otra vía ("que pongan unos por defecto y la
gente los seleccione").

**Las reglas van antes que los platos.** El paso de platos es el paso 3 del
onboarding, después de los dos de reglas, para que la lista de mínimos que se le
enseña al usuario esté ya calculada con *sus* reglas y no con unas genéricas.

> **Riesgo que abre este orden.** Quien elija reglas exigentes (cena de dos platos +
> verdura obligatoria + nada de carne por la noche) llegará al paso de platos con una
> lista de mínimos enorme. Si la única salida es añadir platos a mano, **hemos
> construido un callejón sin salida nuevo en el onboarding**, justo lo que la Fase 6
> venía a cerrar.
>
> Hace falta una salida explícita: *"Con estas reglas necesitáis 14 platos de verdura
> para las cenas y tenéis 7. ¿Añadís más o suavizamos alguna regla?"*, con enlace de
> vuelta al paso 2.

El campo formal de alergias e intolerancias queda en backlog, como ya estaba anotado
en la entrevista.

Tamaño: M. Depende de: M2b (los mínimos), diseño (ver abajo).

### M5 — Semana siguiente y anterior, siempre visibles

Must-have explícito de Cristina para la siguiente; la anterior la pide también
("ampliar la vista temporal a semanas pasadas") y sale barata si se hace a la vez.

No es un cambio de una línea: `weekOffset` está tipado `0 | 1` (`App.tsx:60`) y hay
dos huecos de estado separados (`currentMenu` / `nextWeekMenu`) con sus cargadores.
Hay que generalizar a un estado indexado por offset. **Conviene hacerlo de una vez**
en lugar de dos veces.

Detalles: en semanas pasadas no se ofrece generar, y los hogares nuevos no tendrán
historial (pantalla vacía, no error).

Efecto colateral: elimina `canAccessNextWeek` y `SETTINGS.upcomingWeekUnlockDay`, que
eran dos de las cuatro dependencias que hacían caro M10.

Tamaño: M. Depende de: nada.

### M6 — Editar tocando el día, y navegación de tres destinos

Las dos usuarias intentaron pinchar en el día para editarlo. Y el logotipo como botón
de vuelta (punto 2 del backlog del rediseño) ya falló en las pruebas de Laura; con
desconocidos es soporte garantizado. `design-tokens.md` §6 ya reserva un z-index para
una "nav inferior" que ninguna spec llegó a describir.

Tamaño: M. Depende de: diseño (ver abajo).

### M7 — Código de familia corto ✅ en producción

Hoy son 8 caracteres alfanuméricos generados por el `DEFAULT` de la columna
(`upper(substr(md5(gen_random_uuid()::text), 1, 8))`, migración `20260711130000`).

**Es ahora o nunca**: hoy el único código en circulación es el de Laura. En cuanto
entren familias, cambiarlo rompe los códigos que la gente tenga apuntados.

- **6 dígitos**, no 4. Cuatro dígitos son 10.000 combinaciones y la columna es
  `UNIQUE`; un millón deja las colisiones en anecdóticas y sigue siendo dictable por
  teléfono ("123 456").
- El `DEFAULT` pasa a función con reintento ante colisión, o el `INSERT` fallará algún
  día.
- Se regeneran todos los códigos existentes.
- Revisar la normalización `upper(trim(...))` de `join_household`, y `formatJoinCode`
  en `FamilyView` (hoy parte en dos grupos de 4).
- Entrada numérica en móvil (`inputmode`).

Si en el futuro hace falta escalar, la salida es pedir nombre de familia + código.

Tamaño: S. Depende de: nada.

### M8 — Login por OTP (arregla el acceso directo en iOS) ✅ en producción

Al añadir ¡Ñam! a la pantalla de inicio de un iPhone, el magic link abre Safari, la
sesión aterriza en el almacenamiento de Safari y **el acceso directo nunca llega a
loguearse**. Es comportamiento de Apple: en standalone no hay arreglo técnico del
magic link.

El cambio es menor de lo que parece. Ya se usa `signInWithOtp`
(`AuthProvider.tsx:82`); lo que lo convierte en enlace es `emailRedirectTo` y la
plantilla de correo de Supabase:

1. Plantilla de Supabase a `{{ .Token }}` en lugar de `{{ .ConfirmationURL }}`.
2. Quitar `emailRedirectTo`.
3. Paso de 6 dígitos en `LoginScreen` + llamada a `verifyOtp({ email, token, type: 'email' })`.

El método del SDK no cambia. Nota: el evento `login_link_requested` se queda con
nombre inexacto; se mantiene para no romper la continuidad de la serie en Amplitude.

**Configuración de Supabase que acompaña a esto**, por si hay que reproducirla:

- Son **dos** plantillas, no una. `signInWithOtp` usa *Magic Link* para usuarios que
  ya existen y ***Confirm signup* para los nuevos** — que son todas las familias que
  entren en la beta. Cambiar solo la primera deja fuera a todo el mundo menos a quien
  ya tuviera cuenta.
- `verifyOtp` se llama con `type: 'email'`, que sirve a los dos casos. La trampa
  habitual es `type: 'magiclink'`, que funciona con usuarios existentes y falla con
  los nuevos.
- Longitud del OTP en 6 (el campo de la app tiene `maxLength={6}`) y caducidad corta:
  un código de 6 dígitos es mucho más adivinable que un token largo de URL.
- Vigilar el límite de envío de emails por hora antes de meter a varias familias
  a la vez; el error ya está traducido en `errorMessages.ts`.

Tamaño: S. Depende de: nada.

### M9 — El botón de feedback tapa el de editar en móvil

Se solapan y resulta incómodo. Círculo expandible o colocación vertical.

Tamaño: S. Depende de: diseño (ver abajo).

### M10 — Semana de lunes a domingo

`getCurrentWeekSaturday()` (`App.tsx:17`) pasa a lunes. Con M5 hecho, las
dependencias que lo encarecían desaparecen: `canAccessNextWeek` y
`upcomingWeekUnlockDay` se borran, y el cron de los viernes
(`.github/workflows/generate-menu.yml`) ya estaba pausado.

Dos cosas asumidas:

- **Los menús históricos no se migran.** Están indexados por `week_start` en sábado;
  la vista de semana anterior de M5 buscará lunes y no los encontrará. El historial de
  Laura queda invisible, no borrado. Migrarlo obligaría a re-trocear semanas
  sábado-viernes en semanas lunes-domingo. Los usuarios de beta no tienen historial.
- **El día del despliegue**, la app no encontrará menú para la semana lunes-domingo en
  curso y autogenerará uno nuevo sobre días ya vividos. Se evita desplegando en
  domingo por la noche.

Deuda anotada: las edge functions (`supabase/functions/generate-weekly-menu/`) siguen
siendo single-tenant y calculan el sábado. Están pausadas; **no reactivarlas sin
actualizar el inicio de semana**.

Tamaño: S. Depende de: M5 (conviene, no obliga).

---

## Orden de trabajo

```
M1 ──> M2 ──> M2b
M5 ──> M10
M7, M8            (independientes, se pueden hacer en cualquier momento)
M4, M6, M9        (bloqueados por diseño)
```

M1 antes que nada por el argumento de calendario. M7 y M8 son buenos primeros
candidatos: pequeños, independientes y de impacto inmediato en la incorporación de
usuarios.

---

## Pendiente de Claude Design

- **Onboarding completo (M2 + M4)**: paso 1 de reglas de estructura, paso 2 de reglas
  de contenido, paso 3 de platos. Con dos particularidades:
  - **El paso 2 depende del paso 1**: la regla de verdura solo aparece si la cena se
    ha configurado de dos platos. Es la primera dependencia entre pasos, así que el
    onboarding deja de poder ser un formulario plano.
  - **Salida cuando las reglas piden más platos de los que hay**, con vuelta al paso 2
    para suavizarlas. Sin esto el orden reglas → platos crea un callejón sin salida.
- **Código de invitación en el onboarding**: `onboarding-screen.md` no tiene campo para
  él, pero `redeem_invite_and_create_household` lo exige para crear un hogar. Sin esto,
  el onboarding rediseñado no puede crear hogares. Ya estaba señalado como pregunta
  abierta de la Fase 6.
- **M6**: edición por tap en el día y navegación explícita de tres destinos
  (Semana / Platos / Familia).
- **M9**: propuesta para el botón de feedback en móvil.

No hace falta pedir: **"Ajustes de la casa"** ya está diseñado en `familia.md` §4; se
omitió en la Fase 3 porque dependía de que existieran las reglas.

---

## Fuera de la beta, y por qué

| Qué | Motivo |
|---|---|
| **Fase 7 — roles admin/miembro** | Nadie lo pidió. Erika comparte con Joaquín de igual a igual; Cristina con hijos, hermana y cuidadora. Además exige migración de RLS con riesgo de bloquear a quien hoy edita sin restricción |
| **Fase 8 — lista de miembros** | Nadie lo pidió. Arrastra decidir entre tabla `profiles`, RPC `SECURITY DEFINER` o desnormalizar |
| **Campo de alergias e intolerancias** | M4 resuelve el caso real por la vía barata |
| **Lista de la compra** | Lo mencionan las dos y es lo más prometedor del roadmap, pero exige ingredientes por plato validados por el usuario. Es la v2 |
| **Vista mensual y semanas pasadas más allá de una** | Cristina misma matiza que planifica por semana. Riesgo de overkill |
| **Motor de reglas genérico** | Se replanteará si el conjunto cerrado se queda corto en la beta |
| **Rotación fina de proteína** | Requiere partir `meat` y `fish`. Refinamiento, no bloqueante |
| **Recordatorio de descongelar** | Necesidad real y no resuelta (Erika usa alarmas manuales), pero no bloquea la beta |
| **Subtipo de ingrediente dentro de un plato genérico** | "Costilla" o "magro" dentro de "carne con patatas". Idea a analizar |
| **Lista de nevera y congelador** | El sistema de Cristina en papel. Cambio relevante, a explorar |
| **Plato nuevo colocado en un hueco incompatible** | Punto 4 del backlog del rediseño. Preexistente; se agrava con M2, revisar entonces |
| **"Compartir" raro en escritorio** | Punto 1 del backlog del rediseño. Cosmético |

---

## Verificación

Sigue sin haber tests en el repo. Cada bloque se verifica levantando el dev server
(`.claude/launch.json` tiene `weeklymenu-preview` para probar el build de producción),
en móvil y escritorio, más `npm run build` y `npm run lint`.

**M1 y M2 son la excepción, y no es opcional.** Entre los dos reescriben las
comprobaciones de un algoritmo de restricciones de 582 líneas que hoy no tiene
ninguna prueba, y lo hacen a la vez que multiplican los casos posibles (varios
ingredientes por plato × reglas combinables). Verificar eso a ojo generando menús no
es viable.

Tests unitarios sobre `generateWeeklyMenu` antes de tocarlo, aunque sean los primeros
del repo. Como mínimo: que un catálogo válido produzca siete días completos, que cada
regla activada se cumpla, que dos reglas incompatibles den error explícito en vez de
menú degradado, y un caso por trampa conocida (lasaña `{pasta, meat}` frente a una
cena de carne).
