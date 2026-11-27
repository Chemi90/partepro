import assert from "node:assert/strict";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject, PDFStream } from "pdf-lib";

export async function assertPortableDocument(bytes: Uint8Array) {
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-", "Download must contain PDF bytes.");
  assert.ok(bytes.byteLength < 10 * 1024 * 1024, "A bounded quote must not produce an oversized document.");
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1, "PDF must contain at least one page.");
  assert.equal(document.isEncrypted, false);
  const forbidden = new Set(["/OpenAction", "/AA", "/JS", "/JavaScript", "/Launch", "/EmbeddedFiles"]);
  const visited = new Set<PDFObject>();
  const inspect = (object: PDFObject) => {
    if (visited.has(object)) return;
    visited.add(object);
    if (object instanceof PDFName) assert.ok(!forbidden.has(object.toString()), "PDF must not contain executable actions or attachments.");
    if (object instanceof PDFDict) for (const [key, value] of object.entries()) { inspect(key); inspect(value); }
    if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value);
    if (object instanceof PDFStream) inspect(object.dict);
  };
  for (const [, object] of document.context.enumerateIndirectObjects()) inspect(object);
  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, "Quote pages must use consistent A4 dimensions.");
  }
  return document;
}
