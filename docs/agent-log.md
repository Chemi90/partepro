# Registro de trabajo real

## Inicio
Orquestador: revisado directorio vacío y requisito de tres agentes. Elegido Next.js + TypeScript + Supabase. Se establece demo aislada, controles en servidor y RLS. Los resultados se añadirán conforme se ejecuten; no constituyen una auditoría de seguridad profesional.

## Delegación ejecutada

- Orquestador creó los subagentes `develop` y `testing` en esta sesión, con instrucciones y propiedad de archivos diferenciadas.
- Testing publicó DIRECTRICES antes de la implementación y comunicó los criterios a Develop.
- Develop propuso un contrato Workspace y acciones estrictas; Orquestador lo aceptó e implementó las rutas y tablas relacionales.
- Testing señaló que una alternativa de snapshot JSONB necesitaría validar también las llamadas directas a Supabase. Se implementaron tablas normalizadas, RLS y RPC con reglas en SQL.

## Ciclo de revisión real

1. Develop entregó dominio, demo y cinco vistas.
2. Testing ejecutó 44 pruebas unitarias y pruebas directas sobre Supabase local con dos organizaciones y roles diferentes.
3. Testing reprodujo SEC-01: un rechazo SQL revertía el contador de intentos. Orquestador añadió la migración 003 con contador exterior y subtransacción de negocio; Testing comprobó que el intento fallido ahora cuenta.
4. Testing observó UI-01 en una captura de 1280×720: el contenido de la barra lateral rebasaba su altura. Develop corrigió scroll/visibilidad de contenido decorativo.
5. Orquestador compiló producción, revisó capturas de escritorio/móvil y preparó CI con comprobaciones independientes de aplicación y base de datos.
6. La auditoría de dependencias no informó vulnerabilidades en la ejecución local. El informe detallado y estado de las pruebas E2E están en docs/testing.md.

## Decisiones de entrega

Sin prometer seguridad absoluta. Demo local identificada; persistencia real verificada por separado. Exportación ICS funcional; Calendar requiere credenciales y comprobación externa. Ningún resultado externo se declara realizado sin confirmación del proveedor.

## Adaptación visual solicitada

El usuario pidió tomar como referencia la web de Speed Paradigm y revisar en segundo plano. Orquestador inspeccionó su HTML/CSS público y extrajo los colores, las familias tipográficas y el tratamiento de titulares y controles. Develop adaptó las cinco vistas a ese sistema visual y sirvió las fuentes localmente con sus licencias. Las decisiones están en `docs/design.md`.

Testing amplió la revisión de interfaz con contraste de controles, navegación por Tab y comportamiento del foco en diálogos. Orquestador revisó las capturas de la aplicación y señaló el recorte de las acciones del formulario en una pantalla de 720 píxeles de altura para su corrección. Los resultados y la repetición de las comprobaciones se registran en `docs/testing.md`.

Develop corrigió el pie recortado (UI-02), la restauración del foco al cerrar diálogos (UI-03) y el contraste del contador de pestañas, también al pasar el cursor (UI-04). Testing comprobó las correcciones y los estados de las cinco vistas: la suite final de escritorio/móvil pasó 16/16 en 41 segundos, incluido el acceso real a Supabase local. Orquestador compiló producción y actualizó la captura del README. La publicación permanente continúa pendiente de conectar Supabase alojado y Vercel; la vista temporal que respondió 403 no se utiliza como entrega.

## Preparación de cuentas alojadas

El usuario confirmó que dispone de cuentas de Vercel y Supabase. Orquestador comprobó que las CLI aún no estaban autenticadas e inició sus accesos oficiales, pendientes de la intervención del usuario. Develop separó el archivo de credenciales del seed remoto y añadió validación de destino para conservar el entorno local. Testing preparó comprobaciones remotas sin escrituras de negocio, vinculadas a un origen HTTPS explícito y a un manifiesto privado independiente. La regresión local pasó 16/16 en 43 segundos; las pruebas de producción siguen pendientes y no se han creado recursos alojados durante esta preparación.

## Publicación y revisión de producción

Tras completar el usuario las autorizaciones oficiales, Orquestador creó un proyecto separado en Supabase Free y PartePro en Vercel Hobby, aplicó las tres migraciones, configuró Auth y los secretos de servidor y publicó `https://partepro-three.vercel.app`. Los proyectos Supabase que ya tenía el usuario no se modificaron.

Testing verificó la URL en contextos limpios de escritorio y móvil: 16/16 E2E y cinco grupos de aislamiento RLS aprobados. Corrigió una carrera del helper de navegación del test móvil tras una recarga, manteniendo los criterios y tiempos de espera. Orquestador activó SSL obligatorio en Postgres y comprobó además cinco mutaciones conectadas —solicitud, presupuesto, aceptación, planificación y cierre— con una lectura posterior que confirmó persistencia y logout con 401. Se documentaron los avisos del asesor de Supabase y se preparó un archivo privado de entrega; no se envió el formulario de candidatura.

## Acceso con cuenta visible desde la entrada

El usuario señaló que el perfil ficticio «José · Coordinación» parecía una sesión personal ya iniciada. Orquestador encargó a Testing criterios previos de acceso y a Develop una pantalla de inicio de sesión explícita. Develop añadió el formulario inicial, carga neutral durante la comprobación de sesión, demo secundaria identificada como «Invitado · Demo» y retorno al acceso al cerrar sesión, conservando Supabase Auth y las protecciones existentes.

Testing amplió la cobertura a entrada, error genérico, carga sin mostrar datos, demo explícita, restauración de sesión y logout en escritorio y móvil. La primera ejecución detectó selectores ambiguos en las pruebas por una alerta vacía de Next.js y el perfil oculto en móvil; se corrigieron los selectores sin cambiar los criterios. Orquestador revisó el código, compiló producción y examinó las capturas de ambas pantallas de acceso. Los resultados de esta ronda están en `docs/testing.md`.

La suite local pasó 21/21 en 40,2 segundos. Orquestador publicó el commit `084a9d1` en la misma dirección de producción y Testing repitió la batería alojada: 21/21 en 53,9 segundos, sin omisiones ni reintentos, con login real y logout en ambos tamaños de pantalla. GitHub Actions aprobó aplicación y base de datos. La revisión del HTML público y siete archivos JavaScript no encontró la clave privilegiada ni la contraseña de evaluación; los avisos del asesor alojado permanecen documentados en SECURITY.md. No se modificaron datos de negocio remotos en esta ronda.

## Credenciales de evaluación solicitadas

El usuario pidió una contraseña fácil de recordar. Orquestador comprobó que la cuenta de evaluación ya existía, pertenecía a la organización ficticia prevista y tenía rol dispatcher; actualizó únicamente su contraseña, conservando el mínimo de 12 caracteres de Auth y los datos y permisos. El manifiesto y el archivo de entrega privados quedaron actualizados. Testing verificó un único login nuevo, lectura autenticada, logout y rechazo 401 posterior, sin modificar datos de negocio. Las credenciales no forman parte del repositorio.

## Presupuestos PDF e integración de calendario

El usuario autorizó preparar las mejoras y la entrega. Testing amplió DIRECTRICES antes de la implementación. Develop añadió PDF A4 con fuentes locales, paginación y descarga accesible; el servidor utiliza la sesión del usuario, RLS y datos persistidos. Orquestador añadió la migración 004 con cuota de 20 descargas por minuto y la aplicó localmente y al proyecto remoto dedicado tras superar las pruebas de base de datos.

Orquestador detectó SEC-02: la primera ruta PDF solo comprobaba el error RPC y no su resultado booleano. Develop corrigió el rechazo 429 cuando la cuota devuelve false y Testing lo verificó. También detectó UI-05: el nombre fijo del lateral no coincidía con el emisor del PDF. Orquestador expuso el nombre de la organización mediante RLS y Develop lo incorporó al lateral; Testing verificó su coincidencia en ambos tamaños de pantalla.

Resultados locales de esta ronda: 59 pruebas unitarias, 18 comprobaciones de seguridad en Supabase, build y auditoría de dependencias sin vulnerabilidades. Testing aprobó 21/21 E2E en 48 segundos y revisó los PDF descargados en escritorio y móvil, tanto demo como conectado; además inspeccionó diez páginas sintéticas de documentos largos. Nueve pruebas de Calendar usan respuestas simuladas y no sustituyen la verificación del proveedor real.

Tras autorizar el usuario Google Cloud, Orquestador creó un proyecto sin facturación y una cuenta técnica sin roles IAM de proyecto. A petición expresa del usuario, creó «PartePro · Demo» en Google Calendar y compartió únicamente ese calendario ficticio con permiso de edición. La lectura independiente con la cuenta técnica confirmó calendario, zona Europe/Madrid, rol writer y cero eventos iniciales. El recorrido real desde la app se verificará tras publicar las variables de servidor; sus resultados se registrarán por separado.
