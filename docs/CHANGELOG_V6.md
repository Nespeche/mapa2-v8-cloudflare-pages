# CHANGELOG V6 — Business Synthetic Autoparts

Fecha: 2026-07-05

## Estado

**OK** — V6 generada y validada.

## Contexto

La V6 se implementa sobre la V5.1 aprobada. La V5.1 ya estaba en estado `OK`, sin advertencias, sin errores bloqueantes y con compatibilidad Cloudflare Pages Free.

## Cambios agregados

### Scripts

Se agregaron:

```text
src/generate_business_v6.py
src/check_business_v6.py
```

### Datos comerciales sintéticos

Se generaron:

```text
data/output/business_v6/clientes_v6.csv
data/output/business_v6/clientes_v6.geojson
data/output/business_v6/productos_v6.csv
data/output/business_v6/ventas_mensuales_v6.csv
data/output/business_v6/calendario_v6.csv
data/output/business_v6/agregados_provincia_mes_v6.csv
data/output/business_v6/agregados_departamento_mes_v6.csv
data/output/business_v6/agregados_producto_mes_v6.csv
data/output/business_v6/agregados_cliente_v6.csv
```

### Datos públicos para frontend futuro

Se generaron:

```text
public/data/business/metadata_business_v6.json
public/data/business/clientes.geojson
public/data/business/productos.json
public/data/business/calendario.json
public/data/business/ventas_mensuales.csv
public/data/business/agregados/ventas_provincia_mes.json
public/data/business/agregados/ventas_departamento_mes.json
public/data/business/agregados/ventas_producto_mes.json
public/data/business/agregados/ventas_cliente_totales.json
public/data/business/agregados/heatmap_clientes_ventas.geojson
```

### Diagnósticos

Se generaron:

```text
data/output/diagnostico_business_v6.md
data/output/diagnostico_business_v6.json
data/output/check_business_v6.txt
data/output/v6_file_sizes.txt
```

### Documentación

Se actualizaron/agregaron:

```text
README.md
docs/PROJECT_CONTEXT.md
docs/CHANGELOG_V6.md
docs/RUNBOOK_V6.md
```

## Parámetros de generación

```text
Seed: 20260705
Clientes: 2.000
Productos: 65
Período: 2025-01 a 2026-12
Rubro: autopartes
```

## Distribución de clientes

```text
Buenos Aires: 1.400
CABA: 160
Córdoba: 130
Santa Fe: 120
Mendoza: 50
Entre Ríos: 40
Tucumán: 35
Neuquén: 20
Salta: 20
Río Negro: 15
San Luis: 10
```

Dentro de Buenos Aires:

```text
AMBA: 868
Interior bonaerense: 532
```

## Ventas sintéticas

```text
Registros de ventas: 128.998
Venta neta total 2025: 70.214.766.538,47
Venta neta total 2026: 86.383.530.325,29
Variación sintética 2026 vs 2025: 23,03%
```

## Validaciones OK

El check V6 validó:

- V5.1 base existe y está OK.
- Existen `metadata.json`, `provincias_index.json` y `localidades_puntos_index.json`.
- Hay exactamente 2.000 clientes.
- Todos los clientes tienen provincia válida.
- Todos los clientes tienen coordenadas dentro de Argentina.
- Buenos Aires concentra 70,0% de clientes.
- CABA concentra 8,0% de clientes.
- No hay clientes sin `cliente_id`.
- No hay clientes sin `provincia_id` o `provincia_nombre`.
- No hay clientes sin `lat` y `lon`.
- Todos los clientes tienen `dato_sintetico=true`.
- El catálogo de productos no tiene nulos críticos.
- Existen ventas para todos los meses entre 2025-01 y 2026-12.
- Las ventas tienen valores positivos.
- No hay ventas sin cliente válido.
- No hay ventas sin producto válido.
- Los agregados cierran contra la tabla de ventas.
- Los agregados por provincia cierran contra ventas.
- No hay archivos públicos mayores a 25 MiB.
- No se crearon rutas públicas largas para Windows.

## Compatibilidad Cloudflare Free

```text
Archivo público más pesado: public/data/business/ventas_mensuales.csv — 14.000 MiB
Archivos >25 MiB: 0
Archivos 20-25 MiB: 0
Rutas públicas > límite preventivo: 0
```

## Alcance no realizado

```text
No se creó frontend completo.
No se hizo deploy.
No se avanzó a V7.
No se modificó la lógica censal validada.
No se destruyó la base maestra.
```

## Pendientes no bloqueantes

- En V7 conviene decidir si `ventas_mensuales.csv` se carga completo o bajo demanda por filtro/calendario.
- En V7 conviene evaluar particionar ventas por año si el frontend necesita una carga inicial aún más liviana.
- En V7 conviene definir escala visual de `heatmap_weight` y normalización por provincia o nacional.
