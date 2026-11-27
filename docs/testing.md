# Verificación independiente

## Estado inicial
Testing leyó AGENTS.md y publicó `agents/testing/DIRECTRICES.md` antes de la implementación. Develop confirmó su lectura y acordó el contrato de dominio antes de las pruebas.

## Ejecuciones realizadas — 27 de noviembre de 2026

- `npm test`: **44 pruebas unitarias aprobadas**. Contratos de entrada, importes, duplicados, transiciones, permisos de técnico, conflicto de agenda, inmutabilidad, CSRF, lectura limitada por bytes y errores sin información sensible.
- `node --env-file=.env.local tests/database/security.mjs`: **16 comprobaciones aprobadas** sobre Supabase local real (Postgres 17, Auth y PostgREST), con usuarios autenticados y dos organizaciones independientes. El script crea y elimina sus propios datos ficticios.
- E2E inicial: cabeceras y acceso sin sesión, navegación de cinco vistas, teclado y reinicio correctos en escritorio y móvil. El flujo completo pasó después de corregir un selector del propio test (`getByRole('combobox')` en lugar de un `getByLabel` exacto que incluía texto de opciones).
- Flujo E2E verificado: solicitud → presupuesto → aceptación → agenda → parte finalizado; exportación ICS, texto con HTML tratado como texto y persistencia de la demo tras recarga. Ejecutado en Chromium escritorio y Pixel 7 emulado.
- Última compilación de producción: **12/12 E2E aprobados en 17,3 segundos**, incluyendo login real de Supabase, cookies HttpOnly/SameSite, sesión conservada al recargar y acceso denegado tras logout. La traza se desactiva en la prueba de login para evitar guardar su contraseña en un artefacto.
- QA visual de las capturas actualizadas en escritorio y móvil: barra lateral corregida, tipografía legible y sin desbordamiento horizontal de página en las cinco vistas. Capturas locales en `.local/overview-*.png`, `.local/reports-*.png` y `.local/completed-*.png`.

## Hallazgos y correcciones

### SEC-01 — Medio — Los intentos fallidos no consumían el límite de mutaciones

Reproducción: invocar una acción inválida por RPC y consultar el contador antes/después. El contador permanecía en 2, aunque debía aumentar a 3. La excepción SQL revertía también el incremento del límite.

Corrección del Orquestador: migración `202611270003_persistent_attempt_limit.sql`, con contador exterior persistente y subtransacción de negocio que revierte las escrituras ante un error. Verificación independiente: el nuevo contador `attempt:` aumenta cuando se rechaza la acción; el intento posterior al umbral es rechazado sin crear datos. **Corregido y verificado.**

### UI-01 — Bajo — Sidebar desbordaba en pantallas de poca altura

Reproducción: captura de la vista de resumen en 1280×720. La ayuda y el pie salían del fondo oscuro de la barra fija.

Corrección de Develop: scroll interno y ocultación del panel decorativo cuando falta altura. Captura del último build revisada: ayuda y pie permanecen dentro de la barra. **Corregido y verificado.**

### Infraestructura local de pruebas

La CLI de Supabase publicaba inicialmente los puertos Docker en todas las interfaces. Se corrigió el entorno de pruebas con `tests/support/loopback-local-stack.mjs`, que preserva volúmenes y configuración y fija explícitamente `127.0.0.1` en API 54321 y Postgres 54322. Ambos bindings se inspeccionaron y los servicios volvieron a estar saludables. Este ajuste es del entorno local, no una configuración del alojamiento final.

## Cobertura de base de datos

Las pruebas llaman directamente a Supabase, además de la interfaz de la aplicación: denegación anónima, usuario sin membresía, aislamiento entre empresas, datos visibles para técnico, prohibición de escrituras directas y escalada de rol, IDs de otra organización, validación SQL independiente, precio del catálogo, aceptación concurrente única, planificación concurrente sin solapes, cierre autorizado, límites de intentos y protección del RPC de login reservado al servicio.

## Límites de las evidencias
Las políticas RLS y sesiones se prueban contra Supabase local. Esto no certifica una futura instancia alojada ni su configuración operativa. El despliegue público, integración real con Google Calendar y medidas del proveedor requieren su propia comprobación. Las pruebas no garantizan ausencia de vulnerabilidades ni sustituyen una auditoría profesional.
