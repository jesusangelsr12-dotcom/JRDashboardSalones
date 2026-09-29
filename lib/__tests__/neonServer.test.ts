// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests del ruteo multi-proyecto de lib/neonServer.ts: cada salón se busca
 * en todas las bases NEON_DATABASE_URL* y se consulta en la que lo tenga.
 * Se simula el cliente de @neondatabase/serverless (sin red).
 */

interface BaseFalsa {
  salones: string[];
  citas: Record<string, unknown[]>;
  falla?: boolean;
}

const { bases, conexiones } = vi.hoisted(() => ({
  bases: {} as Record<string, BaseFalsa>,
  conexiones: [] as string[],
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: (url: string) => {
    conexiones.push(url);
    return async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const base = bases[url];
      if (!base || base.falla) throw new Error(`no se pudo conectar a ${url}`);
      const query = strings.join("?");
      const id = String(values[0]);
      if (query.includes("FROM salones")) {
        return base.salones.includes(id.toLowerCase()) ? [{ "?column?": 1 }] : [];
      }
      if (query.includes("FROM citas")) return base.citas[id] ?? [];
      return [];
    };
  },
}));

const TWC_ID = "fe431f09-608e-45e8-bd35-a355d3c0421d";
const MARTHA_ID = "0c77c982-2ca5-4320-b7f0-8908e469c6b9";
const URL_TWC = "postgresql://twc";
const URL_MARTHA = "postgresql://martha";

function cita(clienta: string) {
  return {
    fecha: new Date(2026, 8, 28),
    timestamp: "10:00:00",
    clienta,
    items: [{ tipo: "servicio", nombre: "Corte", costo: 500 }],
    total: "500",
    metodo_pago: "Efectivo",
  };
}

async function cargarModulo() {
  vi.resetModules();
  return import("../neonServer");
}

beforeEach(() => {
  for (const key of Object.keys(bases)) delete bases[key];
  conexiones.length = 0;
  bases[URL_TWC] = { salones: [TWC_ID], citas: { [TWC_ID]: [cita("Clienta TWC")] } };
  bases[URL_MARTHA] = { salones: [MARTHA_ID], citas: { [MARTHA_ID]: [cita("Clienta Martha")] } };
  vi.stubEnv("NEON_DATABASE_URL", URL_TWC);
  vi.stubEnv("NEON_DATABASE_URL_MARTHA", URL_MARTHA);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchSalonDataNeon — ruteo por proyecto Neon", () => {
  it("lee a Martha de su propia base, no de la de TWC", async () => {
    const { fetchSalonDataNeon } = await cargarModulo();
    const { citas } = await fetchSalonDataNeon(MARTHA_ID);
    expect(citas.map((c) => c.clienta)).toEqual(["Clienta Martha"]);
  });

  it("TWC sigue saliendo de NEON_DATABASE_URL", async () => {
    const { fetchSalonDataNeon } = await cargarModulo();
    const { citas } = await fetchSalonDataNeon(TWC_ID);
    expect(citas.map((c) => c.clienta)).toEqual(["Clienta TWC"]);
  });

  it("un salón que no está en ninguna base da error, no datos vacíos", async () => {
    const { fetchSalonDataNeon, NeonSalonNoEncontradoError } = await cargarModulo();
    await expect(
      fetchSalonDataNeon("00000000-0000-0000-0000-000000000000")
    ).rejects.toBeInstanceOf(NeonSalonNoEncontradoError);
  });

  it("si una base se cae, los salones de las demás siguen cargando", async () => {
    bases[URL_TWC].falla = true;
    const { fetchSalonDataNeon } = await cargarModulo();
    const { citas } = await fetchSalonDataNeon(MARTHA_ID);
    expect(citas.map((c) => c.clienta)).toEqual(["Clienta Martha"]);
  });

  it("si una base se cae y el salón no aparece en las demás, propaga el error de conexión", async () => {
    bases[URL_TWC].falla = true;
    const { fetchSalonDataNeon, NeonSalonNoEncontradoError } = await cargarModulo();
    const error = await fetchSalonDataNeon(TWC_ID).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NeonSalonNoEncontradoError);
  });

  it("ignora variables que no siguen el patrón NEON_DATABASE_URL[_NOMBRE]", async () => {
    vi.stubEnv("NEON_DATABASE_URL_MARTHA", "");
    vi.stubEnv("OTRA_NEON_DATABASE_URL", URL_MARTHA);
    vi.stubEnv("NEON_DATABASE_URLMARTHA", URL_MARTHA);
    const { fetchSalonDataNeon, NeonSalonNoEncontradoError } = await cargarModulo();
    await expect(fetchSalonDataNeon(MARTHA_ID)).rejects.toBeInstanceOf(NeonSalonNoEncontradoError);
  });

  it("recuerda en qué base está el salón y ya no consulta las otras", async () => {
    const { fetchSalonDataNeon } = await cargarModulo();
    await fetchSalonDataNeon(MARTHA_ID);
    conexiones.length = 0;
    const { citas } = await fetchSalonDataNeon(MARTHA_ID);
    expect(conexiones).toEqual([URL_MARTHA]);
    expect(citas.map((c) => c.clienta)).toEqual(["Clienta Martha"]);
  });

  it("sin ninguna variable NEON_DATABASE_URL* configurada da error claro", async () => {
    vi.stubEnv("NEON_DATABASE_URL", "");
    vi.stubEnv("NEON_DATABASE_URL_MARTHA", "");
    const { fetchSalonDataNeon } = await cargarModulo();
    await expect(fetchSalonDataNeon(MARTHA_ID)).rejects.toThrow(
      "NEON_DATABASE_URL no está configurada"
    );
  });
});
