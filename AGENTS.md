# PartePro — Orquestador

## Objetivo
Entregar una aplicación Next.js para solicitudes, presupuestos, agenda y partes de mantenimiento, con Supabase y despliegue público. Idioma: español. No prometer seguridad absoluta.

## Equipo y procedimiento obligatorio
1. Orquestador: concreta alcance y amenazas, reparte tareas, integra y prepara entrega.
2. Testing: mantiene `agents/testing/DIRECTRICES.md`, define criterios antes de implementar y revisa de forma independiente.
3. Develop: lee y cumple `agents/develop/DEVELOP.md` y las DIRECTRICES de Testing antes de programar.
4. Testing devuelve fallos con severidad, reproducción, comportamiento esperado y observado.
5. Develop corrige; Testing repite las comprobaciones afectadas. No debilitar pruebas para aprobar.
6. Orquestador solo marca terminado lo verificado. Registrar ejecuciones reales en `docs/agent-log.md`; distinguir pruebas ejecutadas de pendientes.

Se autoriza delegar exclusivamente en los roles Develop y Testing. El repositorio compartido requiere respetar los límites de archivos de cada tarea.

## Contrato técnico
Next.js App Router y TypeScript estricto. Datos de negocio persistidos en Supabase/Postgres con RLS. Ninguna clave privilegiada en cliente. Modo demo local claramente identificado, aislado y con datos ficticios; no presentarlo como persistencia remota.

## Seguridad
Denegación por defecto, autorización en cada endpoint y en la base de datos, validación estricta, protección CSRF, límites de tamaño y frecuencia, transacciones para cambios de estado, importes enteros en céntimos, cabeceras de seguridad y CSP. No registrar secretos ni credenciales. No usar HTML sin sanear ni SQL construido mediante interpolación. Ninguna cuenta de demostración podrá acceder a datos reales.

## Validación
Typecheck, pruebas de dominio y seguridad, pruebas E2E de escritorio y móvil, build de producción y auditoría de dependencias. La base de datos exige pruebas reales de RLS cuando haya una instancia disponible. Documentar los límites de verificación.
