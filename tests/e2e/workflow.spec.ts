import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("complementary", { name: "Navegación principal" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("resumen y cinco vistas accesibles sin desbordamiento", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toBeVisible();
  await expect(page.getByText("Modo demo", { exact: true })).toBeVisible();
  await noOverflow(page);
  await mkdir(".local", { recursive: true });
  await page.screenshot({ path: `.local/overview-${testInfo.project.name}.png`, fullPage: true });
  for (const label of ["Solicitudes", "Presupuestos", "Agenda", "Partes de trabajo"]) {
    await navigate(page, label);
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    await noOverflow(page);
  }
  await page.screenshot({ path: `.local/reports-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("recorrido completo de solicitud a parte finalizado con persistencia de pestaña", async ({ page }, testInfo) => {
  const title = `Revisión QA ${testInfo.project.name}`;
  const description = 'Revisar climatización. <img src=x onerror="window.__qaXss=true">';
  const report = "Conexiones comprobadas, filtro sustituido y equipo funcionando correctamente.";
  await page.goto("/");
  await page.getByRole("button", { name: "Nueva solicitud", exact: true }).click();
  await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption({ label: "Comunidad Olivar 24" });
  await page.getByLabel("¿Qué necesita el cliente?", { exact: true }).fill(title);
  await page.getByLabel("Descripción", { exact: true }).fill(description);
  await page.getByRole("combobox", { name: "Prioridad", exact: true }).selectOption("urgent");
  await page.getByRole("button", { name: "Guardar solicitud", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await navigate(page, "Solicitudes");
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, "__qaXss"))).toBe(false);
  await page.getByRole("button", { name: "Preparar presupuesto", exact: true }).click();
  await page.getByLabel("Cantidad 1", { exact: true }).fill("2");
  await expect(page.getByText("108,90", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Guardar presupuesto", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await navigate(page, "Presupuestos");
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
  await page.getByRole("button", { name: "Registrar aceptación", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await navigate(page, "Agenda");
  await page.locator(".pending-row").filter({ hasText: title }).getByRole("button", { name: "Planificar", exact: true }).click();
  await page.getByRole("combobox", { name: "Técnico responsable", exact: true }).selectOption({ label: "Daniel Gil" });
  const scheduled = new Date();
  scheduled.setDate(scheduled.getDate() + 2);
  const day = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}-${String(scheduled.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Fecha y hora", { exact: true }).fill(`${day}T10:00`);
  await page.getByRole("combobox", { name: "Duración estimada", exact: true }).selectOption("60");
  await page.getByRole("button", { name: "Guardar planificación", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await navigate(page, "Partes de trabajo");
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar calendario", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^PAR-\d+\.ics$/);
  expect(await download.failure()).toBeNull();
  await page.getByRole("button", { name: "Finalizar parte", exact: true }).click();
  await page.getByLabel("Trabajo realizado", { exact: true }).fill(report);
  await page.getByRole("button", { name: "Añadir material", exact: true }).click();
  await page.getByRole("combobox", { name: "Material 1", exact: true }).selectOption({ label: "Filtro de aire F7" });
  await page.getByRole("button", { name: "Confirmar y finalizar", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await page.reload();
  await navigate(page, "Partes de trabajo");
  const card = page.getByRole("button").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await expect(card).toContainText("Finalizada");
  await card.click();
  await expect(page.getByText(report, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finalizar parte", exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `.local/completed-${testInfo.project.name}.png`, fullPage: true });
});

test("demo reiniciable y diálogo operable con teclado", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nueva solicitud", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Reiniciar demo", exact: true }).click();
  await page.getByRole("button", { name: "Sí, reiniciar demo", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toBeVisible();
});
