import { NextRequest } from 'next/server';
import { z } from 'zod';
import { workspaceSchema } from '@/lib/domain';
import { json, verifyOrigin, readJson, handleError, HttpError, databaseError } from '@/lib/server/http';
import { requireMember } from '@/lib/server/supabase';
import { syncCalendar } from '@/lib/server/calendar';

export async function POST(request: NextRequest) {
  try {
    verifyOrigin(request);
    const body = await readJson(request, z.object({ jobId: z.uuid() }).strict());
    const { supabase, member } = await requireMember();
    if (member.role === 'technician') throw new HttpError(403, 'Solo coordinación puede sincronizar el calendario.');
    const { data: allowed, error: limitError } = await supabase.rpc('consume_calendar_rate_limit');
    if (limitError) throw databaseError(limitError.code);
    if (!allowed) throw new HttpError(429, 'Espera un minuto antes de volver a sincronizar.');
    const { data, error } = await supabase.rpc('get_workspace');
    if (error) throw databaseError(error.code);
    const workspace = workspaceSchema.parse(data);
    const job = workspace.jobs.find((item) => item.id === body.jobId);
    const serviceRequest = workspace.requests.find((item) => item.id === job?.requestId);
    const customer = workspace.customers.find((item) => item.id === serviceRequest?.customerId);
    if (!job || !serviceRequest || !customer) throw new HttpError(404, 'No se ha encontrado la intervención.');
    return json(await syncCalendar(member.org_id, job, serviceRequest, customer));
  } catch (error) { return handleError(error); }
}
