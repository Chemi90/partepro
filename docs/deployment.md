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

Para cargar los datos remotos, preparar temporalmente `.env.local` con el proyecto de demostración y `ALLOW_REMOTE_DEMO_SEED=true`, ejecutar `npm run db:seed` y conservar las credenciales generadas de forma privada. No usar un proyecto con información de clientes reales.

## Verificación antes de enviar

1. Build y verificaciones locales/CI correctos; revisar el informe de Testing.
2. Abrir la URL estable de producción en un navegador sin sesión. Debe mostrar PartePro, sin autenticación de Vercel. Revisar Settings → Deployment Protection según el enunciado.
3. Probar el recorrido demo y el acceso de evaluación conectado, escritorio y móvil.
4. Comprobar que las APIs de negocio sin sesión devuelven 401, que los POST de otro origen devuelven 403 y que no se cachean respuestas privadas.
5. Repetir las pruebas de separación entre cuentas en un entorno de preproducción equivalente. Nunca ejecutar el limpiador de fixtures contra producción.
6. Verificar CSP, HTTPS, variables y límites. Confirmar que ninguna clave privilegiada aparece en JavaScript cliente.
7. Dar acceso al repositorio si es privado. Entregar únicamente la cuenta de evaluación con datos ficticios.
8. Comprobar que Supabase sigue activo justo antes de enviar y durante el periodo de revisión. El plan gratuito puede pausar proyectos inactivos; revisar condiciones actuales.

## Estado

Las URLs y el estado real del despliegue se registrarán cuando el proveedor confirme la publicación. La existencia de estas instrucciones no significa que el despliegue remoto se haya realizado.

El 27 de noviembre se probó un despliegue temporal de Vercel desde una copia del repositorio sin archivos de entorno. El proveedor devolvió READY, pero la comprobación HTTP anónima y un navegador aislado recibieron 403. Por tanto, esa vista temporal **no se considera una entrega pública válida**. La publicación permanente y Supabase alojado siguen pendientes de conectar las cuentas de los proveedores.
