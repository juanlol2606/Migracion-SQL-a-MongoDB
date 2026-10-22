IF DB_ID('TecnoHogarDB') IS NOT NULL
BEGIN
    ALTER DATABASE TecnoHogarDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE TecnoHogarDB;
END
GO

CREATE DATABASE TecnoHogarDB;
GO

USE TecnoHogarDB;
GO


CREATE TABLE Categorias (
    categoria_id   INT            NOT NULL PRIMARY KEY,
    nombre         NVARCHAR(80)   NOT NULL UNIQUE,
    descripcion    NVARCHAR(250)  NULL
);


CREATE TABLE Proveedores (
    proveedor_id   INT            NOT NULL PRIMARY KEY,
    nombre         NVARCHAR(120)  NOT NULL,
    nit            VARCHAR(20)    NOT NULL UNIQUE,
    email          VARCHAR(120)   NOT NULL,
    telefono       VARCHAR(20)    NULL,
    ciudad         NVARCHAR(60)   NOT NULL,
    pais           NVARCHAR(60)   NOT NULL
);


CREATE TABLE Productos (
    producto_id    INT            NOT NULL PRIMARY KEY,
    sku            VARCHAR(20)    NOT NULL UNIQUE,
    nombre         NVARCHAR(150)  NOT NULL,
    descripcion    NVARCHAR(400)  NULL,
    precio         DECIMAL(12,2)  NOT NULL CHECK (precio > 0),
    costo          DECIMAL(12,2)  NOT NULL CHECK (costo > 0),
    stock          INT            NOT NULL CHECK (stock >= 0),
    categoria_id   INT            NOT NULL REFERENCES Categorias(categoria_id),
    proveedor_id   INT            NOT NULL REFERENCES Proveedores(proveedor_id),
    activo         BIT            NOT NULL DEFAULT 1,
    fecha_creacion DATE           NOT NULL
);


CREATE TABLE Clientes (
    cliente_id       INT           NOT NULL PRIMARY KEY,
    nombres          NVARCHAR(80)  NOT NULL,
    apellidos        NVARCHAR(80)  NOT NULL,
    email            VARCHAR(120)  NOT NULL UNIQUE,
    telefono         VARCHAR(20)   NULL,
    fecha_nacimiento DATE          NULL,
    fecha_registro   DATE          NOT NULL,
    segmento         VARCHAR(20)   NOT NULL CHECK (segmento IN ('Regular','Frecuente','Premium'))
);


CREATE TABLE Direcciones (
    direccion_id   INT            NOT NULL PRIMARY KEY,
    cliente_id     INT            NOT NULL REFERENCES Clientes(cliente_id),
    tipo           VARCHAR(20)    NOT NULL CHECK (tipo IN ('Casa','Oficina','Otra')),
    direccion      NVARCHAR(150)  NOT NULL,
    ciudad         NVARCHAR(60)   NOT NULL,
    departamento   NVARCHAR(60)   NOT NULL,
    codigo_postal  VARCHAR(10)    NULL,
    es_principal   BIT            NOT NULL DEFAULT 0
);


CREATE TABLE Pedidos (
    pedido_id      INT            NOT NULL PRIMARY KEY,
    cliente_id     INT            NOT NULL REFERENCES Clientes(cliente_id),
    direccion_id   INT            NOT NULL REFERENCES Direcciones(direccion_id),
    fecha_pedido   DATETIME2(0)   NOT NULL,
    estado         VARCHAR(20)    NOT NULL CHECK (estado IN ('Pendiente','Pagado','Enviado','Entregado','Cancelado')),
    subtotal       DECIMAL(14,2)  NOT NULL,
    descuento      DECIMAL(14,2)  NOT NULL DEFAULT 0,
    total          DECIMAL(14,2)  NOT NULL
);


CREATE TABLE DetallePedido (
    detalle_id      INT           NOT NULL PRIMARY KEY,
    pedido_id       INT           NOT NULL REFERENCES Pedidos(pedido_id),
    producto_id     INT           NOT NULL REFERENCES Productos(producto_id),
    cantidad        INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,2) NOT NULL,
    descuento       DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal        DECIMAL(14,2) NOT NULL,
    CONSTRAINT UQ_Detalle_Pedido_Producto UNIQUE (pedido_id, producto_id)
);


CREATE TABLE Pagos (
    pago_id        INT            NOT NULL PRIMARY KEY,
    pedido_id      INT            NOT NULL UNIQUE REFERENCES Pedidos(pedido_id),
    metodo         VARCHAR(30)    NOT NULL CHECK (metodo IN ('Tarjeta credito','Tarjeta debito','PSE','Nequi','Contraentrega')),
    estado         VARCHAR(20)    NOT NULL CHECK (estado IN ('Aprobado','Pendiente','Rechazado','Reembolsado')),
    monto          DECIMAL(14,2)  NOT NULL,
    fecha_pago     DATETIME2(0)   NULL,
    referencia     VARCHAR(30)    NOT NULL UNIQUE
);


CREATE TABLE Envios (
    envio_id        INT           NOT NULL PRIMARY KEY,
    pedido_id       INT           NOT NULL UNIQUE REFERENCES Pedidos(pedido_id),
    transportadora  NVARCHAR(40)  NOT NULL,
    numero_guia     VARCHAR(30)   NOT NULL UNIQUE,
    fecha_envio     DATETIME2(0)  NOT NULL,
    fecha_estimada  DATE          NOT NULL,
    fecha_entrega   DATETIME2(0)  NULL,
    estado          VARCHAR(20)   NOT NULL CHECK (estado IN ('En transito','Entregado')),
    costo_envio     DECIMAL(10,2) NOT NULL
);


CREATE TABLE Resenas (
    resena_id      INT            NOT NULL PRIMARY KEY,
    producto_id    INT            NOT NULL REFERENCES Productos(producto_id),
    cliente_id     INT            NOT NULL REFERENCES Clientes(cliente_id),
    calificacion   TINYINT        NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario     NVARCHAR(400)  NULL,
    fecha          DATETIME2(0)   NOT NULL,
    CONSTRAINT UQ_Resena_Cliente_Producto UNIQUE (cliente_id, producto_id)
);
GO


