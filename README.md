# Taller 3: Migración de SQL Server a MongoDB · TecnoHogar

**Bases de Datos II** · Taller Evaluativo No. 3 · TypeScript + Node.js

Migración de la base relacional de una tienda en línea de tecnología (**TecnoHogar**) desde SQL Server hacia un modelo documental en MongoDB. Incluye verificación de los datos, 8 consultas de negocio con Aggregation Framework y una **interfaz web** para ejecutar todo el proceso y las consultas.

| | |
|---|---|
| Entidades relacionales | **10** tablas, unidas por **11** llaves foráneas |
| Registros | **5.170** (el taller exige más de 5.000) |
| Colecciones MongoDB | **6** |
| Consultas | **8** (`$lookup`, múltiples `$lookup`, `$lookup` con `let`/`pipeline`, `$match`, `$project`, `$group`, `$unwind`, `$sort`, `$limit`) |
| Pruebas de verificación | **43** |

## Interfaz web

```bash
npm run dev          # abre http://localhost:3000
```

| Pestaña | Qué permite |
|---|---|
| **Migración** | Ver el estado y los conteos de SQL Server y MongoDB · crear y poblar la base SQL · ejecutar la migración con su registro en vivo · verificar (tabla con las 43 pruebas) |
| **Consultas** | Las 8 consultas con su pregunta de negocio. El pipeline **se puede editar y ejecutar en vivo** (sintaxis de mongosh), con resultados en tabla o JSON. Botón para guardar las evidencias |
| **Explorar colecciones** | Ver documentos reales de cada colección (con sus arrays y subdocumentos embebidos) y sus índices |

## Estructura

```
├── instalacion/
│   ├── instalar.bat               # doble clic: instala y configura SQL Server + MongoDB
│   └── instalar-entorno.ps1       # script de PowerShell que hace el trabajo
├── sql/
│   ├── 01_crear_bd.sql            # DDL: base, 10 tablas, PK/FK/CHECK/UNIQUE, índices
│   ├── 02_cargar_datos.sql        # 5.170 INSERTs (generado)
│   └── 03_validar_datos.sql       # conteos y chequeos antes de migrar
├── src/
│   ├── config/index.ts            # lee .env
│   ├── db/sqlserver.ts            # conexión mssql + ejecución de scripts con GO
│   ├── db/mongo.ts                # conexión MongoDB
│   ├── datos/generarDatos.ts      # generador de datos coherentes (semilla fija)
│   ├── migracion/tipos.ts         # tipos de las 10 tablas y de los 6 documentos
│   ├── migracion/migrar.ts        # ETL: extraer -> transformar -> cargar
│   ├── migracion/verificar.ts     # 43 pruebas SQL Server vs MongoDB
│   ├── consultas/pipelines.ts     # las 8 consultas (fuente única)
│   ├── consultas/formato.ts       # pipeline <-> texto mongosh (editor de la interfaz)
│   ├── consultas/ejecutar.ts      # ejecución y evidencias
│   ├── server/app.ts              # API REST de la interfaz (Express)
│   └── cli/*.ts                   # comandos de consola
├── client/app.ts                  # lógica de la interfaz (se compila a public/app.js)
├── public/                        # index.html + styles.css
├── consultas/consultas_mongosh.js # las 8 consultas para mongosh / Compass (generado)
├── docs/                          # modelos, decisiones, justificación, verificación, guía
└── evidencias/                    # reportes generados + capturas
```

## Requisitos e instalación del entorno (Windows)

Se necesita **Node.js 18+**, **SQL Server** y **MongoDB**. Hay un instalador automático:

1. Doble clic en **`instalacion/instalar.bat`** y acepte el aviso de permisos de administrador.
2. Espere a que termine (15 a 30 minutos según la conexión). Instala y configura:

| Componente | Configuración que deja lista |
|---|---|
| SQL Server 2022 Express | Instancia `SQLEXPRESS`, autenticación mixta, usuario **`sa`** habilitado (contraseña `TecnoHogar_2025!`), TCP/IP en el puerto fijo **1433**, servicio automático |
| SQL Server Management Studio | Para ver la base relacional (conexión: `localhost,1433`) |
| MongoDB Community Server 8 | Servicio de Windows `MongoDB` en el puerto **27017**, inicio automático |
| mongosh y MongoDB Compass | Consola y cliente gráfico de MongoDB |
| Node.js LTS | Solo si no está instalado |
| Archivo `.env` | Se escribe con los datos de conexión anteriores |

3. Al final el script **prueba las dos conexiones** y muestra el resultado. Todo queda registrado en `instalacion/instalacion.log`.

Se puede ejecutar varias veces sin problema (omite lo que ya está instalado). Opciones, desde PowerShell como administrador:

```powershell
.\instalacion\instalar-entorno.ps1 -SaPassword "OtraClave_123!"   # otra contraseña para sa
.\instalacion\instalar-entorno.ps1 -PuertoSql 14330               # si el 1433 está ocupado
.\instalacion\instalar-entorno.ps1 -SinHerramientasGraficas       # sin SSMS ni Compass
```

Después:

```bash
npm install
```

<details><summary>Instalación manual (si prefiere no usar el script)</summary>

1. **SQL Server 2022 Express**: instalación *Básica*. Luego, en SSMS: *Propiedades del servidor → Seguridad → Modo de autenticación de SQL Server y Windows*; *Seguridad → Inicios de sesión → sa*: asignar contraseña y habilitar. En *SQL Server Configuration Manager → Configuración de red → Protocolos de SQLEXPRESS → TCP/IP*: habilitar; en la pestaña *Direcciones IP → IPAll*: *Puertos dinámicos TCP* vacío y *Puerto TCP* = 1433. Reiniciar el servicio *SQL Server (SQLEXPRESS)*.
2. **MongoDB Community Server**: instalador MSI, opción *Complete* con *Install MongoD as a Service* marcado.
3. Copiar `.env.example` como `.env` y poner la contraseña de `sa`.

</details>

### Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `Failed to connect to localhost:1433` | TCP/IP deshabilitado o puerto dinámico: vuelva a ejecutar el script o revise el paso 1 de la instalación manual |
| `Login failed for user 'sa'` | Autenticación mixta desactivada o contraseña distinta a la de `.env` |
| `connect ECONNREFUSED 127.0.0.1:27017` | El servicio MongoDB está detenido: `services.msc` → *MongoDB Server* → Iniciar |
| `winget` no se reconoce | Instale *App Installer* desde Microsoft Store, o use la instalación manual |
| El script no abre | Clic derecho en `instalar.bat` → *Ejecutar como administrador* |

## Uso

### Opción A: interfaz web (recomendada)

```bash
npm run dev
```

En http://localhost:3000: **Instalar base SQL** → **Ejecutar migración** → **Verificar migración** → pestaña **Consultas**.

### Opción B: consola

```bash
npm run instalar-sql      # crea TecnoHogarDB y carga los datos (o ejecute los .sql en SSMS)
npm run migrar            # SQL Server -> MongoDB
npm run verificar         # 43 pruebas -> evidencias/verificacion_<fecha>.md
npm run consultas         # 8 consultas -> evidencias/resultados_consultas.md
npm run consultas -- 3    # solo la consulta 3
mongosh consultas/consultas_mongosh.js
```

Otros comandos: `npm run generar-datos` (regenera `02_cargar_datos.sql`), `npm run consultas -- --js` (regenera el archivo de mongosh después de cambiar `pipelines.ts`), `npm run typecheck`, `npm start` (versión compilada).

## Resumen del modelo documental

| Colección | Origen | Técnica |
|---|---|---|
| `clientes` | Clientes + Direcciones | Embedding: `direcciones[]` |
| `pedidos` | Pedidos + DetallePedido + Pagos + Envios | Embedding: `items[]`, `pago{}`, `envio{}` · Referencing: `cliente_id`, `items.producto_id` |
| `productos` | Productos (+ resumen de Resenas) | Referencing: `categoria_id`, `proveedor_id` · patrón computado `calificacion{}` |
| `resenas` | Resenas | Referencing: `producto_id`, `cliente_id` |
| `categorias` | Categorias | Colección independiente |
| `proveedores` | Proveedores | Colección independiente |

Detalle en [`docs/02`](docs/02_modelo_documental.md) y [`docs/03`](docs/03_decisiones_embedding_referencing.md).

## Las 8 consultas

| # | Pregunta de negocio | Operadores clave |
|---|---|---|
| 1 | ¿Qué categorías generan más ingresos y margen? | `$unwind`, 2 × `$lookup`, `$group`, `$addToSet` |
| 2 | ¿Quiénes son los 10 clientes más valiosos? | `$group`, `$limit`, `$lookup`, `$filter` |
| 3 | ¿Qué productos se agotarán en menos de 30 días y a qué proveedor pedir? | 3 × `$lookup`, `$project` calculado |
| 4 | ¿Qué transportadora entrega mejor? | `$project` con `$cond`, aritmética de fechas |
| 5 | ¿Cómo evolucionan las ventas mes a mes y por método de pago? | doble `$group`, `$push` |
| 6 | ¿Qué productos generan más insatisfacción? | `$group`, 3 × `$lookup` |
| 7 | ¿Dónde vendemos más, dónde se cancela más y cuánto cuesta enviar? | `$group` con `$cond`, `$addToSet` |
| 8 | ¿Qué clientes valiosos dejaron de comprar? | `$lookup` con `let` + `pipeline` |

Justificación completa en [`docs/04`](docs/04_consultas_justificacion.md). Preguntas probables de la sustentación en [`docs/06`](docs/06_guia_sustentacion.md).
#   M i g r a c i o n - a - M o n g o D B  
 #   M i g r a c i o n - a - M o n g o D B  
 