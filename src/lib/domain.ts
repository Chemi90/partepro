import { z } from "zod";

const id = z.string().uuid();
const shortText = (max: number) => z.string().trim().min(1).max(max);
export const prioritySchema = z.enum(["low", "normal", "urgent"]);
const selectionSchema = z
  .object({ catalogId: id, quantity: z.number().int().min(1).max(100) })
  .strict();
const requestFields = {
  title: shortText(120),
  description: shortText(2000),
  priority: prioritySchema,
};
export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("request.create"),
      customerId: id,
      ...requestFields,
    })
    .strict(),
  z
    .object({
      type: z.literal("request.update"),
      requestId: id,
      ...requestFields,
    })
    .strict(),
  z
    .object({
      type: z.literal("quote.create"),
      requestId: id,
      items: z.array(selectionSchema).min(1).max(20),
    })
    .strict(),
  z.object({ type: z.literal("quote.accept"), quoteId: id }).strict(),
  z
    .object({
      type: z.literal("job.schedule"),
      jobId: id,
      technicianId: id,
      startAt: z.iso.datetime({ offset: true }),
      durationMinutes: z.number().int().min(15).max(480),
    })
    .strict(),
  z
    .object({
      type: z.literal("job.complete"),
      jobId: id,
      report: shortText(4000),
      materials: z.array(selectionSchema).max(20),
    })
    .strict(),
]);
export const workspaceSchema = z
  .object({
    customers: z
      .array(
        z
          .object({
            id,
            name: shortText(120),
            contact: shortText(120),
            email: z.string().email(),
            phone: z.string().max(30),
            address: z.string().max(240),
          })
          .strict(),
      )
      .max(1000),
    technicians: z
      .array(
        z
          .object({
            id,
            name: shortText(120),
            initials: shortText(4),
            color: z.enum(["teal", "violet", "amber"]),
          })
          .strict(),
      )
      .max(100),
    catalog: z
      .array(
        z
          .object({
            id,
            name: shortText(120),
            unit: shortText(20),
            priceCents: z.number().int().min(0).max(10000000),
            kind: z.enum(["service", "material"]),
          })
          .strict(),
      )
      .max(1000),
    requests: z
      .array(
        z
          .object({
            id,
            code: shortText(40),
            customerId: id,
            ...requestFields,
            status: z.enum(["new", "quoted", "accepted", "completed"]),
            createdAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(2000),
    quotes: z
      .array(
        z
          .object({
            id,
            code: shortText(40),
            requestId: id,
            items: z
              .array(
                z
                  .object({
                    catalogId: id,
                    quantity: z.number().int().min(1).max(100),
                    unitPriceCents: z.number().int().nonnegative(),
                    name: shortText(120),
                  })
                  .strict(),
              )
              .max(20),
            subtotalCents: z.number().int().nonnegative(),
            taxCents: z.number().int().nonnegative(),
            totalCents: z.number().int().nonnegative(),
            status: z.enum(["draft", "accepted"]),
            createdAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(2000),
    jobs: z
      .array(
        z
          .object({
            id,
            code: shortText(40),
            requestId: id,
            quoteId: id,
            status: z.enum(["pending", "scheduled", "completed"]),
            technicianId: id.nullable(),
            startAt: z.iso.datetime({ offset: true }).nullable(),
            durationMinutes: z.number().int().min(15).max(480),
            report: z.string().max(4000).nullable(),
            materials: z.array(selectionSchema).max(20),
            completedAt: z.iso.datetime({ offset: true }).nullable(),
          })
          .strict(),
      )
      .max(2000),
    activities: z
      .array(
        z
          .object({
            id,
            text: shortText(500),
            createdAt: z.iso.datetime({ offset: true }),
            kind: z.enum(["request", "quote", "job"]),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();

export type Workspace = z.infer<typeof workspaceSchema>;
export type Customer = Workspace["customers"][number];
export type Technician = Workspace["technicians"][number];
export type CatalogItem = Workspace["catalog"][number];
export type ServiceRequest = Workspace["requests"][number];
export type Quote = Workspace["quotes"][number];
export type Job = Workspace["jobs"][number];
export type Activity = Workspace["activities"][number];
export type Action = z.infer<typeof actionSchema>;
export type Role = "owner" | "dispatcher" | "technician";
export type Actor = { role: Role; technicianId?: string | null };
export type Selection = z.infer<typeof selectionSchema>;
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
export const money = (cents: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);

function required<T>(value: T | undefined, message: string): T {
  if (!value) throw new DomainError(message);
  return value;
}

export function calculateQuote(
  catalog: CatalogItem[],
  selections: Selection[],
) {
  if (!selections.length || selections.length > 20)
    throw new DomainError("Añade entre 1 y 20 conceptos.");
  if (
    new Set(selections.map((item) => item.catalogId)).size !== selections.length
  )
    throw new DomainError("Un concepto no puede aparecer dos veces.");
  const items = selections.map((selection) => {
    if (
      !Number.isInteger(selection.quantity) ||
      selection.quantity < 1 ||
      selection.quantity > 100
    )
      throw new DomainError("La cantidad debe estar entre 1 y 100.");
    const product = required(
      catalog.find((item) => item.id === selection.catalogId),
      "El concepto no existe en el catálogo.",
    );
    if (!Number.isSafeInteger(product.priceCents) || product.priceCents < 0)
      throw new DomainError("El precio del catálogo no es válido.");
    return {
      catalogId: product.id,
      name: product.name,
      quantity: selection.quantity,
      unitPriceCents: product.priceCents,
    };
  });
  const subtotalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
  const taxCents = Math.round((subtotalCents * 21) / 100);
  const totalCents = subtotalCents + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 100000000)
    throw new DomainError("El presupuesto supera el límite permitido.");
  return { items, subtotalCents, taxCents, totalCents };
}

export function applyAction(
  source: Workspace,
  input: Action,
  actor: Actor,
  now = new Date(),
): Workspace {
  const action = actionSchema.parse(input);
  if (!["owner", "dispatcher", "technician"].includes(actor.role))
    throw new DomainError("No tienes permiso para esta acción.");
  if (actor.role === "technician" && action.type !== "job.complete")
    throw new DomainError("Solo coordinación puede realizar esta acción.");
  const state = structuredClone(source);
  const timestamp = now.toISOString();
  const log = (text: string, kind: Activity["kind"]) =>
    state.activities.unshift({
      id: crypto.randomUUID(),
      text,
      kind,
      createdAt: timestamp,
    });
  switch (action.type) {
    case "request.create": {
      required(
        state.customers.find((item) => item.id === action.customerId),
        "Selecciona un cliente válido.",
      );
      if (state.requests.length >= 2000)
        throw new DomainError("Se ha alcanzado el límite de solicitudes.");
      const request: ServiceRequest = {
        id: crypto.randomUUID(),
        code: `SOL-${String(state.requests.length + 1).padStart(3, "0")}`,
        customerId: action.customerId,
        title: action.title,
        description: action.description,
        priority: action.priority,
        status: "new",
        createdAt: timestamp,
      };
      state.requests.unshift(request);
      log(`Nueva solicitud: ${request.title}`, "request");
      break;
    }
    case "request.update": {
      const request = required(
        state.requests.find((item) => item.id === action.requestId),
        "La solicitud no existe.",
      );
      if (request.status !== "new")
        throw new DomainError(
          "Solo se pueden editar solicitudes sin presupuesto.",
        );
      Object.assign(request, {
        title: action.title,
        description: action.description,
        priority: action.priority,
      });
      log(`Solicitud actualizada: ${request.code}`, "request");
      break;
    }
    case "quote.create": {
      const request = required(
        state.requests.find((item) => item.id === action.requestId),
        "La solicitud no existe.",
      );
      if (
        request.status !== "new" ||
        state.quotes.some((item) => item.requestId === request.id)
      )
        throw new DomainError("Esta solicitud ya tiene un presupuesto.");
      const quote: Quote = {
        id: crypto.randomUUID(),
        code: `PRE-${String(state.quotes.length + 1).padStart(3, "0")}`,
        requestId: request.id,
        ...calculateQuote(state.catalog, action.items),
        status: "draft",
        createdAt: timestamp,
      };
      state.quotes.unshift(quote);
      request.status = "quoted";
      log(
        `Presupuesto ${quote.code} preparado · ${money(quote.totalCents)}`,
        "quote",
      );
      break;
    }
    case "quote.accept": {
      const quote = required(
        state.quotes.find((item) => item.id === action.quoteId),
        "El presupuesto no existe.",
      );
      if (
        quote.status !== "draft" ||
        state.jobs.some((item) => item.quoteId === quote.id)
      )
        throw new DomainError("Este presupuesto ya ha sido aceptado.");
      const request = required(
        state.requests.find((item) => item.id === quote.requestId),
        "La solicitud no existe.",
      );
      if (request.status !== "quoted")
        throw new DomainError("La solicitud no está pendiente de aceptación.");
      quote.status = "accepted";
      request.status = "accepted";
      state.jobs.unshift({
        id: crypto.randomUUID(),
        code: `PAR-${String(state.jobs.length + 1).padStart(3, "0")}`,
        requestId: request.id,
        quoteId: quote.id,
        status: "pending",
        technicianId: null,
        startAt: null,
        durationMinutes: 60,
        report: null,
        materials: [],
        completedAt: null,
      });
      log(
        `Presupuesto ${quote.code} aceptado. Intervención pendiente de planificar.`,
        "quote",
      );
      break;
    }
    case "job.schedule": {
      const job = required(
        state.jobs.find((item) => item.id === action.jobId),
        "La intervención no existe.",
      );
      if (job.status === "completed")
        throw new DomainError("Un parte cerrado no se puede reprogramar.");
      required(
        state.technicians.find((item) => item.id === action.technicianId),
        "Selecciona un técnico válido.",
      );
      const starts = new Date(action.startAt).getTime();
      if (
        !Number.isFinite(starts) ||
        starts < now.getTime() - 60000 ||
        starts > now.getTime() + 366 * 86400000
      )
        throw new DomainError(
          "Elige una fecha futura dentro de los próximos 12 meses.",
        );
      const ends = starts + action.durationMinutes * 60000;
      if (
        state.jobs.some(
          (other) =>
            other.id !== job.id &&
            other.status === "scheduled" &&
            other.technicianId === action.technicianId &&
            other.startAt &&
            starts <
              new Date(other.startAt).getTime() +
                other.durationMinutes * 60000 &&
            ends > new Date(other.startAt).getTime(),
        )
      )
        throw new DomainError(
          "Este técnico ya tiene una intervención en ese horario.",
        );
      Object.assign(job, {
        status: "scheduled",
        technicianId: action.technicianId,
        startAt: new Date(starts).toISOString(),
        durationMinutes: action.durationMinutes,
      });
      log(`Intervención ${job.code} planificada.`, "job");
      break;
    }
    case "job.complete": {
      const job = required(
        state.jobs.find((item) => item.id === action.jobId),
        "La intervención no existe.",
      );
      if (job.status !== "scheduled")
        throw new DomainError(
          "Solo se pueden cerrar intervenciones planificadas.",
        );
      if (
        actor.role === "technician" &&
        (!actor.technicianId || actor.technicianId !== job.technicianId)
      )
        throw new DomainError("Este parte no está asignado a tu usuario.");
      if (
        new Set(action.materials.map((item) => item.catalogId)).size !==
        action.materials.length
      )
        throw new DomainError("No repitas materiales.");
      action.materials.forEach((selection) => {
        const product = required(
          state.catalog.find((item) => item.id === selection.catalogId),
          "El material no existe.",
        );
        if (product.kind !== "material")
          throw new DomainError("Selecciona un material del catálogo.");
      });
      Object.assign(job, {
        status: "completed",
        report: action.report,
        materials: action.materials,
        completedAt: timestamp,
      });
      const request = required(
        state.requests.find((item) => item.id === job.requestId),
        "La solicitud no existe.",
      );
      request.status = "completed";
      log(`Parte ${job.code} finalizado y registrado.`, "job");
      break;
    }
  }
  state.activities = state.activities.slice(0, 2000);
  return state;
}
