# Resultados de las consultas

Ejecutado: 22/10/2026, 5:51:41 p. m.

## Consulta 1. Ingresos y margen bruto por categoría 

**Pregunta:** Qué categorías generan más ingresos y cuáles dejan mejor margen?  
**Colección:** `pedidos` · **Operadores:** $match, $unwind, 2 × $lookup, $group, $addToSet, $project, $sort

| unidades | categoria | ingresos | num_pedidos | margen_bruto | margen_pct |
|---|---|---|---|---|---|
| 119 | Computadores | 613.051.715 | 77 | 207.459.015 | 33.8 |
| 167 | Electrodomésticos | 564.626.670 | 108 | 170.548.970 | 30.2 |
| 104 | Televisores | 322.345.295 | 67 | 99.483.695 | 30.9 |
| 99 | Celulares | 262.961.970 | 64 | 76.536.870 | 29.1 |
| 135 | Oficina | 187.283.255 | 84 | 54.752.755 | 29.2 |
| 79 | Deportes | 185.178.990 | 48 | 47.950.290 | 25.9 |
| 86 | Videojuegos | 128.069.190 | 56 | 38.382.390 | 30 |
| 155 | Hogar inteligente | 73.470.535 | 103 | 15.101.835 | 20.6 |
| 57 | Audio | 60.163.890 | 38 | 20.392.490 | 33.9 |
| 169 | Cocina | 39.591.780 | 100 | 13.149.280 | 33.2 |
| 164 | Accesorios | 22.222.115 | 109 | 7.517.915 | 33.8 |
| 74 | Cuidado personal | 19.498.775 | 56 | 5.356.175 | 27.5 |

## Consulta 2. Top 10 clientes por valor de compra

**Pregunta:** ¿Quiénes son los clientes más valiosos y dónde están?  
**Colección:** `pedidos` · **Operadores:** $match, $group, $sort, $limit, $lookup, $unwind, $project, $filter

| num_pedidos | ultima_compra | cliente_id | nombre | email | segmento | ciudad_principal | total_comprado | ticket_promedio |
|---|---|---|---|---|---|---|---|---|
| 10 | 2025-12-01 | 123 | Julián Vargas Quintero | julian.vargas123@correo.com | Premium | Barranquilla | 98.860.525 | 9.886.052 |
| 7 | 2025-07-08 | 179 | Sofía Restrepo Díaz | sofia.restrepo179@correo.com | Frecuente | Bogotá | 90.024.135 | 12.860.591 |
| 8 | 2025-12-06 | 252 | Miguel Vargas Ospina | miguel.vargas252@correo.com | Premium | Bogotá | 84.597.415 | 10.574.677 |
| 10 | 2025-04-29 | 140 | Gabriela Medina Valencia | gabriela.medina140@correo.com | Premium | Bogotá | 77.001.250 | 7.700.125 |
| 9 | 2025-09-18 | 290 | Juan Rodríguez Torres | juan.rodriguez290@correo.com | Premium | Pereira | 68.073.355 | 7.563.706 |
| 13 | 2025-09-07 | 278 | Juan Mejía Suárez | juan.mejia278@correo.com | Premium | Medellín | 67.586.180 | 5.198.937 |
| 5 | 2025-11-16 | 283 | Julián Suárez Valencia | julian.suarez283@correo.com | Frecuente | Cúcuta | 59.909.390 | 11.981.878 |
| 6 | 2025-11-08 | 45 | Diego Ríos Sánchez | diego.rios45@correo.com | Frecuente | Cúcuta | 57.179.495 | 9.529.916 |
| 5 | 2025-12-09 | 247 | Felipe Cárdenas Moreno | felipe.cardenas247@correo.com | Frecuente | Santa Marta | 56.267.640 | 11.253.528 |
| 8 | 2025-12-09 | 255 | Daniela Suárez Mejía | daniela.suarez255@correo.com | Premium | Cali | 54.853.560 | 6.856.695 |

## Consulta 3. Productos en riesgo de quedarse sin inventario

**Pregunta:** ¿Qué productos se agotarán en menos de 30 días al ritmo de venta actual y a qué proveedor hay que pedirles?  
**Colección:** `pedidos` · **Operadores:** $match, $unwind, $group, 3 × $lookup, $project, $sort, $limit

| unidades_90d | dias_cobertura | sku | stock | venta_diaria | proveedor | email_proveedor | pais_proveedor | categoria | producto |
|---|---|---|---|---|---|---|---|---|---|
| 30 | 0 | TH-08-0104 | 0 | 0.33 | Altura Global Distribuciones | ventas7@proveedor7.com | Colombia | Accesorios | Mouse Inalámbrico Cóndor G42 |
| 22 | 0 | TH-02-0146 | 0 | 0.24 | Cóndor Andina S.A. | ventas12@proveedor12.com | Colombia | Computadores | Tablet Vértice N14 |
| 8 | 0 | TH-12-0024 | 0 | 0.09 | Altura Tech Distribuciones | ventas8@proveedor8.com | Colombia | Oficina | Lámpara LED Altura M33 |
| 6 | 0 | TH-04-0052 | 0 | 0.07 | Lumina Global S.A.S. | ventas14@proveedor14.com | Colombia | Audio | Parlante Portátil Cóndor C60 |
| 5 | 0 | TH-05-0053 | 0 | 0.06 | Zentek Andina Distribuciones | ventas3@proveedor3.com | Colombia | Electrodomésticos | Estufa 4 Puestos Andes B13 |
| 5 | 0 | TH-11-0119 | 0 | 0.06 | Altura Global S.A.S. | ventas20@proveedor20.com | Panamá | Deportes | Banda de Actividad Pixel L97 |
| 4 | 0 | TH-08-0128 | 0 | 0.04 | Lumina Tech S.A.S. | ventas5@proveedor5.com | Colombia | Accesorios | Funda Protectora Lumina D92 |
| 4 | 0 | TH-08-0140 | 0 | 0.04 | Lumina Tech S.A.S. | ventas5@proveedor5.com | Colombia | Accesorios | Cargador Rápido Nova T69 |
| 4 | 0 | TH-12-0084 | 0 | 0.04 | Vértice Tech S.A.S. | ventas6@proveedor6.com | Colombia | Oficina | Impresora Multifuncional Pixel M56 |
| 3 | 0 | TH-02-0074 | 0 | 0.03 | Orbis Global S.A. | ventas16@proveedor16.com | Colombia | Computadores | PC Escritorio Orbis X46 |
| 3 | 0 | TH-02-0134 | 0 | 0.03 | Cóndor Andina Importaciones | ventas9@proveedor9.com | Colombia | Computadores | Chromebook Lumina C98 |
| 2 | 0 | TH-09-0105 | 0 | 0.02 | Altura Global Distribuciones | ventas7@proveedor7.com | Colombia | Hogar inteligente | Enchufe Wi-Fi Altura E40 |
| 2 | 0 | TH-07-0139 | 0 | 0.02 | Kumo Tech Distribuciones | ventas18@proveedor18.com | Colombia | Videojuegos | Control Inalámbrico Orbis D53 |
| 2 | 0 | TH-11-0143 | 0 | 0.02 | Zentek Tech S.A. | ventas21@proveedor21.com | Estados Unidos | Deportes | Bicicleta Eléctrica Orbis T46 |
| 2 | 0 | TH-12-0108 | 0 | 0.02 | Vértice Tech S.A.S. | ventas6@proveedor6.com | Colombia | Oficina | Destructora de Papel Orbis D84 |

## Consulta 4. Desempeño de las transportadoras

**Pregunta:** ¿Qué transportadora entrega más rápido, con menos retrasos y a menor costo?  
**Colección:** `pedidos` · **Operadores:** $match, $project, $cond, aritmética de fechas, $group, $sort

| envios | retrasos | transportadora | dias_promedio | pct_retrasos | costo_promedio |
|---|---|---|---|---|---|
| 104 | 7 | Coordinadora | 3.3 | 6.7 | 15.544 |
| 115 | 8 | Servientrega | 3 | 7 | 13.205 |
| 139 | 17 | TCC | 3.4 | 12.2 | 16.150 |
| 125 | 20 | Interrapidísimo | 4.6 | 16 | 12.058 |
| 142 | 25 | Envía | 4.5 | 17.6 | 11.153 |

## Consulta 5. Ventas mensuales y método de pago preferido

**Pregunta:** ¿Cómo evolucionan las ventas mes a mes y con qué medios pagan los clientes?  
**Colección:** `pedidos` · **Operadores:** $match, $group (2 niveles), $push, $sort, $project, $arrayElemAt

| pedidos_mes | metodos | mes | ventas_mes | ticket_promedio | metodo_principal |
|---|---|---|---|---|---|
| 28 | Tarjeta credito, 84.681.565, 9; PSE, 33.236.555, 9; Nequi, 22.749.255, 4; Contraentrega, 13.137.460, 5; Tarjeta debito, 4.347.530, 1 | 1 | 158.152.365 | 5.648.299 | Tarjeta credito |
| 22 | Nequi, 36.642.350, 7; Tarjeta credito, 29.667.350, 5; PSE, 21.503.490, 5; Tarjeta debito, 8.780.775, 2; Contraentrega, 1.475.390, 3 | 2 | 98.069.355 | 4.457.698 | Nequi |
| 28 | Tarjeta credito, 103.572.870, 13; PSE, 39.876.440, 6; Tarjeta debito, 33.389.260, 4; Nequi, 18.211.065, 3; Contraentrega, 4.269.210, 2 | 3 | 199.318.845 | 7.118.530 | Tarjeta credito |
| 35 | Tarjeta credito, 121.187.230, 13; Tarjeta debito, 86.432.235, 7; PSE, 41.019.535, 6; Nequi, 22.905.760, 8; Contraentrega, 6.105.145, 1 | 4 | 277.649.905 | 7.932.854 | Tarjeta credito |
| 31 | Tarjeta credito, 52.858.625, 11; Contraentrega, 35.867.420, 3; Nequi, 32.144.090, 5; PSE, 31.761.740, 10; Tarjeta debito, 2.362.755, 2 | 5 | 154.994.630 | 4.999.827 | Tarjeta credito |
| 27 | PSE, 82.475.745, 12; Tarjeta credito, 33.800.525, 6; Tarjeta debito, 30.523.150, 7; Nequi, 4.325.280, 2 | 6 | 151.124.700 | 5.597.211 | PSE |
| 35 | Tarjeta credito, 70.626.670, 12; PSE, 67.260.020, 9; Nequi, 21.028.000, 5; Tarjeta debito, 20.669.295, 5; Contraentrega, 9.475.620, 4 | 7 | 189.059.605 | 5.401.703 | Tarjeta credito |
| 37 | PSE, 53.576.775, 10; Tarjeta credito, 49.296.540, 9; Tarjeta debito, 47.877.235, 9; Contraentrega, 23.362.180, 5; Nequi, 21.290.180, 4 | 8 | 195.402.910 | 5.281.160 | PSE |
| 49 | Tarjeta credito, 112.357.770, 14; Tarjeta debito, 43.015.855, 7; PSE, 37.144.845, 12; Contraentrega, 37.112.345, 7; Nequi, 32.812.105, 9 | 9 | 262.442.920 | 5.355.978 | Tarjeta credito |
| 39 | Tarjeta credito, 122.435.195, 19; Contraentrega, 50.001.340, 3; Nequi, 41.201.500, 4; PSE, 38.494.680, 8; Tarjeta debito, 26.478.115, 5 | 10 | 278.610.830 | 7.143.867 | Tarjeta credito |
| 48 | Tarjeta credito, 124.904.805, 17; PSE, 61.597.080, 11; Contraentrega, 49.496.135, 9; Tarjeta debito, 39.457.105, 5; Nequi, 23.427.855, 6 | 11 | 298.882.980 | 6.226.729 | Tarjeta credito |
| 41 | PSE, 93.941.085, 13; Tarjeta debito, 46.434.790, 11; Tarjeta credito, 35.958.860, 8; Nequi, 20.878.080, 4; Contraentrega, 17.542.320, 5 | 12 | 214.755.135 | 5.237.930 | PSE |

## Consulta 6. Productos peor calificados 

**Pregunta:** ¿Qué productos generan más insatisfacción, de qué categoría y de qué proveedor vienen?  
**Colección:** `resenas` · **Operadores:** $group, $cond, $match, $sort, $limit, 3 × $lookup, $project

| num_resenas | producto | categoria | proveedor | promedio | pct_negativas |
|---|---|---|---|---|---|
| 19 | Tablet Vértice N14 | Computadores | Cóndor Andina S.A. | 2.58 | 47.4 |
| 20 | Congelador Andes C35 | Electrodomésticos | Orbis Global Ltda. | 2.6 | 40 |
| 11 | Funda Protectora Pixel K66 | Accesorios | Nova Andina S.A.S. | 2.64 | 54.5 |
| 18 | Cepillo Eléctrico Orbis X18 | Cuidado personal | Cóndor Andina Importaciones | 3.11 | 22.2 |
| 15 | Escritorio en L Pixel L54 | Oficina | Altura Tech Distribuciones | 3.73 | 0 |
| 24 | Bombillo Inteligente Cóndor X48 | Hogar inteligente | Orbis Global Ltda. | 3.83 | 4.2 |
| 10 | Monitor 24" Kumo J83 | Televisores | Altura Tech Distribuciones | 3.9 | 10 |
| 12 | Cafetera Orbis C73 | Cocina | Zentek Tech S.A. | 4 | 8.3 |
| 24 | Cafetera Zentek S68 | Cocina | Cóndor Andina Importaciones | 4.33 | 0 |
| 23 | Mouse Inalámbrico Cóndor G42 | Accesorios | Altura Global Distribuciones | 4.7 | 0 |

## Consulta 7. Ventas, cancelaciones y costo logístico por departamento

**Pregunta:** ¿En qué regiones vendemos más, dónde se cancela más y cuánto cuesta enviar allá?  
**Colección:** `pedidos` · **Operadores:** $group, $cond, $addToSet, $avg, $project, $size, $sort

| pedidos | ciudades | departamento | clientes_unicos | ingresos | ticket_promedio | tasa_cancelacion_pct | costo_envio_prom |
|---|---|---|---|---|---|---|---|
| 217 | Bogotá | Cundinamarca | 77 | 1.352.250.790 | 6.694.311 | 6.9 | 11.840 |
| 114 | Medellín | Antioquia | 47 | 628.403.090 | 5.928.331 | 7 | 11.727 |
| 83 | Barranquilla | Atlántico | 33 | 477.404.330 | 6.365.391 | 9.6 | 15.680 |
| 88 | Cali | Valle del Cauca | 35 | 466.884.700 | 5.764.009 | 8 | 12.041 |
| 53 | Cúcuta | Norte de Santander | 14 | 322.723.735 | 6.866.462 | 11.3 | 16.482 |
| 28 | Santa Marta | Magdalena | 10 | 177.601.530 | 6.830.828 | 7.1 | 16.940 |
| 29 | Bucaramanga | Santander | 11 | 136.700.970 | 5.062.999 | 6.9 | 16.500 |
| 28 | Villavicencio | Meta | 9 | 121.886.265 | 5.299.403 | 17.9 | 15.484 |
| 24 | Pereira | Risaralda | 7 | 103.158.130 | 4.912.292 | 12.5 | 16.631 |
| 24 | Cartagena | Bolívar | 12 | 95.132.460 | 4.136.194 | 4.2 | 15.901 |
| 6 | Manizales | Caldas | 3 | 48.494.390 | 8.082.398 | 0 | 15.930 |
| 6 | Ibagué | Tolima | 3 | 30.258.545 | 5.043.091 | 0 | 16.042 |

## Consulta 8. Clientes valiosos en riesgo de abandono

**Pregunta:** ¿Qué clientes compraban seguido pero llevan más de 180 días sin comprar?  
**Colección:** `clientes` · **Operadores:** $lookup con let/pipeline, $expr, $unwind, $match, $project, $sort, $limit

| email | telefono | segmento | cliente_id | nombre | pedidos_historicos | total_historico | ultima_compra | dias_inactivo |
|---|---|---|---|---|---|---|---|---|
| gabriela.medina140@correo.com | 3258055907 | Premium | 140 | Gabriela Medina Valencia | 10 | 77.001.250 | 2025-04-29 | 246 |
| santiago.castro9@correo.com | 3150139507 | Frecuente | 9 | Santiago Castro Quintero | 4 | 52.022.360 | 2025-05-13 | 232 |
| valentina.sanchez273@correo.com | 3230873920 | Regular | 273 | Valentina Sánchez Zapata | 3 | 33.191.725 | 2025-04-02 | 273 |
| juliana.rios165@correo.com | 3225394239 | Regular | 165 | Juliana Ríos Rojas | 3 | 31.719.775 | 2025-05-08 | 238 |
| miguel.medina231@correo.com | 3220299744 | Frecuente | 231 | Miguel Medina Díaz | 4 | 30.552.745 | 2024-11-07 | 419 |
| jorge.gomez203@correo.com | 3163759676 | Regular | 203 | Jorge Gómez Muñoz | 3 | 29.927.550 | 2024-11-30 | 397 |
| nicolas.rojas168@correo.com | 3264114212 | Frecuente | 168 | Nicolás Rojas Ortiz | 4 | 29.277.960 | 2025-04-12 | 263 |
| jorge.sanchez172@correo.com | 3273089259 | Frecuente | 172 | Jorge Sánchez Mejía | 5 | 26.603.160 | 2025-03-03 | 303 |
| santiago.valencia243@correo.com | 3144403293 | Regular | 243 | Santiago Valencia Ospina | 3 | 23.851.730 | 2024-12-05 | 391 |
| manuela.zapata22@correo.com | 3290447987 | Regular | 22 | Manuela Zapata Medina | 3 | 21.149.145 | 2024-07-20 | 529 |
| catalina.cardenas33@correo.com | 3294880357 | Regular | 33 | Catalina Cárdenas Martínez | 3 | 19.369.190 | 2024-10-27 | 431 |
| diego.cardenas128@correo.com | 3203962585 | Regular | 128 | Diego Cárdenas Restrepo | 3 | 18.669.725 | 2025-02-14 | 320 |
| oscar.munoz68@correo.com | 3133621902 | Frecuente | 68 | Óscar Muñoz Rojas | 5 | 16.804.280 | 2025-03-24 | 283 |
| natalia.restrepo212@correo.com | 3241926981 | Frecuente | 212 | Natalia Restrepo Pérez | 4 | 16.133.260 | 2025-04-08 | 268 |
| carolina.suarez117@correo.com | 3294866406 | Regular | 117 | Carolina Suárez Ortiz | 3 | 15.338.790 | 2025-05-10 | 235 |
