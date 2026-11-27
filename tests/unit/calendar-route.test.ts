import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../../src/lib/demo";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireMember: vi.fn(), syncCalendar: vi.fn() }));
vi.mock("../../src/lib/server/supabase", () => ({ requireMember: mocks.requireMember }));
vi.mock("../../src/lib/server/calendar", () => ({ syncCalendar: mocks.syncCalendar }));
import { POST } from "../../src/app/api/calendar/route";
import { HttpError } from "../../src/lib/server/http";

const origin = "https://partepro.example";
const snapshot = createDemoWorkspace();
const request = (jobId = snapshot.jobs[0].id) => new NextRequest(`${origin}/api/calendar`, {
  method: "POST", headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin" }, body: JSON.stringify({ jobId }),
});
beforeEach(() => { vi.stubEnv("APP_ORIGIN", origin); mocks.requireMember.mockReset(); mocks.syncCalendar.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("Calendar HTTP: autorización antes del proveedor", () => {
  it("rechaza sesión ausente sin sincronizar", async () => {
    mocks.requireMember.mockRejectedValue(new HttpError(401, "Inicia sesión para acceder a tu empresa."));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.syncCalendar).not.toHaveBeenCalled();
  });

  it("rechaza al técnico aunque el parte sea visible", async () => {
    const rpc = vi.fn();
    mocks.requireMember.mockResolvedValue({ member: { role: "technician", org_id: "org-a" }, supabase: { rpc } });
    expect((await POST(request())).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.syncCalendar).not.toHaveBeenCalled();
  });

  it("no sincroniza un ID que no está en el workspace autorizado por RLS", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "consume_calendar_rate_limit" ? true : snapshot, error: null }));
    mocks.requireMember.mockResolvedValue({ member: { role: "dispatcher", org_id: "org-a" }, supabase: { rpc } });
    expect((await POST(request("25dbbc98-486e-40c9-af22-227116db6a8f"))).status).toBe(404);
    expect(rpc).toHaveBeenCalledWith("get_workspace");
    expect(mocks.syncCalendar).not.toHaveBeenCalled();
  });
});
