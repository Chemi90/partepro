# Evaluar PartePro en dos minutos

PartePro organiza el trabajo de una empresa de mantenimiento: desde el aviso de un cliente hasta el parte finalizado. Todos los clientes y registros de esta entrega son ficticios.

Abrir [la app pública](https://partepro-three.vercel.app). No requiere una cuenta de Vercel. Introducir el usuario y la contraseña entregados en los campos privados de la candidatura; el banner **Cuenta conectada** confirma el acceso a Supabase. Las credenciales no se publican en este repositorio.

| Tiempo orientativo | Acción | Qué permite comprobar |
|---|---|---|
| 0:00–0:20 | Iniciar sesión y abrir **Solicitudes → Nueva solicitud**. Elegir **Café Botánico**, título «Prueba de evaluación · climatización» y una descripción breve. | Login real, validación del formulario y creación persistente. |
| 0:20–0:50 | Abrir la solicitud, preparar un presupuesto con **Diagnóstico y desplazamiento** y una unidad de **Mano de obra técnica**. Guardarlo y pulsar **Descargar PDF**. | Subtotal 100,00 €, IVA 21,00 € y total 121,00 €. El PDF recoge cliente, conceptos y cantidades; es un presupuesto, no una factura. |
| 0:50–1:15 | Aceptar el presupuesto y planificar la intervención con un técnico en un hueco libre. | Transiciones de negocio, asignación y prevención de solapes. |
| 1:15–1:35 | Abrir la intervención planificada, exportar su cita ICS y pulsar **Sincronizar con Google Calendar**. | Exportación utilizable y respuesta real del proveedor en el calendario ficticio dedicado. Un segundo envío actualiza el mismo evento. |
| 1:35–2:00 | Finalizar el parte con un informe breve. Recargar y consultar **Partes de trabajo**. Cerrar sesión. | Persistencia en Supabase, trazabilidad y retorno al formulario de acceso. |

Cada evaluador puede crear su propia solicitud. La cuenta compartida conserva los cambios; las solicitudes iniciales podrían haber avanzado de estado durante otra revisión. Si aparece un conflicto de agenda, seleccionar otro hueco: el conflicto se comprueba también en la base de datos.

La conexión de producción utiliza «PartePro · Demo», sin acceder al calendario personal ni enviar invitaciones. Se conserva una intervención titulada «Demo Calendar · Revisión de climatización» como muestra de la sincronización real verificada. El evaluador no necesita autorizar una cuenta de Google para usar el botón.

## Explorar sin cuenta

**Explorar demo** abre datos ficticios guardados solo en esa pestaña, con perfil **Invitado · Demo**. Permite probar el mismo recorrido y descargar un PDF marcado como demo. No acredita persistencia en Supabase ni ejecuta la sincronización externa. **Reiniciar demo** solo restaura el estado local.

## Cómo comprobar el equipo de agentes

- [AGENTS.md](../AGENTS.md): Orquestador, alcance y reparto.
- [DEVELOP.md](../agents/develop/DEVELOP.md): implementación y correcciones.
- [DIRECTRICES.md](../agents/testing/DIRECTRICES.md): criterios previos y revisión independiente.
- [Registro real de trabajo](agent-log.md) y [resultados de Testing](testing.md): hallazgos, correcciones y pruebas ejecutadas.

Un ejemplo concreto es SEC-01: Testing detectó que un rechazo de negocio revertía también el contador de intentos. La migración 003 separó el contador de la subtransacción de negocio y se comprobó que los intentos fallidos siguen contando. El repositorio documenta también correcciones de interfaz y accesibilidad.

## Decisiones de alcance

Los agentes trabajan en el desarrollo; no se necesita una API de IA de pago para utilizar la aplicación. La persistencia usa Supabase Free y la publicación Vercel Hobby. Las integraciones configuradas, las pruebas ejecutadas y los límites conocidos se distinguen en [despliegue](deployment.md) y [seguridad](../SECURITY.md).
