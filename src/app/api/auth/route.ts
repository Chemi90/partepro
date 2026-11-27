import { NextRequest } from 'next/server';
import { z } from 'zod';
import { json, verifyOrigin, readJson, handleError, HttpError } from '@/lib/server/http';
import { serverSupabase } from '@/lib/server/supabase';
import { limitLogin } from '@/lib/server/rate-limit';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), email: z.email().max(254), password: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
]);

export async function POST(request: NextRequest) {
  try {
    verifyOrigin(request);
    const body = await readJson(request, schema);
    const supabase = await serverSupabase();
    if (body.action === 'logout') {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw new HttpError(503, 'No se ha podido cerrar la sesión.');
      return json({ ok: true });
    }
    await limitLogin(request, body.email);
    const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error) throw new HttpError(401, 'No se ha podido iniciar sesión. Comprueba tus credenciales.');
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
