# Testing — directrices obligatorias

## Puerta de entrega
Develop debe leer este documento antes de programar. Testing revisa independientemente, comunica fallos reproducibles y repite las comprobaciones afectadas tras cada corrección. No alterar expectativas para ocultar fallos. La entrega distingue controles implementados, controles probados y comprobaciones pendientes.

## Funcionalidad
- El recorrido mínimo debe funcionar: solicitud → presupuesto con líneas de catálogo → aceptación → intervención planificada → parte finalizado.
- Precios calculados en céntimos enteros; cantidades positivas y acotadas. No confiar en totales enviados por cliente.
- Transiciones de estado explícitas; no aceptar, planificar o finalizar registros en estados incompatibles ni duplicar sus efectos.
- Agenda valida fechas y evita asignaciones incompatibles. Mensajes comprensibles de éxito, vacío y error.
- Cada botón visible realiza su función o explica por qué está deshabilitado. No simular éxito remoto.

## Identidad y aislamiento
- Toda lectura y escritura remota exige autenticación comprobada y pertenencia a la organización; no basta con esconder controles.
- RLS activa en cada tabla expuesta con denegación por defecto y `WITH CHECK` apropiado.
- IDs de otra organización, roles falsificados y cambios de organización desde el cliente deben ser rechazados.
- El usuario demo solo maneja datos ficticios. Una demo local se identifica como tal y nunca se presenta como Supabase conectado.
- Claves privilegiadas, tokens de proveedor y secretos nunca viajan al cliente ni al repositorio.

## Superficie HTTP
- Validar estructura, tipos, longitudes y límites de todos los parámetros en servidor.
- Mutaciones con comprobación de origen/CSRF; no realizar cambios por GET.
- Limitar tamaño de cuerpos, frecuencia y tiempos de llamadas externas. Los límites deben funcionar en el modelo de despliegue documentado.
- CSP compatible con producción, protección contra framing, `nosniff`, política de referrer y cookies de sesión protegidas.
- Errores públicos sin stack, SQL, credenciales ni detalles internos. Logs sin datos sensibles.
- Sin HTML arbitrario, SQL interpolado, redirecciones abiertas o URLs de proveedor controladas por usuarios.

## Usabilidad y accesibilidad
- Escritorio y viewport móvil sin desbordamiento horizontal.
- Formularios con etiquetas, navegación por teclado, foco visible, diálogo cerrable y errores accesibles.
- Estados no dependientes únicamente del color. Controles táctiles utilizables y español coherente.

## Entrada y sesión — ajuste de acceso explícito
- Contexto nuevo sin sesión: pantalla «Iniciar sesión», campos vacíos y ningún dashboard, perfil personal o datos de negocio visibles automáticamente.
- Comprobar la sesión antes de decidir la pantalla. Mientras la lectura inicial está pendiente, mostrar carga neutral; no presentar temporalmente demo, dashboard ni formulario de acceso de una cuenta ya autenticada.
- Campos con etiquetas «Correo electrónico» y «Contraseña», tipos email/password y autocomplete username/current-password. Submit accesible por teclado; estado de carga que impida envíos duplicados; errores genéricos visibles con role alert, sin revelar existencia de cuentas ni detalles internos.
- La demo exige una acción secundaria explícita, identificada como demo con datos ficticios. Perfil «Invitado · Demo», sin atribuir el nombre José. Su elección y datos pueden conservarse en la misma pestaña; otra pestaña/contexto limpio empieza en login.
- La selección explícita de demo no autentica ni concede acceso a `/api/workspace`. El login correcto pasa a datos de Supabase y muestra la cuenta real; una sesión válida puede restaurarse tras recarga.
- Al cerrar sesión se eliminan del estado visible datos/perfil de la cuenta, se regresa al login y una recarga sigue mostrando login. No activar la demo implícitamente. No guardar contraseñas, tokens ni datos conectados en sessionStorage/localStorage.
- Si falla la comprobación de sesión o las credenciales, no convertir el fallo en acceso a la demo. Conservar una salida clara para reintentar o elegir explícitamente la demo.
- Verificar escritorio y móvil: login anónimo, carga inicial sin flash, elección de demo, error genérico, login real, restauración de sesión y logout. No debilitar CSRF, cookies, CSP ni autorización para acomodar el nuevo flujo.

## Verificación exigida
- TypeScript estricto, build de producción y auditoría de dependencias.
- Pruebas unitarias de reglas de negocio y entradas adversas.
- Pruebas HTTP de autenticación, CSRF y cuerpos inválidos.
- E2E del recorrido principal en escritorio y móvil.
- Pruebas reales de RLS y sesión cuando haya Supabase disponible; si no, marcar explícitamente pendiente y no afirmar seguridad verificada en producción.
- Revisar cambios de seguridad de dependencias antes de desplegar. La ausencia de hallazgos no garantiza invulnerabilidad.

## Exportación de presupuesto PDF
- «Descargar PDF» debe entregar un archivo PDF real y legible, con MIME/nombre coherentes, en escritorio y móvil; no basta con abrir una vista HTML ni prometer una descarga que no ocurre.
- Incluir identificador y fecha del presupuesto, cliente, solicitud, conceptos, cantidades, precios, base imponible, IVA y total. Usar los importes enteros en céntimos del presupuesto y sus conceptos guardados; no recalcular desde precios actuales del catálogo ni aceptar importes de la URL.
- Identificarlo como «Presupuesto» y aclarar que no es una factura. La exportación de demo lleva una marca explícita de datos ficticios/demo. Un documento conectado refleja exclusivamente los registros autorizados que está viendo esa cuenta.
- Conservar caracteres españoles y símbolo de euro. Textos largos y hasta el máximo de conceptos deben paginarse sin recortes, solapes, totales partidos ni filas ilegibles; cabeceras/pies y numeración coherentes si hay varias páginas.
- Tratar datos como texto: sin interpretar HTML/JavaScript, acciones PDF ejecutables, adjuntos inesperados ni cargas de recursos externos controladas por el contenido. Nombre de descarga seguro y sin rutas controladas por el usuario.
- Si hay endpoint de exportación, comprobar sesión y membresía/RLS para el ID solicitado, no fiarse del workspace o cliente enviados por el navegador; no usar claves privilegiadas en el cliente. No persistir PDF ni datos conectados en almacenamiento público.
- Testing descargará ejemplos demo y conectados, extraerá texto/importes y renderizará páginas para inspección visual. Incluir un caso de textos largos y varios saltos de página sin crear datos de negocio remotos para ello.

## Calendar conectado
- La demo y la descarga ICS deben identificarse como tales. Solo confirmar «añadido/sincronizado» cuando el proveedor externo haya aceptado la operación real; errores de permisos/configuración/proveedor son visibles y no simulan éxito.
- Sesión, organización y rol autorizados, intervención existente con planificación válida y destino de calendario fijado por configuración de servidor. Nunca aceptar un calendarId, credenciales o URL de proveedor arbitrarios del navegador.
- Repetir la sincronización de una intervención no crea eventos duplicados. Una replanificación actualiza el mismo evento o comunica con precisión la limitación. Verificar idempotencia también ante un reintento después de respuesta perdida.
- Sin asistentes, invitaciones, notificaciones ni correos a terceros. Calendar dedicado a los datos ficticios de evaluación; exportar solo el contenido necesario para la intervención.
- Credenciales únicamente en servidor, sin repositorio ni trazas. Timeout, límites de frecuencia y tratamiento seguro de errores del proveedor, sin filtrar tokens ni claves.
- Si hay credenciales y autorización disponibles, Testing contrastará de forma independiente por API externa el evento, horario y ausencia de asistentes/duplicados. No crear cuentas Google ni mutaciones remotas por iniciativa propia; separar explícitamente mocks/unitarias de la verificación real del proveedor.

## Formato de devolución
Cada fallo contiene identificador, severidad, reproducción, resultado esperado, resultado observado y comprobación tras corregir. No inventar hallazgos para aparentar iteraciones.
