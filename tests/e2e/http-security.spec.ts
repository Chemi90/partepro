import { expect, test } from "@playwright/test";

test.describe("HTTP: denegación por defecto", () => {
  test("una lectura sin sesión no devuelve el espacio de trabajo", async ({ request }) => {
    const response = await request.get("/api/workspace");
    expect([401, 503]).toContain(response.status());
    const body: unknown = await response.json();
    expect(body).not.toHaveProperty("workspace");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  for (const endpoint of ["/api/workspace", "/api/auth", "/api/calendar"]) {
    test(`${endpoint} rechaza escrituras de otro origen`, async ({ request }) => {
      const response = await request.post(endpoint, {
        headers: {
          Origin: "https://attacker.invalid",
          "Sec-Fetch-Site": "cross-site",
        },
        data: {},
      });
      expect(response.status()).toBe(403);
      expect(await response.text()).not.toMatch(/stack|service_role|private_key|SUPABASE/i);
    });
  }

  test("página pública incluye políticas de seguridad", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBeTruthy();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
    expect(headers["content-security-policy"]).toMatch(/script-src[^;]*'nonce-/);
  });
});
