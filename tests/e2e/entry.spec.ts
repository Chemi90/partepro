import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { artifactsDirectory, loadEvaluationAccess } from "../support/target";
import { enterDemo } from "../support/ui";

const configuredAccess = loadEvaluationAccess();

test("visitante empieza en login y elige demo sin identidad personal", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  const email = page.getByLabel("Correo electrónico", { exact: true });
  const password = page.getByLabel("Contraseña", { exact: true });
  await expect(email).toHaveValue("");
  await expect(password).toHaveValue("");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("autocomplete", "username");
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
  await expect(page.getByText("José", { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir(artifactsDirectory, { recursive: true });
  await page.screenshot({ path: `${artifactsDirectory}/login-${testInfo.project.name}.png`, animations: "disabled", fullPage: true });

  await enterDemo(page);
  await expect(page.getByText("Modo demo", { exact: true })).toBeVisible();
  await expect(page.getByText("Invitado · Demo", { exact: true })).toHaveCount(1);
  await expect(page.getByText("José", { exact: false })).toHaveCount(0);
  expect([401, 503]).toContain((await page.request.get("/api/workspace")).status());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
});

test("carga y errores de acceso nunca abren la demo automáticamente", async ({ page }) => {
  test.skip(!configuredAccess, "Requiere una aplicación configurada para verificar los estados de acceso; el login anónimo se prueba por separado.");
  let releaseSession!: () => void;
  const sessionGate = new Promise<void>((resolve) => { releaseSession = resolve; });
  let sessionSeen!: () => void;
  const sessionRequest = new Promise<void>((resolve) => { sessionSeen = resolve; });
  await page.route("**/api/workspace", async (route) => {
    sessionSeen();
    await sessionGate;
    await route.fulfill({ status: 503, json: { error: "No se ha podido completar la operación. Inténtalo de nuevo." } });
  });
  try {
    await page.goto("/");
    await sessionRequest;
    await expect(page.getByText("Comprobando tu sesión…", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toHaveCount(0);
  } finally { releaseSession(); }
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);

  let releaseLogin!: () => void;
  const loginGate = new Promise<void>((resolve) => { releaseLogin = resolve; });
  let loginSeen!: () => void;
  const loginRequest = new Promise<void>((resolve) => { loginSeen = resolve; });
  let attempts = 0;
  await page.route("**/api/auth", async (route) => {
    attempts++;
    loginSeen();
    await loginGate;
    await route.fulfill({ status: 401, json: { error: "No se ha podido iniciar sesión. Comprueba tus credenciales." } });
  });
  const syntheticPassword = "synthetic-invalid-password-123!";
  await page.getByLabel("Correo electrónico", { exact: true }).fill("invalid-fixture@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill(syntheticPassword);
  const submit = page.locator('form button[type="submit"]');
  try {
    await submit.click();
    await loginRequest;
    await expect(submit).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(attempts).toBe(1);
    await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
  } finally { releaseLogin(); }
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No se ha podido iniciar sesión. Revisa tus datos e inténtalo de nuevo.");
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toHaveCount(0);
  const storage = await page.evaluate(() => JSON.stringify([Object.entries(sessionStorage), Object.entries(localStorage)]));
  expect(storage.includes(syntheticPassword)).toBe(false);
});
