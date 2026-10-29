TypeScript + Node.js

Migración de la base relacional de una tienda en línea de tecnología (**TecnoHogar**) desde SQL Server hacia un modelo documental en MongoDB. El proyecto incluye el modelo relacional de origen, el proceso de migración (ETL), la verificación automática de los datos migrados, 8 consultas de negocio con el Aggregation Framework y una **interfaz web** para ejecutar todo el proceso y las consultas sin usar la consola.

## Resumen en cifras

| | |
|---|---|
| Entidades relacionales | **10** tablas, unidas por **11** llaves foráneas |
| Registros | **5.170**  |
| Colecciones MongoDB | **6** |
| Consultas | **8** (`$lookup`, múltiples `$lookup`, `$lookup` con `let`/`pipeline`, `$match`, `$project`, `$group`, `$unwind`, `$sort`, `$limit`) |
| Pruebas de verificación | **43** |

## Contenido del repositorio

```
├── instalacion/
│   ├── instalar.bat               # doble clic: instala y configura SQL Server + MongoDB (pide admin)
│   ├── instalar-entorno.ps1       # script de PowerShell que hace el trabajo
│   ├── diagnosticar.bat           # doble clic: diagnostica el entorno y repara lo que pueda
│   ├── diagnosticar.ps1           # script de diagnóstico/reparación (guarda diagnostico.txt)
│   ├── iniciar-servicios.bat      # doble clic: inicia SQL Server y MongoDB (pide admin)
│   └── detener-servicios.bat      # doble clic: detiene SQL Server y MongoDB (pide admin)
├── sql/
│   ├── 01_crear_bd.sql            # DDL: base TecnoHogarDB, 10 tablas, PK/FK/CHECK/UNIQUE, índices
│   └── 02_cargar_datos.sql        # 5.170 INSERTs (generado con src/datos/generarDatos.ts)
├── src/
│   ├── config/index.ts            # lee y recarga el archivo .env
│   ├── db/sqlserver.ts            # conexión con mssql + ejecución de scripts .sql con separadores GO
│   ├── db/mongo.ts                # conexión con el driver de MongoDB
│   ├── datos/generarDatos.ts      # generador de datos coherentes (semilla fija) -> 02_cargar_datos.sql
│   ├── migracion/tipos.ts         # tipos de las 10 tablas de origen y de los 6 documentos destino
│   ├── migracion/migrar.ts        # ETL: extraer de SQL Server -> transformar -> cargar en MongoDB
│   ├── migracion/verificar.ts     # las 43 pruebas que comparan SQL Server contra MongoDB
│   ├── consultas/pipelines.ts     # las 8 consultas de agregación (fuente única)
│   ├── consultas/formato.ts       # conversión pipeline <-> texto mongosh (para el editor de la interfaz)
│   ├── consultas/ejecutar.ts      # ejecución de consultas y generación de evidencias
│   ├── server/app.ts              # API REST de la interfaz web (Express)
│   └── cli/*.ts                   # comandos de consola (instalarSql, migrar, verificar, consultas, generarDatos)
├── client/app.ts                  # lógica de la interfaz (se compila a public/app.js, ignorado por git)
├── public/                        # index.html + styles.css de la interfaz
├── consultas/consultas_mongosh.js # las 8 consultas listas para pegar en mongosh o MongoDB Compass (generado)
├── evidencias/                    # reportes de verificación y de consultas generados por el proyecto
└── .gitattributes                 # fuerza CRLF en los .bat y .ps1 (si no, cmd.exe puede fallar al ejecutarlos)
```

## Requisitos

- Windows 10/11 de 64 bits.
- [Node.js](https://nodejs.org/) 18 o superior (el instalador lo agrega si falta).
- Conexión a internet para la instalación de SQL Server y MongoDB.
- Permisos de administrador para instalar y configurar los servicios.

## Instalación del entorno con `instalacion/`

1. Clone o descomprima el proyecto.
2. Haga doble clic en **`instalacion/instalar.bat`** y acepte el aviso de permisos de administrador de Windows.
3. Espere a que termine (entre 15 y 30 minutos, según la conexión).

| Componente | Configuración que deja lista |
|---|---|
| SQL Server 2022 Express | Instancia `SQLEXPRESS`, autenticación mixta, usuario **`sa`** habilitado (contraseña `TecnoHogar_2025!` por defecto), TCP/IP en el puerto fijo **1433**, servicio en inicio automático |
| SQL Server Management Studio | Para ver la base relacional (conexión: `localhost,1433`) |
| MongoDB Community Server | Servicio de Windows `MongoDB` en el puerto **27017**, inicio automático |
| mongosh y MongoDB Compass | Consola y cliente gráfico de MongoDB |
| Node.js LTS | Solo se instala si no estaba presente |
| Archivo `.env` | Se escribe en la raíz del proyecto con los datos de conexión anteriores |

Al final el script **prueba las dos conexiones** y muestra el resultado. Todo queda registrado en `instalacion/instalacion.log` (no se sube al repositorio).

Parámetros opcionales, desde PowerShell como administrador:

```powershell
.\instalacion\instalar-entorno.ps1 -SaPassword "OtraClave_123!"   # usar otra contraseña para sa
.\instalacion\instalar-entorno.ps1 -PuertoSql 14330               # si el puerto 1433 está ocupado
.\instalacion\instalar-entorno.ps1 -SinHerramientasGraficas       # instalar sin SSMS ni Compass
```

El script se puede ejecutar varias veces sin problema: lo que ya está instalado se omite y la configuración se vuelve a aplicar.

Si algo queda mal configurado (por ejemplo, después de reiniciar el computador), ejecute **`instalacion/diagnosticar.bat`**: revisa SQL Server y MongoDB, intenta repararlos (reinicia servicios, corrige TCP/IP, registra el servicio de MongoDB si falta) y guarda el detalle en `instalacion/diagnostico.txt`.

### Encender y apagar los servicios

SQL Server y MongoDB quedan corriendo en segundo plano como servicios de Windows y arrancan solos con el computador; no se apagan solos. Para no dejarlos consumiendo recursos cuando no está usando el proyecto, hay dos scripts de doble clic (piden permisos de administrador):

- **`instalacion/iniciar-servicios.bat`**: inicia `MSSQL$SQLEXPRESS` y `MongoDB`.
- **`instalacion/detener-servicios.bat`**: los detiene.

Los comandos equivalentes, en PowerShell **como administrador**:

```powershell
Stop-Service 'MSSQL$SQLEXPRESS', MongoDB    # detener
Start-Service 'MSSQL$SQLEXPRESS', MongoDB   # iniciar
Get-Service 'MSSQL$SQLEXPRESS', MongoDB     # ver el estado
```

Para que no arranquen solos con Windows (y volver a encenderlos solo cuando los necesite):

```powershell
Set-Service 'MSSQL$SQLEXPRESS' -StartupType Manual
Set-Service MongoDB -StartupType Manual
```

Para que vuelvan a arrancar automáticamente, use `-StartupType Automatic` en lugar de `Manual`.

Alternativa gráfica: **Win + R** → escriba `services.msc` → busque *SQL Server (SQLEXPRESS)* y *MongoDB Server*, donde puede iniciar, detener y cambiar el tipo de inicio con clic derecho → Propiedades.

> Si los dejó en `Manual`, recuerde iniciarlos (con el script o con `Start-Service`) antes de abrir la interfaz web o de ejecutar cualquier comando del proyecto.

<details><summary>Instalación manual (si prefiere no usar el script)</summary>

1. **SQL Server 2022 Express**: instalación *Básica*. Luego, en SSMS: *Propiedades del servidor → Seguridad → Modo de autenticación de SQL Server y Windows*; *Seguridad → Inicios de sesión → sa*: asignar contraseña y habilitar. En *SQL Server Configuration Manager → Configuración de red → Protocolos de SQLEXPRESS → TCP/IP*: habilitar; en la pestaña *Direcciones IP → IPAll*: *Puertos dinámicos TCP* vacío y *Puerto TCP* = 1433. Reiniciar el servicio *SQL Server (SQLEXPRESS)*.
2. **MongoDB Community Server**: instalador MSI, opción *Complete* con *Install MongoD as a Service* marcado.
3. Copiar `.env.example` como `.env` y poner la contraseña real de `sa`.

</details>

## Configuración (`.env`)

El archivo `.env` **no se sube a GitHub** (está en `.gitignore`). Se crea copiando `.env.example`, o lo escribe automáticamente `instalacion/instalar-entorno.ps1`.

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `SQL_SERVER` | `localhost` | Host de SQL Server |
| `SQL_PORT` | `1433` | Puerto TCP fijo de SQL Server |
| `SQL_DATABASE` | `TecnoHogarDB` | Base de datos relacional de origen |
| `SQL_USER` | `sa` | Usuario de SQL Server (el driver `mssql` usa autenticación SQL, no de Windows) |
| `SQL_PASSWORD` | *(sin valor por defecto)* | Contraseña del usuario anterior |
| `SQL_INSTANCE` | *(vacío)* | Nombre de instancia con nombre (ej. `SQLEXPRESS`); se deja vacío porque se usa el puerto fijo |
| `SQL_ENCRYPT` | `false` | Cifrado de la conexión a SQL Server |
| `MONGO_URI` | `mongodb://localhost:27017` | Cadena de conexión a MongoDB |
| `MONGO_DB` | `tecnohogar` | Base de datos documental de destino |
| `PORT` | `3000` | Puerto de la interfaz web |

## Ejecución

```bash
npm install
```

### Opción A: interfaz web (recomendada)

```bash
npm run dev          # abre http://localhost:3000
```

| Pestaña | Qué permite |
|---|---|
| **Migración** | Ver el estado y los conteos de SQL Server y MongoDB en vivo · botón **Instalar base SQL** (crea y carga `TecnoHogarDB`) · botón **Ejecutar migración** (ETL con registro en vivo) · botón **Verificar migración** (tabla con las 43 pruebas) |
| **Consultas** | Las 8 consultas con su pregunta de negocio y sus técnicas. El pipeline **se puede editar y ejecutar en vivo** (sintaxis de mongosh), con resultados en tabla o JSON. Botón **Guardar evidencias de las 8** |
| **Explorar colecciones** | Ver documentos reales de cada colección, con sus arrays y subdocumentos embebidos, paginados, y sus índices |

### Opción B: consola

| Comando | Qué hace |
|---|---|
| `npm run instalar-sql` | Crea `TecnoHogarDB` y carga los 5.170 registros (equivalente a ejecutar `sql/01_crear_bd.sql` y `sql/02_cargar_datos.sql` en SSMS) |
| `npm run migrar` | Ejecuta el ETL: SQL Server → MongoDB |
| `npm run verificar` | Corre las 43 pruebas y guarda `evidencias/verificacion_<fecha>.md` |
| `npm run consultas` | Ejecuta las 8 consultas y guarda `evidencias/resultados_consultas.md` |
| `npm run consultas -- 3` | Ejecuta solo la consulta 3 |
| `npm run consultas -- --js` | Regenera `consultas/consultas_mongosh.js` después de cambiar `pipelines.ts` |
| `npm run generar-datos` | Regenera `sql/02_cargar_datos.sql` con datos nuevos (semilla fija) |
| `npm run typecheck` | Compila en modo chequeo (servidor y cliente), sin generar archivos |
| `npm run build` / `npm start` | Compila a `dist/` y corre la versión compilada |
| `mongosh consultas/consultas_mongosh.js` | Corre las 8 consultas directamente en mongosh |

## Modelo de datos: de 10 tablas a 6 colecciones

| Colección | Origen (SQL Server) | Técnica |
|---|---|---|
| `clientes` | Clientes + Direcciones | **Embedding**: `direcciones[]` |
| `pedidos` | Pedidos + DetallePedido + Pagos + Envios | **Embedding**: `items[]`, `pago{}`, `envio{}` · **Referencing**: `cliente_id`, `items.producto_id` |
| `productos` | Productos (+ resumen agregado de Resenas) | **Referencing**: `categoria_id`, `proveedor_id` · patrón computado `calificacion{ promedio, total_resenas }` |
| `resenas` | Resenas | **Referencing**: `producto_id`, `cliente_id` |
| `categorias` | Categorias | Colección independiente |
| `proveedores` | Proveedores | Colección independiente |

La decisión general fue **embeber lo que un pedido necesita mostrar de una sola vez** (sus ítems, el pago y el envío, que siempre se leen junto con el pedido y no se consultan por separado) y **referenciar lo que se reutiliza o crece de forma independiente** (un cliente tiene muchos pedidos, un producto pertenece a una sola categoría y un solo proveedor). Los tipos completos de ambos modelos están en [`src/migracion/tipos.ts`](src/migracion/tipos.ts).

## Las 8 consultas de agregación

| # | Pregunta de negocio | Colección | Operadores clave |
|---|---|---|---|
| 1 | ¿Qué proveedores generan más ventas, con qué margen y con qué calidad percibida? | `pedidos` | `$match`, `$unwind`, 2 × `$lookup`, `$group`, `$addToSet`, `$push`, `$avg`, `$project`, `$sort`, `$limit` |
| 2 | ¿Qué pares de productos aparecen juntos en el mismo pedido con más frecuencia? | `pedidos` | `$match`, `$project`, doble `$unwind`, `$expr`, `$group`, `$sort`, `$limit`, 2 × `$lookup`, `$arrayElemAt` |
| 3 | ¿Qué productos activos tienen stock pero no se han vendido en los últimos 180 días, y cuánto dinero hay detenido en ellos? | `productos` | `$match`, `$lookup` con `let`/`pipeline`, `$expr`, `$size`, 2 × `$lookup`, `$project`, `$multiply`, `$sort`, `$limit` |
| 4 | ¿Las líneas con descuento venden más unidades que las que no tienen descuento, y cuánto dinero se cede? | `pedidos` | `$match`, `$unwind`, `$project` con cálculo de porcentaje, `$group`, `$avg`, `$sort` |
| 5 | ¿Los clientes califican peor los productos cuando la entrega llegó tarde? | `pedidos` | `$match`, `$project` con aritmética de fechas, `$unwind`, `$lookup` con `let`/`pipeline` (2 condiciones), `$and`, `$group`, `$cond` |
| 6 | ¿Los clientes que se registraron en años más recientes compran tanto como los antiguos? | `clientes` | `$lookup` con `let`/`pipeline`, `$year`, `$cond`, `$ifNull`, `$arrayElemAt`, `$group`, `$project`, `$sort` |
| 7 | ¿Con qué método de pago se pierden más ventas por rechazos o reembolsos, y cuánto dinero representan? | `pedidos` | `$group`, `$cond`, `$eq`, `$in`, `$add`, `$project`, `$sort` (sin `$lookup`: el pago está embebido) |
| 8 | ¿Cada cuántos días vuelve a comprar un cliente, según su segmento? | `pedidos` | `$match`, `$group` en 2 niveles, `$min`, `$max`, `$lookup`, `$unwind`, `$project` con aritmética de fechas, `$concat`, `$toString`, `$sort` |

El texto completo de cada pipeline está en [`src/consultas/pipelines.ts`](src/consultas/pipelines.ts) (fuente única, usada tanto por la consola como por la interfaz) y en [`consultas/consultas_mongosh.js`](consultas/consultas_mongosh.js) en sintaxis de mongosh. La fecha de corte del análisis es el 31 de diciembre de 2025 (el último día con datos) y una «venta válida» es un pedido en estado `Pagado`, `Enviado` o `Entregado`. Los resultados citados abajo son los de [`evidencias/resultados_consultas.md`](evidencias/resultados_consultas.md).

### Qué busca cada consulta, por qué importa y qué hace

**Consulta 1. Ranking de proveedores: ingresos, margen y calidad**
- **Qué busca:** los 10 proveedores que más venden, con su margen bruto y la calificación promedio de sus productos.
- **Por qué importa:** muestra de quién depende el negocio y con quién conviene negociar mejores costos.
- **Impacto:** Orbis Global Ltda. (México) lidera con 668.098.910 en ingresos, pero con margen de 26,7 % y calificación de 3,26; Cóndor Andina Importaciones vende menos (264.734.980) con margen de 39,6 % y calificación de 3,66.
- **Etapas:** `$match` deja solo ventas válidas → `$unwind` separa los ítems → `$lookup` a `productos` trae costo, proveedor y calificación → `$group` por proveedor suma ingresos, costo y unidades, y reúne productos distintos (`$addToSet`) y calificaciones (`$push`) → `$lookup` a `proveedores` trae nombre y país → `$project` calcula margen % y calificación promedio → `$sort` y `$limit` dejan el top 10.

**Consulta 2. Productos que se compran juntos**
- **Qué busca:** los pares de productos que más veces aparecen en un mismo pedido.
- **Por qué importa:** es la base para armar combos, recomendaciones («quienes compraron X también compraron Y») y ubicar productos cercanos en la tienda.
- **Impacto:** el par más frecuente es Bombillo Inteligente Cóndor X48 con Mouse Inalámbrico Cóndor G42 (13 veces), seguido de Bombillo Inteligente Cóndor X48 con Cafetera Zentek S68 (12 veces).
- **Etapas:** `$match` toma pedidos no cancelados con al menos 2 ítems → `$project` copia dos veces la lista de productos del pedido (`a` y `b`) → doble `$unwind` genera todas las combinaciones → `$match` con `$expr` (`a < b`) cuenta cada par una sola vez → `$group` cuenta las veces → `$match` exige al menos 2 → `$sort` y `$limit` dejan el top 10 → 2 × `$lookup` traen los nombres → `$project` da forma al resultado.

**Consulta 3. Inventario inmovilizado**
- **Qué busca:** productos activos con stock que no tuvieron ventas (no canceladas) en los últimos 180 días, y el dinero detenido en ellos (stock × costo).
- **Por qué importa:** el inventario sin rotación inmoviliza capital y corre riesgo de volverse obsoleto; permite decidir qué liquidar, promocionar o dejar de reponer.
- **Impacto:** el Portátil Ultrabook Orbis A21 tiene 165 unidades paradas por 600.154.500, y los cinco primeros productos superan los 130 millones cada uno. En los datos hay 10 productos en esta situación.
- **Etapas:** `$match` filtra activos con stock → `$lookup` con `let`/`pipeline` busca, por producto, sus ventas de los últimos 180 días (`$unwind` de ítems + `$expr` por `producto_id` + `$group`) → `$match` con `$size: 0` conserva solo los que no vendieron → 2 × `$lookup` traen categoría y proveedor → `$project` calcula `valor_inmovilizado` con `$multiply` → `$sort` y `$limit`.

**Consulta 4. Efecto de los descuentos en las ventas**
- **Qué busca:** si las líneas de venta con descuento (5 %, 10 %, 15 %) venden más unidades que las que no lo tienen, y cuánto dinero se cede en descuentos.
- **Por qué importa:** un descuento cuesta margen; solo se justifica si aumenta el volumen.
- **Impacto:** las unidades por línea casi no cambian (1,41 sin descuento frente a 1,37, 1,39 y 1,39 con 5 %, 10 % y 15 %) y se cedieron 201.481.030 en descuentos: en estos datos los descuentos no están aumentando las unidades vendidas.
- **Etapas:** `$match` deja ventas válidas → `$unwind` separa los ítems → `$project` calcula el porcentaje de descuento de cada línea → `$group` por porcentaje cuenta líneas, promedia unidades y suma ingresos y descuento cedido (`$avg`, `$sum`) → `$project` redondea → `$sort` por porcentaje.

**Consulta 5. Impacto de los retrasos en la satisfacción**
- **Qué busca:** comparar las reseñas de productos entregados a tiempo con las de entregas tardías (más de 1 día después de la fecha estimada).
- **Por qué importa:** si la logística afecta la opinión del cliente, se justifica exigir mejores tiempos a las transportadoras.
- **Impacto:** a tiempo, 483 reseñas con promedio 3,60 y 13,5 % negativas; con retraso, 75 reseñas con promedio 3,53 y 16,0 % negativas. Hay más reseñas negativas cuando se retrasa, aunque la diferencia es moderada.
- **Etapas:** `$match` toma envíos entregados → `$project` calcula si llegó a tiempo (aritmética de fechas) → `$unwind` separa los ítems → `$lookup` con `let`/`pipeline` cruza con `resenas` por cliente **y** producto a la vez (`$and`) → `$unwind` descarta ítems sin reseña → `$group` por «a tiempo / con retraso» promedia la calificación y cuenta las negativas (≤ 2) con `$cond` → `$project` etiqueta y calcula el porcentaje.

**Consulta 6. Grupo de clientes por año de registro**
- **Qué busca:** si los clientes registrados en años recientes compran tanto como los más antiguos.
- **Por qué importa:** indica si la captación reciente trae clientes de igual valor o si el negocio depende de su base antigua.
- **Impacto:** el porcentaje de clientes que compran baja de 80,7 % (registrados en 2022) a 74,2 % (2025), y el ingreso por cliente baja de 13.989.590 a 11.937.742. Hay que recordar que los registrados en 2025 tuvieron menos tiempo para comprar.
- **Etapas:** `$lookup` con `let`/`pipeline` trae, por cliente, cuántos pedidos entregados tiene y su total → `$project` extrae el año (`$year`), marca si compró (`$cond`) y usa `$ifNull` + `$arrayElemAt` para los clientes sin compras → `$group` por año → `$project` calcula porcentaje de compradores, pedidos por cliente e ingreso por cliente → `$sort` por año.

**Consulta 7. Pagos rechazados y reembolsados por método**
- **Qué busca:** el porcentaje de pagos rechazados o reembolsados de cada método de pago y el dinero que representan.
- **Por qué importa:** un pago fallido es una venta perdida o devuelta; señala qué método genera más fricción.
- **Impacto:** Nequi tiene 14,0 % de pagos fallidos (8 rechazados y 7 reembolsados de 107 pedidos), el doble que los demás métodos (entre 6,6 % y 7,4 %). En dinero, PSE es donde más se pierde (137.005.470).
- **Etapas:** `$group` por método usa `$cond` para contar rechazados y reembolsados y sumar el monto perdido (`$in`) y el aprobado → `$project` calcula el porcentaje de fallidos con `$add` → `$sort` de mayor a menor. No necesita `$lookup` porque el pago va embebido en el pedido.

**Consulta 8. Frecuencia de recompra por segmento**
- **Qué busca:** cada cuántos días vuelve a comprar un cliente (entre su primera y su última compra entregada), según su segmento. Solo cuenta clientes con 2 o más pedidos.
- **Por qué importa:** permite programar campañas de recompra y reactivación en el momento justo para cada segmento.
- **Impacto:** los clientes Premium recompran cada 59 días en promedio, los Frecuente cada 100 y los Regular cada 176.
- **Etapas:** `$match` toma pedidos entregados → `$group` por cliente cuenta pedidos y obtiene su primera y última fecha (`$min`, `$max`) → `$match` exige al menos 2 pedidos → `$lookup` a `clientes` y `$unwind` traen el segmento → `$project` calcula los días entre compras → `$group` por segmento promedia y obtiene el mínimo y el máximo → `$project` redondea y arma el rango con `$concat` y `$toString` → `$sort`.

## Verificación de la migración

`npm run verificar` compara SQL Server contra MongoDB en 43 pruebas, agrupadas así:

| Sección | Qué revisa |
|---|---|
| **0. Requisitos del modelo relacional** | Que existan las 10 tablas y las 11 llaves foráneas, que no haya tablas aisladas y que haya más de 5.000 registros en total |
| **A. Conteos** | Que cada tabla (o array/subdocumento embebido) tenga exactamente el mismo número de filas/documentos en ambos lados |
| **B. Totales de control** | Sumas y promedios (subtotales, montos pagados, costos de envío, calificación promedio, pedidos por estado) iguales en SQL Server y MongoDB |
| **C. Integridad de referencias** | Que no existan referencias huérfanas (`cliente_id`, `producto_id`, `categoria_id`, `proveedor_id`) |
| **D. Estructuras embebidas** | Que todo pedido tenga sus ítems, que los totales embebidos cuadren con la suma de sus ítems, que los pedidos enviados/entregados tengan envío, y que todo cliente tenga una dirección principal |
| **E. Muestreo aleatorio** | Compara pedidos y clientes elegidos al azar, campo por campo, entre las dos bases |

El resultado queda en pantalla y en un reporte `evidencias/verificacion_<fecha>.md` con el detalle de las 43 pruebas.

## Evidencias

La carpeta `evidencias/` contiene los reportes que genera el propio proyecto:

- `verificacion_<fecha>.md`: salida completa de `npm run verificar` (las 43 pruebas).
- `resultados_consultas.md`: salida de `npm run consultas` (las 8 consultas con sus resultados), o del botón "Guardar evidencias de las 8" en la interfaz.

Capturas de pantalla que faltan por agregar para la entrega:

- [ ] Pestaña **Migración** con los conteos de SQL Server y MongoDB, y la tabla de verificación (43/43).
- [ ] Un documento de la colección `pedidos` en la pestaña **Explorar colecciones**, mostrando `items[]`, `pago{}` y `envio{}` embebidos.
- [ ] Pestaña **Consultas** con el resultado de alguna consulta.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Failed to connect to localhost:1433` | TCP/IP deshabilitado o puerto dinámico | Ejecute `instalacion/diagnosticar.bat`, o en SQL Server Configuration Manager → TCP/IP → IPAll: `TcpPort=1433`, `TcpDynamicPorts` vacío; reinicie el servicio `MSSQL$SQLEXPRESS` |
| `Login failed for user 'sa'` | Autenticación mixta desactivada, contraseña distinta a la de `.env`, **o la base `TecnoHogarDB` todavía no existe** (SQL Server devuelve un mensaje con la misma frase) | Si la base no existe, use el botón **Instalar base SQL**; si es la contraseña, ejecute `instalacion/diagnosticar.bat` o iguale `SQL_PASSWORD` en `.env` con la de `sa` |
| `connect ECONNREFUSED 127.0.0.1:27017` | El servicio MongoDB está detenido | `Start-Service MongoDB`, o `services.msc` → *MongoDB Server* → Iniciar |
| El puerto 1433 ya está en uso | Otra instancia de SQL Server | Ejecute el instalador con `-PuertoSql 14330` (actualiza `.env`) |
| El puerto 3000 ya está en uso | Otro `npm run dev` abierto, u otro programa | Cierre la otra ventana, o cambie `PORT` en `.env` |
| La página carga pero sin datos | Todavía no se migró | Botón **Ejecutar migración** |
| `winget` no se reconoce | Falta la app *App Installer* | Instálela desde Microsoft Store, o use la instalación manual de este README |
| `running scripts is disabled` | Política de ejecución de PowerShell | Use `instalar.bat` (ya la evita), o `powershell -ExecutionPolicy Bypass -File ...` |
