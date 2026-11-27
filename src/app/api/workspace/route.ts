import { NextRequest } from 'next/server';
import { actionSchema, workspaceSchema } from '@/lib/domain';
import { requireMember } from '@/lib/server/supabase';
import { json, verifyOrigin, readJson, handleError, databaseError } from '@/lib/server/http';

export async function GET() {
  try {
    const { supabase, user, member } = await requireMember();
    const { data, error } = await supabase.rpc('get_workspace');
    if (error) throw databaseError(error.code);
    const workspace = workspaceSchema.parse(data);
    return json({ workspace, role: member.role, technicianId: member.technician_id, user: { email: user.email } });
  } catch (error) { return handleError(error); }
}

export async function POST(request: NextRequest) {
  try {
    verifyOrigin(request);
    const action = await readJson(request, actionSchema);
    const { supabase } = await requireMember();
    const { data: result, error } = await supabase.rpc('apply_workspace_action', { p_action: action });
    if (error) throw databaseError(error.code);
    if (result?.error === true) throw databaseError(typeof result.code === 'string' ? result.code : undefined);
    const { data, error: readError } = await supabase.rpc('get_workspace');
    if (readError) throw databaseError(readError.code);
    return json({ workspace: workspaceSchema.parse(data) });
  } catch (error) { return handleError(error); }
}
