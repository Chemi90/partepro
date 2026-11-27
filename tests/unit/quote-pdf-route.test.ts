import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../../src/lib/demo";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireMember: vi.fn(), createQuotePdf: vi.fn() }));
vi.mock("../../src/lib/server/supabase", () => ({ requireMember: mocks.requireMember }));
vi.mock("../../src/lib/quote-pdf", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/lib/quote-pdf")>()), createQuotePdf: mocks.createQuotePdf }));
import { GET } from "../../src/app/api/quotes/[id]/pdf/route";
import { HttpError } from "../../src/lib/server/http";

const snapshot = createDemoWorkspace();
const invoke = (id = snapshot.quotes[0].id) => GET(new Request(`https://partepro.example/api/quotes/${id}/pdf`), { params: Promise.resolve({ id }) });
beforeEach(() => { mocks.requireMember.mockReset(); mocks.createQuotePdf.mockReset(); });

describe("PDF HTTP: denegación antes de generar documentos", () => {
  it("no genera PDF sin una sesión válida", async () => {
    mocks.requireMember.mockRejectedValue(new HttpError(401, "Inicia sesión para acceder a tu empresa."));
    expect((await invoke()).status).toBe(401);
    expect(mocks.createQuotePdf).not.toHaveBeenCalled();
  });

  it("respeta el false persistido del límite y no lee ni genera el presupuesto", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const from = vi.fn();
    mocks.requireMember.mockResolvedValue({ member: { org_id: "org-a" }, supabase: { rpc, from } });
    const response = await invoke();
    expect(response.status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("consume_pdf_rate_limit");
    expect(from).not.toHaveBeenCalled();
    expect(mocks.createQuotePdf).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("no genera un ID que no está en el snapshot autorizado por RLS", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "consume_pdf_rate_limit" ? true : snapshot, error: null }));
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { name: "Empresa A" }, error: null }) }) }) }));
    mocks.requireMember.mockResolvedValue({ member: { org_id: "org-a" }, supabase: { rpc, from } });
    expect((await invoke("4287110c-57da-4549-ab61-651da2bf7496")).status).toBe(404);
    expect(rpc).toHaveBeenCalledWith("get_workspace");
    expect(mocks.createQuotePdf).not.toHaveBeenCalled();
  });
});
