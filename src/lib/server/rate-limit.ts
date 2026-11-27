import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { HttpError } from './http';

// Only this rate-limiter uses the privileged key. Workspace operations always use caller JWT + RLS.
export async function limitLogin(request: NextRequest, email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'El acceso conectado todavía no está configurado. Puedes explorar la demo.');
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) } });
  // Only Vercel's platform-set header is trusted. Outside Vercel all requests share the conservative server bucket.
  const ip = process.env.VERCEL === '1' ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'shared') : 'shared';
  const hash = (value: string) => createHmac('sha256', key).update(value).digest('hex');
  const { data, error } = await client.rpc('consume_auth_rate_limit', { p_ip: hash(`ip:${ip}`), p_identity: hash(`email:${email.toLowerCase()}`) });
  if (error) throw new HttpError(503, 'El acceso no está disponible temporalmente.');
  if (data !== true) throw new HttpError(429, 'Demasiados intentos. Espera quince minutos antes de volver a intentarlo.');
}
