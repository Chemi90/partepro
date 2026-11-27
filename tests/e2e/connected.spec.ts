import { expect, test } from "@playwright/test";
import { isRemote, loadEvaluationAccess, loadRemoteAccess } from "../support/target";

const access = loadEvaluationAccess();

test.use({ trace: "off" }); // Auth request bodies contain a private test password.

test("sesión Supabase: login, cookie protegida, recarga y logout", async ({ page, context }) => {
  test.skip(!access, "Requiere el seed local de demostración y Supabase activo.");
  await page.goto("/");
  await page.getByTitle("Conectar mi cuenta", { exact: true }).click();
  await page.getByLabel("Correo electrónico", { exact: true }).fill(access!.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(access!.password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Cuenta conectada", { exact: true }).first()).toBeVisible();

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
  await page.reload();
  await expect(page.getByText("Cuenta conectada", { exact: true }).first()).toBeVisible();
  await page.getByTitle("Cerrar sesión", { exact: true }).click();
  await expect(page.getByText("Modo demo", { exact: true })).toBeVisible();
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
});
