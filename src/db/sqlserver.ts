import fs from "fs";
import sql from "mssql";
import { config, recargarConfig, RUTA_ENV } from "../config";
import type { Log } from "../migracion/tipos";

/** Fuente de datos relacional mínima: ejecutar un SELECT y devolver filas. */
export interface FuenteSql {
  consultar<T = Record<string, unknown>>(consulta: string): Promise<T[]>;
  cerrar(): Promise<void>;
}

function configuracion(database: string, maxConexiones = 10): sql.config {
  recargarConfig();
  return {
    server: config.sql.server,
    port: config.sql.instance ? undefined : config.sql.port,
    database,
    user: config.sql.user,
    password: config.sql.password,
    pool: { max: maxConexiones, min: 0 },
    requestTimeout: 120_000,
    options: {
      instanceName: config.sql.instance,
      encrypt: config.sql.encrypt,
      trustServerCertificate: true,
      useUTC: true, // las fechas se leen y escriben en UTC (igual que en MongoDB)
    },
  };
}

/** Agrega a los errores de conexión más comunes una explicación de cómo resolverlos. */
function explicar(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Login failed/i.test(msg)) {
    return new Error(`${msg}. Usuario: "${config.sql.user}", contraseña tomada de SQL_PASSWORD en ${RUTA_ENV}` +
      (config.sql.password ? "" : " (¡está vacía!)") +
      ". Ejecute instalacion\\diagnosticar.bat desde ESTA misma carpeta del proyecto: deja a sa con esa contraseña.");
  }
  if (/Could not connect|ECONNREFUSED|Failed to connect/i.test(msg)) {
    return new Error(`${msg}. SQL Server no responde en ${config.sql.server}:${config.sql.port}. Ejecute instalacion\\diagnosticar.bat.`);
  }
  if (/Cannot open database/i.test(msg)) {
    return new Error(`${msg}. La base TecnoHogarDB todavía no existe: use el botón «Instalar base SQL».`);
  }
  return e instanceof Error ? e : new Error(msg);
}

async function conectar(cfg: sql.config): Promise<sql.ConnectionPool> {
  try {
    return await new sql.ConnectionPool(cfg).connect();
  } catch (e) {
    throw explicar(e);
  }
}

/** Conecta a la base TecnoHogarDB. */
export async function conectarSqlServer(): Promise<FuenteSql> {
  const pool = await conectar(configuracion(config.sql.database));
  return {
    async consultar<T>(consulta: string) {
      const r = await pool.request().query(consulta);
      return r.recordset as T[];
    },
    cerrar: () => pool.close(),
  };
}

/** Comprueba la conexión y devuelve la versión del servidor. */
export async function probarSqlServer(): Promise<string> {
  const pool = await conectar(configuracion("master", 1));
  try {
    const r = await pool.request().query("SELECT @@VERSION AS v");
    return String(r.recordset[0].v).split("\n")[0];
  } finally {
    await pool.close();
  }
}

/**
 * Ejecuta un script .sql que usa separadores GO (como en SSMS / sqlcmd).
 * Usa UNA sola conexión, para que instrucciones como USE se mantengan entre lotes.
 */
export async function ejecutarScript(ruta: string, log: Log): Promise<void> {
  const texto = fs.readFileSync(ruta, "utf8");
  const lotes = texto.split(/^\s*GO\s*;?\s*$/gim).map((l) => l.trim()).filter((l) => l.replace(/\/\*[\s\S]*?\*\//g, "").trim());
  const pool = await conectar(configuracion("master", 1));
  try {
    let i = 0;
    let baseActual = "";
    for (const lote of lotes) {
      // Se antepone el último USE a cada lote para no depender de que el pool reutilice la misma conexión.
      const uso = lote.match(/^\s*USE\s+\[?(\w+)\]?\s*;?\s*$/im);
      if (uso) baseActual = uso[1];
      await pool.request().batch(baseActual && !uso ? `USE [${baseActual}];\n${lote}` : lote);
      i++;
      if (i % 5 === 0 || i === lotes.length) log(`  lote ${i}/${lotes.length} ejecutado`);
    }
  } finally {
    await pool.close();
  }
}
