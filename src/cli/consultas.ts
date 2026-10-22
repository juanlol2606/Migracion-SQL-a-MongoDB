import path from "path";
import { config, RAIZ } from "../config";
import { cerrarMongo, conectarMongo } from "../db/mongo";
import { ejecutarTodas, generarJs } from "../consultas/ejecutar";

(async () => {
  const args = process.argv.slice(2);
  if (args.includes("--js")) {
    const ruta = path.join(RAIZ, "consultas", "consultas_mongosh.js");
    generarJs(ruta);
    console.log(`Generado ${ruta}`);
    return;
  }
  try {
    const ruta = await ejecutarTodas(await conectarMongo(), config.rutas.evidencias, args.map(Number).filter(Boolean));
    console.log(`Resultados guardados en ${ruta}`);
  } finally {
    await cerrarMongo();
  }
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
