import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { workspaceSchema, type Workspace } from "../../src/lib/domain";
import { loadRemoteAccess } from "../support/target";

// This verifier deliberately contains no fixture creation, business mutations,
// service-role key, SQL connection or cleanup. Root provisions fictional data.
const access = loadRemoteAccess();
if (!access.rls) throw new Error("Read-only role verification requires the private RLS fixture manifest.");
const rls = access.rls;
const base = new URL(access.supabaseUrl);
const tables = ["organizations", "memberships", "customers", "technicians", "catalog", "requests", "quotes", "quote_items", "jobs", "job_materials", "activities"] as const;
const businessTables = tables.filter((table) => table !== "organizations" && table !== "memberships");
const sessions: SupabaseClient[] = [];
let passed = 0;
let failed = 0;

const guardedFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const readPath = tables.some((table) => url.pathname === `/rest/v1/${table}`) || url.pathname === "/rest/v1/rpc/get_workspace";
  const allowed = url.origin === base.origin && (
    (method === "GET" && readPath)
    || (method === "POST" && ["/auth/v1/token", "/auth/v1/logout"].includes(url.pathname))
  );
  if (!allowed) throw new Error("Read-only production verifier blocked a request outside its explicit allowlist.");
  return fetch(input, { ...init, redirect: "error" });
};

function client() {
  return createClient(access.supabaseUrl, access.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: guardedFetch },
  });
}

async function check(label: string, callback: () => Promise<void>) {
  try {
    await callback();
    passed++;
    console.log(`PASS ${label}`);
  } catch {
    // Do not serialize SDK responses, assertions, tokens or fixture records.
    failed++;
    console.error(`FAIL ${label}`);
  }
}

async function signIn(credentials: { email: string; password: string }) {
  const instance = client();
  const result = await instance.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
  if (result.error || !result.data.user || !result.data.session) throw new Error("Private fixture sign-in failed.");
  sessions.push(instance);
  return { client: instance, userId: result.data.user.id };
}

async function workspace(instance: SupabaseClient): Promise<Workspace> {
  const result = await instance.rpc("get_workspace", undefined, { get: true });
  const parsed = workspaceSchema.safeParse(result.data);
  if (result.error || !parsed.success) throw new Error("Workspace read failed validation.");
  return parsed.data;
}

const sortedIds = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

try {
  const anonymous = client();
  await check("anonymous Data API and workspace deny business reads", async () => {
    for (const table of tables) {
      const result = await anonymous.from(table).select("*");
      assert.ok(result.error || result.data?.length === 0);
    }
    assert.ok((await anonymous.rpc("get_workspace", undefined, { get: true })).error);
  });

  const a = await signIn(access);
  const b = await signIn(rls.otherOrganization);
  const technician = await signIn(rls.technician);
  const [workspaceA, workspaceB, workspaceTechnician] = await Promise.all([
    workspace(a.client), workspace(b.client), workspace(technician.client),
  ]);

  await check("fixture identities have the declared organizations and roles", async () => {
    assert.notEqual(access.organizationId, rls.otherOrganization.organizationId);
    for (const fixture of [
      { ...a, org: access.organizationId, role: access.expectedRole, technicianId: null },
      { ...b, org: rls.otherOrganization.organizationId, role: rls.otherOrganization.expectedRole, technicianId: null },
      { ...technician, org: access.organizationId, role: "technician", technicianId: rls.technician.technicianId },
    ]) {
      const result = await fixture.client.from("memberships").select("user_id,org_id,role,technician_id");
      assert.equal(result.error, null);
      assert.deepEqual(result.data, [{ user_id: fixture.userId, org_id: fixture.org, role: fixture.role, technician_id: fixture.technicianId }]);
    }
    assert.ok(workspaceA.customers.length > 0 && workspaceB.customers.length > 0);
    assert.ok(workspaceA.jobs.some((job) => job.technicianId === rls.technician.technicianId));
    assert.ok(workspaceA.jobs.some((job) => job.technicianId !== rls.technician.technicianId));
  });

  await check("raw table reads remain inside each organization", async () => {
    for (const fixture of [
      { ...a, org: access.organizationId, other: rls.otherOrganization.organizationId },
      { ...b, org: rls.otherOrganization.organizationId, other: access.organizationId },
    ]) {
      const organizations = await fixture.client.from("organizations").select("id");
      assert.equal(organizations.error, null);
      assert.deepEqual(organizations.data, [{ id: fixture.org }]);
      for (const table of businessTables) {
        const result = await fixture.client.from(table).select("org_id");
        assert.equal(result.error, null);
        assert.ok(result.data?.every((row) => row.org_id === fixture.org));
        const foreign = await fixture.client.from(table).select("org_id").eq("org_id", fixture.other);
        assert.equal(foreign.error, null);
        assert.deepEqual(foreign.data, []);
      }
    }
  });

  await check("workspace snapshots do not share organization records", async () => {
    for (const key of ["customers", "technicians", "catalog", "requests", "quotes", "jobs", "activities"] as const) {
      const otherIds = new Set(sortedIds(workspaceB[key]));
      assert.ok(workspaceA[key].every((row) => !otherIds.has(row.id)));
    }
    // A positive row on B makes this an actual foreign-ID read, not a random UUID.
    const result = await a.client.from("customers").select("id").eq("id", workspaceB.customers[0].id);
    assert.equal(result.error, null);
    assert.deepEqual(result.data, []);
  });

  await check("technician sees assigned work and only its related records", async () => {
    const assigned = workspaceA.jobs.filter((job) => job.technicianId === rls.technician.technicianId);
    assert.ok(assigned.length > 0);
    const requestIds = new Set(assigned.map((job) => job.requestId));
    const quoteIds = new Set(assigned.map((job) => job.quoteId));
    const requests = workspaceA.requests.filter((request) => requestIds.has(request.id));
    const customerIds = new Set(requests.map((request) => request.customerId));
    assert.deepEqual(sortedIds(workspaceTechnician.jobs), sortedIds(assigned));
    assert.deepEqual(sortedIds(workspaceTechnician.requests), sortedIds(requests));
    assert.deepEqual(sortedIds(workspaceTechnician.quotes), sortedIds(workspaceA.quotes.filter((quote) => quoteIds.has(quote.id))));
    assert.deepEqual(sortedIds(workspaceTechnician.customers), sortedIds(workspaceA.customers.filter((customer) => customerIds.has(customer.id))));
    assert.deepEqual(sortedIds(workspaceTechnician.technicians), [rls.technician.technicianId]);
    assert.equal(workspaceTechnician.activities.length, 0);
    const raw = await technician.client.from("jobs").select("id,technician_id,org_id");
    assert.equal(raw.error, null);
    assert.ok(raw.data?.every((job) => job.technician_id === rls.technician.technicianId && job.org_id === access.organizationId));
    assert.deepEqual(sortedIds(raw.data!), sortedIds(assigned));
    const otherJob = workspaceA.jobs.find((job) => job.technicianId !== rls.technician.technicianId)!;
    const foreign = await technician.client.from("jobs").select("id").eq("id", otherJob.id);
    assert.equal(foreign.error, null);
    assert.deepEqual(foreign.data, []);
  });
} catch {
  failed++;
  console.error("FAIL production fixture setup or read validation; private details are not logged.");
} finally {
  for (const instance of sessions) {
    // Revoke only this verifier's refresh token, never other evaluator sessions.
    const result = await instance.auth.signOut({ scope: "local" });
    if (result.error) {
      failed++;
      console.error("FAIL verifier session logout.");
    }
  }
  console.log(`${passed} read-only checks passed; ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
