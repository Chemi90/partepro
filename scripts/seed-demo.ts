import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createDemoWorkspace } from '../src/lib/demo';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error('Configura .env.local primero.');
if (!['localhost','127.0.0.1'].includes(new URL(url).hostname) && process.env.ALLOW_REMOTE_DEMO_SEED !== 'true') {
  throw new Error('Para un proyecto remoto dedicado a esta demo, configura ALLOW_REMOTE_DEMO_SEED=true.');
}
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const orgId = '00000000-0000-4000-8000-000000000001';
const email = process.env.DEMO_EMAIL || 'evaluador@partepro.example';
const password = randomBytes(24).toString('base64url');
const { data: users, error: usersError } = await client.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw new Error('No se ha podido consultar Auth.');
let userId = users.users.find((user) => user.email === email)?.id;
let created = false;
if (!userId) {
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error('No se ha podido crear el usuario de demostración.');
  userId = data.user.id; created = true;
  await mkdir('.local', { recursive: true });
  await writeFile('.local/demo-access.json', JSON.stringify({ email, password, note: 'Solo datos ficticios. No publicar este archivo.' }, null, 2), { mode: 0o600 });
}
const { data: membership, error: membershipError } = await client.from('memberships').select('org_id').eq('user_id', userId).maybeSingle();
if (membershipError) throw new Error('Aplica las migraciones antes de cargar la demo.');
if (membership) {
  if (membership.org_id !== orgId) throw new Error('La cuenta ya pertenece a otra organización. No se ha modificado.');
  console.log('La demo ya está preparada. Se conservan los datos y la contraseña existentes.');
  process.exit(0);
}
const state = createDemoWorkspace();
async function insert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, { ignoreDuplicates: true });
  if (error) throw new Error(`No se ha podido preparar ${table}. Revisa las migraciones y los permisos de administración.`);
}
await insert('organizations', [{ id: orgId, name: 'Clima Norte · Demostración' }]);
await insert('customers', state.customers.map((c) => ({ ...c, org_id: orgId })));
await insert('technicians', state.technicians.map((t) => ({ ...t, org_id: orgId })));
await insert('catalog', state.catalog.map(({ priceCents, ...c }) => ({ ...c, org_id: orgId, price_cents: priceCents })));
await insert('requests', state.requests.map(({ customerId, createdAt, ...r }) => ({ ...r, org_id: orgId, customer_id: customerId, created_at: createdAt })));
await insert('quotes', state.quotes.map(({ requestId, createdAt, subtotalCents, taxCents, totalCents, items: _items, ...q }) => ({ ...q, org_id: orgId, request_id: requestId, created_at: createdAt, subtotal_cents: subtotalCents, tax_cents: taxCents, total_cents: totalCents })));
await insert('quote_items', state.quotes.flatMap((q) => q.items.map((i) => ({ org_id: orgId, quote_id: q.id, catalog_id: i.catalogId, quantity: i.quantity, unit_price_cents: i.unitPriceCents, name: i.name }))));
await insert('jobs', state.jobs.map(({ requestId, quoteId, technicianId, startAt, durationMinutes, completedAt, materials: _materials, ...j }) => ({ ...j, org_id: orgId, request_id: requestId, quote_id: quoteId, technician_id: technicianId, start_at: startAt, duration_minutes: durationMinutes, completed_at: completedAt })));
await insert('job_materials', state.jobs.flatMap((j) => j.materials.map((m) => ({ org_id: orgId, job_id: j.id, catalog_id: m.catalogId, quantity: m.quantity }))));
await insert('activities', state.activities.map(({ createdAt, ...a }) => ({ ...a, org_id: orgId, created_at: createdAt, actor_id: userId })));
await insert('memberships', [{ user_id: userId, org_id: orgId, role: 'dispatcher', technician_id: null }]);
console.log(created ? 'Demo preparada. Credenciales guardadas en .local/demo-access.json (excluido de Git).' : 'Datos demo preparados; se conserva la contraseña existente.');
