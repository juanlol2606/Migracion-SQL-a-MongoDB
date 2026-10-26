
import type { Document } from "mongodb";

export const FECHA_CORTE = new Date("2025-12-31T23:59:59Z");
const HACE_180_DIAS = new Date("2025-07-04T00:00:00Z");
const DIA_MS = 86_400_000;
const VENTA_VALIDA = ["Pagado", "Enviado", "Entregado"];

export interface Consulta {
  id: number;
  titulo: string;
  pregunta: string;
  coleccion: "pedidos" | "clientes" | "productos" | "resenas" | "categorias" | "proveedores";
  tecnicas: string[];
  pipeline: Document[];
}

export const CONSULTAS: Consulta[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 1,
    titulo: "Ranking de proveedores: ingresos, margen y calidad",
    pregunta: "¿Qué proveedores generan más ventas, con qué margen y con qué calidad percibida?",
    coleccion: "pedidos",
    tecnicas: ["$match", "$unwind", "2 × $lookup", "$group", "$addToSet", "$push", "$avg", "$project", "$sort", "$limit"],
    pipeline: [
      { $match: { estado: { $in: VENTA_VALIDA } } },
      { $unwind: "$items" },
      { $lookup: { from: "productos", localField: "items.producto_id", foreignField: "_id", as: "producto" } },
      { $unwind: "$producto" },
      {
        $group: {
          _id: "$producto.proveedor_id",
          ingresos: { $sum: "$items.subtotal" },
          costo: { $sum: { $multiply: ["$items.cantidad", "$producto.costo"] } },
          unidades: { $sum: "$items.cantidad" },
          productos: { $addToSet: "$producto._id" },
          calificaciones: { $push: "$producto.calificacion.promedio" },
        },
      },
      { $lookup: { from: "proveedores", localField: "_id", foreignField: "_id", as: "proveedor" } },
      { $unwind: "$proveedor" },
      {
        $project: {
          _id: 0,
          proveedor: "$proveedor.nombre",
          pais: "$proveedor.ubicacion.pais",
          productos_vendidos: { $size: "$productos" },
          unidades: 1,
          ingresos: { $round: ["$ingresos", 0] },
          margen_pct: { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$ingresos", "$costo"] }, "$ingresos"] }, 100] }, 1] },
          calificacion_prom: { $round: [{ $avg: "$calificaciones" }, 2] },
        },
      },
      { $sort: { ingresos: -1 } },
      { $limit: 10 },
    ],
  },
  // ------------------------------------------------------------------ 2
  {
    id: 2,
    titulo: "Productos que se compran juntos",
    pregunta: "¿Qué pares de productos aparecen juntos en el mismo pedido con más frecuencia?",
    coleccion: "pedidos",
    tecnicas: ["$match", "$project", "doble $unwind", "$expr", "$group", "$sort", "$limit", "2 × $lookup", "$arrayElemAt"],
    pipeline: [
      { $match: { estado: { $ne: "Cancelado" }, "resumen.num_items": { $gte: 2 } } },
      { $project: { a: "$items.producto_id", b: "$items.producto_id" } },
      { $unwind: "$a" },
      { $unwind: "$b" },
      { $match: { $expr: { $lt: ["$a", "$b"] } } },          // cada par una sola vez (a < b)
      { $group: { _id: { a: "$a", b: "$b" }, veces: { $sum: 1 } } },
      { $match: { veces: { $gte: 2 } } },
      { $sort: { veces: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, a: "$_id.a", b: "$_id.b", veces: 1 } },
      { $lookup: { from: "productos", localField: "a", foreignField: "_id", as: "pa" } },
      { $lookup: { from: "productos", localField: "b", foreignField: "_id", as: "pb" } },
      {
        $project: {
          producto_1: { $arrayElemAt: ["$pa.nombre", 0] },
          producto_2: { $arrayElemAt: ["$pb.nombre", 0] },
          veces_juntos: "$veces",
        },
      },
    ],
  },
  // ------------------------------------------------------------------ 3
  {
    id: 3,
    titulo: "Inventario inmovilizado",
    pregunta: "¿Qué productos activos tienen stock pero no se han vendido en los últimos 180 días, y cuánto dinero hay detenido en ellos?",
    coleccion: "productos",
    tecnicas: ["$match", "$lookup con let/pipeline", "$expr", "$size", "2 × $lookup", "$project", "$multiply", "$sort", "$limit"],
    pipeline: [
      { $match: { activo: true, stock: { $gt: 0 } } },
      {
        $lookup: {
          from: "pedidos",
          let: { pid: "$_id" },
          pipeline: [
            { $match: { fecha_pedido: { $gte: HACE_180_DIAS }, estado: { $ne: "Cancelado" } } },
            { $unwind: "$items" },
            { $match: { $expr: { $eq: ["$items.producto_id", "$$pid"] } } },
            { $group: { _id: null, unidades: { $sum: "$items.cantidad" } } },
          ],
          as: "ventas",
        },
      },
      { $match: { ventas: { $size: 0 } } },                    // sin ventas en 180 días
      { $lookup: { from: "categorias", localField: "categoria_id", foreignField: "_id", as: "categoria" } },
      { $unwind: "$categoria" },
      { $lookup: { from: "proveedores", localField: "proveedor_id", foreignField: "_id", as: "proveedor" } },
      { $unwind: "$proveedor" },
      {
        $project: {
          _id: 0,
          sku: 1,
          producto: "$nombre",
          categoria: "$categoria.nombre",
          proveedor: "$proveedor.nombre",
          stock: 1,
          costo: 1,
          valor_inmovilizado: { $multiply: ["$stock", "$costo"] },
        },
      },
      { $sort: { valor_inmovilizado: -1 } },
      { $limit: 15 },
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    id: 4,
    titulo: "Efecto de los descuentos en las ventas",
    pregunta: "¿Las líneas con descuento venden más unidades que las que no tienen descuento, y cuánto dinero se cede?",
    coleccion: "pedidos",
    tecnicas: ["$match", "$unwind", "$project con cálculo de porcentaje", "$group", "$avg", "$sort"],
    pipeline: [
      { $match: { estado: { $in: VENTA_VALIDA } } },
      { $unwind: "$items" },
      {
        $project: {
          cantidad: "$items.cantidad",
          subtotal: "$items.subtotal",
          descuento: "$items.descuento",
          pct: {
            $round: [{
              $multiply: [{
                $divide: ["$items.descuento", { $multiply: ["$items.precio_unitario", "$items.cantidad"] }],
              }, 100],
            }, 0],
          },
        },
      },
      {
        $group: {
          _id: "$pct",
          lineas: { $sum: 1 },
          unidades_prom: { $avg: "$cantidad" },
          ingresos: { $sum: "$subtotal" },
          descuento_cedido: { $sum: "$descuento" },
        },
      },
      {
        $project: {
          _id: 0,
          descuento_pct: "$_id",
          lineas: 1,
          unidades_por_linea: { $round: ["$unidades_prom", 2] },
          ingresos: { $round: ["$ingresos", 0] },
          descuento_cedido: { $round: ["$descuento_cedido", 0] },
        },
      },
      { $sort: { descuento_pct: 1 } },
    ],
  },
  // ------------------------------------------------------------------ 5
  {
    id: 5,
    titulo: "Impacto de los retrasos en la satisfacción",
    pregunta: "¿Los clientes califican peor los productos cuando la entrega llegó tarde?",
    coleccion: "pedidos",
    tecnicas: ["$match", "$project con aritmética de fechas", "$unwind", "$lookup con let/pipeline (2 condiciones)", "$and", "$group", "$cond"],
    pipeline: [
      { $match: { "envio.estado": "Entregado" } },
      {
        $project: {
          cliente_id: 1,
          items: 1,
          a_tiempo: { $lte: [{ $subtract: ["$envio.fecha_entrega", "$envio.fecha_estimada"] }, DIA_MS] },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "resenas",
          let: { c: "$cliente_id", p: "$items.producto_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$cliente_id", "$$c"] }, { $eq: ["$producto_id", "$$p"] }] } } },
            { $project: { _id: 0, calificacion: 1 } },
          ],
          as: "resena",
        },
      },
      { $unwind: "$resena" },
      {
        $group: {
          _id: "$a_tiempo",
          resenas: { $sum: 1 },
          promedio: { $avg: "$resena.calificacion" },
          negativas: { $sum: { $cond: [{ $lte: ["$resena.calificacion", 2] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          entrega: { $cond: ["$_id", "A tiempo", "Con retraso"] },
          resenas: 1,
          calificacion_prom: { $round: ["$promedio", 2] },
          pct_negativas: { $round: [{ $multiply: [{ $divide: ["$negativas", "$resenas"] }, 100] }, 1] },
        },
      },
    ],
  },
  // ------------------------------------------------------------------ 6
  {
    id: 6,
    titulo: "Grupo de clientes por año de registro",
    pregunta: "¿Los clientes que se registraron en años más recientes compran tanto como los antiguos?",
    coleccion: "clientes",
    tecnicas: ["$lookup con let/pipeline", "$year", "$cond", "$ifNull", "$arrayElemAt", "$group", "$project", "$sort"],
    pipeline: [
      {
        $lookup: {
          from: "pedidos",
          let: { cid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$cliente_id", "$$cid"] }, estado: "Entregado" } },
            { $group: { _id: null, pedidos: { $sum: 1 }, total: { $sum: "$resumen.total" } } },
          ],
          as: "compras",
        },
      },
      {
        $project: {
          anio: { $year: "$fecha_registro" },
          compro: { $cond: [{ $gt: [{ $size: "$compras" }, 0] }, 1, 0] },
          pedidos: { $ifNull: [{ $arrayElemAt: ["$compras.pedidos", 0] }, 0] },
          total: { $ifNull: [{ $arrayElemAt: ["$compras.total", 0] }, 0] },
        },
      },
      {
        $group: {
          _id: "$anio",
          clientes: { $sum: 1 },
          compradores: { $sum: "$compro" },
          pedidos: { $sum: "$pedidos" },
          ingresos: { $sum: "$total" },
        },
      },
      {
        $project: {
          _id: 0,
          anio_registro: "$_id",
          clientes: 1,
          pct_compradores: { $round: [{ $multiply: [{ $divide: ["$compradores", "$clientes"] }, 100] }, 1] },
          pedidos_por_cliente: { $round: [{ $divide: ["$pedidos", "$clientes"] }, 2] },
          ingreso_por_cliente: { $round: [{ $divide: ["$ingresos", "$clientes"] }, 0] },
        },
      },
      { $sort: { anio_registro: 1 } },
    ],
  },
  // ------------------------------------------------------------------ 7
  {
    id: 7,
    titulo: "Pagos rechazados y reembolsados por método",
    pregunta: "¿Con qué método de pago se pierden más ventas por rechazos o reembolsos, y cuánto dinero representan?",
    coleccion: "pedidos",
    tecnicas: ["$group", "$cond", "$eq", "$in", "$add", "$project", "$sort", "sin $lookup: el pago está embebido"],
    pipeline: [
      {
        $group: {
          _id: "$pago.metodo",
          pedidos: { $sum: 1 },
          rechazados: { $sum: { $cond: [{ $eq: ["$pago.estado", "Rechazado"] }, 1, 0] } },
          reembolsados: { $sum: { $cond: [{ $eq: ["$pago.estado", "Reembolsado"] }, 1, 0] } },
          monto_perdido: { $sum: { $cond: [{ $in: ["$pago.estado", ["Rechazado", "Reembolsado"]] }, "$pago.monto", 0] } },
          monto_aprobado: { $sum: { $cond: [{ $eq: ["$pago.estado", "Aprobado"] }, "$pago.monto", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          metodo: "$_id",
          pedidos: 1,
          rechazados: 1,
          reembolsados: 1,
          pct_fallidos: { $round: [{ $multiply: [{ $divide: [{ $add: ["$rechazados", "$reembolsados"] }, "$pedidos"] }, 100] }, 1] },
          monto_perdido: { $round: ["$monto_perdido", 0] },
          monto_aprobado: { $round: ["$monto_aprobado", 0] },
        },
      },
      { $sort: { pct_fallidos: -1 } },
    ],
  },
  // ------------------------------------------------------------------ 8
  {
    id: 8,
    titulo: "Frecuencia de recompra por segmento",
    pregunta: "¿Cada cuántos días vuelve a comprar un cliente, según su segmento?",
    coleccion: "pedidos",
    tecnicas: ["$match", "$group (2 niveles)", "$min", "$max", "$lookup", "$unwind", "$project con aritmética de fechas", "$concat", "$toString", "$sort"],
    pipeline: [
      { $match: { estado: "Entregado" } },
      { $group: { _id: "$cliente_id", pedidos: { $sum: 1 }, primera: { $min: "$fecha_pedido" }, ultima: { $max: "$fecha_pedido" } } },
      { $match: { pedidos: { $gte: 2 } } },
      { $lookup: { from: "clientes", localField: "_id", foreignField: "_id", as: "cliente" } },
      { $unwind: "$cliente" },
      {
        $project: {
          segmento: "$cliente.segmento",
          pedidos: 1,
          dias_entre_compras: {
            $divide: [
              { $divide: [{ $subtract: ["$ultima", "$primera"] }, DIA_MS] },
              { $subtract: ["$pedidos", 1] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$segmento",
          clientes: { $sum: 1 },
          pedidos_prom: { $avg: "$pedidos" },
          dias_prom: { $avg: "$dias_entre_compras" },
          dias_min: { $min: "$dias_entre_compras" },
          dias_max: { $max: "$dias_entre_compras" },
        },
      },
      {
        $project: {
          _id: 0,
          segmento: "$_id",
          clientes: 1,
          pedidos_prom: { $round: ["$pedidos_prom", 1] },
          dias_entre_compras: { $round: ["$dias_prom", 0] },
          rango_dias: {
            $concat: [
              { $toString: { $round: ["$dias_min", 0] } }, " a ",
              { $toString: { $round: ["$dias_max", 0] } },
            ],
          },
        },
      },
      { $sort: { dias_entre_compras: 1 } },
    ],
  },
];
