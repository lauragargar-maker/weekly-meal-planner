# Migraciones

Se aplican a mano desde el SQL Editor de Supabase, en orden de nombre de archivo.

**El SQL Editor no muestra `RAISE NOTICE`**: sólo enseña resultados de consulta. Una
migración que quiera informar de algo tiene que traer una consulta de verificación
aparte, para ejecutar después. `psql` y la CLI de Supabase sí muestran los avisos.

## Hay dos proyectos, y cada migración va en los dos

¡Ñam! tiene un proyecto de Supabase para **dev** y otro para **producción**, con
`VITE_SUPABASE_URL` distinta. El `.env` del repo apunta a **dev**, así que `npm run dev`
y `npm run preview` escriben ahí.

El orden es siempre: **dev primero, comprobar, y luego producción.**

Es fácil creer que sólo hay un entorno, porque en el repo no se ve más que un `.env`.
No lo hay: las dos URLs están en el gestor de contraseñas y en la configuración del
hosting.

## Los datos de los dos entornos no coinciden

Dev y producción tienen catálogos de platos distintos: platos que existen en uno pueden
no existir en el otro, y los nombres pueden diferir.

Cualquier migración que **parchee datos buscando por nombre** hay que verificarla contra
el entorno donde se vaya a ejecutar, antes de ejecutarla. `20260804000000_dish_main_ingredients.sql`
es el ejemplo: lleva en el encabezado la consulta de comprobación y emite un `NOTICE` con
el número de filas que tocó, para poder contrastarlo con lo esperado.

## El merge es el despliegue

El frontend lo despliega **Vercel automáticamente al mergear la PR a `main`**. No hay
paso manual ni workflow que lo haga: el único de `.github/workflows/` es el cron de
menús semanales, que está pausado.

Consecuencia práctica: **una migración incompatible con el frontend hay que ejecutarla
antes de mergear.** Después ya no hay ventana de control.

## Migración y frontend van juntos

Varias migraciones cambian la forma de una columna que el frontend lee o escribe. En esos
casos no hay orden seguro: desplegar el frontend antes rompe las escrituras, y ejecutar la
migración antes también. Se avisa en el encabezado de la migración cuando toca.
