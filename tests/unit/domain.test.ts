import { describe, expect, it } from "vitest";
import { actionSchema, applyAction, calculateQuote, DomainError, workspaceSchema, type Action, type Workspace } from "../../src/lib/domain";
import { createDemoWorkspace } from "../../src/lib/demo";

const now = new Date("2026-11-27T07:00:00.000Z");
const owner = { role: "owner" as const };
const unknownId = "99999999-0000-4000-8000-000000000001";
const fresh = () => createDemoWorkspace(now);
const pendingJob = (state: Workspace) => state.jobs.find((job) => job.status === "pending")!;
const newRequest = (state: Workspace) => state.requests.find((request) => request.status === "new")!;

describe("contrato de entradas", () => {
  const request: Action = { type: "request.create", customerId: fresh().customers[0].id, title: "Revisión", description: "Revisar equipo de ventilación", priority: "normal" };

  it("rechaza campos extra que intentan asignar un rol u organización", () => {
    expect(actionSchema.safeParse({ ...request, role: "owner" }).success).toBe(false);
    expect(actionSchema.safeParse({ ...request, organizationId: unknownId }).success).toBe(false);
  });

  it.each(["", " ", "x".repeat(121)])("rechaza títulos vacíos o largos (%s)", (title) => {
    expect(actionSchema.safeParse({ ...request, title }).success).toBe(false);
  });

  it("normaliza espacios pero conserva el contenido como texto", () => {
    const action = actionSchema.parse({ ...request, title: "  Revisar <script>  " });
    expect(action).toHaveProperty("title", "Revisar <script>");
  });

  it("rechaza IDs malformados, prioridad inventada y descripciones excesivas", () => {
    expect(actionSchema.safeParse({ ...request, customerId: "../org-b" }).success).toBe(false);
    expect(actionSchema.safeParse({ ...request, priority: "admin" }).success).toBe(false);
    expect(actionSchema.safeParse({ ...request, description: "x".repeat(2001) }).success).toBe(false);
  });

  it.each([0, -1, 1.5, 101, Number.NaN, Number.POSITIVE_INFINITY])("rechaza cantidad no permitida %s", (quantity) => {
    expect(actionSchema.safeParse({ type: "quote.create", requestId: newRequest(fresh()).id, items: [{ catalogId: fresh().catalog[0].id, quantity }] }).success).toBe(false);
  });
});

describe("presupuestos", () => {
  it("calcula base, IVA redondeado y total en céntimos usando el catálogo", () => {
    const catalog = [{ ...fresh().catalog[0], priceCents: 101 }];
    const result = calculateQuote(catalog, [{ catalogId: catalog[0].id, quantity: 3 }]);
    expect(result).toMatchObject({ subtotalCents: 303, taxCents: 64, totalCents: 367 });
    expect(result.items[0].unitPriceCents).toBe(101);
  });

  it("rechaza alterar precio o total desde una acción", () => {
    const state = fresh();
    expect(actionSchema.safeParse({ type: "quote.create", requestId: newRequest(state).id, items: [{ catalogId: state.catalog[0].id, quantity: 1, unitPriceCents: 1 }], totalCents: 1 }).success).toBe(false);
  });

  it("rechaza conceptos duplicados, ajenos al catálogo y presupuestos vacíos", () => {
    const state = fresh();
    const item = { catalogId: state.catalog[0].id, quantity: 1 };
    expect(() => calculateQuote(state.catalog, [item, item])).toThrow(DomainError);
    expect(() => calculateQuote(state.catalog, [{ ...item, catalogId: unknownId }])).toThrow(DomainError);
    expect(() => calculateQuote(state.catalog, [])).toThrow(DomainError);
  });

  it("rechaza importes que superan el límite del presupuesto", () => {
    const catalog = [{ ...fresh().catalog[0], priceCents: 10000000 }];
    expect(() => calculateQuote(catalog, [{ catalogId: catalog[0].id, quantity: 100 }])).toThrow(DomainError);
  });

  it("rechaza un segundo presupuesto para la misma solicitud", () => {
    const state = fresh();
    const action: Action = { type: "quote.create", requestId: newRequest(state).id, items: [{ catalogId: state.catalog[0].id, quantity: 1 }] };
    const next = applyAction(state, action, owner, now);
    expect(() => applyAction(next, action, owner, now)).toThrow(DomainError);
  });

  it("aceptar dos veces no genera dos intervenciones", () => {
    const state = fresh();
    const quote = state.quotes.find((item) => item.status === "draft")!;
    const accepted = applyAction(state, { type: "quote.accept", quoteId: quote.id }, owner, now);
    expect(accepted.jobs.filter((job) => job.quoteId === quote.id)).toHaveLength(1);
    expect(() => applyAction(accepted, { type: "quote.accept", quoteId: quote.id }, owner, now)).toThrow(DomainError);
  });
});

describe("agenda y partes", () => {
  it("impide asignar un técnico a dos intervenciones solapadas", () => {
    const state = fresh();
    const booked = state.jobs.find((job) => job.status === "scheduled")!;
    expect(() => applyAction(state, { type: "job.schedule", jobId: pendingJob(state).id, technicianId: booked.technicianId!, startAt: booked.startAt!, durationMinutes: 30 }, owner, now)).toThrow(/horario/);
  });

  it("permite intervenciones contiguas sin solapamiento", () => {
    const state = fresh();
    const booked = state.jobs.find((job) => job.status === "scheduled")!;
    const startAt = new Date(Date.parse(booked.startAt!) + booked.durationMinutes * 60_000).toISOString();
    const next = applyAction(state, { type: "job.schedule", jobId: pendingJob(state).id, technicianId: booked.technicianId!, startAt, durationMinutes: 30 }, owner, now);
    expect(next.jobs.find((job) => job.id === pendingJob(state).id)?.status).toBe("scheduled");
  });

  it.each(["2026-01-01T09:00:00Z", "2028-11-27T09:00:00Z"])("rechaza fecha fuera del horizonte permitido %s", (startAt) => {
    const state = fresh();
    expect(() => applyAction(state, { type: "job.schedule", jobId: pendingJob(state).id, technicianId: state.technicians[0].id, startAt, durationMinutes: 60 }, owner, now)).toThrow(DomainError);
  });

  it("un parte pendiente no puede cerrarse", () => {
    const state = fresh();
    expect(() => applyAction(state, { type: "job.complete", jobId: pendingJob(state).id, report: "Reparado", materials: [] }, owner, now)).toThrow(DomainError);
  });

  it("un técnico no puede cerrar el trabajo de otro ni crear solicitudes", () => {
    const state = fresh();
    const booked = state.jobs.find((job) => job.status === "scheduled")!;
    const actor = { role: "technician" as const, technicianId: state.technicians[2].id };
    expect(() => applyAction(state, { type: "job.complete", jobId: booked.id, report: "Reparado", materials: [] }, actor, now)).toThrow(/asignado/);
    expect(() => applyAction(state, { type: "request.create", customerId: state.customers[0].id, title: "Revisión", description: "Revisar equipo", priority: "normal" }, actor, now)).toThrow(DomainError);
  });

  it("el técnico asignado puede cerrar el parte y actualizar la solicitud", () => {
    const state = fresh();
    const booked = state.jobs.find((job) => job.status === "scheduled")!;
    const next = applyAction(state, { type: "job.complete", jobId: booked.id, report: "Equipo revisado y funcionando.", materials: [{ catalogId: state.catalog.find((item) => item.kind === "material")!.id, quantity: 2 }] }, { role: "technician", technicianId: booked.technicianId }, now);
    expect(next.jobs.find((job) => job.id === booked.id)).toMatchObject({ status: "completed", completedAt: now.toISOString() });
    expect(next.requests.find((request) => request.id === booked.requestId)?.status).toBe("completed");
    expect(() => applyAction(next, { type: "job.complete", jobId: booked.id, report: "Otro cierre", materials: [] }, owner, now)).toThrow(DomainError);
  });

  it("rechaza servicios y materiales repetidos en los consumos del parte", () => {
    const state = fresh();
    const jobId = state.jobs.find((job) => job.status === "scheduled")!.id;
    expect(() => applyAction(state, { type: "job.complete", jobId, report: "Reparado", materials: [{ catalogId: state.catalog.find((item) => item.kind === "service")!.id, quantity: 1 }] }, owner, now)).toThrow(DomainError);
    const material = { catalogId: state.catalog.find((item) => item.kind === "material")!.id, quantity: 1 };
    expect(() => applyAction(state, { type: "job.complete", jobId, report: "Reparado", materials: [material, material] }, owner, now)).toThrow(DomainError);
  });
});

describe("consistencia del recorrido", () => {
  it("completa solicitud, presupuesto, aceptación, agenda y parte conservando el original", () => {
    const original = fresh();
    const originalSnapshot = structuredClone(original);
    let state = applyAction(original, { type: "request.create", customerId: original.customers[0].id, title: "Revisión de prueba", description: "Revisar conexiones y sustituir filtro", priority: "normal" }, owner, now);
    const requestId = state.requests[0].id;
    state = applyAction(state, { type: "quote.create", requestId, items: [{ catalogId: state.catalog[0].id, quantity: 1 }] }, owner, now);
    const quoteId = state.quotes[0].id;
    state = applyAction(state, { type: "quote.accept", quoteId }, owner, now);
    const jobId = state.jobs[0].id;
    state = applyAction(state, { type: "job.schedule", jobId, technicianId: state.technicians[2].id, startAt: "2026-11-28T09:00:00Z", durationMinutes: 60 }, owner, now);
    state = applyAction(state, { type: "job.complete", jobId, report: "Conexiones revisadas; prueba de funcionamiento correcta.", materials: [] }, owner, now);
    expect(state.requests.find((request) => request.id === requestId)?.status).toBe("completed");
    expect(state.activities.length).toBe(original.activities.length + 5);
    expect(workspaceSchema.safeParse(state).success).toBe(true);
    expect(original).toEqual(originalSnapshot);
  });

  it("rechaza una referencia inexistente sin modificar el estado", () => {
    const state = fresh();
    const snapshot = structuredClone(state);
    expect(() => applyAction(state, { type: "quote.accept", quoteId: unknownId }, owner, now)).toThrow(DomainError);
    expect(state).toEqual(snapshot);
  });
});
