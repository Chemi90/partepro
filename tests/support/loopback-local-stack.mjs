// Docker Desktop can ignore bridge host_binding_ipv4. Recreate only this test
// stack's containers with explicit loopback bindings, retaining named volumes.
import { execFileSync } from "node:child_process";
import http from "node:http";

const endpoint = execFileSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" }).trim();
const socketPath = endpoint.startsWith("npipe:")
  ? endpoint.slice("npipe:".length).replaceAll("/", "\\").replace(/^\\{4}/, "\\\\")
  : endpoint.startsWith("unix:") ? endpoint.slice("unix:".length) : null;
if (!socketPath) throw new Error("Only a local Docker Engine socket is supported.");

function engine(method, path, payload, binary = false) {
  return new Promise((resolve, reject) => {
    const body = payload === undefined ? undefined : Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
    const request = http.request({ socketPath, method, path, headers: body ? { "content-type": Buffer.isBuffer(payload) ? "application/x-tar" : "application/json", "content-length": Buffer.byteLength(body) } : {} }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => { chunks.push(chunk); });
      response.on("end", () => {
        if (response.statusCode >= 300) return reject(new Error(`Docker ${method} failed (${response.statusCode}).`));
        const output = Buffer.concat(chunks);
        resolve(binary ? output : output.length ? JSON.parse(output.toString("utf8")) : null);
      });
    });
    request.on("error", reject);
    request.end(body);
  });
}

for (const name of ["supabase_kong_partepro", "supabase_db_partepro"]) {
  const container = await engine("GET", `/containers/${name}/json`);
  const bindings = container.HostConfig.PortBindings ?? {};
  if (Object.values(bindings).every((entries) => entries.every((entry) => entry.HostIp === "127.0.0.1"))) {
    console.log(`${name}: already bound to loopback.`);
    continue;
  }
  for (const entries of Object.values(bindings)) for (const entry of entries) entry.HostIp = "127.0.0.1";
  const endpoints = Object.fromEntries(Object.entries(container.NetworkSettings.Networks).map(([network, settings]) => [network, { Aliases: settings.Aliases }]));
  const oldName = `${name}_loopback_backup`;
  // Supabase copies Kong's generated configuration/certificates into its writable
  // layer, not a volume. Preserve it in memory through the recreation.
  const kongFiles = name.includes("_kong_") ? await engine("GET", `/containers/${name}/archive?path=/home/kong`, undefined, true) : null;
  await engine("POST", `/containers/${name}/stop?t=20`);
  await engine("POST", `/containers/${name}/rename?name=${oldName}`);
  try {
    await engine("POST", `/containers/create?name=${name}`, { ...container.Config, HostConfig: container.HostConfig, NetworkingConfig: { EndpointsConfig: endpoints } });
    if (kongFiles) await engine("PUT", `/containers/${name}/archive?path=/home`, kongFiles);
    await engine("POST", `/containers/${name}/start`);
    await engine("DELETE", `/containers/${oldName}`);
    console.log(`${name}: explicit 127.0.0.1 binding; data volumes retained.`);
  } catch (error) {
    console.error(`${name}: loopback recreation failed; backup retained for recovery.`);
    throw error;
  }
}

// Connections retained by the auth/API pools refer to the replaced DB process.
execFileSync("docker", ["restart", "supabase_auth_partepro", "supabase_rest_partepro"], { stdio: "ignore" });
console.log("Auth and REST pools restarted after the database binding change.");
