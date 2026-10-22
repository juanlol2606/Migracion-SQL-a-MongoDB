/**
 * Tipos del proyecto.
 *  - Fila*      : cómo llega cada fila desde SQL Server (modelo relacional, 10 tablas).
 *  - *Doc       : cómo queda cada documento en MongoDB (modelo documental, 6 colecciones).
 * Tener ambos modelos tipados permite que el compilador verifique la transformación.
 */

// =====================================================================  SQL SERVER
export interface FilaCategoria { categoria_id: number; nombre: string; descripcion: string | null }
export interface FilaProveedor {
  proveedor_id: number; nombre: string; nit: string; email: string;
  telefono: string | null; ciudad: string; pais: string;
}
export interface FilaProducto {
  producto_id: number; sku: string; nombre: string; descripcion: string | null;
  precio: number; costo: number; stock: number; categoria_id: number; proveedor_id: number;
  activo: boolean; fecha_creacion: Date;
}
export interface FilaCliente {
  cliente_id: number; nombres: string; apellidos: string; email: string; telefono: string | null;
  fecha_nacimiento: Date | null; fecha_registro: Date; segmento: "Regular" | "Frecuente" | "Premium";
}
export interface FilaDireccion {
  direccion_id: number; cliente_id: number; tipo: "Casa" | "Oficina" | "Otra"; direccion: string;
  ciudad: string; departamento: string; codigo_postal: string | null; es_principal: boolean;
}
export type EstadoPedido = "Pendiente" | "Pagado" | "Enviado" | "Entregado" | "Cancelado";
export interface FilaPedido {
  pedido_id: number; cliente_id: number; direccion_id: number; fecha_pedido: Date;
  estado: EstadoPedido; subtotal: number; descuento: number; total: number;
}
export interface FilaDetalle {
  detalle_id: number; pedido_id: number; producto_id: number; cantidad: number;
  precio_unitario: number; descuento: number; subtotal: number;
}
export interface FilaPago {
  pago_id: number; pedido_id: number; metodo: string;
  estado: "Aprobado" | "Pendiente" | "Rechazado" | "Reembolsado";
  monto: number; fecha_pago: Date | null; referencia: string;
}
export interface FilaEnvio {
  envio_id: number; pedido_id: number; transportadora: string; numero_guia: string;
  fecha_envio: Date; fecha_estimada: Date; fecha_entrega: Date | null;
  estado: "En transito" | "Entregado"; costo_envio: number;
}
export interface FilaResena {
  resena_id: number; producto_id: number; cliente_id: number; calificacion: number;
  comentario: string | null; fecha: Date;
}

/** Resultado del EXTRACT: las 10 tablas en memoria. */
export interface DatosRelacionales {
  Categorias: FilaCategoria[]; Proveedores: FilaProveedor[]; Productos: FilaProducto[];
  Clientes: FilaCliente[]; Direcciones: FilaDireccion[]; Pedidos: FilaPedido[];
  DetallePedido: FilaDetalle[]; Pagos: FilaPago[]; Envios: FilaEnvio[]; Resenas: FilaResena[];
}
export const TABLAS: (keyof DatosRelacionales)[] = [
  "Categorias", "Proveedores", "Productos", "Clientes", "Direcciones",
  "Pedidos", "DetallePedido", "Pagos", "Envios", "Resenas",
];

// =====================================================================  MONGODB
export interface CategoriaDoc { _id: number; nombre: string; descripcion?: string }

export interface ProveedorDoc {
  _id: number; nombre: string; nit: string;
  contacto: { email: string; telefono?: string };          // subdocumento
  ubicacion: { ciudad: string; pais: string };              // subdocumento
}

export interface ProductoDoc {
  _id: number; sku: string; nombre: string; descripcion?: string;
  precio: number; costo: number; stock: number; activo: boolean; fecha_creacion: Date;
  categoria_id: number;                                     // REFERENCING -> categorias
  proveedor_id: number;                                     // REFERENCING -> proveedores
  calificacion: { promedio: number | null; total_resenas: number };  // patrón computado
}

export interface DireccionEmb {
  direccion_id: number; tipo: string; direccion: string; ciudad: string;
  departamento: string; codigo_postal?: string; es_principal: boolean;
}
export interface ClienteDoc {
  _id: number; nombres: string; apellidos: string; email: string; telefono?: string;
  fecha_nacimiento?: Date; fecha_registro: Date; segmento: string;
  direcciones: DireccionEmb[];                              // EMBEDDING (Direcciones)
}

export interface ItemEmb {
  detalle_id: number;
  producto_id: number;                                      // REFERENCING -> productos
  sku: string; nombre: string;                              // snapshot al momento de la compra
  cantidad: number; precio_unitario: number; descuento: number; subtotal: number;
}
export interface PagoEmb {
  pago_id: number; metodo: string; estado: string; monto: number; fecha_pago?: Date; referencia: string;
}
export interface EnvioEmb {
  envio_id: number; transportadora: string; numero_guia: string; estado: string;
  fecha_envio: Date; fecha_estimada: Date; fecha_entrega?: Date; costo_envio: number;
}
export interface PedidoDoc {
  _id: number;
  cliente_id: number;                                       // REFERENCING -> clientes
  fecha_pedido: Date; estado: EstadoPedido;
  direccion_envio: Omit<DireccionEmb, "tipo" | "es_principal">;   // snapshot
  items: ItemEmb[];                                         // EMBEDDING (DetallePedido)
  resumen: { num_items: number; unidades: number; subtotal: number; descuento: number; total: number };
  pago?: PagoEmb;                                           // EMBEDDING (Pagos)
  envio?: EnvioEmb;                                         // EMBEDDING (Envios)
}

export interface ResenaDoc {
  _id: number;
  producto_id: number;                                      // REFERENCING -> productos
  cliente_id: number;                                       // REFERENCING -> clientes
  calificacion: number; comentario?: string; fecha: Date;
}

export interface ColeccionesMongo {
  categorias: CategoriaDoc[]; proveedores: ProveedorDoc[]; productos: ProductoDoc[];
  clientes: ClienteDoc[]; pedidos: PedidoDoc[]; resenas: ResenaDoc[];
}

/** Función que reciben los procesos largos para informar su avance (consola o interfaz web). */
export type Log = (mensaje: string) => void;
