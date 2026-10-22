/**
 * Migración TecnoHogarDB (SQL Server)  ->  tecnohogar (MongoDB)
 *
 *  1. EXTRACT   : lee las 10 tablas de SQL Server.
 *  2. TRANSFORM : convierte tipos y reorganiza las 10 tablas en 6 colecciones:
 *
 *     Tablas SQL Server                         Colección     Técnica
 *     ----------------------------------------  ------------  ------------------------------------------
 *     Categorias                                categorias    colección independiente
 *     Proveedores                               proveedores   colección independiente (+ subdocumentos)
 *     Productos (+ resumen de Resenas)          productos     referencing (categoria_id, proveedor_id)
 *                                                             + patrón computado (calificacion)
 *     Clientes + Direcciones                    clientes      embedding (array direcciones)
 *     Pedidos + DetallePedido + Pagos + Envios  pedidos       embedding (items[], pago{}, envio{})
 *                                                             + referencing (cliente_id, items.producto_id)
 *     Resenas                                   resenas       referencing (producto_id, cliente_id)
 *
 *  3. LOAD      : inserta por lotes (insertMany) y crea índices y validador.
 */
import type { Db, Document, IndexDescription } from "mongodb";
import type { FuenteSql } from "../db/sqlserver";
import {
  TABLAS, type ClienteDoc, type ColeccionesMongo, type DatosRelacionales, type DireccionEmb,
  type ItemEmb, type Log, type PedidoDoc, type ProductoDoc,
} from "./tipos";

const LOTE = 1000;

// ------------------------------------------------------------------ utilidades de tipos
/** DECIMAL -> double redondeado a 2 decimales. */
export const num = (v: unknown): number => Math.round(Number(v) * 100) / 100;

/** DATE / DATETIME2 -> Date (BSON Date). MongoDB no tiene tipo "solo fecha". */
export function fecha(v: unknown): Date {
  if (v instanceof Date) return v;
  const s = String(v);
  return new Date(s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(" ", "T")}Z`);
}

/** Igual que fecha(), pero para columnas que admiten NULL. */
export const fechaOpc = (v: unknown): Date | undefined => (v === null || v === undefined ? undefined : fecha(v));

/** Elimina las claves con null/undefined: en MongoDB es mejor omitir el campo que guardar null. */
export function sinNulos<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

function agruparPor<T, K>(filas: T[], clave: (f: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const f of filas) {
    const k = clave(f);
    const lista = m.get(k);
    if (lista) lista.push(f); else m.set(k, [f]);
  }
  return m;
}

// ------------------------------------------------------------------ 1. EXTRACT
export async function extraer(fuente: FuenteSql, log: Log): Promise<DatosRelacionales> {
  const datos = {} as DatosRelacionales;
  for (const tabla of TABLAS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (datos as any)[tabla] = await fuente.consultar(`SELECT * FROM ${tabla}`);
    log(`  [extract] ${tabla.padEnd(14)} ${String(datos[tabla].length).padStart(6)} filas`);
  }
  return datos;
}

// ------------------------------------------------------------------ 2. TRANSFORM
export function transformar(d: DatosRelacionales, log: Log): ColeccionesMongo {
  // --- categorias y proveedores: entidades independientes, compartidas por muchos productos
  const categorias = d.Categorias.map((c) => sinNulos({ _id: c.categoria_id, nombre: c.nombre, descripcion: c.descripcion ?? undefined }));
  const proveedores = d.Proveedores.map((p) => ({
    _id: p.proveedor_id, nombre: p.nombre, nit: p.nit,
    contacto: sinNulos({ email: p.email, telefono: p.telefono ?? undefined }),
    ubicacion: { ciudad: p.ciudad, pais: p.pais },
  }));

  // --- resumen de reseñas por producto (patrón computado: evita recalcular en cada lectura)
  const resumenResenas = new Map<number, { suma: number; n: number }>();
  for (const r of d.Resenas) {
    const a = resumenResenas.get(r.producto_id) ?? { suma: 0, n: 0 };
    a.suma += Number(r.calificacion); a.n += 1;
    resumenResenas.set(r.producto_id, a);
  }
  const productos: ProductoDoc[] = d.Productos.map((p) => {
    const a = resumenResenas.get(p.producto_id);
    return sinNulos({
      _id: p.producto_id, sku: p.sku, nombre: p.nombre, descripcion: p.descripcion ?? undefined,
      precio: num(p.precio), costo: num(p.costo), stock: p.stock, activo: Boolean(p.activo),
      fecha_creacion: fecha(p.fecha_creacion),
      categoria_id: p.categoria_id,   // REFERENCING -> categorias
      proveedor_id: p.proveedor_id,   // REFERENCING -> proveedores
      calificacion: { promedio: a ? Math.round((a.suma / a.n) * 100) / 100 : null, total_resenas: a?.n ?? 0 },
    });
  });

  // --- clientes + direcciones (EMBEDDING: uno-a-pocos, se consultan juntos)
  const direccionPorId = new Map<number, DireccionEmb>();
  for (const x of d.Direcciones) {
    direccionPorId.set(x.direccion_id, sinNulos({
      direccion_id: x.direccion_id, tipo: x.tipo, direccion: x.direccion, ciudad: x.ciudad,
      departamento: x.departamento, codigo_postal: x.codigo_postal ?? undefined, es_principal: Boolean(x.es_principal),
    }));
  }
  const dirsPorCliente = agruparPor(d.Direcciones, (x) => x.cliente_id);
  const clientes: ClienteDoc[] = d.Clientes.map((c) => sinNulos({
    _id: c.cliente_id, nombres: c.nombres, apellidos: c.apellidos, email: c.email,
    telefono: c.telefono ?? undefined, fecha_nacimiento: fechaOpc(c.fecha_nacimiento),
    fecha_registro: fecha(c.fecha_registro), segmento: c.segmento,
    direcciones: (dirsPorCliente.get(c.cliente_id) ?? [])
      .sort((a, b) => a.direccion_id - b.direccion_id)
      .map((x) => direccionPorId.get(x.direccion_id)!),
  }));

  // --- pedidos + detalle + pago + envío (EMBEDDING: el pedido es la unidad de lectura)
  const productoPorId = new Map(d.Productos.map((p) => [p.producto_id, p]));
  const itemsPorPedido = agruparPor(d.DetallePedido, (x) => x.pedido_id);
  const pagoPorPedido = new Map(d.Pagos.map((x) => [x.pedido_id, x]));
  const envioPorPedido = new Map(d.Envios.map((x) => [x.pedido_id, x]));

  const pedidos: PedidoDoc[] = d.Pedidos.map((p) => {
    const items: ItemEmb[] = (itemsPorPedido.get(p.pedido_id) ?? [])
      .sort((a, b) => a.detalle_id - b.detalle_id)
      .map((x) => {
        const prod = productoPorId.get(x.producto_id)!;
        return {
          detalle_id: x.detalle_id,
          producto_id: x.producto_id,               // REFERENCING -> productos (datos vivos)
          sku: prod.sku, nombre: prod.nombre,       // snapshot: nombre al momento de la compra
          cantidad: x.cantidad, precio_unitario: num(x.precio_unitario),
          descuento: num(x.descuento), subtotal: num(x.subtotal),
        };
      });
    const { tipo: _t, es_principal: _e, ...direccionEnvio } = direccionPorId.get(p.direccion_id)!;
    const doc: PedidoDoc = {
      _id: p.pedido_id,
      cliente_id: p.cliente_id,                     // REFERENCING -> clientes
      fecha_pedido: fecha(p.fecha_pedido),
      estado: p.estado,
      direccion_envio: direccionEnvio,              // snapshot de la dirección usada
      items,
      resumen: {
        num_items: items.length,
        unidades: items.reduce((s, i) => s + i.cantidad, 0),
        subtotal: num(p.subtotal), descuento: num(p.descuento), total: num(p.total),
      },
    };
    const pg = pagoPorPedido.get(p.pedido_id);
    if (pg) {
      doc.pago = sinNulos({
        pago_id: pg.pago_id, metodo: pg.metodo, estado: pg.estado, monto: num(pg.monto),
        fecha_pago: fechaOpc(pg.fecha_pago), referencia: pg.referencia,
      });
    }
    const en = envioPorPedido.get(p.pedido_id);
    if (en) {
      doc.envio = sinNulos({
        envio_id: en.envio_id, transportadora: en.transportadora, numero_guia: en.numero_guia, estado: en.estado,
        fecha_envio: fecha(en.fecha_envio), fecha_estimada: fecha(en.fecha_estimada),
        fecha_entrega: fechaOpc(en.fecha_entrega), costo_envio: num(en.costo_envio),
      });
    }
    return doc;
  });

  // --- reseñas: crecen sin límite -> colección aparte con referencias
  const resenas = d.Resenas.map((r) => sinNulos({
    _id: r.resena_id,
    producto_id: r.producto_id,                     // REFERENCING -> productos
    cliente_id: r.cliente_id,                       // REFERENCING -> clientes
    calificacion: Number(r.calificacion), comentario: r.comentario ?? undefined, fecha: fecha(r.fecha),
  }));

  const col: ColeccionesMongo = { categorias, proveedores, productos, clientes, pedidos, resenas };
  for (const [nombre, docs] of Object.entries(col)) log(`  [transform] ${nombre.padEnd(12)} ${String(docs.length).padStart(6)} documentos`);
  return col;
}

// ------------------------------------------------------------------ 3. LOAD
export const VALIDADOR_PEDIDOS: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: ["cliente_id", "fecha_pedido", "estado", "items", "resumen"],
    properties: {
      cliente_id: { bsonType: "int" },
      fecha_pedido: { bsonType: "date" },
      estado: { enum: ["Pendiente", "Pagado", "Enviado", "Entregado", "Cancelado"] },
      items: {
        bsonType: "array", minItems: 1,
        items: {
          bsonType: "object", required: ["producto_id", "cantidad", "precio_unitario", "subtotal"],
          properties: { cantidad: { bsonType: "int", minimum: 1 } },
        },
      },
    },
  },
};

export const INDICES: Record<string, IndexDescription[]> = {
  clientes: [{ key: { email: 1 }, unique: true }, { key: { "direcciones.ciudad": 1 } }],
  productos: [{ key: { sku: 1 }, unique: true }, { key: { categoria_id: 1 } }, { key: { proveedor_id: 1 } }],
  pedidos: [{ key: { cliente_id: 1, fecha_pedido: -1 } }, { key: { fecha_pedido: 1 } }, { key: { estado: 1 } }, { key: { "items.producto_id": 1 } }],
  resenas: [{ key: { producto_id: 1 } }, { key: { cliente_id: 1, producto_id: 1 }, unique: true }],
};

export async function cargar(db: Db, col: ColeccionesMongo, log: Log, usarValidador = true): Promise<void> {
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const nombre of Object.keys(col)) {
    if (existentes.has(nombre)) await db.dropCollection(nombre); // idempotente: se puede ejecutar varias veces
  }
  if (usarValidador) await db.createCollection("pedidos", { validator: VALIDADOR_PEDIDOS });
  for (const [nombre, docs] of Object.entries(col) as [string, Document[]][]) {
    for (let i = 0; i < docs.length; i += LOTE) {
      await db.collection(nombre).insertMany(docs.slice(i, i + LOTE), { ordered: false });
    }
    log(`  [load] ${nombre.padEnd(12)} ${String(await db.collection(nombre).countDocuments()).padStart(6)} documentos insertados`);
  }
  for (const [nombre, indices] of Object.entries(INDICES)) await db.collection(nombre).createIndexes(indices);
  log("  [load] índices creados");
}

export interface ResumenMigracion { segundos: number; filas: Record<string, number>; documentos: Record<string, number> }

export async function migrar(fuente: FuenteSql, db: Db, log: Log, usarValidador = true): Promise<ResumenMigracion> {
  const t0 = Date.now();
  log("1) EXTRACT desde SQL Server");
  const datos = await extraer(fuente, log);
  log("2) TRANSFORM al modelo documental");
  const col = transformar(datos, log);
  log("3) LOAD en MongoDB");
  await cargar(db, col, log, usarValidador);
  const segundos = (Date.now() - t0) / 1000;
  log(`Migración terminada en ${segundos.toFixed(1)} s`);
  return {
    segundos,
    filas: Object.fromEntries(TABLAS.map((t) => [t, datos[t].length])),
    documentos: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v.length])),
  };
}
