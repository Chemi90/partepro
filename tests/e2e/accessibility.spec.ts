import { expect, test, type Locator } from "@playwright/test";
import { openDemo } from "../support/ui";

async function contrast(locator: Locator) {
  await locator.evaluate(async (element) => {
    const animations = [];
    for (let node: Element | null = element; node; node = node.parentElement) animations.push(...node.getAnimations());
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  });
  return locator.evaluate((element) => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const match = value.match(/^rgba?\(([^)]+)\)$/);
      if (!match) throw new Error(`Color format not handled by audit: ${value}`);
      const values = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return [values[0], values[1], values[2], values[3] ?? 1];
    };
    const over = (foreground: Color, background: Color): Color => [
      foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
      foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
      foreground[2] * foreground[3] + background[2] * (1 - foreground[3]), 1,
    ];
    const chain: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);
    let background: Color = [255, 255, 255, 1];
    for (const node of chain) background = over(parse(getComputedStyle(node).backgroundColor), background);
    const style = getComputedStyle(element);
    const foreground = over(parse(style.color), background);
    const luminance = (color: Color) => color.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    const fontSize = Number.parseFloat(style.fontSize);
    const large = fontSize >= 24 || (fontSize >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700);
    return {
      text: element.textContent?.trim().slice(0, 70),
      ratio: (light + 0.05) / (dark + 0.05),
      minimum: large ? 3 : 4.5,
      fontSize,
      color: style.color,
      background,
    };
  });
}

test("controles y etiquetas principales conservan contraste legible", async ({ page }) => {
  await openDemo(page);
  const create = page.getByRole("button", { name: "Nueva solicitud", exact: true });
  await expect(create).toBeVisible();
  const primaryContrast = await contrast(create);
  expect(primaryContrast.ratio, JSON.stringify(primaryContrast)).toBeGreaterThanOrEqual(primaryContrast.minimum);
  await create.click();
  const dialog = page.getByRole("dialog", { name: "Nueva solicitud", exact: true });
  await expect(dialog).toBeVisible();
  for (const label of await dialog.locator(".form-body > label").all()) {
    const result = await contrast(label);
    expect(result.ratio, JSON.stringify(result)).toBeGreaterThanOrEqual(result.minimum);
    expect(result.fontSize).toBeGreaterThanOrEqual(14);
  }
  for (const name of ["Cancelar", "Guardar solicitud"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    const result = await contrast(button);
    expect(result.ratio, JSON.stringify(result)).toBeGreaterThanOrEqual(result.minimum);
    const bounds = await button.evaluate((element) => {
      const buttonRect = element.getBoundingClientRect();
      const dialogRect = element.closest("dialog")!.getBoundingClientRect();
      return { top: buttonRect.top, bottom: buttonRect.bottom, dialogTop: dialogRect.top, dialogBottom: dialogRect.bottom, viewportHeight: window.innerHeight };
    });
    expect(bounds.top, `${name}: ${JSON.stringify(bounds)}`).toBeGreaterThanOrEqual(bounds.dialogTop);
    expect(bounds.bottom, `${name}: ${JSON.stringify(bounds)}`).toBeLessThanOrEqual(Math.min(bounds.dialogBottom, bounds.viewportHeight) - 1);
  }
  await page.keyboard.press("Escape");

  const audit = async (selector: string) => {
    for (const locator of await page.locator(selector).all()) {
      if (!(await locator.isVisible())) continue;
      const result = await contrast(locator);
      expect.soft(result.ratio, `${selector}: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(result.minimum);
    }
  };
  for (const view of ["Resumen", "Solicitudes", "Presupuestos", "Agenda", "Partes de trabajo"]) {
    const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
    if (await menu.isVisible()) await menu.click();
    await audit(".nav-item, .nav-count");
    await page.getByRole("complementary", { name: "Navegación principal" }).getByRole("button", { name: new RegExp(`^${view}`) }).click();
    await page.mouse.move(0, 0);
    await audit(".status, .priority, .count-badge, .technician-badge, .tabs button, .tabs button span");
    // Cover each filter at rest and while hovered. A selected counter must remain
    // legible even when its parent button changes its background on hover.
    for (const tab of await page.locator(".tabs button").all()) {
      await tab.click();
      await page.mouse.move(0, 0);
      await audit(".status, .tabs button, .tabs button span");
      await tab.hover();
      await audit(".tabs button.selected, .tabs button.selected span");
    }
  }
});

test("Tab mantiene el foco visible y el diálogo lo contiene", async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole("heading", { name: "Todo bajo control." })).toBeVisible();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const box = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      return { text: active.getAttribute("aria-label") ?? active.textContent?.trim().slice(0, 60), left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: window.innerWidth, height: window.innerHeight, outline: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    expect(focus).not.toBeNull();
    expect(focus!.left, JSON.stringify(focus)).toBeGreaterThanOrEqual(-1);
    expect(focus!.right, JSON.stringify(focus)).toBeLessThanOrEqual(focus!.width + 1);
    expect(focus!.top, JSON.stringify(focus)).toBeGreaterThanOrEqual(-1);
    expect(focus!.bottom, JSON.stringify(focus)).toBeLessThanOrEqual(focus!.height + 1);
    expect(focus!.outline).not.toBe("none");
    expect(focus!.outlineWidth).toBeGreaterThanOrEqual(2);
  }
  await page.getByRole("button", { name: "Nueva solicitud", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const visited = new Set<string>();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({
      documentFocused: document.hasFocus(),
      inDialog: Boolean(document.activeElement?.closest("dialog")),
      control: document.activeElement?.getAttribute("name") ?? document.activeElement?.getAttribute("aria-label") ?? (document.activeElement?.tagName === "BUTTON" ? document.activeElement.textContent?.trim() : null),
    }));
    // Native dialogs allow Tab to move to browser chrome. The page itself must
    // never move focus onto its inert background controls while the modal is open.
    if (focus.documentFocused) expect(focus.inDialog, JSON.stringify(focus)).toBe(true);
    if (focus.inDialog && focus.control) visited.add(focus.control);
  }
  for (const name of ["customerId", "title", "description", "priority", "Cancelar", "Guardar solicitud", "Cerrar diálogo"]) expect(visited.has(name), `Control not visited: ${name}`).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva solicitud", exact: true })).toBeFocused();
});
