# Publicar en Vercel y Supabase

## Preparación

Crear un proyecto Supabase gratuito dedicado a datos ficticios. Aplicar las migraciones de `supabase/migrations/` en orden mediante CLI vinculada al proyecto o SQL Editor. Desactivar registro público y usuarios anónimos. Activar rotación de refresh tokens, contraseñas robustas y las protecciones disponibles de Auth.

Importar este repositorio en Vercel, preset Next.js, Node.js 24, directorio raíz del proyecto. Usar el plan gratuito únicamente dentro de sus condiciones vigentes. No activar complementos de pago para la prueba.

## Variables de producción

| Variable | Uso |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | URL del proyecto dedicado |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clave publicable/anon, protegida por RLS |
| SUPABASE_SERVICE_ROLE_KEY | Secreto solo servidor para el limitador de login |
| APP_ORIGIN | Origen HTTPS exacto de producción, sin ruta |

Google Calendar es opcional: GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY y CALENDAR_ORGANIZATION_ID. Usar un calendario de pruebas dedicado. No pegar claves en el repositorio, issues, logs o conversaciones.

Para cargar los datos remotos, conservar `.env.local` y las credenciales locales sin cambios. Crear el archivo privado `.local/production.env`, excluido de Git, con las variables del proyecto remoto dedicado y estas dos opciones:

```dotenv
ALLOW_REMOTE_DEMO_SEED=true
DEMO_ACCESS_FILE=.local/production-demo-access.json
```

Desde la raíz del repositorio, en una sesión de terminal sin variables Supabase heredadas de otro entorno, ejecutar:

```powershell
node --env-file=.local/production.env --import tsx scripts/seed-demo.ts
```

No colocar secretos en argumentos de línea de comandos ni imprimir el contenido de los archivos. Node da prioridad a las variables ya presentes en el proceso sobre las del archivo; comprobar el entorno antes de ejecutar el comando.

El seed escribe la contraseña generada y `supabaseUrl` en `.local/production-demo-access.json`, sin mostrarlas en consola. `DEMO_ACCESS_FILE` se resuelve respecto al repositorio, solo permite archivos dentro de `.local` y rechaza escapes y enlaces de directorio/archivo. Si un archivo existente identifica otro proyecto, la operación se detiene. Un archivo antiguo sin `supabaseUrl` tampoco se reutiliza para un proyecto remoto.

El comando local `npm run db:seed` conserva como destino predeterminado `.local/demo-access.json`. Si el usuario ya existe, el seed mantiene su contraseña. Conservar los archivos de acceso de forma privada y no usar un proyecto con información de clientes reales.

## Verificación antes de enviar

1. Build y verificaciones locales/CI correctos; revisar el informe de Testing.
2. Abrir la URL estable de producción en un navegador sin sesión. Debe mostrar el formulario **Iniciar sesión** de PartePro, sin autenticación de Vercel. **Explorar demo** es una elección secundaria explícita. Revisar Settings → Deployment Protection según el enunciado.
3. Probar el recorrido demo y el acceso de evaluación conectado, escritorio y móvil.
4. Comprobar que las APIs de negocio sin sesión devuelven 401, que los POST de otro origen devuelven 403 y que no se cachean respuestas privadas.
5. Repetir las pruebas de separación entre cuentas en un entorno de preproducción equivalente. Nunca ejecutar el limpiador de fixtures contra producción.
6. Verificar CSP, HTTPS, variables y límites. Confirmar que ninguna clave privilegiada aparece en JavaScript cliente.
7. Dar acceso al repositorio si es privado. Entregar únicamente la cuenta de evaluación con datos ficticios.
8. Comprobar que Supabase sigue activo justo antes de enviar y durante el periodo de revisión. El plan gratuito puede pausar proyectos inactivos; revisar condiciones actuales.

## Estado

Publicado y verificado el 27 de noviembre de 2026:

- Producción estable: https://partepro-three.vercel.app
- Vercel: proyecto `partepro`, equipo `nebula-sur`, plan Hobby, Next.js y Node.js 24, funciones en Irlanda (`dub1`). Deployment actual `dpl_8E4JZQJtRFJCSxiBQhaux45TZ9DC`, estado READY y destino production, construido desde `084a9d126b49471f47431657e02a83b7732e5df7`; autenticación de Vercel desactivada para esta app pública.
- Supabase: proyecto nuevo `partepro` (`qfwlreltnodhjxywqana`), plan Free, región `eu-west-1`. Migraciones 001–003 aplicadas; registro y usuarios anónimos desactivados, rotación de refresh tokens, longitud mínima 12 y SSL obligatorio para conexiones externas a Postgres comprobados.
- Credenciales de servidor cargadas en el entorno Production de Vercel; la clave privilegiada se almacena como Secret. No se sobrescribieron las credenciales locales de Supabase.
- HTTP anónimo 200 y contextos nuevos de navegador sin sesión de Vercel. La pantalla inicial de login y su sesión real pasan **21/21 E2E** en producción, en escritorio y móvil. La verificación anterior añadió **5/5 grupos RLS** y un recorrido conectado con cinco mutaciones y lectura independiente persistidos correctamente; backend y base de datos no cambiaron en el ajuste de entrada. Evidencia diferenciada en `docs/testing.md`.

La publicación se realizó por CLI desde el repositorio. Para futuros despliegues, revisar el cambio y ejecutar `npx vercel deploy --prod --scope nebula-sur` desde una sesión autorizada. La integración automática de Git con Vercel no está configurada.

Un intento temporal anterior devolvió READY pero respondió 403 al acceso anónimo. No forma parte de la entrega; se sustituyó por la producción estable verificada de arriba. Google Calendar continúa pendiente de credenciales y prueba real.
