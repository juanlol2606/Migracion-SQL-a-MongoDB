import { config } from "../config";
import { conectarSqlServer } from "../db/sqlserver";
import { cerrarMongo, conectarMongo } from "../db/mongo";
import { escribirReporte, verificar } from "../migracion/verificar";

(async () => {
  const fuente = await conectarSqlServer();
  try {
    const res = await verificar(fuente, await conectarMongo(), console.log);
    console.log(`Reporte: ${escribirReporte(res, config.rutas.evidencias)}`);
  } finally {
    await fuente.cerrar();
    await cerrarMongo();
  }
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
