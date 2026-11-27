# Preparación de la entrega

La solicitud solo permite un envío: no enviar el formulario hasta completar la revisión de producción.

- App de producción pública: https://partepro-three.vercel.app — verificada sin sesión de Vercel el 27 de noviembre de 2026.
- Repositorio público: https://github.com/Chemi90/partepro
- Cuenta de prueba: cuenta dispatcher de demostración; las credenciales para copiar al formulario están en `.local/entrega-privada.txt`, excluido de Git. No publicar su contraseña en el README.
- Documentación del equipo: AGENTS.md, agents/develop/DEVELOP.md y agents/testing/DIRECTRICES.md.

## Preguntas del formulario

1. **Integraciones:** describir solo integraciones realmente realizadas y verificadas, especificando el papel propio. PartePro integra Supabase Auth/Postgres; exportación ICS disponible. Calendar solo se presentará como integración verificada después de conectar una cuenta y probarla. Ondia puede aportarse como proyecto adicional con sus integraciones reales, sin atribuirse Holded/A3 si no se han utilizado.
2. **Tiendas:** distinguir haber desarrollado una APK de haber publicado en Google Play. Según la documentación revisada de Ondia, la APK se distribuye directamente y no está publicada en Google Play. Confirmar cualquier otra experiencia antes de responder.
3. **Agentes:** explicar el equipo real de esta prueba, sus archivos, distribución de trabajo y un fallo encontrado/corregido por Testing. Consultar el registro de ejecuciones.
4. **Fuera de alcance:** «Entiendo la necesidad. He revisado lo acordado y esta funcionalidad amplía el alcance. Puedo preparar una propuesta con su impacto en precio y plazo, o valorar contigo qué prioridad sustituir manteniendo el presupuesto. Lo dejamos confirmado antes de desarrollarlo».

## Demostración

Presentar el problema de una empresa pequeña de mantenimiento, recorrer solicitud → presupuesto → agenda → parte y explicar una decisión de seguridad con evidencia. Distinguir demo local, persistencia en Supabase e integración externa. No afirmar que la app es imposible de hackear.
