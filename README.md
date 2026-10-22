# Taller 3: Migración de SQL Server a MongoDB · TecnoHogar

**Bases de Datos II** · Taller Evaluativo No. 3 · TypeScript + Node.js

Migración de la base relacional de una tienda en línea de tecnología (**TecnoHogar**) desde SQL Server hacia un modelo documental en MongoDB. El proyecto incluye el modelo relacional de origen, el proceso de migración (ETL), la verificación automática de los datos migrados, 8 consultas de negocio con el Aggregation Framework y una **interfaz web** para ejecutar todo el proceso y las consultas sin usar la consola.

## Resumen en cifras

| | |
|---|---|
| Entidades relacionales | **10** tablas, unidas por **11** llaves foráneas |
| Registros | **5.170** (el taller exige más de 5.000) |
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
| 1 | ¿Qué categorías generan más ingresos y cuáles dejan mejor margen? | `pedidos` | `$match`, `$unwind`, 2 × `$lookup`, `$group`, `$addToSet`, `$project`, `$sort` |
| 2 | ¿Quiénes son los clientes más valiosos y dónde están? | `pedidos` | `$match`, `$group`, `$sort`, `$limit`, `$lookup`, `$unwind`, `$project`, `$filter` |
| 3 | ¿Qué productos se agotarán en menos de 30 días y a qué proveedor pedirles? | `pedidos` | `$match`, `$unwind`, `$group`, 3 × `$lookup`, `$project`, `$sort`, `$limit` |
| 4 | ¿Qué transportadora entrega más rápido, con menos retrasos y a menor costo? | `pedidos` | `$match`, `$project` con `$cond`, aritmética de fechas, `$group`, `$sort` |
| 5 | ¿Cómo evolucionan las ventas mes a mes y con qué medios pagan los clientes? | `pedidos` | `$match`, `$group` en 2 niveles, `$push`, `$sort`, `$project`, `$arrayElemAt` |
| 6 | ¿Qué productos generan más insatisfacción, de qué categoría y proveedor? | `resenas` | `$group`, `$cond`, `$match`, `$sort`, `$limit`, 3 × `$lookup`, `$project` |
| 7 | ¿Dónde vendemos más, dónde se cancela más y cuánto cuesta enviar allá? | `pedidos` | `$group` con `$cond`, `$addToSet`, `$avg`, `$project`, `$size`, `$sort` |
| 8 | ¿Qué clientes compraban seguido pero llevan más de 180 días sin comprar? | `clientes` | `$lookup` con `let`/`pipeline`, `$expr`, `$unwind`, `$match`, `$project`, `$sort`, `$limit` |

El texto completo de cada pipeline está en [`src/consultas/pipelines.ts`](src/consultas/pipelines.ts) (fuente única, usada tanto por la consola como por la interfaz) y en [`consultas/consultas_mongosh.js`](consultas/consultas_mongosh.js) en sintaxis de mongosh.

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
