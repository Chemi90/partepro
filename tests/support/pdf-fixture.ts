import { createDemoWorkspace } from "../../src/lib/demo";
import { quotePdfDocumentFromWorkspace, type QuotePdfDocument } from "../../src/lib/quote-pdf";

export function pdfFixture(long = false): QuotePdfDocument {
  const workspace = createDemoWorkspace(new Date("2026-11-27T08:00:00Z"));
  const document = quotePdfDocumentFromWorkspace(workspace, workspace.quotes[0].id, "Nexo Mantenimiento", true);
  if (!long) return document;
  const padded = (text: string, maximum: number) => text.repeat(Math.ceil(maximum / text.length)).slice(0, maximum).trim();
  document.organizationName = padded("MANTENIMIENTOS Y REPARACIONES TÉCNICAS DEL NORTE ", 160);
  document.customer.name = padded("Comunidad de propietarios Castaños y Olivar ", 120);
  document.customer.contact = padded("Ángela Muñoz Núñez, administración técnica ", 120);
  document.customer.address = padded("Calle de la Constitución, número 27, planta ático, edificio rehabilitado, Madrid. ", 240);
  document.request.title = padded("Revisión técnica de climatización, presión y ventilación de áreas comunes ", 120);
  document.request.description = padded('Comprobación de válvulas, termostatos y conexiones. Texto literal: <script>alert("PDF")</script>. ', 2000);
  document.quote.code = "PRE-2026-".padEnd(39, "0") + "1";
  document.quote.createdAt = "2026-11-26T23:30:00Z";
  document.quote.items = Array.from({ length: 20 }, (_, index) => ({
    catalogId: `00000005-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: padded(`Concepto ${String(index + 1).padStart(2, "0")} - revisión técnica, instalación y comprobación de climatización con materiales y garantías. `, 120),
    quantity: index + 1,
    unitPriceCents: 101 + index * 117,
  }));
  document.quote.subtotalCents = document.quote.items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
  document.quote.taxCents = Math.round(document.quote.subtotalCents * 21 / 100);
  document.quote.totalCents = document.quote.subtotalCents + document.quote.taxCents;
  return document;
}
