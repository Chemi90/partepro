import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { workspaceSchema } from "../../src/lib/domain";
import { artifactsDirectory, isRemote, loadEvaluationAccess, loadRemoteAccess } from "../support/target";
import { downloadQuotePdf } from "../support/pdf-download";

const access = loadEvaluationAccess();

test.use({ trace: "off" }); // Auth request bodies contain a private test password.

test("sesión Supabase: login, PDF autorizado, cookie protegida, recarga y logout", async ({ page, context }, testInfo) => {
  test.skip(!access, "Requiere el seed local de demostración y Supabase activo.");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await page.getByLabel("Correo electrónico", { exact: true }).fill(access!.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-invalid-password-123!");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No se ha podido iniciar sesión. Revisa tus datos e inténtalo de nuevo.");
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
  await page.getByLabel("Contraseña", { exact: true }).fill(access!.password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toHaveCount(0);
  await expect(page.locator(".connected-banner").getByText("Cuenta conectada", { exact: true })).toBeVisible();

  const cookies = await context.cookies();
  const sessionFlags = cookies.filter((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")).map((cookie) => ({ httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, secure: cookie.secure }));
  expect(sessionFlags.length).toBeGreaterThan(0);
  for (const flags of sessionFlags) {
    expect(flags.httpOnly).toBe(true);
    expect(flags.sameSite).toBe("Lax");
    if (isRemote || page.url().startsWith("https:")) expect(flags.secure).toBe(true);
  }

  const authorized = await page.request.get("/api/workspace");
  expect(authorized.status()).toBe(200);
  const data: unknown = await authorized.json();
  expect(data).toHaveProperty("workspace");
  if (isRemote) expect(data).toHaveProperty("role", loadRemoteAccess().expectedRole);
  const remote = z.object({ organizationName: z.string().min(1), workspace: workspaceSchema }).parse(data);
  const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
  if (await menu.isVisible()) await menu.click();
  const sidebar = page.getByRole("complementary", { name: "Navegación principal" });
  await expect(sidebar.locator(".workspace-switch strong")).toHaveText(remote.organizationName);
  await expect(sidebar.locator(".workspace-switch strong")).toBeVisible();
  await sidebar.getByRole("button", { name: /^Presupuestos/ }).click();
  const quote = remote.workspace.quotes[0];
  expect(quote).toBeDefined();
  await page.getByRole("button").filter({ has: page.getByText(quote.code, { exact: true }) }).click();
  const pdfResponsePending = page.waitForResponse((response) => response.url().endsWith(`/api/quotes/${quote.id}/pdf`));
  await downloadQuotePdf(page, `${artifactsDirectory}/quote-connected-${testInfo.project.name}.pdf`, false);
  const pdfResponse = await pdfResponsePending;
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect(pdfResponse.headers()["cache-control"]).toContain("no-store");
  expect(pdfResponse.headers()["vary"]).toContain("Cookie");
  const quoteRequest = remote.workspace.requests.find((entry) => entry.id === quote.requestId)!;
  const customer = remote.workspace.customers.find((entry) => entry.id === quoteRequest.customerId)!;
  await writeFile(`${artifactsDirectory}/quote-connected-${testInfo.project.name}-expected.json`, JSON.stringify({ organizationName: remote.organizationName, quote, request: quoteRequest, customer }, null, 2));
  await page.getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
  const unavailablePdf = await page.request.get("/api/quotes/8ce4f297-04cf-40ec-9960-ef95f9516f42/pdf");
  expect(unavailablePdf.status()).toBe(404);
  expect(unavailablePdf.headers()["content-type"]).not.toContain("application/pdf");
  const storage = await page.evaluate(() => JSON.stringify([Object.entries(sessionStorage), Object.entries(localStorage)]));
  expect(storage.includes(access!.password)).toBe(false);
  expect(storage).not.toMatch(/access_token|refresh_token/);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requestSeen!: () => void;
  const sessionRequest = new Promise<void>((resolve) => { requestSeen = resolve; });
  await page.route("**/api/workspace", async (route) => {
    requestSeen();
    await gate;
    await route.continue();
  });
  try {
    await page.reload();
    await sessionRequest;
    await expect(page.getByText("Comprobando tu sesión…", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
    await expect(page.getByText("Modo demo", { exact: true })).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator(".connected-banner").getByText("Cuenta conectada", { exact: true })).toBeVisible();
  await page.unroute("**/api/workspace");
  await page.getByTitle("Cerrar sesión", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  expect((await page.request.get(`/api/quotes/${quote.id}/pdf`)).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
});
