import 'server-only';
import { createSign } from 'node:crypto';
import { z } from 'zod';
import type { Job, ServiceRequest, Customer } from '@/lib/domain';
import { HttpError } from './http';

export function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.CALENDAR_ORGANIZATION_ID);
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) throw new HttpError(503, 'Google Calendar no está conectado. Puedes exportar la cita.');
  const now = Math.floor(Date.now() / 1000);
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encoded({ alg: 'RS256', typ: 'JWT' })}.${encoded({ iss: email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
  });
  if (!response.ok) throw new HttpError(502, 'No se ha podido autorizar el calendario.');
  const token = z.object({ access_token: z.string().min(1) }).safeParse(await response.json());
  if (!token.success) throw new HttpError(502, 'La conexión con el calendario no está disponible.');
  return token.data.access_token;
}

export async function syncCalendar(orgId: string, job: Job, request: ServiceRequest, customer: Customer) {
  if (!calendarConfigured()) throw new HttpError(503, 'Google Calendar no está conectado. Puedes exportar la cita.');
  // This demo connector is deliberately bound to one organization and a dedicated calendar.
  if (orgId !== process.env.CALENDAR_ORGANIZATION_ID) throw new HttpError(403, 'Tu empresa no tiene un calendario conectado.');
  if (!job.startAt || job.status !== 'scheduled') throw new HttpError(409, 'Primero planifica la intervención.');
  const token = await getAccessToken();
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)}/events`;
  // UUID hexadecimal characters are permitted by Google's base32hex event ID format.
  const eventId = `partepro${job.id.replaceAll('-', '')}`;
  const event = {
    summary: `${job.code} · ${request.title}`, location: customer.address,
    description: `PartePro · ${customer.name}\n${request.description}`,
    start: { dateTime: job.startAt, timeZone: 'Europe/Madrid' },
    end: { dateTime: new Date(new Date(job.startAt).getTime() + job.durationMinutes * 60_000).toISOString(), timeZone: 'Europe/Madrid' },
  };
  const options = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' as const, redirect: 'error' as const };
  let response = await fetch(`${base}/${eventId}?sendUpdates=none`, { ...options, method: 'PUT', body: JSON.stringify(event), signal: AbortSignal.timeout(8000) });
  if (response.status === 404) {
    response = await fetch(`${base}?sendUpdates=none`, { ...options, method: 'POST', body: JSON.stringify({ ...event, id: eventId }), signal: AbortSignal.timeout(8000) });
    // A concurrent create can win. Update the same deterministic event, never create a duplicate.
    if (response.status === 409) response = await fetch(`${base}/${eventId}?sendUpdates=none`, { ...options, method: 'PUT', body: JSON.stringify(event), signal: AbortSignal.timeout(8000) });
  }
  if (!response.ok) throw new HttpError(502, 'El calendario no ha confirmado la sincronización. Inténtalo de nuevo.');
  return { ok: true, message: 'Cita sincronizada con Google Calendar.' };
}
