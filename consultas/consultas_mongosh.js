

db = db.getSiblingDB('tecnohogar');

// ==========================================================================
// CONSULTA 1: Ingresos y margen bruto por categoría (2025)
// Pregunta: ¿Qué categorías generan más ingresos y cuáles dejan mejor margen?
// Operadores: $match, $unwind, 2 × $lookup, $group, $addToSet, $project, $sort
// ==========================================================================
print('\n=== Consulta 1: Ingresos y margen bruto por categoría (2025) ===');
printjson(db.pedidos.aggregate([
  {
    $match: {
      estado: { $in: ["Pagado", "Enviado", "Entregado"] },
      fecha_pedido: { $gte: ISODate("2025-01-01T00:00:00Z"), $lt: ISODate("2026-01-01T00:00:00Z") }
    }
  },
  { $unwind: "$items" },
  {
    $lookup: { from: "productos", localField: "items.producto_id", foreignField: "_id", as: "producto" }
  },
  { $unwind: "$producto" },
  {
    $lookup: {
      from: "categorias",
      localField: "producto.categoria_id",
      foreignField: "_id",
      as: "categoria"
    }
  },
  { $unwind: "$categoria" },
  {
    $group: {
      _id: "$categoria.nombre",
      ingresos: { $sum: "$items.subtotal" },
      costo: { $sum: { $multiply: ["$items.cantidad", "$producto.costo"] } },
      unidades: { $sum: "$items.cantidad" },
      pedidos: { $addToSet: "$_id" }
    }
  },
  {
    $project: {
      _id: 0,
      categoria: "$_id",
      ingresos: { $round: ["$ingresos", 0] },
      unidades: 1,
      num_pedidos: { $size: "$pedidos" },
      margen_bruto: { $round: [{ $subtract: ["$ingresos", "$costo"] }, 0] },
      margen_pct: {
        $round: [
          { $multiply: [{ $divide: [{ $subtract: ["$ingresos", "$costo"] }, "$ingresos"] }, 100] },
          1
        ]
      }
    }
  },
  { $sort: { ingresos: -1 } }
]).toArray());

// ==========================================================================
// CONSULTA 2: Top 10 clientes por valor de compra
// Pregunta: ¿Quiénes son los clientes más valiosos y dónde están?
// Operadores: $match, $group, $sort, $limit, $lookup, $unwind, $project, $filter
// ==========================================================================
print('\n=== Consulta 2: Top 10 clientes por valor de compra ===');
printjson(db.pedidos.aggregate([
  { $match: { estado: "Entregado" } },
  {
    $group: {
      _id: "$cliente_id",
      total_comprado: { $sum: "$resumen.total" },
      num_pedidos: { $sum: 1 },
      ultima_compra: { $max: "$fecha_pedido" }
    }
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
        $arrayElemAt: [
          {
            $map: {
              input: {
                $filter: {
                  input: "$cliente.direcciones",
                  as: "d",
                  cond: { $eq: ["$$d.es_principal", true] }
                }
              },
              as: "d",
              in: "$$d.ciudad"
            }
          },
          0
        ]
      },
      num_pedidos: 1,
      total_comprado: { $round: ["$total_comprado", 0] },
      ticket_promedio: { $round: [{ $divide: ["$total_comprado", "$num_pedidos"] }, 0] },
      ultima_compra: 1
    }
  }
]).toArray());

// ==========================================================================
// CONSULTA 3: Productos en riesgo de quedarse sin inventario
// Pregunta: ¿Qué productos se agotarán en menos de 30 días al ritmo de venta actual y a qué proveedor hay que pedirles?
// Operadores: $match, $unwind, $group, 3 × $lookup, $project, $sort, $limit
// ==========================================================================
print('\n=== Consulta 3: Productos en riesgo de quedarse sin inventario ===');
printjson(db.pedidos.aggregate([
  {
    $match: { estado: { $ne: "Cancelado" }, fecha_pedido: { $gte: ISODate("2025-10-02T00:00:00Z") } }
  },
  { $unwind: "$items" },
  { $group: { _id: "$items.producto_id", unidades_90d: { $sum: "$items.cantidad" } } },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "producto" } },
  { $unwind: "$producto" },
  { $match: { "producto.activo": true } },
  {
    $lookup: {
      from: "proveedores",
      localField: "producto.proveedor_id",
      foreignField: "_id",
      as: "proveedor"
    }
  },
  { $unwind: "$proveedor" },
  {
    $lookup: {
      from: "categorias",
      localField: "producto.categoria_id",
      foreignField: "_id",
      as: "categoria"
    }
  },
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
      pais_proveedor: "$proveedor.ubicacion.pais"
    }
  },
  { $match: { dias_cobertura: { $lt: 30 } } },
  { $sort: { dias_cobertura: 1, unidades_90d: -1 } },
  { $limit: 15 }
]).toArray());

// ==========================================================================
// CONSULTA 4: Desempeño de las transportadoras
// Pregunta: ¿Qué transportadora entrega más rápido, con menos retrasos y a menor costo?
// Operadores: $match, $project, $cond, aritmética de fechas, $group, $sort
// ==========================================================================
print('\n=== Consulta 4: Desempeño de las transportadoras ===');
printjson(db.pedidos.aggregate([
  { $match: { "envio.estado": "Entregado" } },
  {
    $project: {
      transportadora: "$envio.transportadora",
      costo: "$envio.costo_envio",
      dias_entrega: { $divide: [{ $subtract: ["$envio.fecha_entrega", "$envio.fecha_envio"] }, 86400000] },
      retrasado: {
        $cond: [
          { $gt: [{ $subtract: ["$envio.fecha_entrega", "$envio.fecha_estimada"] }, 86400000] },
          1,
          0
        ]
      }
    }
  },
  {
    $group: {
      _id: "$transportadora",
      envios: { $sum: 1 },
      dias_promedio: { $avg: "$dias_entrega" },
      retrasos: { $sum: "$retrasado" },
      costo_promedio: { $avg: "$costo" }
    }
  },
  {
    $project: {
      _id: 0,
      transportadora: "$_id",
      envios: 1,
      dias_promedio: { $round: ["$dias_promedio", 1] },
      retrasos: 1,
      pct_retrasos: { $round: [{ $multiply: [{ $divide: ["$retrasos", "$envios"] }, 100] }, 1] },
      costo_promedio: { $round: ["$costo_promedio", 0] }
    }
  },
  { $sort: { pct_retrasos: 1 } }
]).toArray());

// ==========================================================================
// CONSULTA 5: Ventas mensuales 2025 y método de pago preferido
// Pregunta: ¿Cómo evolucionan las ventas mes a mes y con qué medios pagan los clientes?
// Operadores: $match, $group (2 niveles), $push, $sort, $project, $arrayElemAt
// ==========================================================================
print('\n=== Consulta 5: Ventas mensuales 2025 y método de pago preferido ===');
printjson(db.pedidos.aggregate([
  {
    $match: {
      "pago.estado": "Aprobado",
      fecha_pedido: { $gte: ISODate("2025-01-01T00:00:00Z"), $lt: ISODate("2026-01-01T00:00:00Z") }
    }
  },
  {
    $group: {
      _id: { mes: { $month: "$fecha_pedido" }, metodo: "$pago.metodo" },
      ventas: { $sum: "$pago.monto" },
      pedidos: { $sum: 1 }
    }
  },
  { $sort: { "_id.mes": 1, ventas: -1 } },
  {
    $group: {
      _id: "$_id.mes",
      ventas_mes: { $sum: "$ventas" },
      pedidos_mes: { $sum: "$pedidos" },
      metodos: { $push: { metodo: "$_id.metodo", ventas: { $round: ["$ventas", 0] }, pedidos: "$pedidos" } }
    }
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
      metodos: 1
    }
  }
]).toArray());

// ==========================================================================
// CONSULTA 6: Productos peor calificados (mínimo 10 reseñas)
// Pregunta: ¿Qué productos generan más insatisfacción, de qué categoría y de qué proveedor vienen?
// Operadores: $group, $cond, $match, $sort, $limit, 3 × $lookup, $project
// ==========================================================================
print('\n=== Consulta 6: Productos peor calificados (mínimo 10 reseñas) ===');
printjson(db.resenas.aggregate([
  {
    $group: {
      _id: "$producto_id",
      promedio: { $avg: "$calificacion" },
      num_resenas: { $sum: 1 },
      negativas: { $sum: { $cond: [{ $lte: ["$calificacion", 2] }, 1, 0] } }
    }
  },
  { $match: { num_resenas: { $gte: 10 } } },
  { $sort: { promedio: 1, num_resenas: -1 } },
  { $limit: 10 },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "producto" } },
  { $unwind: "$producto" },
  {
    $lookup: {
      from: "categorias",
      localField: "producto.categoria_id",
      foreignField: "_id",
      as: "categoria"
    }
  },
  { $unwind: "$categoria" },
  {
    $lookup: {
      from: "proveedores",
      localField: "producto.proveedor_id",
      foreignField: "_id",
      as: "proveedor"
    }
  },
  { $unwind: "$proveedor" },
  {
    $project: {
      _id: 0,
      producto: "$producto.nombre",
      categoria: "$categoria.nombre",
      proveedor: "$proveedor.nombre",
      promedio: { $round: ["$promedio", 2] },
      num_resenas: 1,
      pct_negativas: { $round: [{ $multiply: [{ $divide: ["$negativas", "$num_resenas"] }, 100] }, 1] }
    }
  }
]).toArray());

// ==========================================================================
// CONSULTA 7: Ventas, cancelaciones y costo logístico por departamento
// Pregunta: ¿En qué regiones vendemos más, dónde se cancela más y cuánto cuesta enviar allá?
// Operadores: $group, $cond, $addToSet, $avg, $project, $size, $sort
// ==========================================================================
print('\n=== Consulta 7: Ventas, cancelaciones y costo logístico por departamento ===');
printjson(db.pedidos.aggregate([
  {
    $group: {
      _id: "$direccion_envio.departamento",
      pedidos: { $sum: 1 },
      cancelados: { $sum: { $cond: [{ $eq: ["$estado", "Cancelado"] }, 1, 0] } },
      ingresos: { $sum: { $cond: [{ $eq: ["$estado", "Cancelado"] }, 0, "$resumen.total"] } },
      clientes: { $addToSet: "$cliente_id" },
      ciudades: { $addToSet: "$direccion_envio.ciudad" },
      costo_envio_prom: { $avg: "$envio.costo_envio" }
    }
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
      costo_envio_prom: { $round: ["$costo_envio_prom", 0] }
    }
  },
  { $sort: { ingresos: -1 } }
]).toArray());

// ==========================================================================
// CONSULTA 8: Clientes valiosos en riesgo de abandono
// Pregunta: ¿Qué clientes compraban seguido pero llevan más de 180 días sin comprar?
// Operadores: $lookup con let/pipeline, $expr, $unwind, $match, $project, $sort, $limit
// ==========================================================================
print('\n=== Consulta 8: Clientes valiosos en riesgo de abandono ===');
printjson(db.clientes.aggregate([
  {
    $lookup: {
      from: "pedidos",
      let: { cid: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$cliente_id", "$$cid"] }, estado: "Entregado" } },
        {
          $group: {
            _id: null,
            pedidos: { $sum: 1 },
            total: { $sum: "$resumen.total" },
            ultima_compra: { $max: "$fecha_pedido" }
          }
        }
      ],
      as: "historial"
    }
  },
  { $unwind: "$historial" },
  {
    $match: {
      "historial.pedidos": { $gte: 3 },
      "historial.ultima_compra": { $lt: ISODate("2025-07-04T00:00:00Z") }
    }
  },
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
      dias_inactivo: {
        $round: [
          {
            $divide: [{ $subtract: [ISODate("2025-12-31T23:59:59Z"), "$historial.ultima_compra"] }, 86400000]
          },
          0
        ]
      }
    }
  },
  { $sort: { total_historico: -1 } },
  { $limit: 15 }
]).toArray());
