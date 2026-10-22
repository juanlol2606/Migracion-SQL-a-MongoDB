
import JSON5 from "json5";
import { BSON, type Document } from "mongodb";

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;


export function aMongosh(obj: unknown, nivel = 0, ancho = 100): string {
  const sangria = "  ".repeat(nivel);
  const clave = (k: string) => (IDENT.test(k) ? k : JSON.stringify(k));
  const linea = (o: unknown): string => {
    if (o instanceof Date) return `ISODate("${o.toISOString().replace(".000Z", "Z")}")`;
    if (o === null) return "null";
    if (Array.isArray(o)) return `[${o.map(linea).join(", ")}]`;
    if (typeof o === "object") {
      const e = Object.entries(o as Record<string, unknown>);
      return e.length ? `{ ${e.map(([k, v]) => `${clave(k)}: ${linea(v)}`).join(", ")} }` : "{}";
    }
    return JSON.stringify(o);
  };
  const compacto = linea(obj);
  if (sangria.length + compacto.length <= ancho || obj === null || typeof obj !== "object" || obj instanceof Date) return compacto;
  const interior = "  ".repeat(nivel + 1);
  if (Array.isArray(obj)) {
    if (!obj.length) return "[]";
    return `[\n${obj.map((v) => interior + aMongosh(v, nivel + 1, ancho)).join(",\n")}\n${sangria}]`;
  }
  const e = Object.entries(obj as Record<string, unknown>);
  return `{\n${e.map(([k, v]) => `${interior}${clave(k)}: ${aMongosh(v, nivel + 1, ancho)}`).join(",\n")}\n${sangria}}`;
}

const ETAPAS_PROHIBIDAS = ["$out", "$merge"];


export function parsearPipeline(texto: string): Document[] {
  const normal = texto
    .trim()
    .replace(/;\s*$/, "")
    .replace(/(?:ISODate|new\s+Date)\(\s*["']([^"']+)["']\s*\)/g, (_m, f: string) => `{"$date": "${f.length === 10 ? f + "T00:00:00Z" : f}"}`);
  let valor: unknown;
  try {
    valor = JSON5.parse(normal);
  } catch (e) {
    throw new Error(`Sintaxis inválida: ${(e as Error).message}`);
  }
  if (!Array.isArray(valor) || !valor.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
    throw new Error("El pipeline debe ser un arreglo de etapas: [ { $match: ... }, { $group: ... } ]");
  }
  const pipeline = BSON.EJSON.deserialize(valor as Document[], { relaxed: true }) as unknown as Document[];
  for (const etapa of pipeline) {
    const nombre = Object.keys(etapa)[0];
    if (ETAPAS_PROHIBIDAS.includes(nombre)) throw new Error(`La etapa ${nombre} está deshabilitada en la interfaz (modifica datos).`);
  }
  return pipeline;
}


export const aJsonSeguro = (docs: unknown): unknown => BSON.EJSON.serialize(docs as Document, { relaxed: true });
