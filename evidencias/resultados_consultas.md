# Resultados de las consultas

Ejecutado: 25/10/2026, 11:35:57 p. m.

## Consulta 1. Ranking de proveedores: ingresos, margen y calidad

**Pregunta:** ¿Qué proveedores generan más ventas, con qué margen y con qué calidad percibida?  
**Colección:** `pedidos` · **Operadores:** $match, $unwind, 2 × $lookup, $group, $addToSet, $push, $avg, $project, $sort, $limit

| unidades | proveedor | pais | productos_vendidos | ingresos | margen_pct | calificacion_prom |
|---|---|---|---|---|---|---|
| 295 | Orbis Global Ltda. | México | 8 | 668.098.910 | 26.7 | 3.26 |
| 100 | Cóndor Andina S.A. | Colombia | 4 | 478.345.940 | 33.5 | 2.76 |
| 106 | Orbis Global S.A. | Colombia | 14 | 322.082.735 | 29.6 | 3.46 |
| 233 | Cóndor Andina Importaciones | Colombia | 8 | 264.734.980 | 39.6 | 3.66 |
| 174 | Altura Tech Distribuciones | Colombia | 10 | 263.460.790 | 26.3 | 3.92 |
| 59 | Orbis Digital Ltda. | Colombia | 4 | 196.686.755 | 36.3 | 4.4 |
| 74 | Zentek Andina Distribuciones | Colombia | 6 | 178.128.095 | 31.4 | 3.54 |
| 213 | Altura Global Distribuciones | Colombia | 8 | 174.496.910 | 34.4 | 4.13 |
| 92 | Nova Andina S.A.S. | Colombia | 6 | 171.744.525 | 38.4 | 3.78 |
| 103 | Vértice Tech S.A.S. | Colombia | 9 | 162.946.215 | 34.3 | 3.82 |

## Consulta 2. Productos que se compran juntos

**Pregunta:** ¿Qué pares de productos aparecen juntos en el mismo pedido con más frecuencia?  
**Colección:** `pedidos` · **Operadores:** $match, $project, doble $unwind, $expr, $group, $sort, $limit, 2 × $lookup, $arrayElemAt

| producto_1 | producto_2 | veces_juntos |
|---|---|---|
| Bombillo Inteligente Cóndor X48 | Mouse Inalámbrico Cóndor G42 | 13 |
| Bombillo Inteligente Cóndor X48 | Cafetera Zentek S68 | 12 |
| Tablet Vértice N14 | Congelador Andes C35 | 9 |
| Bombillo Inteligente Cóndor X48 | Tablet Vértice N14 | 9 |
| Cafetera Zentek S68 | Congelador Andes C35 | 8 |
| Mouse Inalámbrico Cóndor G42 | Cepillo Eléctrico Orbis X18 | 8 |
| Bombillo Inteligente Cóndor X48 | Congelador Andes C35 | 8 |
| Escritorio en L Pixel L54 | Mouse Inalámbrico Cóndor G42 | 7 |
| Mouse Inalámbrico Cóndor G42 | Tablet Vértice N14 | 7 |
| Cafetera Zentek S68 | Funda Protectora Pixel K66 | 7 |

## Consulta 3. Inventario inmovilizado

**Pregunta:** ¿Qué productos activos tienen stock pero no se han vendido en los últimos 180 días, y cuánto dinero hay detenido en ellos?  
**Colección:** `productos` · **Operadores:** $match, $lookup con let/pipeline, $expr, $size, 2 × $lookup, $project, $multiply, $sort, $limit

| sku | costo | stock | producto | categoria | proveedor | valor_inmovilizado |
|---|---|---|---|---|---|---|
| TH-02-0038 | 3.637.300 | 165 | Portátil Ultrabook Orbis A21 | Computadores | Cóndor Andina S.A. | 600.154.500 |
| TH-04-0004 | 796.000 | 289 | Barra de Sonido Vértice J52 | Audio | Orbis Andina Importaciones | 230.044.000 |
| TH-04-0040 | 779.500 | 291 | Parlante Portátil Andes S66 | Audio | Altura Tech Distribuciones #24 | 226.834.500 |
| TH-02-0014 | 2.685.500 | 79 | PC Escritorio Cóndor E23 | Computadores | Orbis Global S.A. | 212.154.500 |
| TH-11-0131 | 2.503.400 | 53 | Bicicleta Eléctrica Zentek B72 | Deportes | Zentek Tech S.A. | 132.680.200 |
| TH-08-0044 | 144.800 | 119 | Funda Protectora Orbis E71 | Accesorios | Cóndor Andina S.A. | 17.231.200 |
| TH-09-0069 | 408.300 | 41 | Timbre Inteligente Kumo X26 | Hogar inteligente | Orbis Global Ltda. | 16.740.300 |
| TH-03-0039 | 1.388.900 | 11 | Smart TV 43" Altura S42 | Televisores | Orbis Andina S.A.S. | 15.277.900 |
| TH-10-0106 | 261.300 | 17 | Secador de Cabello Vértice S71 | Cuidado personal | Zentek Tech S.A. | 4.442.100 |
| TH-08-0056 | 21.200 | 12 | Funda Protectora Kumo K50 | Accesorios | Vértice Express Importaciones | 254.400 |

## Consulta 4. Efecto de los descuentos en las ventas

**Pregunta:** ¿Las líneas con descuento venden más unidades que las que no tienen descuento, y cuánto dinero se cede?  
**Colección:** `pedidos` · **Operadores:** $match, $unwind, $project con cálculo de porcentaje, $group, $avg, $sort

| lineas | descuento_pct | unidades_por_linea | ingresos | descuento_cedido |
|---|---|---|---|---|
| 772 | 0 | 1.41 | 2.095.078.700 | 0 |
| 270 | 5 | 1.37 | 630.585.870 | 33.188.730 |
| 257 | 10 | 1.39 | 670.757.850 | 74.528.650 |
| 243 | 15 | 1.39 | 531.327.350 | 93.763.650 |

## Consulta 5. Impacto de los retrasos en la satisfacción

**Pregunta:** ¿Los clientes califican peor los productos cuando la entrega llegó tarde?  
**Colección:** `pedidos` · **Operadores:** $match, $project con aritmética de fechas, $unwind, $lookup con let/pipeline (2 condiciones), $and, $group, $cond

| resenas | entrega | calificacion_prom | pct_negativas |
|---|---|---|---|
| 483 | A tiempo | 3.6 | 13.5 |
| 75 | Con retraso | 3.53 | 16 |

## Consulta 6. Grupo de clientes por año de registro

**Pregunta:** ¿Los clientes que se registraron en años más recientes compran tanto como los antiguos?  
**Colección:** `clientes` · **Operadores:** $lookup con let/pipeline, $year, $cond, $ifNull, $arrayElemAt, $group, $project, $sort

| clientes | anio_registro | pct_compradores | pedidos_por_cliente | ingreso_por_cliente |
|---|---|---|---|---|
| 83 | 2022 | 80.7 | 2.17 | 13.989.590 |
| 77 | 2023 | 81.8 | 2.04 | 12.556.502 |
| 74 | 2024 | 77 | 2.26 | 12.556.390 |
| 66 | 2025 | 74.2 | 1.83 | 11.937.742 |

## Consulta 7. Pagos rechazados y reembolsados por método

**Pregunta:** ¿Con qué método de pago se pierden más ventas por rechazos o reembolsos, y cuánto dinero representan?  
**Colección:** `pedidos` · **Operadores:** $group, $cond, $eq, $in, $add, $project, $sort, sin $lookup: el pago está embebido

| pedidos | rechazados | reembolsados | metodo | pct_fallidos | monto_perdido | monto_aprobado |
|---|---|---|---|---|---|---|
| 107 | 8 | 7 | Nequi | 14 | 122.815.765 | 501.038.370 |
| 242 | 5 | 13 | Tarjeta credito | 7.4 | 122.777.025 | 1.510.946.840 |
| 169 | 5 | 7 | PSE | 7.1 | 137.005.470 | 907.165.220 |
| 76 | 2 | 3 | Contraentrega | 6.6 | 28.063.070 | 424.554.600 |
| 106 | 4 | 3 | Tarjeta debito | 6.6 | 37.831.705 | 584.044.740 |

## Consulta 8. Frecuencia de recompra por segmento

**Pregunta:** ¿Cada cuántos días vuelve a comprar un cliente, según su segmento?  
**Colección:** `pedidos` · **Operadores:** $match, $group (2 niveles), $min, $max, $lookup, $unwind, $project con aritmética de fechas, $concat, $toString, $sort

| clientes | segmento | pedidos_prom | dias_entre_compras | rango_dias |
|---|---|---|---|---|
| 13 | Premium | 9.5 | 59 | 33 a 102 |
| 38 | Frecuente | 4.8 | 100 | 18 a 209 |
| 98 | Regular | 2.4 | 176 | 0 a 655 |
