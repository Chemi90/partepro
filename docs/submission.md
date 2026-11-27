# Preparación de la entrega

La solicitud solo permite un envío: no enviar el formulario hasta completar la revisión de producción.

- App de producción pública: https://partepro-three.vercel.app — verificada sin sesión de Vercel el 27 de noviembre de 2026.
- Repositorio público: https://github.com/Chemi90/partepro
- Cuenta de prueba: cuenta dispatcher de evaluación; las credenciales para copiar al formulario están en `.local/entrega-privada.txt`, excluido de Git. Introducir correo y contraseña en **Iniciar sesión** al abrir la app. No publicar su contraseña en el README.
- Documentación del equipo: AGENTS.md, agents/develop/DEVELOP.md y agents/testing/DIRECTRICES.md.
- Respuestas redactadas para copiar: `.local/respuestas-entrega.txt`, archivo privado excluido de Git. El candidato confirmó que AppGym es una aplicación web en producción, Ondia es un proyecto reciente y no ha publicado en App Store ni Google Play.

## Preguntas del formulario

1. **Integraciones:** las respuestas preparadas mencionan pagos Stripe con webhooks y reembolsos en AppGym, autenticación con Google y servicios de IA; se revisaron su código y la evidencia saneada de pagos de septiembre de 2026. PartePro integra Supabase Auth/Postgres y exportación ICS. Calendar solo se presentará como integración verificada después de conectar una cuenta y probarla. No atribuir Holded/A3 ni WhatsApp Business sin experiencia confirmada.
2. **Tiendas:** el candidato confirmó que todavía no ha publicado en App Store ni Google Play. Presentar AppGym como aplicación web en producción y Ondia como proyecto reciente. Una APK distribuida directamente no equivale a publicación en tienda.
3. **Agentes:** explicar el equipo real de esta prueba, sus archivos, distribución de trabajo y un fallo encontrado/corregido por Testing. Consultar el registro de ejecuciones.
4. **Fuera de alcance:** «Entiendo la necesidad. He revisado lo acordado y esta funcionalidad amplía el alcance. Puedo preparar una propuesta con su impacto en precio y plazo, o valorar contigo qué prioridad sustituir manteniendo el presupuesto. Lo dejamos confirmado antes de desarrollarlo».

## Demostración

Iniciar sesión con la cuenta de evaluación. Presentar el problema de una empresa pequeña de mantenimiento, recorrer solicitud → presupuesto → agenda → parte y explicar una decisión de seguridad con evidencia. La opción secundaria **Explorar demo** permite recorrer datos ficticios locales sin autenticarse; no demuestra persistencia en Supabase. Distinguir ambos modos y la integración externa. No afirmar que la app es imposible de hackear.

El [recorrido de dos minutos](evaluation-guide.md) incluye datos concretos para reproducir un presupuesto, descargarlo y comprobar persistencia. No se ha enviado el formulario.
