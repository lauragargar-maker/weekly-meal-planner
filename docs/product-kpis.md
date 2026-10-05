# KPIs de producto de ¡Ñam!

Los seis indicadores que dicen si ¡Ñam! resuelve el problema para el que existe. Están
pensados a partir del objetivo de la app, no de la instrumentación actual: primero se
decide qué hay que medir y después se ve cómo medirlo.

**El problema** (`User Research/`): en las familias con hijos en edad escolar que comen
en casa varias veces por semana, decidir cada día qué se come es una carga mental que
suele caer en una sola persona. Se improvisa, se repiten platos y grupos de alimento,
y cada miembro del hogar compra por su cuenta. **La promesa de ¡Ñam!** es que el hogar
tenga la semana decidida de antemano, con un plan compartido que respeta sus reglas, y
que nadie tenga que pensar "¿qué comemos hoy?".

| # | KPI | Para qué sirve |
|---|---|---|
| 1 | Hogares con la semana resuelta | **North Star**: el valor que entrega la app |
| 2 | Conversión en onboarding | **Adquisición**: quien empieza a configurar ¡Ñam! llega al final |
| 3 | Activación de hogares nuevos | **Activación** |
| 4 | Retención semanal de hogares (S4 y S8) | **Retención** |
| 5 | Mejora percibida en la organización de las comidas | **Resultado**: si el problema se resuelve de verdad |
| 6 | Factor de recomendación entre hogares (K) | **Viralidad** |

---

## Convenciones comunes

Sirven para los seis KPIs, salvo que alguno diga otra cosa.

- **La unidad es el hogar, no la persona.** El problema es de la familia, y el plan
  también. Que dos miembros consulten el menú el mismo día cuenta como un solo día de
  uso. La excepción es la conversión en onboarding (KPI 2), que se mide por persona:
  quien abandona es una persona, porque el hogar todavía no existe.
- **Semana natural de lunes a domingo**, en hora peninsular española (Europe/Madrid).
  Es la misma semana que muestra la app.
- **Sólo producción.** No cuentan los datos del entorno de desarrollo.
- **Fuera los hogares internos y de prueba.** El hogar de la fundadora es una familia
  real, pero conviene dar cada KPI **con y sin** ese hogar mientras haya pocos hogares,
  porque con una base pequeña uno solo puede mover la cifra.
- **"Consultar el menú de una semana"** quiere decir abrir la app y ver el plan de esa
  semana. Generarlo o editarlo también cuenta como consulta. Una consulta cuenta para la
  semana cuyo menú se mira, no para la semana en la que se hace.

---

## 1. Hogares con la semana resuelta (North Star)

**Nombre**
Hogares con la semana resuelta.

**Definición** (provisional, ver "Calibración del umbral")
Número de hogares que tienen menú para una semana natural **y** lo han consultado al
menos **un día**, ya sea durante esa semana o en los tres días previos (de viernes a
domingo).

Con una sola consulta se separa el plan que se usa del que se generó y se olvidó, sin
exigir que el hogar vuelva a la app cada día. Muchas familias obtienen el valor de una
vez: miran el plan el fin de semana, hacen la compra con él y se lo saben, o lo apuntan
en la nevera. Exigir más consultas castigaría justo eso, y premiaría tener que corregir
el plan.

Los días previos cuentan porque planificar la compra con el menú de la semana siguiente
es parte del problema que se resuelve (compras duplicadas, olvidos). Se limitan a tres
para no contar como uso un vistazo hecho con mucha antelación.

**Lectura secundaria**: el número de días distintos con consulta por hogar y semana
(1, 2, 3…). No forma parte del KPI, pero es el dato con el que se calibrará.

**Origen**
- Los menús guardados por hogar y semana (base de datos de producción).
- El registro de días con uso de la app, por hogar y por semana consultada.

**Filtros que aplican**
- Semana natural cerrada (lunes a domingo). La semana en curso se muestra como dato
  provisional.
- Ventana de consulta: del viernes anterior al domingo que cierra la semana.
- Un día se cuenta una vez por hogar, aunque entren varios miembros.
- Se da en valor absoluto. El porcentaje sobre el total de hogares activos se usa como
  lectura secundaria.

**Qué NO incluye**
- Hogares que tienen menú generado pero no lo han consultado en ningún día de la
  ventana.
- Consultas hechas antes del viernes anterior a la semana.
- Consultas a semanas ya cerradas (son de sólo lectura y miran hacia atrás).
- Usuarios que han iniciado sesión pero no pertenecen a ningún hogar.

**Calibración del umbral**
El criterio de "al menos un día" es provisional. No sale de datos, sino de no
dejar fuera a las familias que usan el plan sin abrir la app a diario. Hay que
revisarlo con las primeras 4 a 6 semanas de la beta abierta:

1. Ver cómo se reparten los días con consulta por hogar y semana.
2. Comprobar qué umbral (1, 2, 3… días) predice mejor qué hogares siguen activos en la
   semana 8 (KPI 4). Ese umbral es el que separa a los hogares que obtienen valor de los
   que no, y es el que debe quedarse.
3. Revisar también la ventana de tres días previos con el mismo dato.

Cualquier cambio en esta definición arrastra a los KPIs 4 y 6, que se apoyan en ella.

---

## 2. Conversión en onboarding

**Nombre**
Conversión en onboarding.

**Definición**
Porcentaje de personas que empiezan el onboarding y lo terminan.

- **Empieza** quien, tras iniciar sesión por primera vez sin pertenecer a ningún hogar,
  llega a la pantalla de elegir entre crear un hogar o unirse a uno.
- **Termina** quien acaba perteneciendo a un hogar y llega a ver su primera semana:
  - por el camino de **crear**: nombre y código de invitación, los dos pasos de reglas y
    el paso de platos;
  - por el camino de **unirse**: el código familiar.

Es la puerta de entrada al valor. Configurar la casa es lo que hace que el menú le sirva
a esa familia y no a otra, pero cada pregunta del onboarding también es un sitio donde
abandonar. Si este KPI cae, no habrá hogares que activar.

**Lectura secundaria**
- La conversión por separado de cada camino, crear y unirse. Tienen longitudes muy
  distintas y mezclarlos esconde dónde está el problema: una conversión alta al unirse
  puede tapar una baja al crear.
- El abandono en cada paso del camino de crear, para saber cuál pierde más gente.

**Origen**
- El registro de personas que inician sesión sin hogar y de la pantalla del onboarding
  a la que llegan.
- La pertenencia a hogares (base de datos de producción), para saber quién terminó.

**Filtros que aplican**
- **Por persona**, no por hogar. Es la excepción a las convenciones comunes: mientras
  dura el onboarding el hogar no existe, porque no se crea hasta el último paso.
- Cohorte por fecha de inicio del onboarding.
- Ventana de 7 días desde el inicio para darlo por terminado. Quien abandona y vuelve
  días después tiene que empezar de nuevo, porque el onboarding no guarda lo que llevaba,
  pero si termina dentro de la ventana cuenta como conversión.
- Cada persona cuenta una sola vez, la primera vez que empieza, aunque lo empiece
  varias veces.

**Qué NO incluye**
- El inicio de sesión: pedir el código de acceso por correo y escribirlo. Va antes del
  onboarding y se mide aparte.
- Personas que ya pertenecen a un hogar, incluidas las que vuelven a iniciar sesión en
  otro dispositivo.
- Lo que pasa después del onboarding: si el hogar vuelve a mirar el menú es activación
  (KPI 3).
- **Sí incluye**, como no conversiones, a quienes no pasan del código de invitación de
  la beta. Es un bloqueo y no un abandono, pero quitarlo escondería un motivo real por el
  que la gente no entra. El desglose por paso los separa del resto.

---

## 3. Activación de hogares nuevos

**Nombre**
Tasa de activación de hogares nuevos.

**Definición** (provisional, ver "Calibración del umbral")
Porcentaje de hogares creados en un periodo que, **en los 7 días siguientes a su
creación**, vuelven a consultar su menú al menos **2 días distintos del día de alta**.

Es el momento en que la app empieza a sustituir a la pregunta "¿qué comemos hoy?": el
hogar no sólo monta el plan, sino que vuelve a él para saber qué toca. El día de alta no
cuenta porque ese día todo el mundo mira el menú: lo acaba de crear.

**Origen**
- La fecha de creación de cada hogar (base de datos de producción).
- El registro de días con uso de la app, por hogar.

**Filtros que aplican**
- Cohorte por fecha de creación del hogar.
- Sólo se calcula para hogares con los 7 días ya cumplidos. Los más recientes se quedan
  fuera hasta entonces.
- Denominador: hogares creados en el periodo, no personas registradas.

**Qué NO incluye**
- Personas que se unen a un hogar que ya existía con el código familiar. No es un hogar
  nuevo, sino la adopción dentro de un hogar (ver KPI 6).
- Personas que empiezan el onboarding y no lo terminan: no llegan a tener hogar. Eso es
  la conversión en onboarding (KPI 2).
- El uso del día de alta.

**Calibración del umbral**
Tanto los 2 días de vuelta como la ventana de 7 días son provisionales: no salen de
datos. Se exigen más consultas que en el KPI 1 a propósito, porque aquí no se mide si
una semana tiene valor, sino si se está formando el hábito, y eso necesita más de una
vuelta. Pero el número exacto hay que fijarlo con las primeras cohortes de la beta
abierta:

1. Ver cuántos días vuelve cada hogar nuevo en su primera semana (0, 1, 2, 3…).
2. Comprobar qué combinación de días de vuelta y ventana predice mejor qué hogares
   siguen activos en las semanas 4 y 8 (KPI 4). Es el momento en que el hogar
   "engancha", y el umbral que debe quedarse.
3. Si el resultado es 1 día, la activación queda igual de exigente que la North Star y
   conviene replantear si sigue aportando una lectura distinta.

---

## 4. Retención semanal de hogares (S4 y S8)

**Nombre**
Retención semanal de hogares en la semana 4 y en la semana 8.

**Definición**
De los hogares creados en una misma semana, porcentaje que en la semana N después del
alta cumple el criterio del KPI 1: semana resuelta, con el menú consultado según la
definición vigente de ese KPI.

- **S4** es la lectura temprana: si el hábito no se ha formado en un mes, difícilmente
  se formará.
- **S8** es la lectura de decisión: es el plazo acordado para el criterio de
  continuar o parar la beta.

Se usa el mismo criterio que en el KPI 1 para que retener signifique seguir recibiendo
el valor, no sólo abrir la app de vez en cuando.

**Origen**
- La fecha de creación de cada hogar.
- El cálculo semanal del KPI 1 por hogar.

**Filtros que aplican**
- Cohortes semanales por semana de alta. La semana 0 es la semana de alta.
- Sólo cohortes que ya han cumplido la semana N.
- Se marcan las semanas atípicas (agosto, Navidad, Semana Santa). No se excluyen, pero
  se anotan: en verano se cocina menos en casa y la retención caerá sin que el producto
  tenga la culpa.

**Qué NO incluye**
- Retención por persona. Si un miembro deja de entrar pero otro mantiene el plan, el
  hogar sigue retenido.
- Retención "rodante" (haber vuelto en cualquier momento después de la semana N). Se
  mide la semana N exacta.
- Cohortes con menos de 5 hogares. Se muestran, pero no se sacan conclusiones de ellas.

---

## 5. Mejora percibida en la organización de las comidas

**Nombre**
Mejora percibida en la organización de las comidas.

**Definición**
Diferencia entre la nota (1 a 10) que un hogar da a "¿Qué tal os funciona ahora mismo la
organización de las comidas?" **antes de usar ¡Ñam!** y la que da **tras 4 semanas** de
uso. El KPI es la mediana de esa diferencia, y como lectura secundaria el porcentaje de
hogares que mejoran al menos 2 puntos.

Los demás KPIs dicen si la app se usa. Éste dice si el uso sirve para lo que tiene que
servir: quitar la carga de decidir. Usa la misma pregunta que las entrevistas de
descubrimiento, así que se puede comparar directamente con ellas.

**Origen**
- Encuesta de una pregunta dentro de la app: una vez en el alta (línea base) y otra a
  las 4 semanas. Después, cada trimestre.
- **Hoy no existe.** Hay que construirla.

**Filtros que aplican**
- Sólo hogares con las dos respuestas (alta y semana 4).
- Una respuesta por hogar y momento. Si responden varios miembros, se toma la de la
  persona que creó el hogar, que es la que más probablemente cargaba con la decisión.

**Qué NO incluye**
- NPS o "¿nos recomendarías?". Mide intención de recomendar, que es otra cosa y ya la
  cubre el KPI 6 con comportamiento real.
- Comentarios libres del botón de feedback. Explican el porqué, pero no son una nota
  comparable.
- Hogares que abandonan antes de la semana 4. Esto introduce un sesgo a favor
  (sólo responden los que se quedan), por eso este KPI se lee siempre junto al KPI 4.

---

## 6. Factor de recomendación entre hogares (K)

**Nombre**
Factor de recomendación entre hogares (K).

**Definición**
Hogares nuevos **activados** (KPI 3) que llegan por recomendación de un hogar existente
en un mes, divididos entre los hogares con la semana resuelta (KPI 1) al inicio de ese
mes.

Un K de 0,2 significa que cada cinco hogares que usan ¡Ñam! traen uno nuevo al mes. Es
la señal de que la app resuelve un problema tan común que las familias lo comentan entre
ellas, en el colegio o en el grupo de padres.

**Origen**
- **Hoy no existe.** El código de invitación de la beta es el mismo para todos, así que
  no se sabe qué hogar trajo a cuál. Hay dos opciones para obtenerlo:
  - Un código de invitación propio de cada hogar.
  - Una pregunta en el alta: "¿Quién te habló de ¡Ñam!?".
  La primera mide mejor; la segunda es más barata y basta para la beta.
- La activación del KPI 3.

**Filtros que aplican**
- Periodo mensual.
- En el numerador sólo cuentan los hogares nuevos activados, no los registros. Una
  recomendación que no llega a usar la app no es crecimiento.

**Qué NO incluye**
- Miembros que se unen a un hogar existente con el código familiar. Es adopción dentro
  del hogar, no crecimiento de hogares. Merece seguirse aparte, porque el reparto de la
  carga mental es parte del problema.
- Hogares captados directamente por el equipo: entrevistas, contactos personales,
  publicaciones propias. **Durante la beta cerrada casi todos los hogares llegan así**,
  de modo que K saldrá cercano a cero por construcción. Hay que empezar a leerlo cuando
  la beta se abra.
- Invitaciones enviadas que no acaban en alta.
