import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { z } from "zod";
import { workspaceSchema, type Workspace } from "./domain";

export const QUOTE_PDF_FONTS = {
  regular: "/fonts/manrope-pdf-regular.ttf",
  bold: "/fonts/manrope-pdf-bold.ttf",
} as const;

export const quotePdfDocumentSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(160),
    demo: z.boolean(),
    quote: workspaceSchema.shape.quotes.element,
    customer: workspaceSchema.shape.customers.element,
    request: workspaceSchema.shape.requests.element,
  })
  .strict()
  .superRefine((document, context) => {
    const { quote, request, customer } = document;
    const subtotal = quote.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0,
    );
    if (
      quote.requestId !== request.id ||
      request.customerId !== customer.id ||
      !quote.items.length ||
      !Number.isSafeInteger(subtotal) ||
      subtotal !== quote.subtotalCents ||
      quote.taxCents !== Math.round((subtotal * 21) / 100) ||
      quote.totalCents !== subtotal + quote.taxCents ||
      quote.totalCents > 100000000
    ) {
      context.addIssue({
        code: "custom",
        message: "El presupuesto no tiene datos o importes coherentes.",
      });
    }
  });

export type QuotePdfDocument = z.infer<typeof quotePdfDocumentSchema>;
export type QuotePdfFonts = {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
};

export function quotePdfFilename(code: string, demo: boolean): string {
  const safeCode =
    code
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .slice(0, 50) || "presupuesto";
  return `PartePro-${safeCode}${demo ? "-demo" : ""}.pdf`;
}

export function quotePdfDocumentFromWorkspace(
  workspace: Workspace,
  quoteId: string,
  organizationName: string,
  demo: boolean,
): QuotePdfDocument {
  const quote = workspace.quotes.find((item) => item.id === quoteId);
  const request = workspace.requests.find(
    (item) => item.id === quote?.requestId,
  );
  const customer = workspace.customers.find(
    (item) => item.id === request?.customerId,
  );
  return quotePdfDocumentSchema.parse({
    organizationName,
    demo,
    quote,
    request,
    customer,
  });
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = 78;
const INK = rgb(11 / 255, 11 / 255, 12 / 255);
const PAPER = rgb(247 / 255, 246 / 255, 243 / 255);
const BRAND = rgb(27 / 255, 59 / 255, 1);
const MUTED = rgb(93 / 255, 93 / 255, 89 / 255);
const LINE = rgb(0.82, 0.82, 0.8);
const WHITE = rgb(1, 1, 1);
const currency = (cents: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");

/** Build a self-contained PDF from the saved quote snapshot, never current catalogue prices. */
export async function createQuotePdf(
  input: QuotePdfDocument,
  fonts: QuotePdfFonts,
): Promise<Uint8Array> {
  const document = quotePdfDocumentSchema.parse(input);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(fonts.regular, { subset: true }),
    pdf.embedFont(fonts.bold, { subset: true }),
  ]);
  pdf.setTitle(`Presupuesto ${document.quote.code} - PartePro`);
  pdf.setAuthor(document.organizationName);
  pdf.setSubject(
    document.demo
      ? "Presupuesto de demostración con datos ficticios"
      : "Presupuesto de servicio",
  );
  pdf.setCreator("PartePro");
  pdf.setProducer("PartePro / pdf-lib");
  pdf.setCreationDate(new Date(document.quote.createdAt));
  pdf.setModificationDate(new Date(document.quote.createdAt));

  const characters = new Set(
    regular
      .getCharacterSet()
      .filter((character) => bold.getCharacterSet().includes(character)),
  );
  let escapedCharacters = false;
  const safeText = (value: string) =>
    Array.from(
      value
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/[\u2010-\u2015]/g, "-")
        .replace(/\u00a0/g, " "),
    )
      .map((character) => {
        if (character === "\n" || characters.has(character.codePointAt(0)!))
          return character;
        escapedCharacters = true;
        return `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`;
      })
      .join("");

  const wrap = (
    value: string,
    font: PDFFont,
    size: number,
    width: number,
  ): string[] => {
    const output: string[] = [];
    for (const paragraph of safeText(value).split("\n")) {
      if (!paragraph.trim()) {
        output.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.trim().split(/\s+/u)) {
        const joined = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(joined, size) <= width) {
          line = joined;
          continue;
        }
        if (line) {
          output.push(line);
          line = "";
        }
        for (const character of Array.from(word)) {
          if (line && font.widthOfTextAtSize(line + character, size) > width) {
            output.push(line);
            line = "";
          }
          line += character;
        }
      }
      if (line) output.push(line);
    }
    return output;
  };

  const date = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(document.quote.createdAt));
  let page!: PDFPage;
  let y = 0;
  const draw = (
    value: string,
    x: number,
    baseline: number,
    size = 10,
    font: PDFFont = regular,
    color: RGB = INK,
  ) => page.drawText(safeText(value), { x, y: baseline, font, size, color });
  const right = (
    value: string,
    x: number,
    baseline: number,
    size = 10,
    font: PDFFont = regular,
    color: RGB = INK,
  ) => {
    const text = safeText(value);
    draw(
      text,
      x - font.widthOfTextAtSize(text, size),
      baseline,
      size,
      font,
      color,
    );
  };
  const line = (baseline: number) =>
    page.drawLine({
      start: { x: MARGIN, y: baseline },
      end: { x: PAGE_WIDTH - MARGIN, y: baseline },
      thickness: 0.6,
      color: LINE,
    });
  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: PAPER,
    });
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - 69,
      width: 24,
      height: 24,
      color: BRAND,
    });
    draw("P", MARGIN + 6, PAGE_HEIGHT - 63, 17, bold, WHITE);
    draw("PARTEPRO.", MARGIN + 33, PAGE_HEIGHT - 63, 17, bold);
    const organizationLines = wrap(document.organizationName, regular, 9, 210);
    organizationLines.forEach((text, index) =>
      right(
        text,
        PAGE_WIDTH - MARGIN,
        PAGE_HEIGHT - 49 - index * 12,
        9,
        regular,
        MUTED,
      ),
    );
    const headerBottom = Math.min(
      PAGE_HEIGHT - 88,
      PAGE_HEIGHT - 67 - (organizationLines.length - 1) * 12,
    );
    line(headerBottom);
    if (pdf.getPageCount() === 1) {
      draw("PRESUPUESTO", MARGIN, headerBottom - 47, 29, bold);
      draw(`Fecha: ${date}`, MARGIN, headerBottom - 69, 10, regular, MUTED);
      const codeLines = wrap(document.quote.code, bold, 11, 195);
      codeLines.forEach((text, index) =>
        right(
          text,
          PAGE_WIDTH - MARGIN,
          headerBottom - 34 - index * 14,
          11,
          bold,
          BRAND,
        ),
      );
      const statusY = Math.min(
        headerBottom - 69,
        headerBottom - 54 - (codeLines.length - 1) * 14,
      );
      right(
        document.quote.status === "accepted"
          ? "Aceptado"
          : "Pendiente de aceptación",
        PAGE_WIDTH - MARGIN,
        statusY,
        9,
        regular,
        MUTED,
      );
      y = statusY - 30;
    } else {
      draw("PRESUPUESTO / CONTINUACIÓN", MARGIN, headerBottom - 25, 10, bold);
      const codeLines = wrap(document.quote.code, bold, 9, 210);
      codeLines.forEach((text, index) =>
        right(
          text,
          PAGE_WIDTH - MARGIN,
          headerBottom - 25 - index * 12,
          9,
          bold,
          BRAND,
        ),
      );
      y = headerBottom - 55 - (codeLines.length - 1) * 12;
    }
    if (document.demo) {
      page.drawRectangle({
        x: MARGIN,
        y: y - 17,
        width: CONTENT_WIDTH,
        height: 25,
        color: rgb(0.92, 0.93, 1),
      });
      draw("DEMO · DATOS FICTICIOS", MARGIN + 10, y - 9, 9, bold, BRAND);
      y -= 39;
    }
  };
  const ensureSpace = (height: number) => {
    if (y - height < BOTTOM) addPage();
  };
  const paragraph = (
    text: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: RGB;
      spacing?: number;
      width?: number;
      x?: number;
    } = {},
  ) => {
    const size = options.size ?? 10.5,
      font = options.font ?? regular;
    const spacing = options.spacing ?? size * 1.5;
    for (const textLine of wrap(
      text,
      font,
      size,
      options.width ?? CONTENT_WIDTH,
    )) {
      ensureSpace(spacing);
      draw(textLine, options.x ?? MARGIN, y, size, font, options.color ?? INK);
      y -= spacing;
    }
  };
  const section = (label: string, minimumFollowingHeight = 35) => {
    const labels = wrap(label, bold, 9, CONTENT_WIDTH);
    ensureSpace(labels.length * 14 + 10 + minimumFollowingHeight);
    labels.forEach((text, index) =>
      draw(text, MARGIN, y - index * 14, 9, bold, BRAND),
    );
    y -= labels.length * 14 + 9;
  };

  addPage();
  section("CLIENTE");
  paragraph(document.customer.name, { size: 14, font: bold, spacing: 21 });
  paragraph(`Contacto: ${document.customer.contact}`, { color: MUTED });
  if (document.customer.address)
    paragraph(document.customer.address, { color: MUTED });
  paragraph(document.customer.email, { color: MUTED });
  if (document.customer.phone)
    paragraph(document.customer.phone, { color: MUTED });
  y -= 16;
  section(`SOLICITUD · ${document.request.code}`);
  paragraph(document.request.title, { size: 13, font: bold, spacing: 19 });
  paragraph(document.request.description, { color: MUTED });
  y -= 21;

  const quantityRight = MARGIN + 303;
  const unitRight = MARGIN + 405;
  const totalRight = PAGE_WIDTH - MARGIN - 10;
  const tableHeader = () => {
    ensureSpace(62);
    page.drawRectangle({
      x: MARGIN,
      y: y - 24,
      width: CONTENT_WIDTH,
      height: 31,
      color: INK,
    });
    draw("CONCEPTO", MARGIN + 10, y - 12, 8, bold, WHITE);
    right("UD.", quantityRight, y - 12, 8, bold, WHITE);
    right("PRECIO / UD.", unitRight, y - 12, 8, bold, WHITE);
    right("IMPORTE", totalRight, y - 12, 8, bold, WHITE);
    y -= 43;
  };
  tableHeader();
  for (const item of document.quote.items) {
    const lines = wrap(item.name, regular, 10, 258);
    const rowHeight = Math.max(36, lines.length * 15 + 17);
    if (y - rowHeight < BOTTOM) {
      addPage();
      tableHeader();
    }
    lines.forEach((text, index) => draw(text, MARGIN + 10, y - index * 15, 10));
    right(String(item.quantity), quantityRight, y, 10);
    right(currency(item.unitPriceCents), unitRight, y, 10);
    right(
      currency(item.quantity * item.unitPriceCents),
      totalRight,
      y,
      10,
      bold,
    );
    y -= rowHeight;
    line(y + 12);
  }
  y -= 12;
  ensureSpace(164);
  right("Base imponible", MARGIN + 350, y, 10, regular, MUTED);
  right(currency(document.quote.subtotalCents), totalRight, y, 11);
  y -= 24;
  right("IVA (21 %)", MARGIN + 350, y, 10, regular, MUTED);
  right(currency(document.quote.taxCents), totalRight, y, 11);
  y -= 16;
  page.drawRectangle({
    x: MARGIN + 222,
    y: y - 41,
    width: CONTENT_WIDTH - 222,
    height: 43,
    color: BRAND,
  });
  draw("TOTAL", MARGIN + 236, y - 25, 10, bold, WHITE);
  right(
    currency(document.quote.totalCents),
    totalRight,
    y - 26,
    17,
    bold,
    WHITE,
  );
  y -= 77;
  ensureSpace(47);
  paragraph("No constituye una factura.", {
    size: 9,
    font: bold,
    color: MUTED,
  });
  paragraph(
    document.demo
      ? "Documento de demostración. Todos los datos son ficticios."
      : "Presupuesto emitido con los conceptos e importes guardados en PartePro.",
    { size: 9, color: MUTED },
  );
  if (escapedCharacters)
    paragraph(
      "Los caracteres fuera de la fuente se identifican con su código Unicode [U+...].",
      { size: 8, color: MUTED },
    );

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    page = current;
    line(55);
    wrap(`PartePro · ${document.quote.code}`, regular, 8, 365).forEach(
      (text, lineIndex) =>
        draw(text, MARGIN, 36 - lineIndex * 10, 8, regular, MUTED),
    );
    right(
      `Página ${index + 1} de ${pages.length}`,
      PAGE_WIDTH - MARGIN,
      36,
      8,
      regular,
      MUTED,
    );
  });
  return pdf.save();
}
