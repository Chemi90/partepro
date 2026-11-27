# Verificación independiente

## Estado inicial
Testing leyó AGENTS.md y publicó `agents/testing/DIRECTRICES.md` antes de la implementación. Develop confirmó su lectura y acordó el contrato de dominio antes de las pruebas.

## Producción verificada — 27 de noviembre de 2026

Origen comprobado: **https://partepro-three.vercel.app**, en el proyecto nuevo de demostración y con autorización explícita. La batería se ejecutó con contextos de navegador nuevos, sin sesiones de Vercel ni cookies previas.

- **16/16 E2E aprobados en 43,6 segundos**, sin omisiones: escritorio Chromium y Pixel 7 emulado; cinco vistas, contraste, teclado, formularios, flujo completo de la demo, descarga ICS y persistencia de pestaña tras recarga.
- Página anónima **200**, conservando el origen y la ruta pública; API de datos anónima **401**, sin exponer el espacio de trabajo. Los POST de otro origen devuelven **403**. HSTS, CSP con nonce renovado y políticas de seguridad verificadas.
- Login real de Supabase correcto con rol **dispatcher**, cookies **Secure, HttpOnly y SameSite=Lax**, sesión conservada al recargar y acceso a datos denegado después del logout.
- **5/5 grupos RLS de solo lectura aprobados** sobre la instancia alojada (6,3 segundos): denegación anónima, identidades y roles declarados, aislamiento entre dos organizaciones en tablas, snapshots sin filas compartidas y técnico limitado a trabajos asignados y sus registros relacionados. La segunda organización contiene filas existentes: la prueba no depende de UUID ajenos inventados.
- Capturas y reporte privados en `.local/production/`, con trazas desactivadas y sin registrar contraseñas ni tokens. Se inspeccionaron las capturas de resumen en escritorio y formulario móvil; presentación y controles completos.

La primera ejecución obtuvo 15/16 por una carrera del propio helper de navegación: tras recargar en móvil comprobaba `isVisible()` antes de finalizar la carga y omitía abrir el menú. La captura mostraba el parte ya finalizado y persistido. Testing corrigió el helper para esperar la interfaz antes de decidir si abrir el menú; la repetición completa produjo el resultado anterior, sin aumentar tiempos ni relajar aserciones. Typecheck y `git diff --check` correctos tras esa corrección.

Durante esta verificación no se crearon, modificaron ni borraron registros de negocio remotos. El recorrido de negocio fue la demo identificada del navegador; la comprobación conectada se limitó a login, lectura, recarga y logout. La persistencia de escrituras remotas exige su propia evidencia y no se deduce de esta batería.

### Comprobación adicional de persistencia remota

Después de esa batería, Orquestador ejecutó un recorrido separado mediante la API Next.js de producción, autenticado como el evaluador dispatcher. Se crearon y persistieron una solicitud ficticia, su presupuesto, aceptación, planificación y parte finalizado: cinco mutaciones autorizadas, sin llamadas administrativas para el recorrido. Una nueva lectura de `/api/workspace` confirmó solicitud y parte en estado `completed`; tras logout, el acceso devolvió 401. Se conserva un único registro explícito de «Verificación de producción · Datos ficticios», con IDs y resultado en `.local/production/connected-flow.json`. No se borraron registros.

Antes de ese recorrido se activó y consultó SSL obligatorio para conexiones externas a Postgres: `currentConfig.database=true` y `appliedSuccessfully=true`. También se inspeccionaron HTML y siete scripts públicos sin encontrar la clave privilegiada ni la contraseña de evaluación. Los tres avisos del asesor de Supabase y sus motivos están documentados en `SECURITY.md`.

## Ejecuciones realizadas — 27 de noviembre de 2026

- `npm test`: **44 pruebas unitarias aprobadas**. Contratos de entrada, importes, duplicados, transiciones, permisos de técnico, conflicto de agenda, inmutabilidad, CSRF, lectura limitada por bytes y errores sin información sensible.
- `node --env-file=.env.local tests/database/security.mjs`: **16 comprobaciones aprobadas** sobre Supabase local real (Postgres 17, Auth y PostgREST), con usuarios autenticados y dos organizaciones independientes. El script crea y elimina sus propios datos ficticios.
- E2E inicial: cabeceras y acceso sin sesión, navegación de cinco vistas, teclado y reinicio correctos en escritorio y móvil. El flujo completo pasó después de corregir un selector del propio test (`getByRole('combobox')` en lugar de un `getByLabel` exacto que incluía texto de opciones).
- Flujo E2E verificado: solicitud → presupuesto → aceptación → agenda → parte finalizado; exportación ICS, texto con HTML tratado como texto y persistencia de la demo tras recarga. Ejecutado en Chromium escritorio y Pixel 7 emulado.
- Primera compilación de producción verificada: **12/12 E2E aprobados en 17,3 segundos**, incluyendo login real de Supabase, cookies HttpOnly/SameSite, sesión conservada al recargar y acceso denegado tras logout. La traza se desactiva en la prueba de login para evitar guardar su contraseña en un artefacto.
- QA visual de las capturas actualizadas en escritorio y móvil: barra lateral corregida, tipografía legible y sin desbordamiento horizontal de página en las cinco vistas. Capturas locales en `.local/overview-*.png`, `.local/reports-*.png` y `.local/completed-*.png`.

## Revisión del rediseño — 27 de noviembre de 2026

Tras aplicar la nueva tipografía local, colores, navegación y formularios, se ejecutó `PLAYWRIGHT_EXTERNAL_SERVER=1 npm run test:e2e` sobre la compilación de producción final: **16/16 pruebas aprobadas en 41,0 segundos**, sin omisiones. Incluye las 12 comprobaciones anteriores y cuatro ejecuciones adicionales de accesibilidad (dos pruebas en escritorio y móvil). `npm run typecheck` también terminó correctamente.

- Contraste de etiquetas y botones del formulario, navegación, contadores, prioridades y estados de las cinco vistas. Cada filtro se comprueba seleccionado y sin seleccionar, también al pasar el cursor. El cálculo usa los colores renderizados y la composición de transparencias, con mínimo 4,5:1 para texto normal y 3:1 para texto grande; espera a que terminen las transiciones.
- Recorrido de Tab con foco visible, controles del menú móvil cerrado fuera del recorrido, siete controles del diálogo alcanzables, fondo inerte y devolución del foco al botón original tras Escape. La comprobación distingue el foco del documento del foco en los controles del propio navegador.
- Botones del pie del formulario completamente dentro del diálogo y del viewport al abrirlo en 1280×720 y Pixel 7. Cuerpo con scroll independiente cuando falta altura.
- Revisión visual de las cinco vistas, formularios de solicitud y presupuesto, y detalle del parte finalizado. Sin desbordamiento horizontal de página ni errores JavaScript durante el recorrido. Capturas renovadas con animaciones desactivadas en `.local/{overview,requests,quotes,calendar,reports,request-form,quote-form,completed}-{desktop,mobile}.png`.

Se corrigieron y volvieron a probar UI-02, UI-03 y UI-04 descritos abajo. La revisión de contraste cubre los elementos indicados; no constituye una certificación completa de accesibilidad. No se repitió la batería de base de datos porque este rediseño no cambió el backend ni sus migraciones; su evidencia anterior permanece separada.

## Verificación independiente en GitHub Actions

La adaptación visual y sus correcciones, commit `55c6a916965090419e583d79ab837885d669419c`, superaron la [ejecución de CI del rediseño](https://github.com/Chemi90/partepro/actions/runs/45977292249): ambos trabajos aprobados, auditoría sin vulnerabilidades notificadas, typecheck, 44 pruebas unitarias, build de producción, 15 E2E aprobados en 40,2 segundos y 16/16 comprobaciones de base de datos sobre una instancia nueva. El E2E de login conectado se omite en CI por falta de credenciales y sí pasó en la suite local de 16/16 descrita arriba.

El commit `3ca806bc488e99278d333bbadf04299bbb81b439` superó la [ejecución de CI](https://github.com/Chemi90/partepro/actions/runs/45973152424) con ambos trabajos correctos:

- [Aplicación](https://github.com/Chemi90/partepro/actions/runs/45973152424/job/140418261641): instalación limpia, auditoría con 0 vulnerabilidades notificadas, typecheck, 44 pruebas unitarias, build de producción y 11 E2E. La prueba de login conectado se omite en ese job porque no dispone de credenciales locales; sí se ejecutó y aprobó en la verificación local descrita arriba.
- [Base de datos](https://github.com/Chemi90/partepro/actions/runs/45973152424/job/140418261018): Supabase efímero inicializado desde cero con las migraciones del repositorio; 16/16 comprobaciones de seguridad aprobadas.

No se necesitaron modificaciones ni excepciones para superar esta ejecución. Estos enlaces verifican el commit indicado, no cambios futuros.

## Hallazgos y correcciones

### SEC-01 — Medio — Los intentos fallidos no consumían el límite de mutaciones

Reproducción: invocar una acción inválida por RPC y consultar el contador antes/después. El contador permanecía en 2, aunque debía aumentar a 3. La excepción SQL revertía también el incremento del límite.

Corrección del Orquestador: migración `202611270003_persistent_attempt_limit.sql`, con contador exterior persistente y subtransacción de negocio que revierte las escrituras ante un error. Verificación independiente: el nuevo contador `attempt:` aumenta cuando se rechaza la acción; el intento posterior al umbral es rechazado sin crear datos. **Corregido y verificado.**

### UI-01 — Bajo — Sidebar desbordaba en pantallas de poca altura

Reproducción: captura de la vista de resumen en 1280×720. La ayuda y el pie salían del fondo oscuro de la barra fija.

Corrección de Develop: scroll interno y ocultación del panel decorativo cuando falta altura. Captura del último build revisada: ayuda y pie permanecen dentro de la barra. **Corregido y verificado.**

### UI-02 — Medio — Pie del formulario recortado en 720 píxeles de altura

Reproducción: abrir «Nueva solicitud» en 1280×720. Los botones inferiores quedaban parcialmente cortados al abrir el diálogo. Develop separó cabecera y pie del cuerpo desplazable y limitó la altura al viewport. La regresión comprueba los límites completos de ambos botones y el flujo de creación sigue pasando en escritorio y móvil. **Corregido y verificado.**

### UI-03 — Bajo — Escape no devolvía el foco al control original

Reproducción: abrir el formulario y cerrarlo con Escape. El foco quedaba en el documento en lugar de regresar a «Nueva solicitud». Develop conserva el elemento que abre el diálogo y restaura el foco si sigue conectado al DOM. La aserción de foco pasa en escritorio y móvil. **Corregido y verificado.**

### UI-04 — Bajo — Contador de filtro ilegible en estados concretos

Reproducción: en Solicitudes, el contador de «Por revisar» mostraba texto blanco sobre fondo blanco cuando estaba inactivo. La primera corrección reveló además contraste 1,14:1 al seleccionar ese filtro y dejar el cursor encima: la regla hover cambiaba el fondo del botón a neutro, conservando blanco en el contador. Develop separó los colores de contadores activos e inactivos y restringió el hover neutro a filtros sin seleccionar. La auditoría ampliada de todos los filtros, estados y contadores pasa en escritorio y móvil con los mínimos indicados. **Corregido y verificado.**

### Infraestructura local de pruebas

La CLI de Supabase publicaba inicialmente los puertos Docker en todas las interfaces. Se corrigió el entorno de pruebas con `tests/support/loopback-local-stack.mjs`, que preserva volúmenes y configuración y fija explícitamente `127.0.0.1` en API 54321 y Postgres 54322. Ambos bindings se inspeccionaron y los servicios volvieron a estar saludables. Este ajuste es del entorno local, no una configuración del alojamiento final.

## Cobertura de base de datos

Las pruebas llaman directamente a Supabase, además de la interfaz de la aplicación: denegación anónima, usuario sin membresía, aislamiento entre empresas, datos visibles para técnico, prohibición de escrituras directas y escalada de rol, IDs de otra organización, validación SQL independiente, precio del catálogo, aceptación concurrente única, planificación concurrente sin solapes, cierre autorizado, límites de intentos y protección del RPC de login reservado al servicio.

## Límites de las evidencias
Las pruebas locales incluyen operaciones de escritura y concurrencia; la verificación alojada descrita arriba cubre acceso público, sesión, lecturas con aislamiento y un recorrido adicional con escrituras persistidas. No certifica cambios posteriores, otros proyectos ni toda la configuración operativa del proveedor. La exportación ICS no equivale a una integración autenticada con Google Calendar. Las pruebas no garantizan ausencia de vulnerabilidades ni sustituyen una auditoría profesional.

## Preparación de la comprobación de producción

Preparación completada y aplicada en la ejecución remota descrita arriba. Antes de disponer de autorización y dominio se repitió la regresión local: **16/16 E2E en 43,0 segundos**, incluido login real local. Typecheck correcto. Se ejecutaron además seis comprobaciones sin red del selector de destino: loopback aceptado; remoto sin confirmación, confirmación distinta, HTTP, servidor externo no declarado y URL con credenciales rechazados.

`tests/support/target.ts` separa los destinos. Para un origen remoto exige HTTPS, `PLAYWRIGHT_EXTERNAL_SERVER=1` y `PLAYWRIGHT_CONFIRMED_DEMO_ORIGIN` exactamente igual a `PLAYWRIGHT_BASE_URL`. El login remoto lee exclusivamente `.local/production-demo-access.json`; nunca recurre al acceso local. El manifiesto debe vincular el origen de la app con una URL canónica HTTPS de `*.supabase.co`, el UUID de organización y una clave pública. Las claves privilegiadas se rechazan. Los roles de las cuentas de evaluación se conservan como `dispatcher`.

El manifiesto privado contiene `email`, `password`, `supabaseUrl`, `origin`, `organizationId`, `expectedRole` y `publishableKey`. Para las lecturas RLS añade `rls.technician` con `email`, `password`, `technicianId`, y `rls.otherOrganization` con `email`, `password`, `organizationId`, `expectedRole`. El técnico debe tener trabajo asignado y la primera organización otro trabajo ajeno; la segunda organización necesita al menos un cliente ficticio. Las identidades y filas se preparan por separado, nunca por el verificador.

Una vez disponibles esas condiciones, con las tres variables de destino establecidas:

```text
npm run test:e2e
node --import tsx tests/production/read-only.ts
```

En remoto, la suite exige acceso anónimo 401 (503 ya no se acepta), página pública 200 sin redirección de autenticación, HSTS, CSP con nonce distinto en peticiones separadas, cookies Secure/HttpOnly/SameSite y el rol esperado al iniciar sesión. Las trazas están desactivadas; las capturas del recorrido quedan en `.local/production/`. El flujo de negocio se ejecuta en la demo del navegador y bloquea cualquier intento de mutar `/api/workspace`.

`tests/production/read-only.ts` comprueba cinco grupos: acceso anónimo a Data API/RPC, identidad y rol de cada fixture, aislamiento por organización en tablas, snapshots sin registros compartidos y lecturas de técnico limitadas a trabajos asignados. Su transporte solo permite GET a tablas y a `get_workspace`, más login/logout de sus propias sesiones; rechaza redirecciones. No acepta servicio privilegiado, no llama RPC de mutación, no crea fixtures ni limpia datos. No debe usarse el limpiador de `tests/database/security.mjs` contra una instancia remota.
