# Registro de trabajo real

## Inicio
Orquestador: revisado directorio vacío y requisito de tres agentes. Elegido Next.js + TypeScript + Supabase. Se establece demo aislada, controles en servidor y RLS. Los resultados se añadirán conforme se ejecuten; no constituyen una auditoría de seguridad profesional.

## Delegación ejecutada

- Orquestador creó los subagentes `develop` y `testing` en esta sesión, con instrucciones y propiedad de archivos diferenciadas.
- Testing publicó DIRECTRICES antes de la implementación y comunicó los criterios a Develop.
- Develop propuso un contrato Workspace y acciones estrictas; Orquestador lo aceptó e implementó las rutas y tablas relacionales.
- Testing señaló que una alternativa de snapshot JSONB necesitaría validar también las llamadas directas a Supabase. Se implementaron tablas normalizadas, RLS y RPC con reglas en SQL.

## Ciclo de revisión real

1. Develop entregó dominio, demo y cinco vistas.
2. Testing ejecutó 44 pruebas unitarias y pruebas directas sobre Supabase local con dos organizaciones y roles diferentes.
3. Testing reprodujo SEC-01: un rechazo SQL revertía el contador de intentos. Orquestador añadió la migración 003 con contador exterior y subtransacción de negocio; Testing comprobó que el intento fallido ahora cuenta.
4. Testing observó UI-01 en una captura de 1280×720: el contenido de la barra lateral rebasaba su altura. Develop corrigió scroll/visibilidad de contenido decorativo.
5. Orquestador compiló producción, revisó capturas de escritorio/móvil y preparó CI con comprobaciones independientes de aplicación y base de datos.
6. La auditoría de dependencias no informó vulnerabilidades en la ejecución local. El informe detallado y estado de las pruebas E2E están en docs/testing.md.

## Decisiones de entrega

Sin prometer seguridad absoluta. Demo local identificada; persistencia real verificada por separado. Exportación ICS funcional; Calendar requiere credenciales y comprobación externa. Ningún resultado externo se declara realizado sin confirmación del proveedor.
