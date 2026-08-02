# Brief para Claude Design — ¡Ñam! preparación de la beta

## Contexto

**¡Ñam!** es una app de planificación de menús semanales para familias. Hasta ahora
la usa una sola familia; queremos abrirla a unas 10-15 familias más.

Vosotros ya hicisteis el rediseño completo, que **está en producción desde el 30 de
julio de 2026**: sistema de tokens (paleta crema/tinta/verde/amarillo/rojo, Baloo 2 +
Nunito Sans), pantallas de acceso, agenda semanal, catálogo de platos ("Nuestros
platos"), pantalla "Familia", edición de platos y animaciones. Todo eso funciona y
**no hay que rediseñarlo**.

Después hemos hecho dos entrevistas de usuario en profundidad y hemos priorizado lo
que falta para abrir la beta. Cuatro cosas necesitan diseño, y son las de este brief.

---



## Antes de nada: qué existe hoy de verdad

En el handoff anterior varias specs daban por existentes cosas que no estaban
construidas, y eso costó trabajo de reconciliación. Para evitarlo:

**Existe y funciona:**

- Login por correo, onboarding de **un solo paso**, agenda semanal, catálogo de
platos con buscador y filtros, pantalla Familia, alta/edición/borrado de platos,
botón y modal de feedback.
- Sistema de tokens y clases: `.btn-primary`, `.btn-secondary`, `.btn-dark`,
`.btn-danger`, `.card`, `.card-hoy`, `.card-edit`, `.chip`, `.chip-on`,
`.input-nam`, `.input-hero`, `.label-nam`, `.help-nam`, `.error-nam`, `.anim-*`.
- Un catálogo inicial de platos españoles que se ofrece al crear el hogar.
- Un checklist de mínimos de catálogo, que ya calcula si hay platos suficientes
para generar una semana.

**No existe, y no hay que darlo por hecho:**

- Roles de administrador y miembro. **Todos los miembros de un hogar son iguales.**
No dibujéis badges ADMIN, avisos de "solo el admin puede…" ni variantes por rol.
- Lista de miembros de la casa. La pantalla Familia no puede mostrar quién está
dentro.
- Selector de "la semana empieza en". **La semana es de lunes a domingo, fija.**
- Navegación inferior. Está reservado un z-index para ella pero nunca se diseñó.

**Ya diseñado por vosotros y pendiente solo de construir** (no hay que rehacerlo):
el bloque "Ajustes de la casa" de `familia.md` §4.

---



## Encargo 1 — Revisitar y rediseñar onboarding completo

Hoy el onboarding es **un único formulario**: pestañas "Crear hogar" / "Unirme a un
hogar", nombre de la casa, código de invitación de la beta, y dos tarjetas para elegir
si se quiere el catálogo sugerido o empezar de cero.

Queremos convertirlo en un flujo por pasos que además configure **las reglas del menú**.

### Los pasos

**Paso 1 — Estructura de las comidas**


| Pregunta               | Opciones                                     | Por defecto |
| ---------------------- | -------------------------------------------- | ----------- |
| En la comida queremos… | Plato único / Primero y segundo / Indistinto | Indistinto  |
| En la cena queremos…   | Un plato / Dos platos                        | Un plato    |


**Paso 2 — Qué come la familia cada semana**


| Pregunta                   | Control                                                | Por defecto |
| -------------------------- | ------------------------------------------------------ | ----------- |
| Pescado al menos…          | Stepper 0-7 días                                       | 2           |
| Legumbre…                  | Stepper 0-7 comidas                                    | 1           |
| Pasta como mucho…          | Stepper 0-7 veces                                      | 2           |
| Verdura en todas las cenas | Sí / No                                                | No          |
| En la cena, nada de…       | Chips múltiples: pasta, arroz, patata, carne, legumbre | pasta       |


> **Dependencia entre pasos**: "Verdura en todas las cenas" **solo aparece si en el
> paso 1 se ha elegido cena de dos platos**. Con un solo plato la pregunta no tiene
> sentido. Es la primera vez que un paso depende de otro, así que el flujo no puede
> ser un formulario plano.

**Paso 3 — Vuestros platos**

Se muestra el catálogo sugerido y el usuario **repasa y descarta** los platos que no quiere. Importante que sea un proceso lo más sencillo posible donde quien quiera pueda entretenerse pero quien no quiera pueda pasar sin más y asumir el por defecto. Interesante considerar filtros (ej poder revisar comidas de proteina, hidratos y verdura con filtros correspondientes)

Va después de las reglas a propósito: así los mínimos que se enseñan ("necesitáis al
menos N platos de X") están calculados con **sus** reglas, no con unas genéricas.

> **El problema que hay que resolver aquí.** Quien elija reglas exigentes (cena de dos
> platos + verdura obligatoria + nada de carne por la noche) llegará a este paso
> necesitando bastantes más platos de los que hay en el catálogo sugerido. Si la única
> salida es añadirlos a mano uno por uno, hemos creado un callejón sin salida.
>
> Necesitamos un estado que diga algo como *"Con estas reglas necesitáis 14 platos de
> verdura para las cenas y tenéis 7"* y ofrezca **dos salidas**: añadir platos, o
> volver al paso 2 a suavizar las reglas. Que se entienda que ninguna de las dos es
> el camino "malo".



### Restricciones

- **El código de invitación de la beta es obligatorio** para crear un hogar y hoy no
aparece en vuestro diseño de onboarding. Hay que decidir en qué paso vive. Sin él,
el flujo no puede crear hogares.
- Se mantienen las dos vías: **crear un hogar** o **unirse a uno existente** con el
código familiar. Quien se une **no pasa por los pasos de reglas ni de platos**: la
casa ya los tiene configurados.
- El código familiar pasa a ser de **6 dígitos**, mostrado como "123 456".
- Nada de "PASO 1 DE 3" si el número de pasos varía según la vía elegida; que el
indicador de progreso sea honesto.

---



## Encargo 2 — Editar tocando el día

En las pruebas, **las dos entrevistadas intentaron pinchar directamente sobre un día** para cambiar el plato. Hoy hay que entrar antes en un modo de edición de toda la semana, que se activa desde un botón de la cabecera en desktop / parte de abajo en móvil.

Queremos que tocar un día sea el camino natural para editarlo, sobre todo en móvil.
El modo de edición de la semana completa puede seguir existiendo si tiene sentido, o
desaparecer si el tap lo hace innecesario — esa decisión es vuestra.

Tened en cuenta que **un día puede tener varios platos** (comida con primero y
segundo, cena con dos platos), así que "tocar el día" tiene que llevar a elegir **qué plato** o platos se cambia.

---



## Encargo 3 — Navegación de tres destinos

La app tiene tres pantallas: **Semana**, **Platos** y **Familia**. Hoy se vuelve a la
semana pulsando el logotipo "¡Ñam!", y en las pruebas nadie lo interpretó como el
botón de vuelta.

Queremos una navegación explícita entre los tres destinos. Vuestro
`design-tokens.md` §6 ya reserva un z-index para una "nav inferior" que ninguna spec
llegó a describir; puede ser esa o una solución mejor.

Restricción: la app se usa **instalada en la pantalla de inicio del móvil**, así que
la navegación tiene que funcionar sin depender del botón atrás del sistema.

---



## Encargo 4 — El botón de feedback en móvil

El botón flotante de feedback **se solapa con el botón de editar el menú** en móvil, y
resulta incómodo. Hay que minimizarlo: un círculo que se expanda, una colocación
vertical, o lo que propongáis.

Tiene que seguir siendo fácil de encontrar: durante la beta el feedback es la
principal fuente de información que tenemos.

---



## Reglas de la casa para este encargo

1. **Contrastad con la lista de "qué existe" de arriba.** Si algo que necesitáis no
  está en ella, decidlo explícitamente en la spec en vez de darlo por hecho.
2. **No inventéis navegación que no tenga destino.** En el rediseño anterior apareció
  un enlace "¿Te han dado un código de casa?" que no podía llevar a ninguna parte.
3. **Móvil primero.** El uso real es en el móvil, muchas veces de pie en la cocina.
4. **Contraste AA de verdad.** En el rediseño anterior dos combinaciones no lo
  cumplían y hubo que corregirlas: texto pequeño en `tinta-300`, y blanco sobre
   `verde-500`. Para texto usad `tinta-500` y `verde-600` como mínimo.
   **Encargo extra, medido y confirmado**: en la pantalla de login, los mensajes de
   error se pintan en `amarillo-500` sobre el fondo `verde-500`, a 14 px. Son
   **1,85:1**, muy lejos del 4,5:1 que exige AA. El texto informativo blanco de esa
   misma pantalla está en ~3,3:1. Sobre `verde-500` no hay ningún color claro que
   llegue a AA, así que no basta con cambiar el tono del texto: hace falta una
   solución de fondo (una píldora clara detrás del error, u otra que propongáis).
   Es la pieza de marca más visible de la app, así que la decisión es vuestra.
5. **Áreas táctiles de 44 px** como mínimo.
6. **Todo el texto en español.**



## Qué esperamos recibir

Specs en el mismo formato que el paquete anterior (una por pantalla, con medidas,
estados, comportamiento responsive y notas de accesibilidad), más las capturas o
mockups correspondientes.