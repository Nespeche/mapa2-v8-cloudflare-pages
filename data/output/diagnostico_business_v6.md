# Diagnóstico Business V6 — Mapa2

Versión: `v6_business_synthetic_autoparts`
Fase: **V6 — Base ficticia de clientes y ventas de autopartes**
Generado: `2026-07-05T16:44:42+00:00`
Seed: `20260705`

## Aviso de datos sintéticos

Los clientes, productos y ventas generados en V6 son **ficticios**. No representan clientes reales, operaciones reales ni precios reales. Se usan únicamente para pruebas de visualización, filtros y agregaciones comerciales en la futura V7.

## Confirmación de alcance

- No se modificó la lógica censal validada en V5.1.
- No se destruyó ni reemplazó la base maestra.
- No se creó frontend completo.
- No se hizo deploy.
- No se avanzó a V7.

## Resumen cuantitativo

- Clientes generados: **2000**
- Productos generados: **65**
- Registros de ventas: **128998**
- Meses cubiertos: **24** (2025-01 a 2026-12)
- Agregados provincia-mes: **264**
- Agregados departamento-mes: **6432**
- Agregados producto-mes: **1560**
- Agregados cliente: **2000**

## Ventas sintéticas

- Venta neta total 2025: **70,214,766,538.47**
- Venta neta total 2026: **86,383,530,325.29**
- Variación 2026 vs 2025: **23.03%**

## Distribución de clientes por provincia

- Buenos Aires: 1400
- Ciudad Autónoma de Buenos Aires: 160
- Córdoba: 130
- Santa Fe: 120
- Mendoza: 50
- Entre Ríos: 40
- Tucumán: 35
- Neuquén: 20
- Salta: 20
- Río Negro: 15
- San Luis: 10

## Distribución por tipo de cliente

- Casa de repuestos: 613
- Taller mecánico: 526
- Lubricentro: 230
- Distribuidor mayorista: 180
- Concesionario: 166
- Servicio técnico: 104
- Flota comercial: 95
- Rectificadora: 86

## Buenos Aires — AMBA vs interior

- AMBA: 868
- Interior bonaerense: 532

## Top provincias por ventas

- Buenos Aires: 107,045,510,343.13
- Ciudad Autónoma de Buenos Aires: 13,870,353,543.52
- Córdoba: 11,514,733,264.70
- Santa Fe: 10,141,411,985.58
- Mendoza: 4,526,877,262.24
- Tucumán: 2,615,899,155.72
- Entre Ríos: 2,550,093,567.38
- Neuquén: 1,571,717,501.57
- Salta: 1,497,159,349.20
- Río Negro: 875,891,417.31

## Top productos por ventas

- Neumático utilitario R15: 9,951,780,540.97
- Neumático 195/55 R16: 8,420,398,791.69
- Neumático 175/65 R14: 7,400,864,816.35
- Batería utilitario 90Ah: 7,185,788,205.02
- Batería 12V 75Ah: 5,489,630,222.89
- Aceite sintético 5W30 4L: 5,484,257,331.83
- Aceite transmisión 75W90: 4,853,635,872.38
- Kit de filtros service: 4,731,169,988.95
- Batería 12V 55Ah: 4,393,848,561.11
- Parrilla de suspensión: 4,363,915,580.80

## Método de geocodificación

- Método: `punto_localidad_v5_1_con_jitter_sintetico`
- Confianza: `0.88`
- Descripción: se asignan clientes ficticios a puntos/localidades V5.1 y se aplica jitter sintético leve para evitar superposición exacta.
- Fuente geográfica: capas públicas V5.1 en `public/data/provincias/<provincia>/puntos.geojson` y `departamentos.geojson`.

## Archivos generados — public/data/business

- `business/ventas_mensuales.csv` — 14.0 MiB
- `business/agregados/ventas_departamento_mes.json` — 3.185 MiB
- `business/agregados/heatmap_clientes_ventas.geojson` — 1.945 MiB
- `business/clientes.geojson` — 1.859 MiB
- `business/agregados/ventas_cliente_totales.json` — 1.459 MiB
- `business/agregados/ventas_producto_mes.json` — 0.773 MiB
- `business/agregados/ventas_provincia_mes.json` — 0.118 MiB
- `business/productos.json` — 0.025 MiB
- `business/calendario.json` — 0.006 MiB
- `business/metadata_business_v6.json` — 0.006 MiB

## Validaciones

Estado inicial: `PENDING_CHECK`.

Ejecutar:

```powershell
python src\check_business_v6.py --base-data public\data --business-data public\data\business --diag data\output\diagnostico_business_v6.json --out data\output\check_business_v6.txt
```

<!-- VALIDATION_BLOCK_START -->
Validación ejecutada: `2026-07-05T16:48:35+00:00`

Estado final: **OK**

- Checks OK: 38
- Advertencias: 0
- Errores: 0
- Archivos public/data: 301
- Archivo público más pesado: `data/business/ventas_mensuales.csv` — 14.0 MiB
- Ruta pública más larga: `data/provincias/provincia_94_tierra_del_fuego_antartida_e_islas_del_atlantico_sur/gobiernos_locales.geojson` — 107 caracteres

### Detalle de validaciones

- `OK` Existe metadata.json V5.1 — public/data/metadata.json
- `OK` Existe provincias_index.json — public/data/indexes/provincias_index.json
- `OK` Existe localidades_puntos_index.json — public/data/indexes/localidades_puntos_index.json
- `OK` Base V5.1 en estado OK — version=v5_1_map_ready_cloudflare_fix
- `OK` Provincias válidas cargadas — 24 provincias
- `OK` Existe metadata_business_v6.json — public/data/business/metadata_business_v6.json
- `OK` Existe clientes.geojson — public/data/business/clientes.geojson
- `OK` Existe productos.json — public/data/business/productos.json
- `OK` Existe calendario.json — public/data/business/calendario.json
- `OK` Existe ventas_mensuales.csv — public/data/business/ventas_mensuales.csv
- `OK` Existe ventas_provincia_mes.json — public/data/business/agregados/ventas_provincia_mes.json
- `OK` Existe ventas_departamento_mes.json — public/data/business/agregados/ventas_departamento_mes.json
- `OK` Existe ventas_producto_mes.json — public/data/business/agregados/ventas_producto_mes.json
- `OK` Existe ventas_cliente_totales.json — public/data/business/agregados/ventas_cliente_totales.json
- `OK` Existe heatmap_clientes_ventas.geojson — public/data/business/agregados/heatmap_clientes_ventas.geojson
- `OK` Clientes generados exactamente — 2000
- `OK` Todos los clientes tienen provincia válida — clientes=2000
- `OK` No existen clientes sin cliente_id ni duplicados
- `OK` No existen clientes sin provincia_id/provincia_nombre
- `OK` Todos los clientes tienen coordenadas válidas dentro de Argentina — bbox={'lon_min': -74.2, 'lon_max': -52.0, 'lat_min': -56.2, 'lat_max': -21.0}
- `OK` Todos los clientes tienen dato_sintetico=true
- `OK` Mayoría de clientes en Buenos Aires según regla — 1400 clientes (70.0%)
- `OK` Clientes CABA dentro de regla sugerida — 160 clientes (8.0%)
- `OK` Catálogo de productos sin nulos críticos — productos=65
- `OK` Producto_id único y válido — productos=65
- `OK` Existen ventas para todos los meses 2025-01 a 2026-12 — meses=24
- `OK` Ventas con valores positivos — registros=128998
- `OK` No existen ventas sin cliente válido
- `OK` No existen ventas sin producto válido
- `OK` Todos los clientes tienen al menos una venta
- `OK` Heatmap tiene un punto por cliente — features=2000
- `OK` Agregado provincia_mes cierra contra ventas — records=264
- `OK` Agregado departamento_mes cierra contra ventas — records=6432
- `OK` Agregado producto_mes cierra contra ventas — records=1560
- `OK` Agregado cliente_totales cierra contra ventas — records=2000
- `OK` Agregados por provincia cierran contra ventas — 156,598,296,863.76
- `OK` Archivos en public/data no superan 25 MiB — max=14.0 MiB
- `OK` No se crearon rutas públicas demasiado largas para Windows — max_len=107
<!-- VALIDATION_BLOCK_END -->

## Resultado final

Estado: `OK`.
