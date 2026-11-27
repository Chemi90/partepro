import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { workspaceSchema } from "@/lib/domain";
import {
  createQuotePdf,
  quotePdfDocumentFromWorkspace,
  quotePdfFilename,
} from "@/lib/quote-pdf";
import { requireMember } from "@/lib/server/supabase";
import { databaseError, handleError, HttpError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, member } = await requireMember();
    const parsedId = z
      .string()
      .uuid()
      .safeParse((await params).id);
    if (!parsedId.success)
      throw new HttpError(
        400,
        "El identificador del presupuesto no es válido.",
      );
    const { data: allowed, error: rateError } = await supabase.rpc(
      "consume_pdf_rate_limit",
    );
    if (rateError) throw databaseError(rateError.code);
    if (allowed !== true)
      throw new HttpError(
        429,
        "Demasiadas descargas. Espera un minuto antes de volver a intentarlo.",
      );
    const [{ data, error }, { data: organization, error: organizationError }] =
      await Promise.all([
        supabase.rpc("get_workspace"),
        supabase
          .from("organizations")
          .select("name")
          .eq("id", member.org_id)
          .single(),
      ]);
    if (error) throw databaseError(error.code);
    if (organizationError || !organization)
      throw new HttpError(503, "No se ha podido preparar el presupuesto.");
    const workspace = workspaceSchema.parse(data);
    if (!workspace.quotes.some((quote) => quote.id === parsedId.data))
      throw new HttpError(404, "No se ha encontrado el presupuesto.");
    const document = quotePdfDocumentFromWorkspace(
      workspace,
      parsedId.data,
      organization.name,
      false,
    );
    const [regular, bold] = await Promise.all([
      readFile(join(process.cwd(), "public/fonts/manrope-pdf-regular.ttf")),
      readFile(join(process.cwd(), "public/fonts/manrope-pdf-bold.ttf")),
    ]);
    const bytes = await createQuotePdf(document, { regular, bold });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quotePdfFilename(document.quote.code, false)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
