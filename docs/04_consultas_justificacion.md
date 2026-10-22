# 4. Consultas de negocio y su justificación

Código: `src/consultas/pipelines.ts` (fuente única) · `consultas/consultas_mongosh.js` (para mongosh/Compass) · resultados en `evidencias/resultados_consultas.md`. En la interfaz web (pestaña **Consultas**) cada pipeline se puede editar y ejecutar en vivo.

"Hoy", para el análisis, es el **31-dic-2025** (último día con datos).

| # | Consulta | Colección base | `$lookup` | Área que la usa |
|---|---|---|---|---|
| 1 | Ingresos y margen por categoría | pedidos | 2 (productos, categorias) | Gerencia comercial |
| 2 | Top 10 clientes | pedidos | 1 (clientes) | Mercadeo / CRM |
| 3 | Riesgo de quiebre de stock | pedidos | 3 (productos, proveedores, categorias) | Compras / inventario |
| 4 | Desempeño de transportadoras | pedidos | — (datos embebidos) | Logística |
| 5 | Ventas mensuales y métodos de pago | pedidos | — (datos embebidos) | Finanzas |
| 6 | Productos peor calificados | resenas | 3 (productos, categorias, proveedores) | Calidad / compras |
| 7 | Ventas y cancelaciones por región | pedidos | — (datos embebidos) | Expansión / logística |
| 8 | Clientes en riesgo de abandono | clientes | 1 con `let`/`pipeline` (pedidos) | Retención / CRM |

Las consultas 4, 5 y 7 **no necesitan `$lookup`** porque pago, envío y dirección están embebidos en el pedido. Es la prueba práctica de que el embedding funcionó: en SQL Server cada una habría necesitado JOIN con Pagos, Envios o Direcciones.

---

## Consulta 1. Ingresos y margen bruto por categoría (2025)

**Qué busca:** para cada categoría, ingresos, unidades vendidas, número de pedidos y margen bruto (ingreso − costo) en 2025.
**Por qué importa:** vender mucho no es lo mismo que ganar mucho. Una categoría con altos ingresos puede tener margen bajo.
**Decisión que apoya:** dónde invertir en publicidad, qué categorías ampliar y cuáles renegociar con proveedores.
**Impacto:** concentrar el presupuesto comercial en las categorías que más aportan a la utilidad, no solo a la facturación.

| Etapa | Qué hace |
|---|---|
| `$match` | Solo pedidos de 2025 que son venta real (Pagado/Enviado/Entregado). Va primero para usar índices y reducir documentos |
| `$unwind: "$items"` | Convierte cada pedido en un documento por línea de producto |
| `$lookup productos` | Trae el producto de cada línea (se necesitan `costo` y `categoria_id`) |
| `$lookup categorias` | **Segundo `$lookup`**, encadenado: usa `producto.categoria_id` para traer el nombre de la categoría |
| `$group` | Agrupa por categoría: suma ingresos, costo (cantidad × costo), unidades; `$addToSet` junta los pedidos sin repetir |
| `$project` | Calcula `num_pedidos` (`$size`), margen bruto y margen %; redondea |
| `$sort` | Ordena de mayor a menor ingreso |

---

## Consulta 2. Top 10 clientes por valor de compra

**Qué busca:** los 10 clientes que más han comprado (pedidos entregados), con número de pedidos, ticket promedio, fecha de última compra y ciudad principal.
**Por qué importa:** en comercio electrónico una minoría de clientes suele concentrar buena parte de las ventas (principio de Pareto).
**Decisión que apoya:** a quién ofrecer programas de fidelización, beneficios VIP o atención preferente.
**Impacto:** retener a un cliente de alto valor cuesta mucho menos que conseguir uno nuevo.

| Etapa | Qué hace |
|---|---|
| `$match` | Solo pedidos entregados (venta efectiva) |
| `$group` por `cliente_id` | Total comprado, número de pedidos, última compra (`$max`) |
| `$sort` + `$limit: 10` | Se queda con los 10 mayores **antes** del `$lookup`, así el lookup se hace 10 veces y no una vez por cada cliente con compras (optimización) |
| `$lookup clientes` | Trae nombre, email, segmento y direcciones |
| `$project` | Concatena el nombre; con `$filter` + `$map` + `$arrayElemAt` extrae la ciudad de la dirección **principal** del array embebido; calcula ticket promedio |

---

## Consulta 3. Productos en riesgo de quedarse sin inventario

**Qué busca:** productos activos cuyo stock alcanza para **menos de 30 días** al ritmo de venta de los últimos 90 días, con el proveedor al que hay que hacer el pedido.
**Por qué importa:** un producto agotado es venta perdida, y el cliente puede irse a la competencia.
**Decisión que apoya:** qué reabastecer primero y a quién llamar (el resultado trae email y país del proveedor; un proveedor del exterior implica mayor tiempo de importación).
**Impacto:** menos quiebres de stock y una lista de compras priorizada lista para usar.

| Etapa | Qué hace |
|---|---|
| `$match` | Pedidos no cancelados desde el 2-oct-2025 (últimos 90 días) |
| `$unwind` + `$group` | Unidades vendidas por producto en ese periodo |
| `$lookup productos` | Stock actual y estado `activo` (dato "vivo": por esto el item guarda la referencia) |
| `$match activo: true` | Descarta productos descontinuados |
| `$lookup proveedores` | Nombre, email y país del proveedor |
| `$lookup categorias` | Nombre de la categoría (**tres `$lookup` en total**) |
| `$project` | Venta diaria = unidades/90; días de cobertura = stock / venta diaria |
| `$match` + `$sort` + `$limit` | Cobertura < 30 días, los más urgentes primero, máximo 15 |

---

## Consulta 4. Desempeño de las transportadoras

**Qué busca:** por transportadora, número de envíos, días promedio de entrega, porcentaje de entregas retrasadas y costo promedio.
**Por qué importa:** la experiencia de entrega es lo que más influye en la satisfacción y en las reseñas.
**Decisión que apoya:** con qué transportadora renegociar, a cuál asignar más volumen o cuál reemplazar.
**Impacto:** con los datos se ve que la más barata no es la mejor. En los datos generados, *Envía* tiene el menor costo promedio (≈ $11.150) pero 17,6 % de entregas retrasadas, frente a 6,7 % de *Coordinadora*.

| Etapa | Qué hace |
|---|---|
| `$match` | Solo envíos entregados (los que tienen `fecha_entrega`) |
| `$project` | Días de entrega = (`fecha_entrega` − `fecha_envio`) / milisegundos por día. `$cond` marca 1 si llegó más de un día después de la fecha estimada |
| `$group` | Por transportadora: conteo, promedio de días, suma de retrasos, costo promedio |
| `$project` + `$sort` | % de retrasos y orden del mejor al peor |

Sin `$lookup`: el envío está embebido en el pedido.

---

## Consulta 5. Ventas mensuales 2025 y método de pago preferido

**Qué busca:** ventas y pedidos por mes en 2025, ticket promedio, método de pago dominante y el desglose de todos los métodos.
**Por qué importa:** muestra estacionalidad (meses fuertes y débiles) y el peso de cada medio de pago.
**Decisión que apoya:** planear inventario y campañas por temporada; negociar comisiones con la pasarela de pagos del método más usado; decidir si mantener contraentrega (riesgo de devolución).
**Impacto:** proyección de flujo de caja y reducción de costos financieros.

| Etapa | Qué hace |
|---|---|
| `$match` | Pagos aprobados de 2025 |
| `$group` #1 | Por (mes, método): ventas y pedidos |
| `$sort` | Por mes y, dentro de cada mes, por ventas descendente |
| `$group` #2 | Por mes: totales y `$push` del arreglo de métodos (queda ordenado por el `$sort` anterior) |
| `$project` | Ticket promedio; `$arrayElemAt [..., 0]` toma el método principal (el primero del arreglo) |

Patrón de **doble `$group`**: primero el detalle y luego el resumen con el detalle anidado.

---

## Consulta 6. Productos peor calificados (mínimo 10 reseñas)

**Qué busca:** los 10 productos con peor calificación promedio (entre los que tienen al menos 10 reseñas), su % de reseñas negativas (1 o 2 estrellas), su categoría y su proveedor.
**Por qué importa:** un producto malo genera devoluciones, reclamos y daña la reputación de la tienda.
**Decisión que apoya:** retirar el producto, exigir mejoras al proveedor o revisar el control de calidad. Si varios productos del mismo proveedor aparecen, es una señal sobre el proveedor.
**Impacto:** menos devoluciones y mejor calificación general de la tienda.

| Etapa | Qué hace |
|---|---|
| `$group` por producto | Promedio, número de reseñas y reseñas negativas (`$cond`) |
| `$match` | Al menos 10 reseñas, para que el promedio sea estadísticamente confiable |
| `$sort` + `$limit` | Los 10 peores |
| `$lookup` × 3 | productos → categorias y proveedores (desde `producto.categoria_id` y `producto.proveedor_id`) |
| `$project` | Redondeo y % negativas |

---

## Consulta 7. Ventas, cancelaciones y costo logístico por departamento

**Qué busca:** por departamento de destino: pedidos, clientes únicos, ingresos, ticket promedio, tasa de cancelación y costo promedio de envío.
**Por qué importa:** muestra dónde está el mercado, dónde se pierden ventas por cancelación y dónde enviar es más caro.
**Decisión que apoya:** abrir una bodega o punto de recogida regional, cobrar envío diferenciado, enfocar campañas por región.
**Impacto:** reducir costos logísticos y crecer en regiones con buen ticket pero poca penetración.

| Etapa | Qué hace |
|---|---|
| `$group` por `direccion_envio.departamento` | Usa la dirección **embebida** (snapshot) del pedido. `$cond` excluye cancelados de los ingresos y los cuenta aparte. `$addToSet` para clientes y ciudades únicas. `$avg` del costo de envío (ignora pedidos sin envío) |
| `$project` | Clientes únicos (`$size`), ticket promedio, tasa de cancelación |
| `$sort` | Por ingresos |

---

## Consulta 8. Clientes valiosos en riesgo de abandono

**Qué busca:** clientes con 3 o más compras entregadas cuya última compra fue hace más de 180 días, ordenados por lo que han gastado.
**Por qué importa:** son clientes que ya demostraron lealtad y dejaron de comprar. Recuperarlos es más barato que conseguir nuevos.
**Decisión que apoya:** a quién enviar una campaña de reactivación (cupón, llamada, correo personalizado). El resultado trae email y teléfono.
**Impacto:** recuperar ingresos que se estaban perdiendo sin que nadie lo notara.

| Etapa | Qué hace |
|---|---|
| `$lookup` con `let` + `pipeline` | **Subconsulta correlacionada:** por cada cliente (`$$cid`) busca sus pedidos entregados y dentro del sub-pipeline los resume con `$group` (cantidad, total, última compra). Solo se trae el resumen, no todos los pedidos |
| `$unwind` | Pasa el resumen de array a objeto; descarta clientes sin compras |
| `$match` | ≥ 3 pedidos y última compra antes del 4-jul-2025 (180 días antes del corte) |
| `$project` | Días de inactividad = (fecha corte − última compra) / ms por día |
| `$sort` + `$limit` | Los 15 de mayor valor histórico |

Esta es la forma avanzada de `$lookup`: en vez de igualar dos campos, ejecuta un pipeline completo sobre la colección relacionada. Usa el índice `{cliente_id: 1, fecha_pedido: -1}`.
