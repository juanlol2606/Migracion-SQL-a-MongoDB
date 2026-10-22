import path from "path";
import { config } from "../config";
import { ejecutarScript } from "../db/sqlserver";

(async () => {
  for (const archivo of ["01_crear_bd.sql", "02_cargar_datos.sql"]) {
    console.log(`Ejecutando ${archivo}...`);
    await ejecutarScript(path.join(config.rutas.sql, archivo), console.log);
  }
  console.log("Base de datos TecnoHogarDB lista.");
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
