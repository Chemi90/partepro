import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const accessPath = ".local/demo-access.json";
const access = existsSync(accessPath)
  ? z.object({ email: z.string().email(), password: z.string().min(12) }).parse(JSON.parse(readFileSync(accessPath, "utf8")))
  : null;

test.use({ trace: "off" }); // Auth request bodies contain a local test password.

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
    if (page.url().startsWith("https:")) expect(flags.secure).toBe(true);
  }

  const authorized = await page.request.get("/api/workspace");
  expect(authorized.status()).toBe(200);
  const data: unknown = await authorized.json();
  expect(data).toHaveProperty("workspace");
  await page.reload();
  await expect(page.getByText("Cuenta conectada", { exact: true }).first()).toBeVisible();
  await page.getByTitle("Cerrar sesión", { exact: true }).click();
  await expect(page.getByText("Modo demo", { exact: true })).toBeVisible();
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
});
