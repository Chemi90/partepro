import { expect, type Page } from "@playwright/test";

export async function enterDemo(page: Page) {
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Explorar demo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Todo bajo control.", exact: true })).toBeVisible();
}

export async function openDemo(page: Page) {
  await page.goto("/");
  await enterDemo(page);
}
