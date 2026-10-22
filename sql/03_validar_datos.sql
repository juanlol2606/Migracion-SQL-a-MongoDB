/* Script 03: validación de la base relacional ANTES de migrar */
USE TecnoHogarDB;
GO

/* 1. Conteo de registros por tabla (debe superar 5.000 en total; con los datos generados son 5.170) */
SELECT 'Categorias' AS tabla, COUNT(*) AS registros FROM Categorias
UNION ALL SELECT 'Proveedores',   COUNT(*) FROM Proveedores
UNION ALL SELECT 'Productos',     COUNT(*) FROM Productos
UNION ALL SELECT 'Clientes',      COUNT(*) FROM Clientes
UNION ALL SELECT 'Direcciones',   COUNT(*) FROM Direcciones
UNION ALL SELECT 'Pedidos',       COUNT(*) FROM Pedidos
UNION ALL SELECT 'DetallePedido', COUNT(*) FROM DetallePedido
UNION ALL SELECT 'Pagos',         COUNT(*) FROM Pagos
UNION ALL SELECT 'Envios',        COUNT(*) FROM Envios
UNION ALL SELECT 'Resenas',       COUNT(*) FROM Resenas;

SELECT
  (SELECT COUNT(*) FROM Categorias) + (SELECT COUNT(*) FROM Proveedores) + (SELECT COUNT(*) FROM Productos) +
  (SELECT COUNT(*) FROM Clientes)   + (SELECT COUNT(*) FROM Direcciones) + (SELECT COUNT(*) FROM Pedidos) +
  (SELECT COUNT(*) FROM DetallePedido) + (SELECT COUNT(*) FROM Pagos) + (SELECT COUNT(*) FROM Envios) +
  (SELECT COUNT(*) FROM Resenas) AS total_registros;

/* 1b. Las 10 entidades están relacionadas: lista de las 11 llaves foráneas (tabla hija -> tabla padre) */
SELECT OBJECT_NAME(f.parent_object_id)     AS tabla_hija,
       COL_NAME(fc.parent_object_id, fc.parent_column_id) AS columna_fk,
       OBJECT_NAME(f.referenced_object_id) AS tabla_padre
FROM sys.foreign_keys f
JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
ORDER BY tabla_hija;

/* 1c. Tablas que no participan en ninguna relación (debe devolver 0 filas) */
SELECT t.name AS tabla_aislada
FROM sys.tables t
WHERE t.is_ms_shipped = 0 AND NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys f
  WHERE f.parent_object_id = t.object_id OR f.referenced_object_id = t.object_id);

/* 2. Coherencia: el total de cada pedido coincide con la suma de su detalle (debe devolver 0 filas) */
SELECT p.pedido_id, p.total, SUM(d.subtotal) AS suma_detalle
FROM Pedidos p JOIN DetallePedido d ON d.pedido_id = p.pedido_id
GROUP BY p.pedido_id, p.total
HAVING ABS(p.total - SUM(d.subtotal)) > 0.01;

/* 3. Pedidos enviados/entregados sin registro de envío (debe devolver 0 filas) */
SELECT p.pedido_id, p.estado
FROM Pedidos p LEFT JOIN Envios e ON e.pedido_id = p.pedido_id
WHERE p.estado IN ('Enviado','Entregado') AND e.envio_id IS NULL;

/* 4. Totales de control que se compararán con MongoDB después de migrar */
SELECT
  (SELECT SUM(subtotal) FROM DetallePedido) AS suma_detalle,
  (SELECT SUM(monto)    FROM Pagos)         AS suma_pagos,
  (SELECT SUM(costo_envio) FROM Envios)     AS suma_costo_envios,
  (SELECT AVG(CAST(calificacion AS DECIMAL(5,2))) FROM Resenas) AS calificacion_promedio;
