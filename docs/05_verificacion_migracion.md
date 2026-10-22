# 5. Verificación de la migración

Código: `src/migracion/verificar.ts` (botón **Verificar migración** en la interfaz o `npm run verificar`). Se conecta **a los dos motores al mismo tiempo**, ejecuta 43 pruebas y genera `evidencias/verificacion_<fecha>.md`.

## Cómo se verificó cada transformación

### 0. Modelo relacional (4 pruebas)

Antes de comparar, se comprueba que la base de origen cumple el enunciado, consultando el catálogo de SQL Server:

| Prueba | Consulta | Esperado |
|---|---|---|
| Tablas de usuario | `SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0` | 10 |
| Llaves foráneas | `SELECT COUNT(*) FROM sys.foreign_keys` | 11 |
| Tablas aisladas | tablas que no aparecen como hija ni como padre en `sys.foreign_keys` | 0 |
| Volumen | suma de `COUNT(*)` de las 10 tablas | más de 5.000 (hay 5.170) |

### A. Conteos (10 pruebas)

Cada tabla se compara con su destino. Cuando varias tablas se unieron en una colección, se cuentan **los elementos embebidos**:

| SQL Server | MongoDB | Cómo se cuenta en Mongo |
|---|---|---|
| `COUNT(*) FROM Direcciones` | `clientes.direcciones[]` | `$sum: {$size: "$direcciones"}` |
| `COUNT(*) FROM DetallePedido` | `pedidos.items[]` | `$sum: {$size: "$items"}` |
| `COUNT(*) FROM Pagos` | `pedidos.pago` | `countDocuments({pago: {$exists: true}})` |
| `COUNT(*) FROM Envios` | `pedidos.envio` | `countDocuments({envio: {$exists: true}})` |

### B. Totales de control (8 pruebas)

Que el número de filas coincida no garantiza que los valores estén bien. Se comparan sumas de dinero y unidades, el promedio de calificaciones y el conteo por estado:
`SUM(DetallePedido.subtotal)` = suma de `items.subtotal` · `SUM(Pagos.monto)` = suma de `pago.monto` · `SUM(Envios.costo_envio)` · `SUM(cantidad)` · `AVG(calificacion)` · pedidos por estado.

### C. Integridad de referencias (6 pruebas)

MongoDB no tiene llaves foráneas, así que se comprueba con `$lookup` que **ninguna referencia quedó huérfana**:

```js
db.pedidos.aggregate([
  { $lookup: { from: "clientes", localField: "cliente_id", foreignField: "_id", as: "ref" } },
  { $match: { ref: { $size: 0 } } },   // pedidos cuyo cliente no existe
  { $count: "huerfanos" }               // debe dar 0 (o ningún resultado)
])
```

Se aplica a `pedidos.cliente_id`, `pedidos.items.producto_id`, `productos.categoria_id`, `productos.proveedor_id`, `resenas.producto_id` y `resenas.cliente_id`.

### D. Estructuras embebidas (5 pruebas)

Comprueban que el embedding conservó las reglas de negocio:

- ningún pedido quedó con `items` vacío;
- `pago.monto` = `resumen.total` en todos los pedidos;
- `resumen.total` = suma de `items.subtotal` (con `$expr` y `$sum` sobre el array);
- todo pedido Enviado/Entregado tiene subdocumento `envio`;
- todo cliente tiene una dirección con `es_principal: true`.

### E. Muestreo (10 pruebas)

Se eligen 5 pedidos y 5 clientes al azar. Para cada uno se reconstruyen los datos desde SQL Server (con varias consultas a distintas tablas) y se comparan campo a campo con el documento de MongoDB: cliente, estado, total, lista de (producto, cantidad) y método de pago; email y lista de direcciones.

## Evidencias a incluir en el repositorio

1. `evidencias/verificacion_*.md`: generado automáticamente.
2. `evidencias/resultados_consultas.md`: generado con el botón **Guardar evidencias de las 8** o `npm run consultas`.
3. Capturas de pantalla (agréguelas ustedes):
   - SSMS con el resultado de `sql/03_validar_datos.sql` (conteos por tabla).
   - Interfaz web, pestaña **Migración**: conteos de SQL Server y MongoDB, registro de la migración y la tabla de las 43 pruebas.
   - Interfaz web, pestaña **Consultas**: cada consulta con su resultado.
   - MongoDB Compass: lista de colecciones con su número de documentos, un documento de `pedidos` expandido (items, pago, envío) y uno de `clientes` (direcciones).
   - Compass → pestaña *Indexes* de `pedidos`.
   - Resultado de al menos 2 consultas en Compass o mongosh.
