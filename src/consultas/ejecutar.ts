import fs from "fs";
import path from "path";
import type { Db, Document } from "mongodb";
import { CONSULTAS } from "./pipelines";
import { aMongosh } from "./formato";

export interface ResultadoConsulta { filas: Document[]; total: number; ms: number; truncado: boolean }

const MAX_FILAS = 500;

export async function ejecutarPipeline(db: Db, coleccion: string, pipeline: Document[]): Promise<ResultadoConsulta> {
  const t0 = performance.now();
  const filas = await db.collection(coleccion).aggregate(pipeline, { maxTimeMS: 30_000, allowDiskUse: true }).toArray();
  return { filas: filas.slice(0, MAX_FILAS), total: filas.length, ms: Math.round(performance.now() - t0), truncado: filas.length > MAX_FILAS };
}


function celda(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) && Math.abs(v) >= 10_000 ? v.toLocaleString("es-CO") : String(v);
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? Object.values(x).map(celda).join(", ") : celda(x))).join("; ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "");
}

export function tablaMd(filas: Document[]): string {
  if (!filas.length) return "_(sin resultados)_\n";
  const cols = Object.keys(filas[0]);
  return `| ${cols.join(" | ")} |\n|${"---|".repeat(cols.length)}\n` +
    filas.map((f) => `| ${cols.map((c) => celda(f[c])).join(" | ")} |`).join("\n") + "\n";
}

export async function ejecutarTodas(db: Db, carpeta: string, ids?: number[], log: (m: string) => void = console.log): Promise<string> {
  fs.mkdirSync(carpeta, { recursive: true });
  let md = `# Resultados de las consultas\n\nEjecutado: ${new Date().toLocaleString("es-CO")}\n`;
  for (const c of CONSULTAS.filter((x) => !ids?.length || ids.includes(x.id))) {
    const r = await ejecutarPipeline(db, c.coleccion, c.pipeline);
    log(`=== Consulta ${c.id}: ${c.titulo} (${r.total} filas, ${r.ms} ms)`);
    md += `\n## Consulta ${c.id}. ${c.titulo}\n\n**Pregunta:** ${c.pregunta}  \n**Colección:** \`${c.coleccion}\` · **Operadores:** ${c.tecnicas.join(", ")}\n\n${tablaMd(r.filas)}`;
  }
  const ruta = path.join(carpeta, "resultados_consultas.md");
  fs.writeFileSync(ruta, md, "utf8");
  return ruta;
}


export function generarJs(ruta: string): void {
  const out = [
    "// Consultas de negocio - TecnoHogar (generado desde src/consultas/pipelines.ts)",
    "// Ejecutar:  mongosh consultas/consultas_mongosh.js",
    "// o copiar cada pipeline en la pestaña Aggregations de MongoDB Compass.",
    "", "db = db.getSiblingDB('tecnohogar');", "",
  ];
  for (const c of CONSULTAS) {
    out.push("// " + "=".repeat(74), `// CONSULTA ${c.id}: ${c.titulo}`, `// Pregunta: ${c.pregunta}`,
      `// Operadores: ${c.tecnicas.join(", ")}`, "// " + "=".repeat(74),
      `print('\\n=== Consulta ${c.id}: ${c.titulo} ===');`,
      `printjson(db.${c.coleccion}.aggregate(${aMongosh(c.pipeline)}).toArray());`, "");
  }
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, out.join("\n"), "utf8");
}
