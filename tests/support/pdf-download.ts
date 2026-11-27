import { expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertPortableDocument } from "./pdf-assertions";

export async function downloadQuotePdf(page: Page, path: string, demo: boolean) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF", exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(demo ? /^PartePro-[A-Za-z0-9_-]+-demo\.pdf$/ : /^PartePro-[A-Za-z0-9_-]+\.pdf$/);
  if (!demo) expect(download.suggestedFilename()).not.toContain("-demo.pdf");
  await mkdir(dirname(path), { recursive: true });
  await download.saveAs(path);
  const document = await assertPortableDocument(await readFile(path));
  expect(document.getTitle()).toMatch(/^Presupuesto /);
  if (demo) expect(document.getSubject()).toContain("datos ficticios");
  else expect(document.getSubject()).toBe("Presupuesto de servicio");
  return document;
}
