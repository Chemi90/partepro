import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
}

export function verifyOrigin(request: NextRequest) {
  const configured = process.env.APP_ORIGIN;
  const expected = configured || (process.env.NODE_ENV !== 'production' ? request.nextUrl.origin : null);
  if (!expected) throw new HttpError(503, 'El servicio necesita completar su configuración.');
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (!origin || origin !== new URL(expected).origin || (site && !['same-origin', 'none'].includes(site))) {
    throw new HttpError(403, 'Origen de la solicitud no permitido.');
  }
}

export async function readJson<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Se requiere contenido JSON.');
  }
  if (Number(request.headers.get('content-length') || 0) > 16_384) throw new HttpError(413, 'La solicitud es demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Faltan los datos de la solicitud.');
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); throw new HttpError(413, 'La solicitud es demasiado grande.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'JSON no válido.'); }
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, 'Revisa los campos: hay datos incompletos o no válidos.');
  return result.data;
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // No request body, upstream error, stack or credentials are logged.
  console.error('PartePro: unexpected server failure', { incident: crypto.randomUUID() });
  return json({ error: 'No se ha podido completar la operación. Inténtalo de nuevo.' }, 500);
}

export function databaseError(code: string | undefined) {
  if (code === '42501') return new HttpError(403, 'No tienes permisos para esta operación.');
  if (code === 'P0002') return new HttpError(404, 'No se ha encontrado el registro.');
  if (code === 'P0429') return new HttpError(429, 'Demasiadas solicitudes. Espera un minuto.');
  if (['23505','23P01','40001','P0001'].includes(code || '')) return new HttpError(409, 'La operación entra en conflicto con el estado actual. Actualiza los datos y revisa la agenda.');
  if (['22023','22P02','23514','22003','22007'].includes(code || '')) return new HttpError(400, 'Los datos enviados no son válidos.');
  return new HttpError(503, 'El servicio de datos no está disponible.');
}
