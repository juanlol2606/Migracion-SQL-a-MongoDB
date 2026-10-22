/**
 * Verificación posterior a la migración: compara SQL Server contra MongoDB.
 *  0. Modelo relacional: 10 tablas, 11 llaves foráneas, ninguna tabla aislada, más de 5.000 registros.
 *  A. Conteos: cada tabla vs su colección o estructura embebida.
 *  B. Totales de control: sumas de dinero, unidades y promedios.
 *  C. Integridad de referencias: ninguna referencia apunta a un documento inexistente.
 *  D. Estructuras embebidas: reglas de negocio dentro de cada documento.
 *  E. Muestreo: pedidos y clientes al azar comparados campo a campo.
 */
import fs from "fs";
import path from "path";
import type { Db, Document } from "mongodb";
import type { FuenteSql } from "../db/sqlserver";
import { num } from "./migrar";
import { TABLAS, type ClienteDoc, type Log, type PedidoDoc } from "./tipos";

export interface Prueba { seccion: string; prueba: string; sql: string | number; mongo: string | number; ok: boolean }

export async function verificar(fuente: FuenteSql, db: Db, log: Log, muestras = 5): Promise<Prueba[]> {
  const res: Prueba[] = [];
  const check = (seccion: string, prueba: string, esperado: string | number, obtenido: string | number, tol = 0) => {
    const ok = typeof esperado === "number" && typeof obtenido === "number"
      ? Math.abs(esperado - obtenido) <= tol : esperado === obtenido;
    res.push({ seccion, prueba, sql: esperado, mongo: obtenido, ok });
    log(`  ${ok ? "OK " : "ERR"} | ${prueba}: SQL=${esperado}  Mongo=${obtenido}`);
  };
  const escalar = async (consulta: string, redondear = true): Promise<number> => {
    const [fila] = await fuente.consultar<Record<string, unknown>>(consulta);
    const v = Object.values(fila)[0];
    return v === null || v === undefined ? 0 : redondear ? num(v) : Number(v);
  };
  const suma = async (col: string, pipeline: Document[]): Promise<number> => {
    const [r] = await db.collection(col).aggregate(pipeline).toArray();
    return r ? Math.round(r.v * 100) / 100 : 0;
  };
  const cuenta = (col: string, filtro: Document = {}) => db.collection(col).countDocuments(filtro);

  // ------------------------------------------------------------- A
  // ------------------------------------------------------------- 0
  log("0. Requisitos del modelo relacional (SQL Server)");
  let S = "0. Modelo relacional";
  check(S, "Tablas de usuario en TecnoHogarDB", 10, await escalar("SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0"));
  check(S, "Llaves foráneas (relaciones) definidas", 11, await escalar("SELECT COUNT(*) FROM sys.foreign_keys"));
  check(S, "Tablas sin ninguna relación (aisladas)", 0, await escalar(
    `SELECT COUNT(*) FROM sys.tables t WHERE t.is_ms_shipped = 0 AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys f WHERE f.parent_object_id = t.object_id OR f.referenced_object_id = t.object_id)`));
  const totalRegistros = await escalar("SELECT " + TABLAS.map((t) => `(SELECT COUNT(*) FROM ${t})`).join(" + "));
  check(S, `Total de registros > 5.000 (hay ${totalRegistros})`, "sí", totalRegistros > 5000 ? "sí" : "no");

  // ------------------------------------------------------------- A
  log("A. Conteos de registros vs documentos");
  S = "A. Conteos";
  check(S, "Categorias -> categorias", await escalar("SELECT COUNT(*) FROM Categorias"), await cuenta("categorias"));
  check(S, "Proveedores -> proveedores", await escalar("SELECT COUNT(*) FROM Proveedores"), await cuenta("proveedores"));
  check(S, "Productos -> productos", await escalar("SELECT COUNT(*) FROM Productos"), await cuenta("productos"));
  check(S, "Clientes -> clientes", await escalar("SELECT COUNT(*) FROM Clientes"), await cuenta("clientes"));
  check(S, "Direcciones -> clientes.direcciones[]", await escalar("SELECT COUNT(*) FROM Direcciones"),
    await suma("clientes", [{ $group: { _id: null, v: { $sum: { $size: "$direcciones" } } } }]));
  check(S, "Pedidos -> pedidos", await escalar("SELECT COUNT(*) FROM Pedidos"), await cuenta("pedidos"));
  check(S, "DetallePedido -> pedidos.items[]", await escalar("SELECT COUNT(*) FROM DetallePedido"),
    await suma("pedidos", [{ $group: { _id: null, v: { $sum: { $size: "$items" } } } }]));
  check(S, "Pagos -> pedidos.pago{}", await escalar("SELECT COUNT(*) FROM Pagos"), await cuenta("pedidos", { pago: { $exists: true } }));
  check(S, "Envios -> pedidos.envio{}", await escalar("SELECT COUNT(*) FROM Envios"), await cuenta("pedidos", { envio: { $exists: true } }));
  check(S, "Resenas -> resenas", await escalar("SELECT COUNT(*) FROM Resenas"), await cuenta("resenas"));

  // ------------------------------------------------------------- B
  log("B. Totales de control");
  S = "B. Totales de control";
  check(S, "Suma DetallePedido.subtotal = suma items.subtotal", await escalar("SELECT SUM(subtotal) FROM DetallePedido"),
    await suma("pedidos", [{ $unwind: "$items" }, { $group: { _id: null, v: { $sum: "$items.subtotal" } } }]), 1);
  check(S, "Suma unidades vendidas (cantidad)", await escalar("SELECT SUM(cantidad) FROM DetallePedido"),
    await suma("pedidos", [{ $group: { _id: null, v: { $sum: "$resumen.unidades" } } }]));
  check(S, "Suma Pagos.monto = suma pago.monto", await escalar("SELECT SUM(monto) FROM Pagos"),
    await suma("pedidos", [{ $group: { _id: null, v: { $sum: "$pago.monto" } } }]), 1);
  check(S, "Suma Envios.costo_envio = suma envio.costo_envio", await escalar("SELECT SUM(costo_envio) FROM Envios"),
    await suma("pedidos", [{ $group: { _id: null, v: { $sum: "$envio.costo_envio" } } }]), 1);
  const [prom] = await db.collection("resenas").aggregate([{ $group: { _id: null, v: { $avg: "$calificacion" } } }]).toArray();
  check(S, "Promedio de calificación de reseñas",
    Math.round((await escalar("SELECT AVG(CAST(calificacion AS FLOAT)) FROM Resenas", false)) * 1e4) / 1e4,
    prom ? Math.round(prom.v * 1e4) / 1e4 : 0, 0.0001);
  for (const est of ["Entregado", "Cancelado", "Pendiente"]) {
    check(S, `Pedidos con estado '${est}'`, await escalar(`SELECT COUNT(*) FROM Pedidos WHERE estado = '${est}'`), await cuenta("pedidos", { estado: est }));
  }

  // ------------------------------------------------------------- C
  log("C. Integridad de referencias (huérfanos esperados = 0)");
  S = "C. Referencias";
  const huerfanos = async (col: string, campo: string, destino: string, unwind?: string) => {
    const p: Document[] = unwind ? [{ $unwind: unwind }] : [];
    p.push({ $lookup: { from: destino, localField: campo, foreignField: "_id", as: "ref" } },
      { $match: { ref: { $size: 0 } } }, { $count: "n" });
    const [r] = await db.collection(col).aggregate(p).toArray();
    return r ? r.n : 0;
  };
  check(S, "pedidos.cliente_id -> clientes", 0, await huerfanos("pedidos", "cliente_id", "clientes"));
  check(S, "pedidos.items.producto_id -> productos", 0, await huerfanos("pedidos", "items.producto_id", "productos", "$items"));
  check(S, "productos.categoria_id -> categorias", 0, await huerfanos("productos", "categoria_id", "categorias"));
  check(S, "productos.proveedor_id -> proveedores", 0, await huerfanos("productos", "proveedor_id", "proveedores"));
  check(S, "resenas.producto_id -> productos", 0, await huerfanos("resenas", "producto_id", "productos"));
  check(S, "resenas.cliente_id -> clientes", 0, await huerfanos("resenas", "cliente_id", "clientes"));

  // ------------------------------------------------------------- D
  log("D. Estructuras embebidas");
  S = "D. Embebidos";
  check(S, "Pedidos sin items", 0, await cuenta("pedidos", { items: { $size: 0 } }));
  check(S, "Pedidos donde pago.monto != resumen.total", 0,
    await cuenta("pedidos", { $expr: { $gt: [{ $abs: { $subtract: ["$pago.monto", "$resumen.total"] } }, 0.01] } }));
  check(S, "Pedidos donde resumen.total != suma(items.subtotal)", 0,
    await cuenta("pedidos", { $expr: { $gt: [{ $abs: { $subtract: ["$resumen.total", { $sum: "$items.subtotal" }] } }, 0.01] } }));
  check(S, "Pedidos Enviado/Entregado sin envío", 0,
    await cuenta("pedidos", { estado: { $in: ["Enviado", "Entregado"] }, envio: { $exists: false } }));
  check(S, "Clientes sin dirección principal", 0, await cuenta("clientes", { "direcciones.es_principal": { $ne: true } }));

  // ------------------------------------------------------------- E
  log("E. Muestreo aleatorio SQL vs Mongo");
  S = "E. Muestreo";
  const azar = (ids: number[], k: number) => [...ids].sort(() => Math.random() - 0.5).slice(0, k);
  const idsPed = (await fuente.consultar<{ pedido_id: number }>("SELECT pedido_id FROM Pedidos")).map((r) => r.pedido_id);
  for (const pid of azar(idsPed, muestras)) {
    const [p] = await fuente.consultar<{ cliente_id: number; estado: string; total: number }>(`SELECT cliente_id, estado, total FROM Pedidos WHERE pedido_id = ${pid}`);
    const det = await fuente.consultar<{ producto_id: number; cantidad: number }>(`SELECT producto_id, cantidad FROM DetallePedido WHERE pedido_id = ${pid} ORDER BY producto_id`);
    const [pg] = await fuente.consultar<{ metodo: string }>(`SELECT metodo FROM Pagos WHERE pedido_id = ${pid}`);
    const m = await db.collection<PedidoDoc>("pedidos").findOne({ _id: pid });
    if (!m) { check(S, `Pedido ${pid} existe en MongoDB`, "sí", "no"); continue; }
    const sqlV = JSON.stringify([p.cliente_id, p.estado, num(p.total), det.map((x) => [x.producto_id, x.cantidad]), pg.metodo]);
    const monV = JSON.stringify([m.cliente_id, m.estado, m.resumen.total,
      m.items.map((i) => [i.producto_id, i.cantidad]).sort((a, b) => a[0] - b[0]), m.pago?.metodo]);
    check(S, `Pedido ${pid} [cliente, estado, total, items, método pago]`, sqlV, monV);
  }
  const idsCli = (await fuente.consultar<{ cliente_id: number }>("SELECT cliente_id FROM Clientes")).map((r) => r.cliente_id);
  for (const cid of azar(idsCli, muestras)) {
    const [c] = await fuente.consultar<{ email: string }>(`SELECT email FROM Clientes WHERE cliente_id = ${cid}`);
    const dirs = await fuente.consultar<{ direccion_id: number; ciudad: string }>(`SELECT direccion_id, ciudad FROM Direcciones WHERE cliente_id = ${cid} ORDER BY direccion_id`);
    const m = await db.collection<ClienteDoc>("clientes").findOne({ _id: cid });
    if (!m) { check(S, `Cliente ${cid} existe en MongoDB`, "sí", "no"); continue; }
    check(S, `Cliente ${cid} [email, direcciones]`,
      JSON.stringify([c.email, dirs.map((x) => [x.direccion_id, x.ciudad])]),
      JSON.stringify([m.email, m.direcciones.map((x) => [x.direccion_id, x.ciudad])]));
  }

  const ok = res.filter((r) => r.ok).length;
  log(`\n${ok}/${res.length} pruebas superadas`);
  return res;
}

export function escribirReporte(res: Prueba[], carpeta: string): string {
  fs.mkdirSync(carpeta, { recursive: true });
  const ahora = new Date();
  const sello = ahora.toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  const ruta = path.join(carpeta, `verificacion_${sello}.md`);
  const ok = res.filter((r) => r.ok).length;
  let md = `# Reporte de verificación de la migración\n\nFecha: ${ahora.toLocaleString("es-CO")}  \nResultado: **${ok}/${res.length} pruebas superadas**\n`;
  let seccion = "";
  for (const r of res) {
    if (r.seccion !== seccion) {
      const cols = r.seccion.startsWith("0.") ? "Esperado | Encontrado en SQL Server" : "SQL Server | MongoDB";
      md += `\n## ${r.seccion}\n\n| Prueba | ${cols} | Resultado |\n|---|---|---|---|\n`;
      seccion = r.seccion;
    }
    md += `| ${r.prueba} | ${r.sql} | ${r.mongo} | ${r.ok ? "✅" : "❌"} |\n`;
  }
  fs.writeFileSync(ruta, md, "utf8");
  return ruta;
}
