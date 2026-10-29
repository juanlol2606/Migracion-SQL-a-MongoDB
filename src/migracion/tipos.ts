// SQL SERVER
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


export interface DatosRelacionales {
  Categorias: FilaCategoria[]; Proveedores: FilaProveedor[]; Productos: FilaProducto[];
  Clientes: FilaCliente[]; Direcciones: FilaDireccion[]; Pedidos: FilaPedido[];
  DetallePedido: FilaDetalle[]; Pagos: FilaPago[]; Envios: FilaEnvio[]; Resenas: FilaResena[];
}
export const TABLAS: (keyof DatosRelacionales)[] = [
  "Categorias", "Proveedores", "Productos", "Clientes", "Direcciones",
  "Pedidos", "DetallePedido", "Pagos", "Envios", "Resenas",
];

//  MONGODB
export interface CategoriaDoc { _id: number; nombre: string; descripcion?: string }

export interface ProveedorDoc {
  _id: number; nombre: string; nit: string;
  contacto: { email: string; telefono?: string };          
  ubicacion: { ciudad: string; pais: string };              
}

export interface ProductoDoc {
  _id: number; sku: string; nombre: string; descripcion?: string;
  precio: number; costo: number; stock: number; activo: boolean; fecha_creacion: Date;
  categoria_id: number;                                     // REFERENCING 
  proveedor_id: number;                                     // REFERENCING 
  calificacion: { promedio: number | null; total_resenas: number };  
}

export interface DireccionEmb {
  direccion_id: number; tipo: string; direccion: string; ciudad: string;
  departamento: string; codigo_postal?: string; es_principal: boolean;
}
export interface ClienteDoc {
  _id: number; nombres: string; apellidos: string; email: string; telefono?: string;
  fecha_nacimiento?: Date; fecha_registro: Date; segmento: string;
  direcciones: DireccionEmb[];                              // EMBEDDING 
}

export interface ItemEmb {
  detalle_id: number;
  producto_id: number;                                      // REFERENCING 
  sku: string; nombre: string;                              
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
  cliente_id: number;                                       // REFERENCING 
  fecha_pedido: Date; estado: EstadoPedido;
  direccion_envio: Omit<DireccionEmb, "tipo" | "es_principal">;   
  items: ItemEmb[];                                         // EMBEDDING 
  resumen: { num_items: number; unidades: number; subtotal: number; descuento: number; total: number };
  pago?: PagoEmb;                                           // EMBEDDING 
  envio?: EnvioEmb;                                         // EMBEDDING 
}

export interface ResenaDoc {
  _id: number;
  producto_id: number;                                      // REFERENCING 
  cliente_id: number;                                       // REFERENCING 
  calificacion: number; comentario?: string; fecha: Date;
}

export interface ColeccionesMongo {
  categorias: CategoriaDoc[]; proveedores: ProveedorDoc[]; productos: ProductoDoc[];
  clientes: ClienteDoc[]; pedidos: PedidoDoc[]; resenas: ResenaDoc[];
}


export type Log = (mensaje: string) => void;
