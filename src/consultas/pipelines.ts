
import type { Document } from "mongodb";

export const FECHA_CORTE = new Date("2025-12-31T23:59:59Z");
const INICIO_2025 = new Date("2025-01-01T00:00:00Z");
const INICIO_2026 = new Date("2026-01-01T00:00:00Z");
const HACE_90_DIAS = new Date("2025-10-02T00:00:00Z");   
const HACE_180_DIAS = new Date("2025-07-04T00:00:00Z");  
const DIA_MS = 86_400_000;                               
const VENTA_VALIDA = ["Pagado", "Enviado", "Entregado"];

export interface Consulta {
  id: number;
  titulo: string;
  pregunta: string;
  decision: string;
  coleccion: "pedidos" | "clientes" | "productos" | "resenas" | "categorias" | "proveedores";
  tecnicas: string[];
  pipeline: Document[];
}

export const CONSULTAS: Consulta[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 1,
    titulo: "Ingresos y margen bruto por categoría ",
    pregunta: "Qué categorías generan más ingresos y cuáles dejan mejor margen?",
    decision: "",
    coleccion: "pedidos",
    tecnicas: ["$match", "$unwind", "2 × $lookup", "$group", "$addToSet", "$project", "$sort"],
    pipeline: [
      { $match: { estado: { $in: VENTA_VALIDA }, fecha_pedido: { $gte: INICIO_2025, $lt: INICIO_2026 } } },
      { $unwind: "$items" },
      { $lookup: { from: "productos", localField: "items.producto_id", foreignField: "_id", as: "producto" } },
      { $unwind: "$producto" },
      { $lookup: { from: "categorias", localField: "producto.categoria_id", foreignField: "_id", as: "categoria" } },
      { $unwind: "$categoria" },
      {
        $group: {
          _id: "$categoria.nombre",
          ingresos: { $sum: "$items.subtotal" },
          costo: { $sum: { $multiply: ["$items.cantidad", "$producto.costo"] } },
          unidades: { $sum: "$items.cantidad" },
          pedidos: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          categoria: "$_id",
          ingresos: { $round: ["$ingresos", 0] },
          unidades: 1,
          num_pedidos: { $size: "$pedidos" },
          margen_bruto: { $round: [{ $subtract: ["$ingresos", "$costo"] }, 0] },
          margen_pct: { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$ingresos", "$costo"] }, "$ingresos"] }, 100] }, 1] },
        },
      },
      { $sort: { ingresos: -1 } },
    ],
  },
  // ------------------------------------------------------------------ 2
  {
    id: 2,
    titulo: "Top 10 clientes por valor de compra",
    pregunta: "¿Quiénes son los clientes más valiosos y dónde están?",
    decision: "",
    coleccion: "pedidos",
    tecnicas: ["$match", "$group", "$sort", "$limit", "$lookup", "$unwind", "$project", "$filter"],
    pipeline: [
      { $match: { estado: "Entregado" } },
      {
        $group: {
          _id: "$cliente_id",
          total_comprado: { $sum: "$resumen.total" },
          num_pedidos: { $sum: 1 },
          ultima_compra: { $max: "$fecha_pedido" },
        },
      },
      { $sort: { total_comprado: -1 } },
      { $limit: 10 },
      { $lookup: { from: "clientes", localField: "_id", foreignField: "_id", as: "cliente" } },
      { $unwind: "$cliente" },
      {
        $project: {
          _id: 0,
          cliente_id: "$_id",
          nombre: { $concat: ["$cliente.nombres", " ", "$cliente.apellidos"] },
          email: "$cliente.email",
          segmento: "$cliente.segmento",
          ciudad_principal: {
            $arrayElemAt: [{
              $map: {
                input: { $filter: { input: "$cliente.direcciones", as: "d", cond: { $eq: ["$$d.es_principal", true] } } },
                as: "d", in: "$$d.ciudad",
              },
            }, 0],
          },
          num_pedidos: 1,
          total_comprado: { $round: ["$total_comprado", 0] },
          ticket_promedio: { $round: [{ $divide: ["$total_comprado", "$num_pedidos"] }, 0] },
          ultima_compra: 1,
        },
      },
    ],
  },
  // ------------------------------------------------------------------ 3
  {
    id: 3,
    titulo: "Productos en riesgo de quedarse sin inventario",
    pregunta: "¿Qué productos se agotarán en menos de 30 días al ritmo de venta actual y a qué proveedor hay que pedirles?",
    decision: "",
    coleccion: "pedidos",
    tecnicas: ["$match", "$unwind", "$group", "3 × $lookup", "$project", "$sort", "$limit"],
    pipeline: [
      { $match: { estado: { $ne: "Cancelado" }, fecha_pedido: { $gte: HACE_90_DIAS } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.producto_id", unidades_90d: { $sum: "$items.cantidad" } } },
      { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "producto" } },
      { $unwind: "$producto" },
      { $match: { "producto.activo": true } },
      { $lookup: { from: "proveedores", localField: "producto.proveedor_id", foreignField: "_id", as: "proveedor" } },
      { $unwind: "$proveedor" },
      { $lookup: { from: "categorias", localField: "producto.categoria_id", foreignField: "_id", as: "categoria" } },
      { $unwind: "$categoria" },
      {
        $project: {
          _id: 0,
          sku: "$producto.sku",
          producto: "$producto.nombre",
          categoria: "$categoria.nombre",
          stock: "$producto.stock",
          unidades_90d: 1,
          venta_diaria: { $round: [{ $divide: ["$unidades_90d", 90] }, 2] },
          dias_cobertura: { $round: [{ $divide: ["$producto.stock", { $divide: ["$unidades_90d", 90] }] }, 0] },
          proveedor: "$proveedor.nombre",
          email_proveedor: "$proveedor.contacto.email",
          pais_proveedor: "$proveedor.ubicacion.pais",
        },
      },
      { $match: { dias_cobertura: { $lt: 30 } } },
      { $sort: { dias_cobertura: 1, unidades_90d: -1 } },
      { $limit: 15 },
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    id: 4,
    titulo: "Desempeño de las transportadoras",
    pregunta: "¿Qué transportadora entrega más rápido, con menos retrasos y a menor costo?",
    decision: "",
    coleccion: "pedidos",
    tecnicas: ["$match", "$project", "$cond", "aritmética de fechas", "$group", "$sort"],
    pipeline: [
      { $match: { "envio.estado": "Entregado" } },
      {
        $project: {
          transportadora: "$envio.transportadora",
          costo: "$envio.costo_envio",
          dias_entrega: { $divide: [{ $subtract: ["$envio.fecha_entrega", "$envio.fecha_envio"] }, DIA_MS] },
          // retrasado si se entregó después del final del día estimado (diferencia > 1 día)
          retrasado: { $cond: [{ $gt: [{ $subtract: ["$envio.fecha_entrega", "$envio.fecha_estimada"] }, DIA_MS] }, 1, 0] },
        },
      },
      {
        $group: {
          _id: "$transportadora",
          envios: { $sum: 1 },
          dias_promedio: { $avg: "$dias_entrega" },
          retrasos: { $sum: "$retrasado" },
          costo_promedio: { $avg: "$costo" },
        },
      },
      {
        $project: {
          _id: 0,
          transportadora: "$_id",
          envios: 1,
          dias_promedio: { $round: ["$dias_promedio", 1] },
          retrasos: 1,
          pct_retrasos: { $round: [{ $multiply: [{ $divide: ["$retrasos", "$envios"] }, 100] }, 1] },
          costo_promedio: { $round: ["$costo_promedio", 0] },
        },
      },
      { $sort: { pct_retrasos: 1 } },
    ],
  },
  // ------------------------------------------------------------------ 5
  {
    id: 5,
    titulo: "Ventas mensuales y método de pago preferido",
    pregunta: "¿Cómo evolucionan las ventas mes a mes y con qué medios pagan los clientes?",
    decision: "",
    coleccion: "pedidos",
    tecnicas: ["$match", "$group (2 niveles)", "$push", "$sort", "$project", "$arrayElemAt"],
    pipeline: [
      { $match: { "pago.estado": "Aprobado", fecha_pedido: { $gte: INICIO_2025, $lt: INICIO_2026 } } },
      {
        $group: {
          _id: { mes: { $month: "$fecha_pedido" }, metodo: "$pago.metodo" },
          ventas: { $sum: "$pago.monto" },
          pedidos: { $sum: 1 },
        },
      },
      { $sort: { "_id.mes": 1, ventas: -1 } },
      {
        $group: {
          _id: "$_id.mes",
          ventas_mes: { $sum: "$ventas" },
          pedidos_mes: { $sum: "$pedidos" },
          metodos: { $push: { metodo: "$_id.metodo", ventas: { $round: ["$ventas", 0] }, pedidos: "$pedidos" } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          mes: "$_id",
          pedidos_mes: 1,
          ventas_mes: { $round: ["$ventas_mes", 0] },
          ticket_promedio: { $round: [{ $divide: ["$ventas_mes", "$pedidos_mes"] }, 0] },
          metodo_principal: { $arrayElemAt: ["$metodos.metodo", 0] },
          metodos: 1,
        },
      },
    ],
  },
  // ------------------------------------------------------------------ 6
  {
    id: 6,
    titulo: "Productos peor calificados ",
    pregunta: "¿Qué productos generan más insatisfacción, de qué categoría y de qué proveedor vienen?",
    decision: "",
    coleccion: "resenas",
    tecnicas: ["$group", "$cond", "$match", "$sort", "$limit", "3 × $lookup", "$project"],
    pipeline: [
      {
        $group: {
          _id: "$producto_id",
          promedio: { $avg: "$calificacion" },
          num_resenas: { $sum: 1 },
          negativas: { $sum: { $cond: [{ $lte: ["$calificacion", 2] }, 1, 0] } },
        },
      },
      { $match: { num_resenas: { $gte: 10 } } },
      { $sort: { promedio: 1, num_resenas: -1 } },
      { $limit: 10 },
      { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "producto" } },
      { $unwind: "$producto" },
      { $lookup: { from: "categorias", localField: "producto.categoria_id", foreignField: "_id", as: "categoria" } },
      { $unwind: "$categoria" },
      { $lookup: { from: "proveedores", localField: "producto.proveedor_id", foreignField: "_id", as: "proveedor" } },
      { $unwind: "$proveedor" },
      {
        $project: {
          _id: 0,
          producto: "$producto.nombre",
          categoria: "$categoria.nombre",
          proveedor: "$proveedor.nombre",
          promedio: { $round: ["$promedio", 2] },
          num_resenas: 1,
          pct_negativas: { $round: [{ $multiply: [{ $divide: ["$negativas", "$num_resenas"] }, 100] }, 1] },
        },
      },
    ],
  },
  // ------------------------------------------------------------------ 7
  {
    id: 7,
    titulo: "Ventas, cancelaciones y costo logístico por departamento",
    pregunta: "¿En qué regiones vendemos más, dónde se cancela más y cuánto cuesta enviar allá?",
    decision: "",
    coleccion: "pedidos",
    tecnicas: ["$group", "$cond", "$addToSet", "$avg", "$project", "$size", "$sort"],
    pipeline: [
      {
        $group: {
          _id: "$direccion_envio.departamento",
          pedidos: { $sum: 1 },
          cancelados: { $sum: { $cond: [{ $eq: ["$estado", "Cancelado"] }, 1, 0] } },
          ingresos: { $sum: { $cond: [{ $eq: ["$estado", "Cancelado"] }, 0, "$resumen.total"] } },
          clientes: { $addToSet: "$cliente_id" },
          ciudades: { $addToSet: "$direccion_envio.ciudad" },
          costo_envio_prom: { $avg: "$envio.costo_envio" },
        },
      },
      {
        $project: {
          _id: 0,
          departamento: "$_id",
          ciudades: 1,
          pedidos: 1,
          clientes_unicos: { $size: "$clientes" },
          ingresos: { $round: ["$ingresos", 0] },
          ticket_promedio: { $round: [{ $divide: ["$ingresos", { $subtract: ["$pedidos", "$cancelados"] }] }, 0] },
          tasa_cancelacion_pct: { $round: [{ $multiply: [{ $divide: ["$cancelados", "$pedidos"] }, 100] }, 1] },
          costo_envio_prom: { $round: ["$costo_envio_prom", 0] },
        },
      },
      { $sort: { ingresos: -1 } },
    ],
  },
  // ------------------------------------------------------------------ 8
  {
    id: 8,
    titulo: "Clientes valiosos en riesgo de abandono",
    pregunta: "¿Qué clientes compraban seguido pero llevan más de 180 días sin comprar?",
    decision: "",
    coleccion: "clientes",
    tecnicas: ["$lookup con let/pipeline", "$expr", "$unwind", "$match", "$project", "$sort", "$limit"],
    pipeline: [
      {
        $lookup: {
          from: "pedidos",
          let: { cid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$cliente_id", "$$cid"] }, estado: "Entregado" } },
            { $group: { _id: null, pedidos: { $sum: 1 }, total: { $sum: "$resumen.total" }, ultima_compra: { $max: "$fecha_pedido" } } },
          ],
          as: "historial",
        },
      },
      { $unwind: "$historial" },
      { $match: { "historial.pedidos": { $gte: 3 }, "historial.ultima_compra": { $lt: HACE_180_DIAS } } },
      {
        $project: {
          _id: 0,
          cliente_id: "$_id",
          nombre: { $concat: ["$nombres", " ", "$apellidos"] },
          email: 1,
          telefono: 1,
          segmento: 1,
          pedidos_historicos: "$historial.pedidos",
          total_historico: { $round: ["$historial.total", 0] },
          ultima_compra: "$historial.ultima_compra",
          dias_inactivo: { $round: [{ $divide: [{ $subtract: [FECHA_CORTE, "$historial.ultima_compra"] }, DIA_MS] }, 0] },
        },
      },
      { $sort: { total_historico: -1 } },
      { $limit: 15 },
    ],
  },
];
