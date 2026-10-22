import { config } from "../config";
import { generarScript } from "../datos/generarDatos";

const resumen = generarScript(config.rutas.sql);
for (const r of resumen) console.log(`${r.tabla.padEnd(15)}${String(r.registros).padStart(7)}`);
console.log(`${"TOTAL".padEnd(15)}${String(resumen.reduce((s, r) => s + r.registros, 0)).padStart(7)}`);
