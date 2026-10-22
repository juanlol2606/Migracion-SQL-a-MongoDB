import http from "http";
import path from "path";
import express, { type Request, type Response } from "express";
import { config, RAIZ } from "../config";
import { conectarSqlServer, ejecutarScript, probarSqlServer } from "../db/sqlserver";
import { conectarMongo } from "../db/mongo";
import { migrar } from "../migracion/migrar";
import { escribirReporte, verificar } from "../migracion/verificar";
import { TABLAS } from "../migracion/tipos";
import { CONSULTAS } from "../consultas/pipelines";
import { aJsonSeguro, aMongosh, parsearPipeline } from "../consultas/formato";
import { ejecutarPipeline, ejecutarTodas } from "../consultas/ejecutar";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(config.rutas.publico));

const COLECCIONES = ["clientes", "pedidos", "productos", "resenas", "categorias", "proveedores"];
const mensajeError = (e: unknown) => (e instanceof Error ? e.message : String(e));


let trabajoEnCurso: string | null = null;


async function streaming(res: Response, nombre: string, tarea: (log: (m: string) => void) => Promise<unknown>) {
  if (trabajoEnCurso) {
    res.status(409).json({ error: `Ya se está ejecutando: ${trabajoEnCurso}` });
    return;
  }
  trabajoEnCurso = nombre;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  const enviar = (evento: object) => res.write(JSON.stringify(evento) + "\n");
  const log = (m: string) => { console.log(m); enviar({ tipo: "log", mensaje: m }); };
  try {
    const datos = await tarea(log);
    enviar({ tipo: "fin", datos });
  } catch (e) {
    console.error(e);
    enviar({ tipo: "error", mensaje: mensajeError(e) });
  } finally {
    trabajoEnCurso = null;
    res.end();
  }
}

// estado de las dos bases
app.get("/api/estado", async (_req, res) => {
  const estado = {
    destino: {
      sql: `${config.sql.server}${config.sql.instance ? "\\" + config.sql.instance : ""} / ${config.sql.database}`,
      mongo: `${config.mongo.uri.replace(/\/\/[^@/]*@/, "//***@")} / ${config.mongo.db}`,
    },
    sql: { ok: false } as Record<string, unknown>,
    mongo: { ok: false } as Record<string, unknown>,
    trabajoEnCurso,
  };
  try {
    estado.sql.version = await probarSqlServer();
    estado.sql.ok = true;
    const fuente = await conectarSqlServer();
    try {
      const [fila] = await fuente.consultar<Record<string, number>>(
        "SELECT " + TABLAS.map((t) => `(SELECT COUNT(*) FROM ${t}) AS ${t}`).join(", "));
      estado.sql.tablas = fila;
    } finally {
      await fuente.cerrar();
    }
  } catch (e) {
    estado.sql.error = mensajeError(e);
  }
  try {
    const db = await conectarMongo();
    const conteos: Record<string, number> = {};
    for (const c of COLECCIONES) conteos[c] = await db.collection(c).estimatedDocumentCount();
    estado.mongo.colecciones = conteos;
    estado.mongo.ok = true;
  } catch (e) {
    estado.mongo.error = mensajeError(e);
  }
  res.json(estado);
});

//  procesos
app.post("/api/sql/instalar", (_req, res) =>
  streaming(res, "instalación de SQL Server", async (log) => {
    for (const archivo of ["01_crear_bd.sql", "02_cargar_datos.sql"]) {
      log(`Ejecutando ${archivo}...`);
      await ejecutarScript(path.join(config.rutas.sql, archivo), log);
    }
    log("Base de datos TecnoHogarDB creada y cargada.");
  }));

app.post("/api/migrar", (_req, res) =>
  streaming(res, "migración", async (log) => {
    const fuente = await conectarSqlServer();
    try {
      return await migrar(fuente, await conectarMongo(), log);
    } finally {
      await fuente.cerrar();
    }
  }));

app.post("/api/verificar", (_req, res) =>
  streaming(res, "verificación", async (log) => {
    const fuente = await conectarSqlServer();
    try {
      const pruebas = await verificar(fuente, await conectarMongo(), log);
      const reporte = escribirReporte(pruebas, config.rutas.evidencias);
      log(`Reporte guardado en ${path.relative(RAIZ, reporte)}`);
      return { pruebas, reporte: path.basename(reporte) };
    } finally {
      await fuente.cerrar();
    }
  }));

//  consultas
app.get("/api/consultas", (_req, res) => {
  res.json(CONSULTAS.map(({ pipeline, ...c }) => ({ ...c, texto: aMongosh(pipeline) })));
});

app.post("/api/consultas/ejecutar", async (req: Request, res: Response) => {
  const { coleccion, texto } = req.body as { coleccion?: string; texto?: string };
  if (!coleccion || !COLECCIONES.includes(coleccion)) return res.status(400).json({ error: "Colección no válida" });
  try {
    const pipeline = parsearPipeline(texto ?? "");
    const r = await ejecutarPipeline(await conectarMongo(), coleccion, pipeline);
    res.json({ ...r, filas: aJsonSeguro(r.filas) });
  } catch (e) {
    res.status(400).json({ error: mensajeError(e) });
  }
});

app.post("/api/consultas/evidencias", async (_req, res) => {
  try {
    const ruta = await ejecutarTodas(await conectarMongo(), config.rutas.evidencias);
    res.json({ archivo: path.basename(ruta) });
  } catch (e) {
    res.status(500).json({ error: mensajeError(e) });
  }
});

// explorador de colecciones
app.get("/api/colecciones/:nombre", async (req, res) => {
  const { nombre } = req.params;
  if (!COLECCIONES.includes(nombre)) return res.status(404).json({ error: "Colección no encontrada" });
  const salto = Math.max(0, Number(req.query.salto) || 0);
  const limite = Math.min(50, Math.max(1, Number(req.query.limite) || 5));
  try {
    const col = (await conectarMongo()).collection(nombre);
    const [total, documentos, indices] = await Promise.all([
      col.countDocuments(),
      col.find().sort({ _id: 1 }).skip(salto).limit(limite).toArray(),
      col.indexes(),
    ]);
    res.json({ total, documentos: aJsonSeguro(documentos), indices });
  } catch (e) {
    res.status(500).json({ error: mensajeError(e) });
  }
});


function escuchar(host: string, obligatorio: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const servidor = http.createServer(app);
    servidor.once("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE") {
        console.error(`\n[X] El puerto ${config.puerto} ya está en uso (¿hay otra ventana con "npm run dev" abierta?).`);
        console.error(`    Cierre la otra ventana o cambie PORT en el archivo .env\n`);
        process.exit(1);
      }
      if (obligatorio) { console.error(`[X] No se pudo iniciar el servidor en ${host}: ${e.message}`); process.exit(1); }
      resolve(false); 
    });
    servidor.listen(config.puerto, host, () => resolve(true));
  });
}

(async () => {
  await escuchar("127.0.0.1", true);
  const ipv6 = await escuchar("::1", false);
  console.log("");
  console.log("  Interfaz lista. Abra en el navegador:");
  console.log(`    http://localhost:${config.puerto}`);
  console.log(`    http://127.0.0.1:${config.puerto}${ipv6 ? "" : "   (use esta)"}`);
  console.log("  Deje esta ventana abierta mientras use la interfaz (Ctrl+C para detener).\n");
})();