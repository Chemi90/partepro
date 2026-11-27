import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const target = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000");
if (target.username || target.password || target.search || target.hash || target.pathname !== "/") {
  throw new Error("The E2E target must be an origin without credentials, path, query or fragment.");
}

export const baseURL = target.origin;
export const isRemote = !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);
export const artifactsDirectory = isRemote ? ".local/production" : ".local";

if (isRemote && (
  target.protocol !== "https:"
  || process.env.PLAYWRIGHT_EXTERNAL_SERVER !== "1"
  || process.env.PLAYWRIGHT_CONFIRMED_DEMO_ORIGIN !== baseURL
)) {
  throw new Error("Remote tests require HTTPS, PLAYWRIGHT_EXTERNAL_SERVER=1 and an exact PLAYWRIGHT_CONFIRMED_DEMO_ORIGIN for the authorized fictional project.");
}

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(12) });
const remoteAccessSchema = credentialsSchema.extend({
  origin: z.url(),
  supabaseUrl: z.url(),
  organizationId: z.uuid(),
  expectedRole: z.enum(["owner", "dispatcher"]),
  publishableKey: z.string().min(20),
  rls: z.object({
    technician: credentialsSchema.extend({ technicianId: z.uuid() }),
    otherOrganization: credentialsSchema.extend({ organizationId: z.uuid(), expectedRole: z.enum(["owner", "dispatcher"]) }),
  }).optional(),
});

export type RemoteAccess = z.infer<typeof remoteAccessSchema>;

function readAccessFile(path: string): unknown {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new Error(`Unable to read the private evaluation manifest at ${path}. Contents are not logged.`); }
}

export function loadRemoteAccess(): RemoteAccess {
  if (!isRemote) throw new Error("Production checks require an explicitly confirmed remote target.");
  const result = remoteAccessSchema.safeParse(readAccessFile(".local/production-demo-access.json"));
  if (!result.success) throw new Error("Production evaluation manifest is incomplete or invalid. Contents are not logged.");
  const access = result.data;
  const supabase = new URL(access.supabaseUrl);
  if (access.origin !== baseURL || access.supabaseUrl !== supabase.origin
    || supabase.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(supabase.hostname)) {
    throw new Error("Production credentials are not bound to the confirmed HTTPS target.");
  }
  let publicRole = false;
  if (access.publishableKey.startsWith("sb_publishable_")) publicRole = true;
  else {
    try { publicRole = JSON.parse(Buffer.from(access.publishableKey.split(".")[1], "base64url").toString("utf8")).role === "anon"; }
    catch { /* Reject malformed or privileged keys without including their values. */ }
  }
  if (!publicRole) throw new Error("Read-only production verification accepts only a public Supabase key.");
  return access;
}

export function loadEvaluationAccess() {
  if (isRemote) return loadRemoteAccess();
  const path = ".local/demo-access.json";
  if (!existsSync(path)) return null;
  const result = credentialsSchema.safeParse(readAccessFile(path));
  if (!result.success) throw new Error("Local evaluation manifest is invalid. Contents are not logged.");
  return result.data;
}
