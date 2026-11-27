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

## Formato de devolución
Cada fallo contiene identificador, severidad, reproducción, resultado esperado, resultado observado y comprobación tras corregir. No inventar hallazgos para aparentar iteraciones.
