/* Interfaz web de TecnoHogar. Se compila a public/app.js con: npm run build:client */

// ============================================================ tipos de la API
interface Estado {
  destino: { sql: string; mongo: string };
  sql: { ok: boolean; version?: string; error?: string; tablas?: Record<string, number> };
  mongo: { ok: boolean; error?: string; colecciones?: Record<string, number> };
  trabajoEnCurso: string | null;
}
interface ConsultaApi {
  id: number; titulo: string; pregunta: string; decision: string;
  coleccion: string; tecnicas: string[]; texto: string;
}
interface Prueba { seccion: string; prueba: string; sql: string | number; mongo: string | number; ok: boolean }
interface ResultadoApi { filas: Record<string, unknown>[]; total: number; ms: number; truncado: boolean; error?: string }
type Evento = { tipo: "log"; mensaje: string } | { tipo: "fin"; datos: unknown } | { tipo: "error"; mensaje: string };

const COLECCIONES = ["clientes", "pedidos", "productos", "resenas", "categorias", "proveedores"];

// ============================================================ utilidades
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(document.querySelectorAll(sel)) as T[];
const fmtNum = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...hijos: (Node | string)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...hijos);
  return e;
}

function toast(msg: string) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("visible");
  window.setTimeout(() => t.classList.remove("visible"), 3500);
}

async function api<T>(url: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opciones });
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error ?? `Error ${r.status}`);
  return datos as T;
}

/** Fecha EJSON ({ $date: "..." }) -> texto legible. */
function esFecha(v: unknown): v is { $date: string } {
  return !!v && typeof v === "object" && "$date" in (v as object);
}
function fmtFecha(v: { $date: string }) {
  const iso = typeof v.$date === "string" ? v.$date : new Date(Number((v.$date as { $numberLong: string }).$numberLong)).toISOString();
  return iso.endsWith("T00:00:00Z") || iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
}

/** JSON con colores para documentos. */
function jsonColor(v: unknown, sangria = ""): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (esFecha(v)) return `<span class="d">ISODate("${esc(fmtFecha(v))}")</span>`;
  if (v === null) return '<span class="n">null</span>';
  if (typeof v === "number" || typeof v === "boolean") return `<span class="n">${v}</span>`;
  if (typeof v === "string") return `<span class="s">"${esc(v)}"</span>`;
  const s2 = sangria + "  ";
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return "[\n" + v.map((x) => s2 + jsonColor(x, s2)).join(",\n") + `\n${sangria}]`;
  }
  const e = Object.entries(v as Record<string, unknown>);
  if (!e.length) return "{}";
  return "{\n" + e.map(([k, x]) => `${s2}<span class="k">${esc(k)}</span>: ${jsonColor(x, s2)}`).join(",\n") + `\n${sangria}}`;
}

function compacto(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (esFecha(x) ? fmtFecha(x) : x));
}

// ============================================================ pestañas
$$<HTMLButtonElement>(".pestanas button").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".pestanas button").forEach((x) => x.classList.toggle("activa", x === b));
    $$(".vista").forEach((v) => v.classList.toggle("activa", v.id === `vista-${b.dataset.vista}`));
    if (b.dataset.vista === "explorar") cargarColeccion(coleccionActual, 0);
  }));

// ============================================================ estado de conexiones
function conteos(cont: HTMLElement, datos: Record<string, number>) {
  cont.replaceChildren();
  let total = 0;
  for (const [k, v] of Object.entries(datos)) {
    total += v;
    cont.append(el("div", { class: "conteo" }, el("b", {}, fmtNum(v)), el("span", {}, k)));
  }
  cont.append(el("div", { class: "conteo total" }, el("b", {}, fmtNum(total)), el("span", {}, "total")));
}

async function refrescarEstado() {
  try {
    const e = await api<Estado>("/api/estado");
    $("#destino-sql").textContent = e.destino.sql;
    $("#destino-mongo").textContent = e.destino.mongo;
    $("#pill-sql").className = `pildora ${e.sql.ok ? "ok" : "mal"}`;
    $("#pill-mongo").className = `pildora ${e.mongo.ok ? "ok" : "mal"}`;
    $("#version-sql").textContent = e.sql.ok ? e.sql.version ?? "" : "Sin conexión";
    const tablas = $("#tablas-sql");
    if (e.sql.tablas) conteos(tablas, e.sql.tablas);
    else tablas.replaceChildren(el("div", { class: "error-caja" }, e.sql.error ?? "La base TecnoHogarDB no existe todavía. Use «Instalar base SQL»."));
    $("#estado-mongo").textContent = e.mongo.ok ? "Conectado" : "Sin conexión";
    const cols = $("#colecciones-mongo");
    if (e.mongo.colecciones) conteos(cols, e.mongo.colecciones);
    else cols.replaceChildren(el("div", { class: "error-caja" }, e.mongo.error ?? ""));
    if (e.mongo.colecciones) conteosColecciones = e.mongo.colecciones;
    pintarChipsColecciones();
  } catch (err) {
    toast(`No se pudo consultar el estado: ${(err as Error).message}`);
  }
}
$("#btn-refrescar").addEventListener("click", refrescarEstado);

// ============================================================ procesos con avance en vivo
const consola = $("#consola");
function escribir(linea: string, clase = "") {
  const span = el("span", clase ? { class: clase } : {}, linea + "\n");
  consola.append(span);
  consola.scrollTop = consola.scrollHeight;
}

async function ejecutarProceso(url: string, boton: HTMLButtonElement): Promise<unknown> {
  const botones = ["#btn-instalar", "#btn-migrar", "#btn-verificar"].map((s) => $<HTMLButtonElement>(s));
  botones.forEach((b) => (b.disabled = true));
  const textoOriginal = boton.textContent;
  boton.textContent = "Ejecutando…";
  consola.replaceChildren();
  let resultado: unknown = null;
  try {
    const r = await fetch(url, { method: "POST" });
    if (!r.ok || !r.body) throw new Error((await r.json()).error ?? `Error ${r.status}`);
    const lector = r.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const lineas = buffer.split("\n");
      buffer = lineas.pop() ?? "";
      for (const l of lineas.filter(Boolean)) {
        const ev = JSON.parse(l) as Evento;
        if (ev.tipo === "log") escribir(ev.mensaje, ev.mensaje.includes(" ERR ") ? "err" : ev.mensaje.includes(" OK ") ? "ok" : "");
        else if (ev.tipo === "error") { escribir(`ERROR: ${ev.mensaje}`, "err"); toast("El proceso terminó con error"); }
        else { resultado = ev.datos; toast("Proceso terminado"); }
      }
    }
  } catch (err) {
    escribir(`ERROR: ${(err as Error).message}`, "err");
  } finally {
    botones.forEach((b) => (b.disabled = false));
    boton.textContent = textoOriginal;
    refrescarEstado();
  }
  return resultado;
}

$("#btn-instalar").addEventListener("click", (e) => {
  if (!confirm("Esto BORRA y vuelve a crear la base TecnoHogarDB en SQL Server con los datos de prueba. ¿Continuar?")) return;
  ejecutarProceso("/api/sql/instalar", e.currentTarget as HTMLButtonElement);
});
$("#btn-migrar").addEventListener("click", (e) => ejecutarProceso("/api/migrar", e.currentTarget as HTMLButtonElement));
$("#btn-verificar").addEventListener("click", async (e) => {
  const r = (await ejecutarProceso("/api/verificar", e.currentTarget as HTMLButtonElement)) as { pruebas: Prueba[] } | null;
  if (r) pintarVerificacion(r.pruebas);
});

function pintarVerificacion(pruebas: Prueba[]) {
  $("#tarjeta-verificacion").classList.remove("oculto");
  const ok = pruebas.filter((p) => p.ok).length;
  const ins = $("#resumen-verificacion");
  ins.textContent = `${ok}/${pruebas.length} pruebas superadas`;
  ins.className = `insignia ${ok === pruebas.length ? "ok" : "mal"}`;
  const tabla = $("#tabla-verificacion");
  tabla.replaceChildren(el("thead", {}, el("tr", {}, el("th", {}, "Prueba"), el("th", {}, "SQL Server"), el("th", {}, "MongoDB"), el("th", {}, ""))));
  const cuerpo = el("tbody");
  let seccion = "";
  for (const p of pruebas) {
    if (p.seccion !== seccion) {
      seccion = p.seccion;
      // En la sección 0 ambos valores salen de SQL Server: se compara lo esperado con lo encontrado
      cuerpo.append(seccion.startsWith("0.")
        ? el("tr", { class: "seccion" }, el("td", {}, seccion), el("td", {}, "Esperado"), el("td", {}, "Encontrado en SQL Server"), el("td", {}))
        : el("tr", { class: "seccion" }, el("td", { colspan: "4" }, seccion)));
    }
    const valor = (v: string | number) => (typeof v === "number" ? el("td", { class: "num" }, fmtNum(v)) : el("td", {}, el("span", { class: "anidado" }, v)));
    cuerpo.append(el("tr", {}, el("td", {}, p.prueba), valor(p.sql), valor(p.mongo),
      el("td", {}, el("span", { class: p.ok ? "marca-ok" : "marca-mal" }, p.ok ? "✓" : "✗"))));
  }
  tabla.append(cuerpo);
}

// ============================================================ consultas
let consultas: ConsultaApi[] = [];
let actual: ConsultaApi | null = null;
let ultimoResultado: ResultadoApi | null = null;
let modo: "tabla" | "json" = "tabla";
const editor = $<HTMLTextAreaElement>("#c-editor");
const selColeccion = $<HTMLSelectElement>("#c-coleccion");
selColeccion.append(...COLECCIONES.map((c) => el("option", { value: c }, c)));

async function cargarConsultas() {
  consultas = await api<ConsultaApi[]>("/api/consultas");
  const lista = $("#lista-consultas");
  lista.replaceChildren(...consultas.map((c) => {
    const b = el("button", { class: "item-consulta", "data-id": String(c.id) },
      el("b", {}, `${c.id}. ${c.titulo}`), el("span", {}, `db.${c.coleccion}`));
    b.addEventListener("click", () => seleccionar(c));
    return b;
  }));
  if (consultas.length) seleccionar(consultas[0]);
}

function seleccionar(c: ConsultaApi) {
  actual = c;
  $$(".item-consulta").forEach((b) => b.classList.toggle("activa", b.dataset.id === String(c.id)));
  $("#c-titulo").textContent = `Consulta ${c.id}. ${c.titulo}`;
  $("#c-pregunta").textContent = c.pregunta;
  $("#c-decision").textContent = `Decisión que apoya: ${c.decision}`;
  $("#c-tecnicas").replaceChildren(...c.tecnicas.map((t) => el("span", { class: "chip" }, t)));
  selColeccion.value = c.coleccion;
  editor.value = c.texto;
  $("#c-meta").textContent = "";
  $("#c-resultado").replaceChildren(el("p", { class: "sutil" }, "Ejecute la consulta para ver los resultados."));
}

async function ejecutarConsulta() {
  const boton = $<HTMLButtonElement>("#btn-ejecutar");
  boton.disabled = true;
  $("#c-meta").textContent = "Ejecutando…";
  try {
    ultimoResultado = await api<ResultadoApi>("/api/consultas/ejecutar", {
      method: "POST", body: JSON.stringify({ coleccion: selColeccion.value, texto: editor.value }),
    });
    $("#c-meta").textContent = `${ultimoResultado.total} documento(s) · ${ultimoResultado.ms} ms${ultimoResultado.truncado ? " · se muestran 500" : ""}`;
    pintarResultado();
  } catch (err) {
    ultimoResultado = null;
    $("#c-meta").textContent = "";
    $("#c-resultado").replaceChildren(el("div", { class: "error-caja" }, (err as Error).message));
  } finally {
    boton.disabled = false;
  }
}

function pintarResultado() {
  const cont = $("#c-resultado");
  if (!ultimoResultado) return;
  const filas = ultimoResultado.filas;
  if (!filas.length) { cont.replaceChildren(el("p", { class: "sutil" }, "La consulta no devolvió documentos.")); return; }
  if (modo === "json") {
    const pre = el("pre", { class: "json" });
    pre.innerHTML = jsonColor(filas);
    cont.replaceChildren(pre);
    return;
  }
  const cols: string[] = [];
  for (const f of filas) for (const k of Object.keys(f)) if (!cols.includes(k)) cols.push(k);
  const thead = el("thead", {}, el("tr", {}, ...cols.map((c) => el("th", {}, c))));
  const tbody = el("tbody", {}, ...filas.map((f) => el("tr", {}, ...cols.map((c) => {
    const v = f[c];
    if (typeof v === "number") return el("td", { class: "num" }, fmtNum(v));
    if (esFecha(v)) return el("td", {}, fmtFecha(v));
    if (Array.isArray(v) && v.every((x) => x && typeof x === "object" && !esFecha(x))) {
      // arreglo de subdocumentos: una línea por elemento con sus valores
      return el("td", {}, ...v.map((x) => el("div", { class: "anidado" },
        Object.values(x as Record<string, unknown>).map((y) => (typeof y === "number" ? fmtNum(y) : esFecha(y) ? fmtFecha(y) : typeof y === "object" ? compacto(y) : String(y))).join(" · "))));
    }
    if (Array.isArray(v)) return el("td", {}, v.map((y) => (esFecha(y) ? fmtFecha(y) : String(y))).join(", "));
    if (v && typeof v === "object") return el("td", {}, el("span", { class: "anidado" }, compacto(v)));
    return el("td", {}, v === undefined ? "" : String(v));
  }))));
  cont.replaceChildren(el("table", {}, thead, tbody));
}

$("#btn-ejecutar").addEventListener("click", ejecutarConsulta);
$("#btn-restaurar").addEventListener("click", () => actual && seleccionar(actual));
editor.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ejecutarConsulta(); }
  if (e.key === "Tab") {
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b } = editor;
    editor.setRangeText("  ", a, b, "end");
  }
});
$$<HTMLButtonElement>(".segmentado button").forEach((b) => b.addEventListener("click", () => {
  modo = b.dataset.modo as "tabla" | "json";
  $$(".segmentado button").forEach((x) => x.classList.toggle("activa", x === b));
  pintarResultado();
}));
$("#btn-evidencias").addEventListener("click", async (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  b.disabled = true;
  try {
    const r = await api<{ archivo: string }>("/api/consultas/evidencias", { method: "POST" });
    toast(`Guardado en evidencias/${r.archivo}`);
  } catch (err) {
    toast((err as Error).message);
  } finally {
    b.disabled = false;
  }
});

// ============================================================ explorador
let coleccionActual = "pedidos";
let salto = 0;
let totalColeccion = 0;
let conteosColecciones: Record<string, number> = {};
const POR_PAGINA = 3;

function pintarChipsColecciones() {
  $("#ex-colecciones").replaceChildren(...COLECCIONES.map((c) => {
    const n = conteosColecciones[c];
    const chip = el("button", { class: `chip${c === coleccionActual ? " activa" : ""}` }, n === undefined ? c : `${c} · ${fmtNum(n)}`);
    chip.addEventListener("click", () => { coleccionActual = c; pintarChipsColecciones(); cargarColeccion(c, 0); });
    return chip;
  }));
}

async function cargarColeccion(nombre: string, desde: number) {
  try {
    const r = await api<{ total: number; documentos: unknown[]; indices: { name: string; key: Record<string, number>; unique?: boolean }[] }>(
      `/api/colecciones/${nombre}?salto=${desde}&limite=${POR_PAGINA}`);
    salto = desde;
    totalColeccion = r.total;
    $("#ex-titulo").textContent = `db.${nombre}`;
    $("#ex-pagina").textContent = r.total ? `${desde + 1}–${Math.min(desde + POR_PAGINA, r.total)} de ${fmtNum(r.total)}` : "vacía";
    const docs = $("#ex-documentos");
    docs.replaceChildren(...r.documentos.map((d) => {
      const pre = el("pre", { class: "json doc" });
      pre.innerHTML = jsonColor(d);
      return pre;
    }));
    if (!r.documentos.length) docs.replaceChildren(el("p", { class: "sutil" }, "La colección está vacía. Ejecute la migración."));
    $("#ex-indices").replaceChildren(...r.indices.map((i) =>
      el("div", { class: "indice" }, el("b", {}, i.name), el("div", { class: "sutil" }, `${JSON.stringify(i.key)}${i.unique ? " · único" : ""}`))));
  } catch (err) {
    $("#ex-documentos").replaceChildren(el("div", { class: "error-caja" }, (err as Error).message));
  }
}
$("#ex-anterior").addEventListener("click", () => salto > 0 && cargarColeccion(coleccionActual, Math.max(0, salto - POR_PAGINA)));
$("#ex-siguiente").addEventListener("click", () => salto + POR_PAGINA < totalColeccion && cargarColeccion(coleccionActual, salto + POR_PAGINA));

// ============================================================ inicio
refrescarEstado();
cargarConsultas().catch((e) => toast((e as Error).message));
