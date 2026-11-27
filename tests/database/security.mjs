import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== "http://127.0.0.1:54321" || !publicKey || !serviceKey) {
  throw new Error("Database security tests only run against the dedicated loopback Supabase stack.");
}
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, options);
const client = () => createClient(url, publicKey, options);
const identities = [];
const results = [];
const id = Object.fromEntries(["orgA", "orgB", "techA", "techOther", "customerA", "customerOther", "customerB", "serviceA", "materialA", "serviceB", "requestA", "requestOther", "requestNew", "requestB", "quoteA", "quoteOther", "jobA", "jobOther"].map((key) => [key, randomUUID()]));

function sql(statement) {
  const result = spawnSync("docker", ["exec", "-i", "supabase_db_partepro", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: statement, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Local fixture SQL failed: ${result.stderr}`);
  return result.stdout.trim();
}
async function account(label) {
  const email = `qa-${label}-${randomUUID()}@example.com`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null, "Fixture user creation must succeed.");
  const instance = client();
  const signed = await instance.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null, "Fixture sign-in must succeed.");
  identities.push(created.data.user.id);
  return { id: created.data.user.id, client: instance };
}
const failed = (result) => Boolean(result.error || result.data?.error);
async function check(name, callback) {
  try { await callback(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function workspace(instance) {
  const result = await instance.rpc("get_workspace");
  assert.equal(result.error, null);
  return result.data;
}
async function action(instance, body) { return instance.rpc("apply_workspace_action", { p_action: body }); }

try {
  const ownerA = await account("owner-a");
  const ownerB = await account("owner-b");
  const techA = await account("tech-a");
  const outsider = await account("outsider");
  sql(`
    begin;
    insert into public.organizations(id,name) values('${id.orgA}','QA Empresa A'),('${id.orgB}','QA Empresa B');
    insert into public.technicians(id,org_id,name,initials,color) values('${id.techA}','${id.orgA}','QA Técnico A','TA','teal'),('${id.techOther}','${id.orgA}','QA Técnico B','TB','amber');
    insert into public.memberships(user_id,org_id,role,technician_id) values('${ownerA.id}','${id.orgA}','owner',null),('${ownerB.id}','${id.orgB}','owner',null),('${techA.id}','${id.orgA}','technician','${id.techA}');
    insert into public.customers(id,org_id,name,contact,email,phone,address) values
      ('${id.customerA}','${id.orgA}','QA Cliente A','QA Contacto','qa@example.com','',''),
      ('${id.customerOther}','${id.orgA}','QA Cliente restringido','QA Contacto','qa@example.com','',''),
      ('${id.customerB}','${id.orgB}','QA Cliente B','QA Contacto','qa@example.com','','');
    insert into public.catalog(id,org_id,name,unit,price_cents,kind) values
      ('${id.serviceA}','${id.orgA}','QA Servicio','hora',101,'service'),
      ('${id.materialA}','${id.orgA}','QA Material','unidad',200,'material'),
      ('${id.serviceB}','${id.orgB}','QA Servicio externo','hora',1,'service');
    insert into public.requests(id,org_id,code,customer_id,title,description,priority,status) values
      ('${id.requestA}','${id.orgA}','QA-001','${id.customerA}','QA Asignada','Prueba de aislamiento','normal','accepted'),
      ('${id.requestOther}','${id.orgA}','QA-002','${id.customerOther}','QA Ajena','Prueba de aislamiento','normal','accepted'),
      ('${id.requestNew}','${id.orgA}','QA-003','${id.customerA}','QA Nueva','Prueba de presupuesto','normal','new'),
      ('${id.requestB}','${id.orgB}','QA-001','${id.customerB}','QA Otra organización','Prueba de aislamiento','normal','new');
    insert into public.quotes(id,org_id,code,request_id,subtotal_cents,tax_cents,total_cents,status) values
      ('${id.quoteA}','${id.orgA}','QA-PRE-001','${id.requestA}',101,21,122,'accepted'),
      ('${id.quoteOther}','${id.orgA}','QA-PRE-002','${id.requestOther}',101,21,122,'accepted');
    insert into public.quote_items(org_id,quote_id,catalog_id,quantity,unit_price_cents,name) values
      ('${id.orgA}','${id.quoteA}','${id.serviceA}',1,101,'QA Servicio'),
      ('${id.orgA}','${id.quoteOther}','${id.serviceA}',1,101,'QA Servicio');
    insert into public.jobs(id,org_id,code,request_id,quote_id,technician_id,status,start_at,duration_minutes) values
      ('${id.jobA}','${id.orgA}','QA-PAR-001','${id.requestA}','${id.quoteA}','${id.techA}','scheduled',now()+interval '1 day',60),
      ('${id.jobOther}','${id.orgA}','QA-PAR-002','${id.requestOther}','${id.quoteOther}','${id.techOther}','scheduled',now()+interval '1 day',60);
    insert into public.activities(org_id,text,kind,actor_id) values('${id.orgA}','QA evento privado','request','${ownerA.id}');
    commit;
  `);

  await check("anonymous cannot read business tables or workspace RPC", async () => {
    const anonymous = client();
    for (const table of ["organizations", "memberships", "customers", "technicians", "catalog", "requests", "quotes", "quote_items", "jobs", "job_materials", "activities"]) {
      const result = await anonymous.from(table).select("*");
      assert.ok(result.error || result.data?.length === 0, table);
    }
    assert.ok((await anonymous.rpc("get_workspace")).error);
  });

  await check("authenticated user without membership is denied", async () => {
    assert.ok((await outsider.client.rpc("get_workspace")).error);
    assert.ok(failed(await action(outsider.client, { type: "request.create", customerId: id.customerA, title: "Intrusión", description: "Sin membresía", priority: "normal" })));
  });

  await check("RLS separates organizations in raw table API and aggregated workspace", async () => {
    const [a, b] = await Promise.all([workspace(ownerA.client), workspace(ownerB.client)]);
    assert.equal(a.customers.length, 2);
    assert.equal(b.customers.length, 1);
    assert.equal(b.customers[0].id, id.customerB);
    assert.ok(!JSON.stringify(a).includes(id.customerB));
    const raw = await ownerA.client.from("customers").select("*").eq("id", id.customerB);
    assert.deepEqual(raw.data, []);
  });

  await check("technician sees only assigned jobs and their related customer/request/quote", async () => {
    const snapshot = await workspace(techA.client);
    assert.deepEqual(snapshot.jobs.map((job) => job.id), [id.jobA]);
    assert.deepEqual(snapshot.requests.map((request) => request.id), [id.requestA]);
    assert.deepEqual(snapshot.customers.map((customer) => customer.id), [id.customerA]);
    assert.deepEqual(snapshot.quotes.map((quote) => quote.id), [id.quoteA]);
    assert.deepEqual(snapshot.technicians.map((technician) => technician.id), [id.techA]);
    assert.equal(snapshot.activities.length, 0);
  });

  await check("direct table writes and role escalation are denied", async () => {
    assert.ok((await ownerA.client.from("requests").update({ title: "Bypass" }).eq("id", id.requestNew)).error);
    assert.ok((await ownerA.client.from("catalog").update({ price_cents: 1 }).eq("id", id.serviceA)).error);
    assert.ok((await techA.client.from("memberships").update({ role: "owner", technician_id: null }).eq("user_id", techA.id)).error);
    assert.ok((await ownerA.client.from("memberships").insert({ user_id: outsider.id, org_id: id.orgA, role: "owner" })).error);
  });

  await check("cross-organization IDs cannot be used in action RPC", async () => {
    assert.ok(failed(await action(ownerA.client, { type: "quote.create", requestId: id.requestB, items: [{ catalogId: id.serviceA, quantity: 1 }] })));
    assert.ok(failed(await action(ownerA.client, { type: "quote.create", requestId: id.requestNew, items: [{ catalogId: id.serviceB, quantity: 1 }] })));
    assert.equal((await workspace(ownerB.client)).requests[0].status, "new");
  });

  await check("database independently validates shape, type, duplicates and trusted price", async () => {
    const body = { type: "quote.create", requestId: id.requestNew, items: [{ catalogId: id.serviceA, quantity: 1 }] };
    assert.ok(failed(await action(ownerA.client, { ...body, role: "owner" })));
    assert.ok(failed(await action(ownerA.client, { ...body, totalCents: 1 })));
    assert.ok(failed(await action(ownerA.client, { ...body, items: [{ catalogId: id.serviceA, quantity: "1" }] })));
    assert.ok(failed(await action(ownerA.client, { ...body, items: [{ catalogId: id.serviceA, quantity: 1.5 }] })));
    assert.ok(failed(await action(ownerA.client, { ...body, items: [body.items[0], body.items[0]] })));
    assert.ok(!failed(await action(ownerA.client, body)));
    const quote = (await workspace(ownerA.client)).quotes.find((item) => item.requestId === id.requestNew);
    assert.equal(quote.totalCents, 122);
    assert.equal(quote.items[0].unitPriceCents, 101);
  });

  await check("concurrent quote acceptance creates exactly one job", async () => {
    const quote = (await workspace(ownerA.client)).quotes.find((item) => item.requestId === id.requestNew);
    const attempts = await Promise.all([action(ownerA.client, { type: "quote.accept", quoteId: quote.id }), action(ownerA.client, { type: "quote.accept", quoteId: quote.id })]);
    assert.equal(attempts.filter((result) => !failed(result)).length, 1);
    const snapshot = await workspace(ownerA.client);
    assert.equal(snapshot.jobs.filter((job) => job.quoteId === quote.id).length, 1);
  });

  await check("technician cannot mutate management data or close a different technician's job", async () => {
    assert.ok(failed(await action(techA.client, { type: "request.create", customerId: id.customerA, title: "Sin permiso", description: "Operación de gestión", priority: "normal" })));
    assert.ok(failed(await action(techA.client, { type: "job.complete", jobId: id.jobOther, report: "Cierre ajeno", materials: [] })));
  });

  await check("schedule conflict is rejected inside the database", async () => {
    const snapshot = await workspace(ownerA.client);
    const pending = snapshot.jobs.find((job) => job.status === "pending");
    const booked = snapshot.jobs.find((job) => job.id === id.jobA);
    assert.ok(failed(await action(ownerA.client, { type: "job.schedule", jobId: pending.id, technicianId: id.techA, startAt: booked.startAt, durationMinutes: 30 })));
  });

  await check("concurrent scheduling cannot double-book the same technician", async () => {
    const pending = (await workspace(ownerA.client)).jobs.find((job) => job.status === "pending");
    const requestId = randomUUID(), quoteId = randomUUID(), jobId = randomUUID();
    sql(`
      begin;
      insert into public.requests(id,org_id,code,customer_id,title,description,priority,status) values('${requestId}','${id.orgA}','QA-RACE','${id.customerA}','QA Carrera','Prueba concurrente','normal','accepted');
      insert into public.quotes(id,org_id,code,request_id,subtotal_cents,tax_cents,total_cents,status) values('${quoteId}','${id.orgA}','QA-RACE','${requestId}',101,21,122,'accepted');
      insert into public.jobs(id,org_id,code,request_id,quote_id) values('${jobId}','${id.orgA}','QA-RACE','${requestId}','${quoteId}');
      commit;
    `);
    const startAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const attempts = await Promise.all([pending.id, jobId].map((targetId) => action(ownerA.client, { type: "job.schedule", jobId: targetId, technicianId: id.techOther, startAt, durationMinutes: 60 })));
    assert.equal(attempts.filter((result) => !failed(result)).length, 1);
  });

  await check("assigned technician closes once and updates the linked request", async () => {
    const body = { type: "job.complete", jobId: id.jobA, report: "Prueba: equipo revisado.", materials: [{ catalogId: id.materialA, quantity: 1 }] };
    assert.ok(!failed(await action(techA.client, body)));
    assert.ok(failed(await action(techA.client, body)));
    const snapshot = await workspace(techA.client);
    assert.equal(snapshot.jobs[0].status, "completed");
    assert.equal(snapshot.requests[0].status, "completed");
    assert.equal(snapshot.jobs[0].materials[0].quantity, 1);
  });

  await check("failed mutation attempts are counted without modifying business state", async () => {
    const before = Number(sql(`select coalesce((select count from private.rate_buckets where key='attempt:${ownerA.id}'),0);`));
    assert.ok(failed(await action(ownerA.client, { type: "unknown.action" })));
    const after = Number(sql(`select coalesce((select count from private.rate_buckets where key='attempt:${ownerA.id}'),0);`));
    assert.equal(after, before + 1, "Failed actions must not roll back the rate bucket.");
  });

  await check("the mutation attempt threshold rejects the next request", async () => {
    sql(`insert into private.rate_buckets as b(key,window_start,count) values('attempt:${ownerB.id}',date_trunc('minute',now()),60) on conflict(key) do update set window_start=excluded.window_start,count=60;`);
    const response = await action(ownerB.client, { type: "request.create", customerId: id.customerB, title: "Exceso de cuota", description: "Debe rechazarse antes de modificar datos", priority: "normal" });
    assert.equal(response.data?.code, "P0429");
    assert.equal((await workspace(ownerB.client)).requests.length, 1);
  });

  await check("login throttle RPC is inaccessible to authenticated or anonymous callers", async () => {
    const args = { p_ip: "a".repeat(64), p_identity: "b".repeat(64) };
    assert.ok((await ownerA.client.rpc("consume_auth_rate_limit", args)).error);
    assert.ok((await client().rpc("consume_auth_rate_limit", args)).error);
  });

  await check("login identity limit persists across separate requests", async () => {
    const args = { p_ip: randomBytes(32).toString("hex"), p_identity: randomBytes(32).toString("hex") };
    for (let attempt = 1; attempt <= 9; attempt++) {
      const result = await admin.rpc("consume_auth_rate_limit", args);
      assert.equal(result.error, null);
      assert.equal(result.data, attempt <= 8);
    }
    sql(`delete from private.rate_buckets where key in ('login-ip:${args.p_ip}','login-user:${args.p_identity}');`);
  });
} finally {
  sql(`
    begin;
    delete from public.job_materials where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.quote_items where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.jobs where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.quotes where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.requests where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.activities where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.memberships where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.customers where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.catalog where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.technicians where org_id in ('${id.orgA}','${id.orgB}');
    delete from public.organizations where id in ('${id.orgA}','${id.orgB}');
    ${identities.map((userId) => `delete from private.rate_buckets where key in ('mutate:${userId}','attempt:${userId}','calendar:${userId}');`).join("\n")}
    commit;
  `);
  for (const userId of identities) await admin.auth.admin.deleteUser(userId);
}

console.log(`${results.filter((result) => result.pass).length}/${results.length} database security checks passed.`);
if (results.some((result) => !result.pass)) process.exitCode = 1;
