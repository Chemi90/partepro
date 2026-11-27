import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { createDemoWorkspace } from "../../src/lib/demo";
import { createQuotePdf, quotePdfDocumentFromWorkspace, quotePdfFilename, type QuotePdfFonts } from "../../src/lib/quote-pdf";
import { assertPortableDocument } from "../support/pdf-assertions";
import { pdfFixture } from "../support/pdf-fixture";

let fonts: QuotePdfFonts;
beforeAll(async () => {
  const [regular, bold] = await Promise.all([readFile("public/fonts/manrope-pdf-regular.ttf"), readFile("public/fonts/manrope-pdf-bold.ttf")]);
  fonts = { regular, bold };
});

describe("presupuesto PDF", () => {
  it("produce un PDF A4 autónomo sin acciones ejecutables usando los precios guardados", async () => {
    const workspace = createDemoWorkspace();
    const quote = workspace.quotes[0];
    const savedPrice = quote.items[0].unitPriceCents;
    workspace.catalog.forEach((item) => { item.priceCents = 9999999; });
    const input = quotePdfDocumentFromWorkspace(workspace, quote.id, "Nexo Mantenimiento", true);
    expect(input.quote.items[0].unitPriceCents).toBe(savedPrice);
    const document = await assertPortableDocument(await createQuotePdf(input, fonts));
    expect(document.getTitle()).toBe(`Presupuesto ${quote.code} - PartePro`);
    expect(document.getSubject()).toContain("datos ficticios");
  });

  it("pagina veinte conceptos y textos máximos sin convertir el HTML en acciones PDF", async () => {
    const document = await assertPortableDocument(await createQuotePdf(pdfFixture(true), fonts));
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(document.getPageCount()).toBeLessThanOrEqual(12);
  });

  it("rechaza importes o relaciones incoherentes y sanea el nombre de descarga", async () => {
    const alteredAmount = pdfFixture();
    alteredAmount.quote.totalCents++;
    await expect(createQuotePdf(alteredAmount, fonts)).rejects.toThrow();
    const alteredCustomer = pdfFixture();
    alteredCustomer.customer.id = "32a8cd83-2bd8-4d27-bb76-40778a12aee4";
    await expect(createQuotePdf(alteredCustomer, fonts)).rejects.toThrow();
    const filename = quotePdfFilename('../../Ávila"\r\n.pdf', true);
    expect(filename).toMatch(/^PartePro-[A-Za-z0-9_-]+-demo\.pdf$/);
    expect(filename).not.toMatch(/[\\/\r\n"]/);
  });
});
