import { expect, test } from "@playwright/test";
import { isRemote, loadEvaluationAccess, loadRemoteAccess } from "../support/target";

const access = loadEvaluationAccess();

test.use({ trace: "off" }); // Auth request bodies contain a private test password.

test("sesión Supabase: login, cookie protegida, recarga y logout", async ({ page, context }) => {
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
  await page.reload();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
});
