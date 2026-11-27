import { type Workspace, workspaceSchema } from "./domain";

const uuid = (group: number, n: number) =>
  `${String(group).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const DEMO_STORAGE_KEY = "partepro.demo.v1";

export function createDemoWorkspace(now = new Date()): Workspace {
  const at = (day: number, hour: number, minute = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const createdAt = at(-2, 10);
  const customers = [
    {
      id: uuid(1, 1),
      name: "Comunidad Olivar 24",
      contact: "Lucía Martín",
      email: "lucia@example.com",
      phone: "600 000 101",
      address: "Calle del Olivar, 24 · Madrid",
    },
    {
      id: uuid(1, 2),
      name: "Estudio Norte",
      contact: "Pablo Navarro",
      email: "pablo@example.com",
      phone: "600 000 102",
      address: "Calle de Velázquez, 42 · Madrid",
    },
    {
      id: uuid(1, 3),
      name: "Café Botánico",
      contact: "Elena Ruiz",
      email: "elena@example.com",
      phone: "600 000 103",
      address: "Calle de la Palma, 18 · Madrid",
    },
    {
      id: uuid(1, 4),
      name: "Residencial Las Encinas",
      contact: "Carlos Vega",
      email: "carlos@example.com",
      phone: "600 000 104",
      address: "Avenida de Europa, 9 · Madrid",
    },
    {
      id: uuid(1, 5),
      name: "Clínica Alameda",
      contact: "Ana Torres",
      email: "ana@example.com",
      phone: "600 000 105",
      address: "Paseo de la Alameda, 12 · Madrid",
    },
  ];
  const technicians: Workspace["technicians"] = [
    { id: uuid(2, 1), name: "Marcos López", initials: "ML", color: "teal" },
    { id: uuid(2, 2), name: "Sara Díaz", initials: "SD", color: "violet" },
    { id: uuid(2, 3), name: "Daniel Gil", initials: "DG", color: "amber" },
  ];
  const catalog: Workspace["catalog"] = [
    {
      id: uuid(3, 1),
      name: "Diagnóstico y desplazamiento",
      unit: "servicio",
      priceCents: 4500,
      kind: "service",
    },
    {
      id: uuid(3, 2),
      name: "Mano de obra técnica",
      unit: "hora",
      priceCents: 5500,
      kind: "service",
    },
    {
      id: uuid(3, 3),
      name: "Mantenimiento de climatización",
      unit: "equipo",
      priceCents: 12000,
      kind: "service",
    },
    {
      id: uuid(3, 4),
      name: "Filtro de aire F7",
      unit: "unidad",
      priceCents: 2800,
      kind: "material",
    },
    {
      id: uuid(3, 5),
      name: "Termostato digital",
      unit: "unidad",
      priceCents: 8500,
      kind: "material",
    },
    {
      id: uuid(3, 6),
      name: "Kit de juntas y conexiones",
      unit: "kit",
      priceCents: 1800,
      kind: "material",
    },
  ];
  const requests: Workspace["requests"] = [
    {
      id: uuid(4, 8),
      code: "SOL-008",
      customerId: customers[2].id,
      title: "El aire del local no enfría",
      description:
        "El equipo de la zona de barra lleva dos días sin enfriar. El local abre a las 8:00; necesitamos revisión antes del fin de semana.",
      priority: "urgent",
      status: "new",
      createdAt: at(0, 8, 15),
    },
    {
      id: uuid(4, 7),
      code: "SOL-007",
      customerId: customers[3].id,
      title: "Revisión de la bomba de circulación",
      description:
        "Se escucha un ruido intermitente en la sala de máquinas. Revisar conexiones y presión del circuito.",
      priority: "normal",
      status: "new",
      createdAt: at(-1, 16, 40),
    },
    {
      id: uuid(4, 6),
      code: "SOL-006",
      customerId: customers[1].id,
      title: "Instalación de un termostato digital",
      description:
        "Sustituir el termostato del despacho principal y comprobar la programación semanal.",
      priority: "low",
      status: "quoted",
      createdAt: at(-1, 11, 20),
    },
    {
      id: uuid(4, 5),
      code: "SOL-005",
      customerId: customers[4].id,
      title: "Mantenimiento de equipos de ventilación",
      description:
        "Revisión periódica y sustitución de filtros de dos equipos de ventilación.",
      priority: "normal",
      status: "accepted",
      createdAt,
    },
    {
      id: uuid(4, 4),
      code: "SOL-004",
      customerId: customers[0].id,
      title: "Puesta a punto de la calefacción",
      description:
        "Comprobar funcionamiento y revisar las conexiones antes de la temporada de invierno.",
      priority: "normal",
      status: "accepted",
      createdAt,
    },
    {
      id: uuid(4, 3),
      code: "SOL-003",
      customerId: customers[1].id,
      title: "Revisión de climatización de oficinas",
      description:
        "Mantenimiento preventivo de climatización de la planta principal.",
      priority: "normal",
      status: "accepted",
      createdAt,
    },
    {
      id: uuid(4, 2),
      code: "SOL-002",
      customerId: customers[2].id,
      title: "Sustitución de filtros de extracción",
      description:
        "Sustituir filtros y verificar el caudal de extracción de la cocina.",
      priority: "low",
      status: "completed",
      createdAt: at(-4, 10),
    },
    {
      id: uuid(4, 1),
      code: "SOL-001",
      customerId: customers[3].id,
      title: "Ajuste de presión del circuito",
      description:
        "Revisión de presión y purgado de los circuitos de calefacción.",
      priority: "normal",
      status: "completed",
      createdAt: at(-5, 10),
    },
  ];
  const quoteSpecs = [
    {
      request: 6,
      items: [
        [0, 1],
        [1, 1],
        [4, 1],
      ],
      status: "draft" as const,
    },
    {
      request: 5,
      items: [
        [2, 2],
        [3, 2],
      ],
      status: "accepted" as const,
    },
    {
      request: 4,
      items: [
        [0, 1],
        [1, 2],
        [5, 1],
      ],
      status: "accepted" as const,
    },
    { request: 3, items: [[2, 2]], status: "accepted" as const },
    {
      request: 2,
      items: [
        [1, 1],
        [3, 2],
      ],
      status: "accepted" as const,
    },
    {
      request: 1,
      items: [
        [0, 1],
        [1, 1],
      ],
      status: "accepted" as const,
    },
  ];
  const quotes: Workspace["quotes"] = quoteSpecs.map((spec, index) => {
    const items = spec.items.map(([product, quantity]) => ({
      catalogId: catalog[product].id,
      name: catalog[product].name,
      quantity,
      unitPriceCents: catalog[product].priceCents,
    }));
    const subtotalCents = items.reduce(
        (n, item) => n + item.quantity * item.unitPriceCents,
        0,
      ),
      taxCents = Math.round(subtotalCents * 0.21);
    return {
      id: uuid(5, index + 1),
      code: `PRE-${String(index + 1).padStart(3, "0")}`,
      requestId: uuid(4, spec.request),
      items,
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      status: spec.status,
      createdAt,
    };
  });
  const jobs: Workspace["jobs"] = [
    {
      id: uuid(6, 1),
      code: "PAR-001",
      requestId: uuid(4, 5),
      quoteId: uuid(5, 2),
      status: "scheduled",
      technicianId: technicians[0].id,
      startAt: at(0, 9),
      durationMinutes: 90,
      report: null,
      materials: [],
      completedAt: null,
    },
    {
      id: uuid(6, 2),
      code: "PAR-002",
      requestId: uuid(4, 4),
      quoteId: uuid(5, 3),
      status: "scheduled",
      technicianId: technicians[1].id,
      startAt: at(0, 11),
      durationMinutes: 120,
      report: null,
      materials: [],
      completedAt: null,
    },
    {
      id: uuid(6, 3),
      code: "PAR-003",
      requestId: uuid(4, 3),
      quoteId: uuid(5, 4),
      status: "pending",
      technicianId: null,
      startAt: null,
      durationMinutes: 60,
      report: null,
      materials: [],
      completedAt: null,
    },
    {
      id: uuid(6, 4),
      code: "PAR-004",
      requestId: uuid(4, 2),
      quoteId: uuid(5, 5),
      status: "completed",
      technicianId: technicians[2].id,
      startAt: at(-1, 10),
      durationMinutes: 60,
      report:
        "Sustituidos dos filtros de extracción. Caudal y conexiones comprobados. Equipo funcionando correctamente.",
      materials: [{ catalogId: catalog[3].id, quantity: 2 }],
      completedAt: at(-1, 11),
    },
    {
      id: uuid(6, 5),
      code: "PAR-005",
      requestId: uuid(4, 1),
      quoteId: uuid(5, 6),
      status: "completed",
      technicianId: technicians[0].id,
      startAt: at(-2, 9),
      durationMinutes: 60,
      report:
        "Circuito purgado y presión ajustada. Sin fugas visibles. Se recomienda una revisión en seis meses.",
      materials: [],
      completedAt: at(-2, 10),
    },
  ];
  return workspaceSchema.parse({
    customers,
    technicians,
    catalog,
    requests,
    quotes,
    jobs,
    activities: [
      {
        id: uuid(7, 1),
        text: "Nueva solicitud de Café Botánico",
        createdAt: at(0, 8, 15),
        kind: "request",
      },
      {
        id: uuid(7, 2),
        text: "Presupuesto PRE-001 preparado para Estudio Norte",
        createdAt: at(-1, 17),
        kind: "quote",
      },
      {
        id: uuid(7, 3),
        text: "Daniel ha finalizado el parte PAR-004",
        createdAt: at(-1, 11),
        kind: "job",
      },
      {
        id: uuid(7, 4),
        text: "Sara tiene una nueva intervención asignada",
        createdAt: at(-1, 9),
        kind: "job",
      },
    ],
  });
}
