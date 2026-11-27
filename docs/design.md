# Diseño de PartePro

## Referencia y alcance

La adaptación visual parte de [speedparadigm.com](https://speedparadigm.com/), por petición expresa del usuario. Se inspeccionaron el HTML y las hojas CSS públicas del sitio el 27 de noviembre de 2026. La comparación de la referencia se basa en ese código público, no en una captura visual del sitio ni en acceso a su código privado.

Se conserva la identidad PartePro y su interfaz de gestión con cinco vistas. La estructura comercial, los textos, el logotipo y las afirmaciones de Speed Paradigm no se reproducen. Se adapta su lenguaje visual a una herramienta operativa.

## Sistema visual

| Elemento                | Decisión                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| Fondo papel             | `#f7f6f3`                                                              |
| Tinta                   | `#0b0b0c`                                                              |
| Azul principal          | `#1b3bff`                                                              |
| Azul al pasar el cursor | `#12299e`                                                              |
| Separadores             | `#0b0b0c1f`                                                            |
| Radio base              | `0.25rem`                                                              |
| Titulares               | Bricolage Grotesque variable, peso 700–800, tracking negativo          |
| Texto e interfaz        | Manrope variable, peso 400–700                                         |
| Titular principal       | Mayúsculas mediante CSS, `clamp(2.2rem, 5.9vw, 4.05rem)`; ajuste móvil |
| Acciones                | Botones rectangulares azules, etiquetas legibles y foco azul visible   |

Las fuentes se sirven localmente desde `public/fonts`, con sus licencias SIL OFL. No hay peticiones a Google Fonts ni a otro proveedor de fuentes en tiempo de ejecución. Ambas familias se precargan y usan `font-display: swap`.

## Adaptación a la aplicación

- Navegación de papel y texto negro, con la sección seleccionada en azul.
- Jerarquía editorial: titular rotundo, métricas con tipografía display, espacio entre grupos y separadores finos.
- Tarjetas con bordes discretos de cuatro píxeles de radio y sin sombras decorativas.
- El azul identifica acciones, foco, progreso y enlaces. Los estados conservan texto y, cuando aporta significado, colores semánticos de aviso.
- Se conservan las cinco vistas y los recorridos de los formularios. Los permisos, endpoints y reglas de negocio no cambian con el rediseño.
- La navegación móvil cerrada queda oculta también para teclado mediante `visibility: hidden`; el panel abierto restaura su visibilidad.
- Se conserva el respeto a `prefers-reduced-motion`, el diseño adaptable y el cierre de diálogos mediante Escape.
- Los diálogos mantienen sus acciones visibles mientras el cuerpo se desplaza y devuelven el foco al control que los abrió al cerrarse.

## Verificación

Los resultados de TypeScript, pruebas funcionales, revisión de contraste y capturas de la aplicación se registran en `docs/testing.md`. La inspección del HTML/CSS de la referencia no demuestra equivalencia visual exacta; el resultado es una adaptación de sus elementos visuales a PartePro.
