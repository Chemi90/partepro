import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { databaseError, handleError, HttpError, readJson, verifyOrigin } from "../../src/lib/server/http";

const origin = "https://partepro.example";
const request = (body: string, headers: Record<string, string> = {}) => new NextRequest(`${origin}/api/workspace`, {
  method: "POST",
  headers: { "content-type": "application/json", origin, ...headers },
  body,
});

afterEach(() => vi.unstubAllEnvs());

describe("protección de origen", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", origin);
    vi.stubEnv("NODE_ENV", "production");
  });

  it("permite exactamente el origen configurado", () => {
    expect(() => verifyOrigin(request("{}", { "sec-fetch-site": "same-origin" }))).not.toThrow();
  });

  it.each(["https://partepro.example.attacker.invalid", "http://partepro.example", "https://partepro.example:444", "null", ""])('rechaza origen %s', (badOrigin) => {
    expect(() => verifyOrigin(request("{}", { origin: badOrigin }))).toThrow(HttpError);
  });

  it("rechaza sec-fetch-site cross-site y same-site incluso con Origin falsificado", () => {
    expect(() => verifyOrigin(request("{}", { "sec-fetch-site": "cross-site" }))).toThrow(HttpError);
    expect(() => verifyOrigin(request("{}", { "sec-fetch-site": "same-site" }))).toThrow(HttpError);
  });

  it("falla cerrado en producción sin APP_ORIGIN", () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect(() => verifyOrigin(request("{}"))).toThrow(HttpError);
  });
});

describe("lectura y validación del cuerpo HTTP", () => {
  const schema = z.object({ title: z.string().trim().min(1).max(120) }).strict();

  it("devuelve solo una estructura válida", async () => {
    await expect(readJson(request('{"title":" Revisión "}'), schema)).resolves.toEqual({ title: "Revisión" });
  });

  it("rechaza Content-Type de formulario", async () => {
    await expect(readJson(request("title=hello", { "content-type": "application/x-www-form-urlencoded" }), schema)).rejects.toMatchObject({ status: 415 });
  });

  it("rechaza JSON roto y campos desconocidos", async () => {
    await expect(readJson(request("{broken}"), schema)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request('{"title":"Revisión","role":"owner"}'), schema)).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza cuerpos grandes antes de leer si la cabecera lo declara", async () => {
    await expect(readJson(request("{}", { "content-length": "16385" }), schema)).rejects.toMatchObject({ status: 413 });
  });

  it("aplica límite real aunque content-length mienta o falte", async () => {
    const body = JSON.stringify({ title: "x".repeat(17_000) });
    await expect(readJson(request(body, { "content-length": "1" }), schema)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(request(body), schema)).rejects.toMatchObject({ status: 413 });
  });

  it("cuenta bytes UTF-8, no solamente caracteres", async () => {
    const body = JSON.stringify({ title: "🙂".repeat(5000) });
    await expect(readJson(request(body), schema)).rejects.toMatchObject({ status: 413 });
  });
});

describe("errores públicos", () => {
  it("traduce errores de base de datos sin devolver detalle SQL", () => {
    expect(databaseError("42501").status).toBe(403);
    expect(databaseError("P0429").status).toBe(429);
    expect(databaseError("23505").status).toBe(409);
    expect(databaseError("22P02").status).toBe(400);
    expect(databaseError("unexpected").status).toBe(503);
  });

  it("no filtra detalles inesperados ni secretos al cliente o al log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = handleError(new Error("postgres://password-secret@database/private-table"));
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).not.toContain("password-secret");
      expect(JSON.stringify(spy.mock.calls)).not.toContain("password-secret");
    } finally { spy.mockRestore(); }
  });
});
