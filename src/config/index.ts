import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export const RAIZ = path.resolve(__dirname, "..", "..");
export const RUTA_ENV = path.join(RAIZ, ".env");

const env = (k: string, def = ""): string => process.env[k] ?? def;

function construir() {
  return {
    sql: {
      server: env("SQL_SERVER", "localhost"),
      port: Number(env("SQL_PORT", "1433")),
      database: env("SQL_DATABASE", "TecnoHogarDB"),
      user: env("SQL_USER", "sa"),
      password: env("SQL_PASSWORD"),
      instance: env("SQL_INSTANCE") || undefined,
      encrypt: env("SQL_ENCRYPT", "false") === "true",
    },
    mongo: {
      uri: env("MONGO_URI", "mongodb://localhost:27017"),
      db: env("MONGO_DB", "tecnohogar"),
    },
    puerto: Number(env("PORT", "3000")),
    rutas: {
      sql: path.join(RAIZ, "sql"),
      evidencias: path.join(RAIZ, "evidencias"),
      publico: path.join(RAIZ, "public"),
    },
  };
}


export function recargarConfig(): void {
  if (fs.existsSync(RUTA_ENV)) dotenv.config({ path: RUTA_ENV, override: true });
  const nueva = construir();
  config.sql = nueva.sql;
  config.mongo = nueva.mongo;
}

if (fs.existsSync(RUTA_ENV)) dotenv.config({ path: RUTA_ENV, override: true });
export const config = construir();