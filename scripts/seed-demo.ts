import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoWorkspace } from '../src/lib/demo';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error('Configura las variables del proyecto de demostración primero.');
const supabaseUrl = new URL(url).origin;
const localTarget = ['localhost','127.0.0.1'].includes(new URL(url).hostname);
if (!localTarget && process.env.ALLOW_REMOTE_DEMO_SEED !== 'true') {
  throw new Error('Para un proyecto remoto dedicado a esta demo, configura ALLOW_REMOTE_DEMO_SEED=true.');
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateDirectory = resolve(repositoryRoot, '.local');
const accessFile = resolve(repositoryRoot, process.env.DEMO_ACCESS_FILE || '.local/demo-access.json');
const privateRelativePath = relative(privateDirectory, accessFile);
if (!privateRelativePath || privateRelativePath === '..' || privateRelativePath.startsWith(`..${sep}`) || isAbsolute(privateRelativePath)) {
  throw new Error('DEMO_ACCESS_FILE debe ser un archivo dentro de .local del repositorio.');
}

async function ensurePrivateDirectory(directory: string) {
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('La carpeta privada no puede ser un enlace ni un archivo.');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') await mkdir(directory, { mode: 0o700 });
    else throw error;
  }
}

// Reject directory links before creating children; a lexical .local prefix is not enough.
await ensurePrivateDirectory(privateDirectory);
let parentDirectory = privateDirectory;
const parentRelativePath = relative(privateDirectory, dirname(accessFile));
for (const segment of parentRelativePath ? parentRelativePath.split(sep) : []) {
  parentDirectory = join(parentDirectory, segment);
  await ensurePrivateDirectory(parentDirectory);
}
try {
  const info = await lstat(accessFile);
  if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) throw new Error('El archivo privado de acceso no puede ser un enlace ni un directorio.');
  const privateContent = await readFile(accessFile, 'utf8');
  let saved: unknown;
  try { saved = JSON.parse(privateContent); }
  catch { throw new Error('El archivo privado de acceso no contiene JSON válido. No se ha modificado.'); }
  const savedProject = saved && typeof saved === 'object' && 'supabaseUrl' in saved ? saved.supabaseUrl : undefined;
  if (savedProject !== undefined && savedProject !== supabaseUrl) throw new Error('El archivo de acceso pertenece a otro proyecto. Usa un archivo separado dentro de .local.');
  if (savedProject === undefined && !localTarget) throw new Error('El archivo existente no identifica su proyecto. Para producción, usa un archivo nuevo y separado dentro de .local.');
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
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
  await writeFile(accessFile, JSON.stringify({ email, password, supabaseUrl, note: 'Solo datos ficticios. No publicar este archivo.' }, null, 2), { mode: 0o600 });
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
console.log(created ? 'Demo preparada. Credenciales guardadas en el archivo privado configurado dentro de .local (excluido de Git).' : 'Datos demo preparados; se conserva la contraseña existente.');
