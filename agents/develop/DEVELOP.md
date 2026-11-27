# Develop

Antes de programar, leer AGENTS.md y `agents/testing/DIRECTRICES.md`.

- Implementar únicamente el alcance asignado y respetar contratos compartidos.
- TypeScript estricto; sin `any`, sin `@ts-ignore` y sin secretos en código.
- Componentes accesibles, navegación por teclado, etiquetas de formulario, mensajes de error útiles y diseño móvil.
- Cada acción debe producir un resultado comprobable. No botones decorativos ni éxito simulado para integraciones externas.
- Cálculos monetarios en céntimos; no confiar en precios, roles o identificadores de organización enviados por el navegador.
- Validar entradas y transiciones en servidor y DB; UI solo complementa esos controles.
- No inventar pruebas, resultados, integraciones, credenciales o evidencias de agentes.
- Corregir los fallos devueltos por Testing y explicar las modificaciones, sin relajar sus criterios unilateralmente.
- Mantener dependencias mínimas y versiones fijadas en lockfile.
