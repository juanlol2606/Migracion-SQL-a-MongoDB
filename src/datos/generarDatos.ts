
import fs from "fs";
import path from "path";

//  aleatorio reproducible
class Aleatorio {
  private s: number;
  constructor(semilla: number) { this.s = semilla >>> 0; }
  
  random(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  entero(a: number, b: number): number { return a + Math.floor(this.random() * (b - a + 1)); }
  uniforme(a: number, b: number): number { return a + this.random() * (b - a); }
  elegir<T>(xs: readonly T[]): T { return xs[Math.floor(this.random() * xs.length)]; }
  elegirPeso<T>(xs: readonly T[], pesos: readonly number[]): T {
    const total = pesos.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < xs.length; i++) { r -= pesos[i]; if (r < 0) return xs[i]; }
    return xs[xs.length - 1];
  }
  muestra<T>(xs: readonly T[], k: number): T[] {
    const copia = [...xs];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, k);
  }
 
  pareto(alfa: number): number { return 1 / Math.pow(1 - this.random(), 1 / alfa); }
  gauss(media: number, desv: number): number {
    const u = 1 - this.random(), v = this.random();
    return media + desv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

const rnd = new Aleatorio(42);

const N_PRODUCTOS = 150, N_CLIENTES = 300, N_PEDIDOS = 700, PROB_RESENA = 0.33, LOTE = 500;
const utc = (a: number, m: number, d: number, h = 0, mi = 0, s = 0) => new Date(Date.UTC(a, m - 1, d, h, mi, s));
const INICIO = utc(2024, 1, 1), FIN = utc(2025, 12, 31, 23, 59, 59);
const DIA = 86_400_000, HORA = 3_600_000, MINUTO = 60_000;
const sumar = (f: Date, ms: number) => new Date(f.getTime() + ms);
const soloFecha = (f: Date) => utc(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
const fechaAleatoria = (a: Date, b: Date) =>
  new Date(Math.floor((a.getTime() + rnd.random() * (b.getTime() - a.getTime())) / 1000) * 1000);
const r2 = (x: number) => Math.round(x * 100) / 100;

// ------------------------------------------------------------ catálogos
const CATEGORIAS: [string, string][] = [
  ["Celulares", "Smartphones y teléfonos básicos"], ["Computadores", "Portátiles, escritorio y tabletas"],
  ["Televisores", "Smart TV y monitores"], ["Audio", "Audífonos, parlantes y barras de sonido"],
  ["Electrodomésticos", "Neveras, lavadoras y estufas"], ["Cocina", "Pequeños electrodomésticos de cocina"],
  ["Videojuegos", "Consolas, juegos y accesorios"], ["Accesorios", "Cables, cargadores, fundas y periféricos"],
  ["Hogar inteligente", "Bombillos, cámaras y asistentes de voz"], ["Cuidado personal", "Secadores, planchas y afeitadoras"],
  ["Deportes", "Relojes deportivos y bicicletas eléctricas"], ["Oficina", "Impresoras, sillas y escritorios"],
];
const RANGO_PRECIO: Record<number, [number, number]> = {
  1: [450_000, 5_500_000], 2: [1_200_000, 8_000_000], 3: [900_000, 7_000_000], 4: [60_000, 1_800_000],
  5: [900_000, 6_500_000], 6: [80_000, 900_000], 7: [90_000, 3_500_000], 8: [15_000, 250_000],
  9: [40_000, 700_000], 10: [50_000, 600_000], 11: [150_000, 4_000_000], 12: [120_000, 2_500_000],
};
const PRODUCTOS_BASE: Record<number, string[]> = {
  1: ["Smartphone Galaxy", "Smartphone Moto", "Smartphone Redmi", "iPhone", "Celular Básico"],
  2: ["Portátil Ultrabook", "Portátil Gamer", "PC Escritorio", "Tablet", "Chromebook"],
  3: ['Smart TV 50"', 'Smart TV 65"', 'Monitor 27"', 'Monitor 24"', 'Smart TV 43"'],
  4: ["Audífonos Bluetooth", "Parlante Portátil", "Barra de Sonido", "Audífonos In-Ear", "Torre de Sonido"],
  5: ["Nevera No Frost", "Lavadora Carga Superior", "Estufa 4 Puestos", "Secadora", "Congelador"],
  6: ["Licuadora", "Freidora de Aire", "Cafetera", "Sanduchera", "Olla Arrocera"],
  7: ["Consola", "Control Inalámbrico", "Juego de Aventura", "Juego de Deportes", "Silla Gamer"],
  8: ["Cargador Rápido", "Cable USB-C", "Funda Protectora", "Mouse Inalámbrico", "Teclado Mecánico"],
  9: ["Bombillo Inteligente", "Cámara de Seguridad", "Asistente de Voz", "Enchufe Wi-Fi", "Timbre Inteligente"],
  10: ["Secador de Cabello", "Plancha de Cabello", "Afeitadora", "Cepillo Eléctrico", "Depiladora"],
  11: ["Reloj Deportivo", "Bicicleta Eléctrica", "Banda de Actividad", "Patineta Eléctrica", "Báscula Inteligente"],
  12: ["Impresora Multifuncional", "Silla Ergonómica", "Escritorio en L", "Lámpara LED", "Destructora de Papel"],
};
const MARCAS = ["Nova", "Zentek", "Altura", "Kumo", "Vértice", "Lumina", "Orbis", "Pixel", "Andes", "Cóndor"];
const CIUDADES: [string, string, string, number][] = [
  ["Bogotá", "Cundinamarca", "110", 30], ["Medellín", "Antioquia", "050", 18], ["Cali", "Valle del Cauca", "760", 12],
  ["Barranquilla", "Atlántico", "080", 9], ["Cartagena", "Bolívar", "130", 6], ["Bucaramanga", "Santander", "680", 6],
  ["Pereira", "Risaralda", "660", 4], ["Manizales", "Caldas", "170", 3], ["Cúcuta", "Norte de Santander", "540", 4],
  ["Ibagué", "Tolima", "730", 3], ["Santa Marta", "Magdalena", "470", 3], ["Villavicencio", "Meta", "500", 2],
];
const PESOS_CIUDAD = CIUDADES.map((c) => c[3]);
const NOMBRES = ["Juan", "María", "Carlos", "Ana", "Luis", "Laura", "Andrés", "Camila", "Jorge", "Valentina",
  "Felipe", "Daniela", "Santiago", "Sofía", "David", "Paula", "Miguel", "Natalia", "Sebastián", "Juliana",
  "Alejandro", "Carolina", "Diego", "Manuela", "Óscar", "Isabella", "Ricardo", "Gabriela", "Mateo", "Lucía",
  "Esteban", "Mariana", "Julián", "Catalina", "Nicolás", "Sara"];
const APELLIDOS = ["García", "Rodríguez", "Martínez", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres",
  "Díaz", "Vargas", "Moreno", "Rojas", "Jiménez", "Castro", "Ortiz", "Gómez", "Muñoz", "Herrera", "Medina",
  "Restrepo", "Ospina", "Cárdenas", "Suárez", "Ríos", "Mejía", "Quintero", "Zapata", "Correa", "Valencia"];
const CALLES = ["Calle", "Carrera", "Avenida", "Diagonal", "Transversal"];
const TRANSPORTADORAS: [string, number, number, number][] = [
  ["Servientrega", 3, 0.12, 12_000], ["Coordinadora", 3, 0.08, 13_500], ["Interrapidísimo", 4, 0.18, 10_500],
  ["Envía", 4, 0.22, 9_800], ["TCC", 3, 0.10, 14_000],
];
const METODOS = ["Tarjeta credito", "Tarjeta debito", "PSE", "Nequi", "Contraentrega"];
const PESOS_METODO = [35, 15, 25, 15, 10];
const COMENTARIOS: Record<number, string[]> = {
  5: ["Excelente producto, lo recomiendo.", "Superó mis expectativas.", "Llegó rápido y en perfecto estado."],
  4: ["Muy bueno, buena relación calidad-precio.", "Cumple con lo prometido.", "Buen producto, el empaque podría mejorar."],
  3: ["Es aceptable, nada extraordinario.", "Funciona, pero esperaba más.", "Regular, la entrega se demoró."],
  2: ["No cumplió mis expectativas.", "Calidad inferior a la descrita.", "Presentó fallas a las pocas semanas."],
  1: ["Muy mala experiencia, no lo recomiendo.", "Llegó defectuoso.", "Pésima calidad."],
};
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

type Valor = string | number | boolean | Date | null;
type Tabla = { columnas: string[]; filas: Valor[][] };

//  generación
export function generar(): Record<string, Tabla> {
  const t: Record<string, Tabla> = {};
  t.Categorias = { columnas: ["categoria_id", "nombre", "descripcion"], filas: CATEGORIAS.map(([n, d], i) => [i + 1, n, d]) };

  // Proveedores: 18 nacionales y 7 internacionales
  const EXTERIOR: [string, string][] = [["Ciudad de Panamá", "Panamá"], ["Miami", "Estados Unidos"], ["Shenzhen", "China"], ["Ciudad de México", "México"]];
  const proveedores: Valor[][] = [];
  const nombresProv = new Set<string>();
  const nits = new Set<string>();
  for (let i = 1; i <= 25; i++) {
    let nombre = `${rnd.elegir(MARCAS)} ${rnd.elegir(["Tech", "Global", "Andina", "Express", "Digital"])} ${rnd.elegir(["S.A.S.", "Ltda.", "S.A.", "Distribuciones", "Importaciones"])}`;
    if (nombresProv.has(nombre)) nombre += ` #${i}`;
    nombresProv.add(nombre);
    const [ciudad, pais] = i <= 18 ? [rnd.elegir(CIUDADES.slice(0, 6))[0], "Colombia"] : rnd.elegir(EXTERIOR);
    let nit: string;
    do { nit = `900${rnd.entero(100000, 999999)}-${rnd.entero(0, 9)}`; } while (nits.has(nit));
    nits.add(nit);
    proveedores.push([i, nombre, nit, `ventas${i}@proveedor${i}.com`, `60${rnd.entero(10000000, 99999999)}`, ciudad, pais]);
  }
  t.Proveedores = { columnas: ["proveedor_id", "nombre", "nit", "email", "telefono", "ciudad", "pais"], filas: proveedores };

  // Productos: cada proveedor se especializa en 3 categorías
  const provPorCat: Record<number, number[]> = {};
  for (let c = 1; c <= 12; c++) provPorCat[c] = [];
  for (let p = 1; p <= 25; p++) for (const c of rnd.muestra([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3)) provPorCat[c].push(p);
  for (let c = 1; c <= 12; c++) if (!provPorCat[c].length) provPorCat[c].push(rnd.entero(1, 25));

  const productos: Valor[][] = [];
  const precio = new Map<number, number>();
  const activos: number[] = [];
  for (let i = 1; i <= N_PRODUCTOS; i++) {
    const cat = ((i - 1) % 12) + 1;
    const base = rnd.elegir(PRODUCTOS_BASE[cat]), marca = rnd.elegir(MARCAS);
    const modelo = `${rnd.elegir("ABCDEFGHJKLMNPRSTXZ".split(""))}${rnd.entero(10, 99)}`;
    const [lo, hi] = RANGO_PRECIO[cat];
    const p = Math.round(rnd.uniforme(lo, hi) / 100) * 100;
    const costo = Math.round((p * rnd.uniforme(0.55, 0.8)) / 100) * 100;
    const stock = rnd.elegir([0, rnd.entero(1, 15), rnd.entero(16, 80), rnd.entero(81, 300)]);
    const activo = rnd.random() > 0.05;
    precio.set(i, p);
    if (activo) activos.push(i);
    productos.push([i, `TH-${String(cat).padStart(2, "0")}-${String(i).padStart(4, "0")}`, `${base} ${marca} ${modelo}`,
      `${base} marca ${marca}, modelo ${modelo}. Garantía de 12 meses.`, p, costo, stock, cat,
      rnd.elegir(provPorCat[cat]), activo, soloFecha(fechaAleatoria(utc(2023, 1, 1), utc(2024, 6, 30)))]);
  }
  t.Productos = { columnas: ["producto_id", "sku", "nombre", "descripcion", "precio", "costo", "stock", "categoria_id", "proveedor_id", "activo", "fecha_creacion"], filas: productos };
  const popularidad = activos.map(() => Math.min(rnd.pareto(1.3), 25)); // tope: evita un producto con ventas irreales

  // Clientes y direcciones
  const clientes: Valor[][] = [], direcciones: Valor[][] = [];
  const dirsDe = new Map<number, number[]>(), ciudadDir = new Map<number, string>(), registro = new Map<number, Date>();
  let dirId = 1;
  for (let i = 1; i <= N_CLIENTES; i++) {
    const n = rnd.elegir(NOMBRES), a1 = rnd.elegir(APELLIDOS), a2 = rnd.elegir(APELLIDOS);
    const reg = soloFecha(fechaAleatoria(utc(2022, 1, 1), utc(2025, 9, 30)));
    const nac = rnd.random() > 0.1 ? soloFecha(fechaAleatoria(utc(1960, 1, 1), utc(2005, 12, 31))) : null;
    registro.set(i, reg);
    clientes.push([i, n, `${a1} ${a2}`, sinTildes(`${n}.${a1}`).toLowerCase() + `${i}@correo.com`,
      `3${rnd.entero(100000000, 299999999)}`, nac, reg, "Regular"]);
    const ciudadCliente = rnd.elegirPeso(CIUDADES, PESOS_CIUDAD);
    dirsDe.set(i, []);
    const nDirs = rnd.elegirPeso([1, 2, 3], [55, 35, 10]);
    for (let k = 0; k < nDirs; k++) {
      const c = k === 0 || rnd.random() < 0.7 ? ciudadCliente : rnd.elegirPeso(CIUDADES, PESOS_CIUDAD);
      direcciones.push([dirId, i, ["Casa", "Oficina", "Otra"][k],
        `${rnd.elegir(CALLES)} ${rnd.entero(1, 180)} # ${rnd.entero(1, 120)}-${rnd.entero(1, 99)}`,
        c[0], c[1], `${c[2]}${rnd.entero(100, 999)}`, k === 0]);
      dirsDe.get(i)!.push(dirId);
      ciudadDir.set(dirId, c[0]);
      dirId++;
    }
  }

  // Pedidos, detalle, pagos y envíos
  const cliIds = [...registro.keys()];
  const actividad = cliIds.map(() => Math.min(rnd.pareto(1.5), 12)); 
  const pedidos: Valor[][] = [], detalle: Valor[][] = [], pagos: Valor[][] = [], envios: Valor[][] = [];
  const entregados: [number, number, Date][] = [];
  let detId = 1, envioId = 1;
  for (let pid = 1; pid <= N_PEDIDOS; pid++) {
    const cid = rnd.elegirPeso(cliIds, actividad);
    const inicio = new Date(Math.max(INICIO.getTime(), registro.get(cid)!.getTime()));
    const fecha = fechaAleatoria(inicio, FIN);
    const dias = Math.floor((FIN.getTime() - fecha.getTime()) / DIA);
    const estado = dias > 20 ? rnd.elegirPeso(["Entregado", "Cancelado"], [93, 7])
      : dias > 5 ? rnd.elegirPeso(["Entregado", "Enviado", "Cancelado"], [60, 33, 7])
      : rnd.elegirPeso(["Pendiente", "Pagado", "Enviado", "Cancelado"], [30, 35, 28, 7]);
    const direccion = rnd.elegir(dirsDe.get(cid)!);

    const nItems = rnd.elegirPeso([1, 2, 3, 4, 5], [30, 30, 20, 12, 8]);
    const prods = new Set<number>();
    while (prods.size < nItems) prods.add(rnd.elegirPeso(activos, popularidad));
    let sub = 0, desc = 0;
    const lineas: number[] = [];
    for (const prod of [...prods].sort((a, b) => a - b)) {
      const cant = rnd.elegirPeso([1, 2, 3, 4], [70, 20, 7, 3]);
      const pu = precio.get(prod)!;
      const d = r2(pu * cant * rnd.elegir([0, 0, 0, 0.05, 0.1, 0.15]));
      detalle.push([detId++, pid, prod, cant, pu, d, r2(pu * cant - d)]);
      lineas.push(prod);
      sub += pu * cant; desc += d;
    }
    sub = r2(sub); desc = r2(desc);
    const total = r2(sub - desc);
    pedidos.push([pid, cid, direccion, fecha, estado, sub, desc, total]);

    const metodo = rnd.elegirPeso(METODOS, PESOS_METODO);
    let estPago: string, fPago: Date | null;
    if (estado === "Pendiente") { estPago = "Pendiente"; fPago = null; }
    else if (estado === "Cancelado") { estPago = rnd.elegir(["Rechazado", "Reembolsado"]); fPago = sumar(fecha, rnd.entero(1, 120) * MINUTO); }
    else { estPago = "Aprobado"; fPago = metodo !== "Contraentrega" ? sumar(fecha, rnd.entero(1, 120) * MINUTO) : null; }
    pagos.push([pid, pid, metodo, estPago, total, fPago, `PAY${String(pid).padStart(7, "0")}${rnd.entero(100, 999)}`]);

    if (estado === "Enviado" || estado === "Entregado") {
      let [tr, diasEnv, pRetraso, costo] = rnd.elegir(TRANSPORTADORAS);
      if (!["Bogotá", "Medellín", "Cali"].includes(ciudadDir.get(direccion)!)) { diasEnv += 1; costo *= 1.35; }
      const fEnvio = sumar(fecha, rnd.entero(6, 48) * HORA);
      const fEstimada = soloFecha(sumar(fEnvio, diasEnv * DIA));
      let fEntrega: Date | null = null;
      if (estado === "Entregado") {
        const extra = rnd.random() < pRetraso ? rnd.entero(1, 5) : -rnd.entero(0, 1);
        fEntrega = sumar(fEstimada, extra * DIA + rnd.entero(8, 18) * HORA);
        if (fEntrega.getTime() < fEnvio.getTime() + 12 * HORA) fEntrega = sumar(fEnvio, 12 * HORA);
        for (const prod of lineas) entregados.push([cid, prod, fEntrega]);
      }
      envios.push([envioId++, pid, tr, `${sinTildes(tr).slice(0, 3).toUpperCase()}${rnd.entero(1e9, 1e10 - 1)}`,
        fEnvio, fEstimada, fEntrega, fEntrega ? "Entregado" : "En transito", r2(costo)]);
    }
  }

  
  const compras = new Map<number, number>();
  for (const p of pedidos) if (p[4] === "Entregado") compras.set(p[1] as number, (compras.get(p[1] as number) ?? 0) + 1);
  for (const c of clientes) {
    const n = compras.get(c[0] as number) ?? 0;
    c[7] = n >= 8 ? "Premium" : n >= 4 ? "Frecuente" : "Regular";
  }

  
  const calidad = new Map<number, number>();
  for (const id of precio.keys()) calidad.set(id, rnd.uniforme(2.6, 4.9));
  const resenas: Valor[][] = [];
  const vistos = new Set<string>();
  for (const [cid, prod, fEnt] of entregados) {
    const clave = `${cid}-${prod}`;
    if (vistos.has(clave) || rnd.random() > PROB_RESENA) continue;
    vistos.add(clave);
    const cal = Math.min(5, Math.max(1, Math.round(rnd.gauss(calidad.get(prod)!, 0.9))));
    const f = new Date(Math.min(sumar(fEnt, rnd.entero(1, 30) * DIA + rnd.entero(0, 12) * HORA).getTime(), FIN.getTime()));
    resenas.push([resenas.length + 1, prod, cid, cal, rnd.elegir(COMENTARIOS[cal]), f]);
  }

  t.Clientes = { columnas: ["cliente_id", "nombres", "apellidos", "email", "telefono", "fecha_nacimiento", "fecha_registro", "segmento"], filas: clientes };
  t.Direcciones = { columnas: ["direccion_id", "cliente_id", "tipo", "direccion", "ciudad", "departamento", "codigo_postal", "es_principal"], filas: direcciones };
  t.Pedidos = { columnas: ["pedido_id", "cliente_id", "direccion_id", "fecha_pedido", "estado", "subtotal", "descuento", "total"], filas: pedidos };
  t.DetallePedido = { columnas: ["detalle_id", "pedido_id", "producto_id", "cantidad", "precio_unitario", "descuento", "subtotal"], filas: detalle };
  t.Pagos = { columnas: ["pago_id", "pedido_id", "metodo", "estado", "monto", "fecha_pago", "referencia"], filas: pagos };
  t.Envios = { columnas: ["envio_id", "pedido_id", "transportadora", "numero_guia", "fecha_envio", "fecha_estimada", "fecha_entrega", "estado", "costo_envio"], filas: envios };
  t.Resenas = { columnas: ["resena_id", "producto_id", "cliente_id", "calificacion", "comentario", "fecha"], filas: resenas };
  return t;
}

//  escritura del script SQL
const ORDEN = ["Categorias", "Proveedores", "Productos", "Clientes", "Direcciones", "Pedidos", "DetallePedido", "Pagos", "Envios", "Resenas"];

function sqlValor(v: Valor): string {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? `'${iso.slice(0, 10)}'` : `'${iso.slice(0, 19)}'`;
  }
  return `N'${v.replace(/'/g, "''")}'`;
}

export function escribirSql(tablas: Record<string, Tabla>, ruta: string): number {
  let total = 0;
  const out: string[] = ["/* Script 02: carga de datos de TecnoHogarDB (generado por src/datos/generarDatos.ts) */",
    "USE TecnoHogarDB;", "GO", "SET NOCOUNT ON;", "GO", ""];
  for (const nombre of ORDEN) {
    const { columnas, filas } = tablas[nombre];
    total += filas.length;
    out.push(`/* ---- ${nombre}: ${filas.length} registros ---- */`);
    for (let i = 0; i < filas.length; i += LOTE) {
      out.push(`INSERT INTO ${nombre} (${columnas.join(", ")}) VALUES`);
      out.push(filas.slice(i, i + LOTE).map((f) => `(${f.map(sqlValor).join(", ")})`).join(",\n") + ";");
      out.push("GO");
    }
    out.push("");
  }
  out.push(`/* TOTAL DE REGISTROS CARGADOS: ${total} */`, "");
  fs.writeFileSync(ruta, out.join("\n"), "utf8");
  return total;
}

export function generarScript(rutaSql: string): { tabla: string; registros: number }[] {
  const tablas = generar();
  escribirSql(tablas, path.join(rutaSql, "02_cargar_datos.sql"));
  return ORDEN.map((n) => ({ tabla: n, registros: tablas[n].filas.length }));
}
