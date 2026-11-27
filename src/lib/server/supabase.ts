import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { HttpError, databaseError } from './http';

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new HttpError(503, 'El acceso conectado todavía no está configurado. Puedes explorar la demo.');
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: new URL(process.env.APP_ORIGIN || url).protocol === 'https:', path: '/' },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { for (const { name, value, options } of values) cookieStore.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: new URL(process.env.APP_ORIGIN || url).protocol === 'https:' }); },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000), cache: 'no-store' }) },
  });
}

export async function requireMember() {
  const supabase = await serverSupabase();
  // getUser validates at the Auth service, rather than trusting client-provided session data.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new HttpError(401, 'Inicia sesión para acceder a tu empresa.');
  const { data: member, error } = await supabase.from('memberships').select('org_id,role,technician_id').eq('user_id', user.id).single();
  if (error || !member) throw new HttpError(403, 'Esta cuenta no tiene acceso a una empresa.');
  if (!['owner','dispatcher','technician'].includes(member.role)) throw databaseError('42501');
  return { supabase, user, member: member as { org_id: string; role: 'owner' | 'dispatcher' | 'technician'; technician_id: string | null } };
}
