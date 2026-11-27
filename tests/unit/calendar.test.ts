import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../../src/lib/demo";

vi.mock("server-only", () => ({}));
import { syncCalendar } from "../../src/lib/server/calendar";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const orgId = "2f828a6f-e253-4fb6-827f-0207462143a1";
const workspace = createDemoWorkspace(new Date("2026-11-27T08:00:00Z"));
const scheduled = workspace.jobs.find((job) => job.status === "scheduled")!;
const job = { ...scheduled, startAt: "2026-03-29T00:30:00Z", durationMinutes: 90 };
const serviceRequest = workspace.requests.find((entry) => entry.id === job.requestId)!;
const customer = workspace.customers.find((entry) => entry.id === serviceRequest.customerId)!;
const eventId = `partepro${job.id.replaceAll("-", "")}`;
const providerFetch = vi.fn<typeof fetch>();
const response = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const token = () => response(200, { access_token: "unit-test-token" });
const sync = () => syncCalendar(orgId, job, serviceRequest, customer);

beforeEach(() => {
  providerFetch.mockReset();
  vi.stubGlobal("fetch", providerFetch);
  vi.stubEnv("GOOGLE_CALENDAR_ID", "qa-only@group.calendar.google.com");
  vi.stubEnv("GOOGLE_CLIENT_EMAIL", "qa-only@fictional.iam.gserviceaccount.com");
  vi.stubEnv("GOOGLE_PRIVATE_KEY", privateKey);
  vi.stubEnv("CALENDAR_ORGANIZATION_ID", orgId);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Calendar: contrato del proveedor sin llamadas externas", () => {
  it("rechaza configuración ausente, otra organización y parte sin planificación antes de contactar al proveedor", async () => {
    await expect(syncCalendar("d8b2f42d-d79e-44ca-bceb-04dad5347fbb", job, serviceRequest, customer)).rejects.toMatchObject({ status: 403 });
    await expect(syncCalendar(orgId, { ...job, startAt: null, status: "pending" }, serviceRequest, customer)).rejects.toMatchObject({ status: 409 });
    vi.stubEnv("GOOGLE_CALENDAR_ID", "");
    await expect(sync()).rejects.toMatchObject({ status: 503 });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("actualiza el mismo evento al replanificar, preserva el horario y no añade asistentes ni notificaciones", async () => {
    providerFetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(response(200));
    await expect(sync()).resolves.toMatchObject({ ok: true });
    const [url, options] = providerFetch.mock.calls[1];
    expect(String(url)).toContain(`/${eventId}?sendUpdates=none`);
    expect(options?.method).toBe("PUT");
    expect(options?.redirect).toBe("error");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const event = JSON.parse(String(options?.body));
    expect(event).toMatchObject({
      summary: `${job.code} · ${serviceRequest.title}`,
      start: { dateTime: job.startAt, timeZone: "Europe/Madrid" },
      end: { dateTime: "2026-03-29T02:00:00.000Z", timeZone: "Europe/Madrid" },
    });
    expect(event).not.toHaveProperty("attendees");
    expect(event).not.toHaveProperty("conferenceData");
    expect(event).not.toHaveProperty("sendNotifications");
    providerFetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(response(200));
    await syncCalendar(orgId, { ...job, startAt: "2026-03-30T08:00:00Z" }, serviceRequest, customer);
    expect(providerFetch.mock.calls[3][0]).toBe(url);
    expect(providerFetch.mock.calls[3][1]?.method).toBe("PUT");
    expect(JSON.parse(String(providerFetch.mock.calls[3][1]?.body)).start.dateTime).toBe("2026-03-30T08:00:00Z");
  });

  it("crea un ID determinista tras 404 y un reintento posterior actualiza ese ID", async () => {
    providerFetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(200));
    await sync();
    const [url, options] = providerFetch.mock.calls[2];
    expect(String(url)).toMatch(/\/events\?sendUpdates=none$/);
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body)).id).toBe(eventId);
    providerFetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(response(200));
    await sync();
    expect(String(providerFetch.mock.calls[4][0])).toContain(`/${eventId}?sendUpdates=none`);
    expect(providerFetch.mock.calls.filter((call) => call[1]?.method === "POST" && String(call[0]).includes("/events")).length).toBe(1);
  });

  it("resuelve la carrera 404/409 actualizando el mismo evento sin crear otro", async () => {
    providerFetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(409)).mockResolvedValueOnce(response(200));
    await expect(sync()).resolves.toMatchObject({ ok: true });
    expect(providerFetch.mock.calls[3][0]).toBe(providerFetch.mock.calls[1][0]);
    expect(providerFetch.mock.calls[3][1]?.method).toBe("PUT");
    expect(providerFetch).toHaveBeenCalledTimes(4);
  });

  it("rechaza un error de autorización del proveedor sin exponer su respuesta", async () => {
    providerFetch.mockResolvedValueOnce(response(403, { error: "private-provider-detail" }));
    await expect(sync()).rejects.toMatchObject({ status: 502, message: "No se ha podido autorizar el calendario." });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("no confirma éxito si Calendar rechaza la escritura", async () => {
    providerFetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(response(503, { error: "private-provider-detail" }));
    await expect(sync()).rejects.toMatchObject({ status: 502, message: "El calendario no ha confirmado la sincronización. Inténtalo de nuevo." });
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });
});
