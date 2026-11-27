"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { Workspace } from "@/lib/domain";

export default function QuotePdfDownload({
  workspace,
  quoteId,
  mode,
}: {
  workspace: Workspace;
  quoteId: string;
  mode: "demo" | "connected";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const download = async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    setReady(false);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 20_000);
    let failureMessage =
      "No se ha podido descargar el PDF. Vuelve a intentarlo.";
    try {
      let blob: Blob;
      let filename = "PartePro-presupuesto.pdf";
      if (mode === "connected") {
        const response = await fetch(
          `/api/quotes/${encodeURIComponent(quoteId)}/pdf`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: abort.signal,
          },
        );
        if (response.status === 429)
          failureMessage =
            "Has alcanzado el límite de descargas. Espera un minuto.";
        if (response.status === 401)
          failureMessage =
            "Tu sesión ha caducado. Inicia sesión de nuevo para descargar el PDF.";
        if (
          !response.ok ||
          response.headers.get("Content-Type")?.split(";")[0] !==
            "application/pdf"
        )
          throw new Error("PDF unavailable");
        const safeName = response.headers
          .get("Content-Disposition")
          ?.match(
            /^attachment;\s*filename="([A-Za-z0-9_.-]{1,100}\.pdf)"$/i,
          )?.[1];
        if (safeName) filename = safeName;
        blob = await response.blob();
      } else {
        const {
          createQuotePdf,
          quotePdfDocumentFromWorkspace,
          quotePdfFilename,
          QUOTE_PDF_FONTS,
        } = await import("@/lib/quote-pdf");
        const [regular, bold] = await Promise.all(
          Object.values(QUOTE_PDF_FONTS).map(async (path) => {
            const response = await fetch(path, {
              signal: abort.signal,
              credentials: "same-origin",
            });
            if (!response.ok) throw new Error("Font unavailable");
            return response.arrayBuffer();
          }),
        );
        const document = quotePdfDocumentFromWorkspace(
          workspace,
          quoteId,
          "Nexo Mantenimiento · Demostración",
          true,
        );
        const bytes = await createQuotePdf(document, { regular, bold });
        blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
        filename = quotePdfFilename(document.quote.code, true);
      }
      if (!mounted.current) return;
      if (abort.signal.aborted) throw new Error("PDF timed out");
      if (blob.size > 10_000_000 || (await blob.slice(0, 5).text()) !== "%PDF-")
        throw new Error("Invalid PDF");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      setReady(true);
    } catch {
      if (mounted.current) setError(failureMessage);
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <div className="pdf-download">
      <button
        type="button"
        className="button button-secondary"
        onClick={() => void download()}
        disabled={loading}
        aria-busy={loading}
      >
        <Download size={17} />
        {loading ? "Generando PDF…" : "Descargar PDF"}
      </button>
      {error && (
        <p className="pdf-download-error" role="alert">
          {error}
        </p>
      )}
      {ready && (
        <span className="sr-only" role="status">
          PDF preparado para descargar.
        </span>
      )}
    </div>
  );
}
