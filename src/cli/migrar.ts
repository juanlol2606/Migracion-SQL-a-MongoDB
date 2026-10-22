import { conectarSqlServer } from "../db/sqlserver";
import { cerrarMongo, conectarMongo } from "../db/mongo";
import { migrar } from "../migracion/migrar";

(async () => {
  const fuente = await conectarSqlServer();
  try {
    await migrar(fuente, await conectarMongo(), console.log);
  } finally {
    await fuente.cerrar();
    await cerrarMongo();
  }
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
