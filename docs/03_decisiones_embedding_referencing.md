# 3. Decisiones de Embedding y Referencing

## Criterios usados

Para cada relación del modelo relacional se hicieron cuatro preguntas:

1. **¿Se leen juntos?** Si casi siempre que se consulta A también se necesita B, conviene embeber B en A.
2. **¿Cuántos son?** Uno-a-pocos (y acotado) → embeber. Uno-a-muchos sin límite → referenciar (límite de 16 MB por documento y documentos que crecen sin parar).
3. **¿B tiene vida propia?** Si B se consulta, actualiza o reutiliza desde varias partes del sistema → colección propia y referencia.
4. **¿Cambia B con frecuencia?** Si B cambia y está copiado en muchos documentos, cada cambio obliga a actualizar todas las copias → referenciar.

## Decisiones

### ✅ EMBEDDING: Direcciones dentro de `clientes`

| Pregunta | Respuesta |
|---|---|
| ¿Se leen juntos? | Sí: perfil del cliente, checkout, selección de dirección de entrega |
| ¿Cuántos son? | 1 a 3 por cliente: relación uno-a-pocos, acotada |
| ¿Vida propia? | No: una dirección no existe sin su cliente |
| ¿Cambia seguido? | Rara vez |

**Ventaja:** con un solo `find({_id})` se obtiene el cliente con todas sus direcciones. Se elimina el JOIN `Clientes ⋈ Direcciones`.

### ✅ EMBEDDING: DetallePedido, Pagos y Envios dentro de `pedidos`

| Pregunta | Respuesta |
|---|---|
| ¿Se leen juntos? | Sí: "ver mi pedido", factura, seguimiento y reportes de ventas necesitan el encabezado, las líneas, el pago y el envío |
| ¿Cuántos son? | Detalle: 1 a 5 líneas por pedido. Pago: exactamente 1. Envío: 0 o 1 |
| ¿Vida propia? | No: una línea, un pago o un envío no tienen sentido sin su pedido |
| ¿Cambia seguido? | Un pedido se cierra y queda prácticamente inmutable (registro histórico) |

**Ventajas:**

- Leer un pedido completo pasa de **4 tablas con 3 JOINs** a **1 documento**.
- La creación del pedido es **atómica**: MongoDB garantiza atomicidad a nivel de documento, así que encabezado, líneas y pago se guardan juntos o no se guardan, sin transacción multi-documento.
- Las consultas de ventas (1, 2, 5, 7) recorren una sola colección.

**Decisión de diseño importante: snapshot vs. referencia en los items.** Cada item guarda `producto_id` (referencia) **y** `sku`, `nombre` y `precio_unitario` (copia). El precio y el nombre deben quedar congelados como estaban al momento de la compra: si mañana cambia el precio del producto, la factura antigua no debe cambiar. Esto ya ocurría en SQL Server con `precio_unitario`. La referencia `producto_id` se mantiene para llegar a los datos "vivos" (stock actual, categoría, proveedor) con `$lookup`.

Por la misma razón, `direccion_envio` es una **copia** de la dirección usada. Si el cliente edita o borra la dirección después, el pedido conserva a dónde se envió realmente.

### 🔗 REFERENCING: `cliente_id` en `pedidos`

Un cliente puede acumular **cientos de pedidos** a lo largo de los años: relación uno-a-muchos **sin límite**. Embeber los pedidos dentro del cliente haría crecer el documento indefinidamente (riesgo con el límite de 16 MB) y cada compra reescribiría el documento del cliente. Además, los pedidos se consultan solos (reportes por fecha, por estado, por transportadora). Por eso se guarda solo `cliente_id` y se usa `$lookup` cuando hacen falta datos del cliente (consultas 2 y 8).

### 🔗 REFERENCING: `categoria_id` y `proveedor_id` en `productos`

Categorías y proveedores son entidades **independientes y compartidas**: cada categoría agrupa unos 12 productos y un proveedor surte varios productos de distintas categorías. Tienen su propio ciclo de vida (el área de compras actualiza el email o el teléfono del proveedor). Si se embebieran, cambiar el email de un proveedor obligaría a actualizar todos sus productos. Con la referencia se cambia en un solo lugar.

### 🔗 REFERENCING: `resenas` como colección aparte

Un producto popular puede acumular **miles de reseñas** (crecimiento ilimitado). Además las reseñas se consultan por producto, por cliente o por calificación. Embeberlas en `productos` haría muy pesado cada documento del catálogo, que es el que más se lee.

### ⚡ PATRÓN COMPUTADO: `productos.calificacion`

Aunque las reseñas están referenciadas, el catálogo necesita mostrar "★ 4,3 (53 reseñas)" en cada producto. Calcular ese promedio con `$group` en cada visita sería costoso, así que la migración guarda `{promedio, total_resenas}` precalculado en el producto. En producción se actualizaría cada vez que llega una reseña nueva. Es una desnormalización controlada: se acepta un pequeño costo en escritura a cambio de lecturas rápidas.

## Resumen

| Relación | Cardinalidad | Decisión | Motivo principal |
|---|---|---|---|
| Cliente → Direcciones | 1 : pocos | Embedding | Se leen juntos, acotado |
| Pedido → Detalle | 1 : pocos | Embedding (array) | Unidad de lectura y escritura atómica |
| Pedido → Pago | 1 : 1 | Embedding (subdocumento) | Siempre se lee con el pedido |
| Pedido → Envío | 1 : 0..1 | Embedding (subdocumento opcional) | Siempre se lee con el pedido |
| Cliente → Pedidos | 1 : muchos (ilimitado) | Referencing | Crecimiento ilimitado, consultas independientes |
| Producto → Categoría / Proveedor | muchos : 1 | Referencing | Entidades compartidas con vida propia |
| Producto → Reseñas | 1 : muchos (ilimitado) | Referencing + resumen computado | Crecimiento ilimitado; lectura rápida del promedio |
| Item → Producto | muchos : 1 | Referencing + snapshot | Precio/nombre históricos congelados; datos vivos por referencia |

## Lo que se gana y lo que se cede

| Se gana | Se cede |
|---|---|
| Lectura de un pedido completo en 1 operación | Datos duplicados (nombre del producto en items, dirección en pedidos) |
| Escritura atómica del pedido sin transacciones | Si se quisiera "corregir" el nombre de un producto en pedidos viejos, habría que actualizar muchos documentos (pero no se quiere: es histórico) |
| Esquema flexible (pedidos sin envío simplemente no tienen el campo) | Las restricciones de integridad referencial ya no las garantiza el motor: se verificaron en la migración (`src/migracion/verificar.ts`, sección C) |
