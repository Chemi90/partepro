# Seguridad de PartePro

No existe una garantía de invulnerabilidad. Este repositorio incluye controles preventivos y pruebas; no es una certificación ni sustituye una auditoría independiente antes de tratar información real.

## Límites de confianza

- El navegador es no confiable: IDs, precios, roles, importes y estados se verifican en servidor y Postgres.
- El modo demo usa datos ficticios en `sessionStorage`; no puede escribir en una empresa remota. Cada pestaña mantiene su estado.
- El modo conectado usa Supabase Auth. `getUser()` verifica la sesión en el servicio de identidad, y cada endpoint consulta la pertenencia vigente.
- Un usuario pertenece a una empresa. Los roles owner y dispatcher gestionan su empresa; technician solo ve datos relacionados con sus trabajos y puede cerrar sus partes asignados.
- Se desactiva registro público y acceso anónimo en la configuración local y en el proyecto remoto dedicado de la demo.

## Controles implementados

1. RLS en todas las tablas públicas, SELECT filtrado por empresa/asignación y ninguna escritura directa para anon/authenticated.
2. RPC de negocio con identidad derivada de Auth, permisos, lista de campos admitidos, límites de texto/listas/números, relaciones de la misma empresa y estados válidos.
3. Transacciones con bloqueo por empresa: aceptación única y prevención de solapes concurrentes. Precios de catálogo en céntimos y redondeo explícito del 21% para presupuestos de demostración.
4. Cookies HttpOnly, SameSite=Lax y Secure en HTTPS; sesión solo por servidor. No tokens en localStorage/sessionStorage: las credenciales de sesión viajan en cookies protegidas. Respuestas privadas sin caché.
5. Comprobación de Origin exacto y Fetch Metadata en mutaciones. APP_ORIGIN obligatorio en producción. Sin CORS abierto.
6. Cuerpos JSON máximos de 16 KiB, incluyendo cuerpos sin Content-Length. Zod estricto y validación independiente en SQL.
7. Limitación persistente en Postgres: intentos de mutación 60/minuto por usuario; login 8/15 minutos por identificador y 30/15 minutos por IP/bucket; Calendar 10/minuto. Los rechazos de negocio conservan el contador.
8. En Vercel solo se confía en su cabecera de IP. En otro host se utiliza un bucket compartido conservador hasta configurar un proxy confiable. Los buckets de login usan HMAC; no se almacena el correo ni la IP sin procesar.
9. CSP por petición con nonce para scripts y sin unsafe-eval en producción; frame-ancestors/object-src/base-uri bloqueados. Estilos inline permitidos para presentación React; no se permite HTML arbitrario.
10. HSTS en producción, nosniff, Referrer-Policy no-referrer, aislamiento de ventana y permisos de cámara/micrófono/geolocalización desactivados.
11. Errores públicos genéricos sin SQL, trazas ni secretos. Logs sin cuerpos de peticiones o credenciales.
12. Google Calendar usa destinos fijos HTTPS, timeouts y rechaza redirecciones. Calendario dedicado vinculado a una sola organización. ID determinista para no duplicar citas. No envía invitaciones.

## Secretos y operación

- `.env.local`, `.local/`, tokens, credenciales, trazas y artefactos de pruebas están excluidos de Git.
- La clave privilegiada de Supabase solo se usa en el módulo de limitación de login y en scripts administrativos. Los endpoints de negocio usan la sesión del usuario y RLS.
- No se implementan cargas de archivos en esta versión. No hay almacenamiento público de fotos ni una falsa promesa de análisis de archivos.
- Usar cuentas de infraestructura con MFA y credenciales de demostración exclusivas. No publicar el usuario administrador del proveedor.
- El repositorio debe pasar typecheck, tests, E2E, build y auditoría antes de desplegar. Actualizar dependencias y revisar alertas de seguridad periódicamente.
- Configurar límites y protección contra abuso del proveedor; los límites de aplicación no sustituyen mitigación de DDoS. Verificar copias/exportaciones y recuperación antes de almacenar datos reales.
- La demo remota debe ser una instancia separada, sin información de clientes reales. Los datos de ejemplo son ficticios.

## Reportar un fallo

No publicar secretos, datos personales ni instrucciones con credenciales en issues públicos. Contactar privadamente con el propietario del repositorio y describir el caso mínimo reproducible. Rotar cualquier secreto expuesto y revocar sesiones afectadas.

## Evidencia y límites de verificación

Consultar `docs/testing.md` para ejecuciones y resultados observados. Probar localmente no acredita automáticamente la configuración de producción. La publicación exige comprobar las mismas rutas sin sesión, RLS, variables, HTTPS y acceso público en el destino real.

## Estado del alojamiento verificado

El 27 de noviembre de 2026 se comprobaron acceso anónimo, cookies de sesión, cabeceras, CSRF y aislamiento RLS en la producción indicada en `docs/deployment.md`. Se activó y confirmó SSL obligatorio para conexiones externas a Postgres. El HTML y los siete scripts referenciados por la página pública no contenían la clave privilegiada de Supabase ni la contraseña de evaluación.

El asesor de Supabase mantiene dos avisos por funciones `SECURITY DEFINER` ejecutables por usuarios autenticados: `apply_workspace_action` y `consume_calendar_rate_limit`. El privilegio es intencional para escrituras transaccionales y contadores privados; ambas fijan `search_path=''`, derivan identidad y empresa de Auth y comprueban permisos. Las reglas de negocio se verifican también en la implementación privada del RPC. No se elimina el aviso debilitando esas validaciones ni concediendo escritura directa sobre las tablas.

La protección de contraseñas filtradas de Supabase permanece desactivada: requiere [Pro o superior](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), mientras esta entrega usa Free. Todas las cuentas respetan el mínimo de 12 caracteres y no hay registro público. Las identidades técnicas de prueba usan contraseñas aleatorias; la cuenta de evaluación tiene una contraseña memorable solicitada para la entrega y acceso únicamente a datos ficticios. Las credenciales no se publican en el repositorio. Este límite se documenta; no se presenta el asesor como libre de avisos.
