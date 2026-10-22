# 6. Guía para la sustentación

## Preguntas probables y cómo responderlas

**¿Por qué no copiaron cada tabla como una colección?**
Porque se replicaría el modelo relacional y habría que hacer `$lookup` para todo, que es más lento que un JOIN de SQL Server. En MongoDB se diseña según cómo se **leen** los datos: lo que se consulta junto se guarda junto. Por eso 10 tablas quedaron en 6 colecciones.

**¿Por qué embebieron el detalle en el pedido y no los pedidos en el cliente?**
El detalle es acotado (1 a 5 líneas), no existe sin el pedido y siempre se lee con él. Los pedidos de un cliente crecen sin límite (podría llegar al límite de 16 MB) y se consultan solos (reportes por fecha, estado, transportadora).

**Si el precio de un producto cambia, ¿qué pasa con los pedidos viejos?**
Nada, y así debe ser. Cada item guarda `precio_unitario` y `nombre` como estaban al momento de la compra (snapshot). Para el precio actual se usa `producto_id` con `$lookup`.

**Si un proveedor cambia de email, ¿cuántos documentos hay que actualizar?**
Uno solo, en `proveedores`, porque los productos lo referencian por `proveedor_id`. Si estuviera embebido habría que actualizar todos sus productos.

**¿Cómo saben que no se perdió información?**
Con las 43 pruebas de `verificar.ts`: requisitos del modelo relacional, conteos (incluidos los elementos embebidos), sumas de dinero, referencias huérfanas con `$lookup` + `$size: 0`, reglas de negocio dentro de los documentos y muestreo campo a campo.

**¿Qué diferencia hay entre `$lookup` simple y `$lookup` con pipeline?**
El simple iguala un campo local con uno foráneo (como un `LEFT JOIN ... ON a = b`). El de `let`/`pipeline` ejecuta un pipeline completo sobre la otra colección por cada documento: permite condiciones adicionales y agrupar dentro del lookup (consulta 8: en vez de traer todos los pedidos del cliente, trae solo el resumen).

**¿Por qué `$match` va al principio?**
Para filtrar lo antes posible y aprovechar índices. Las etapas siguientes procesan menos documentos. En la consulta 2, además, `$limit` va **antes** del `$lookup` para hacer 10 lookups en vez de uno por cada cliente con compras (cerca de 300).

**¿Qué hace `$unwind`?**
Convierte un documento con un array de N elementos en N documentos, uno por elemento. Se usa para agrupar por producto (que está dentro de `items`) o para convertir el array que devuelve `$lookup` en un objeto.

**¿Por qué después de `$lookup` siempre hay `$unwind`?**
`$lookup` devuelve siempre un **array** (aunque haya un solo match). `$unwind` lo convierte en objeto para poder usar `"$producto.costo"` directamente. Como efecto secundario, descarta los documentos sin coincidencia (como un INNER JOIN). Para conservarlos se usa `preserveNullAndEmptyArrays: true`.

**¿MongoDB garantiza integridad referencial?**
No: no hay llaves foráneas. Por eso (1) la migración usa los mismos IDs, (2) se verificó que no hubiera huérfanos y (3) la aplicación sería responsable de mantenerla. Se agregó un validador `$jsonSchema` a `pedidos` para recuperar parte de las restricciones.

**¿Qué pasa si ejecuto la migración dos veces?**
Es idempotente: borra las colecciones y las vuelve a crear, así que no se duplican datos.

**¿Por qué TypeScript y no Python?**
El enunciado permite "Python u otro lenguaje autorizado" (confirmen con el profesor que TypeScript está autorizado). Ventajas para este trabajo: (1) el modelo relacional (`FilaPedido`, `FilaDetalle`...) y el documental (`PedidoDoc`, `ItemEmb`...) están tipados en `src/migracion/tipos.ts`, así que si la transformación olvida un campo o le pone un tipo equivocado el código **no compila**; (2) el driver `mssql` es JavaScript puro y no necesita instalar ODBC; (3) MongoDB usa sintaxis JavaScript, así que los pipelines del código son casi idénticos a los de mongosh.

**¿Cómo pasa una fila de SQL Server a un documento?**
`extraer()` hace `SELECT * FROM` cada tabla. `transformar()` agrupa en memoria con `Map` (por ejemplo, `itemsPorPedido` agrupa DetallePedido por `pedido_id`) y arma cada `PedidoDoc` con sus `items`, `pago` y `envio`. `cargar()` inserta con `insertMany` en lotes de 1.000 y crea los índices.

## Modificaciones que pueden pedir en vivo (ensayarlas)

En la pestaña **Consultas** de la interfaz se edita el pipeline y se ejecuta con <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, sin tocar el código. **Restaurar original** vuelve a la versión del repositorio. Las etapas `$out` y `$merge` están bloqueadas para no modificar datos por accidente.

**"Muestre solo el año 2024"** (consultas 1 y 5): cambiar el rango de fechas del `$match`.
```js
fecha_pedido: { $gte: ISODate("2024-01-01"), $lt: ISODate("2025-01-01") }
```

**"Ordene por margen en vez de por ingresos"** (consulta 1):
```js
{ $sort: { margen_pct: -1 } }
```

**"Top 5 en vez de top 10"** (consulta 2): `{ $limit: 5 }`.

**"Solo clientes de Bogotá"** (consulta 2): después del `$unwind: "$cliente"` agregar
```js
{ $match: { "cliente.direcciones": { $elemMatch: { ciudad: "Bogotá", es_principal: true } } } }
```
(Nota: al filtrar después del `$limit` saldrían menos de 10. Para el top 10 de Bogotá hay que filtrar por `direccion_envio.ciudad` en el primer `$match`.)

**"Los mejor calificados en vez de los peores"** (consulta 6): `{ $sort: { promedio: -1, num_resenas: -1 } }`.

**"Que también muestre el nombre del cliente"** en un pedido:
```js
db.pedidos.aggregate([
  { $match: { _id: 2 } },
  { $lookup: { from: "clientes", localField: "cliente_id", foreignField: "_id", as: "cliente" } },
  { $unwind: "$cliente" },
  { $project: { estado: 1, "resumen.total": 1, cliente: { $concat: ["$cliente.nombres", " ", "$cliente.apellidos"] } } }
])
```

**"Agrupe por ciudad en vez de departamento"** (consulta 7): `_id: "$direccion_envio.ciudad"`.

**"Cobertura menor a 15 días"** (consulta 3): `{ $match: { dias_cobertura: { $lt: 15 } } }`.

**"Ventas por proveedor"** (consulta nueva, buena para practicar):
```js
db.pedidos.aggregate([
  { $match: { estado: "Entregado" } },
  { $unwind: "$items" },
  { $lookup: { from: "productos", localField: "items.producto_id", foreignField: "_id", as: "p" } },
  { $unwind: "$p" },
  { $group: { _id: "$p.proveedor_id", ventas: { $sum: "$items.subtotal" } } },
  { $lookup: { from: "proveedores", localField: "_id", foreignField: "_id", as: "prov" } },
  { $unwind: "$prov" },
  { $project: { _id: 0, proveedor: "$prov.nombre", pais: "$prov.ubicacion.pais", ventas: 1 } },
  { $sort: { ventas: -1 } }, { $limit: 10 }
])
```

**"¿Cuál es el equivalente en SQL de la consulta 1?"**
```sql
SELECT c.nombre, SUM(d.subtotal) AS ingresos, SUM(d.cantidad * p.costo) AS costo
FROM Pedidos pe
JOIN DetallePedido d ON d.pedido_id = pe.pedido_id
JOIN Productos p     ON p.producto_id = d.producto_id
JOIN Categorias c    ON c.categoria_id = p.categoria_id
WHERE pe.estado IN ('Pagado','Enviado','Entregado') AND YEAR(pe.fecha_pedido) = 2025
GROUP BY c.nombre ORDER BY ingresos DESC;
```
El `JOIN DetallePedido` desaparece en MongoDB (está embebido); los otros dos JOIN son los dos `$lookup`.

## Reparto sugerido entre los dos integrantes

Ambos deben entender todo, pero conviene que cada uno lidere una parte:

- **Integrante 1:** modelo relacional, generación de datos, proceso ETL (`migrar.ts`) y verificación.
- **Integrante 2:** modelo documental, decisiones de embedding/referencing y las 8 consultas.
