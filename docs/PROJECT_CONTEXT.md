# PROJECT_CONTEXT — Mapa2

## Versión vigente

**V6 — Base ficticia de clientes y ventas de autopartes**  
Fecha: 2026-07-05

La V6 fue implementada después de la aprobación explícita de V5.1. Esta fase agrega datos comerciales sintéticos para pruebas de visualización. **No avanza a V7**.

## Objetivo general

Construir una app web pública para visualizar información geográfica, censal y comercial sintética de Argentina con mapas interactivos, filtros, tooltips, drill-down, clusters, heatmap y coropléticos.

La jerarquía visible para usuario final se mantiene simplificada a:

```text
Provincia → Localidad
```

Internamente se conserva trazabilidad territorial completa mediante campos como:

```text
tipo_original
capa_original
display_tipo
app_jerarquia
metodo_dato
clasificacion_censo
confianza_censo
provincia_id
provincia_nombre
poblacion_total
nivel_map_ready
render_layer
aditiva
no_aditiva
uso_frontend
loading_strategy
```

## Estado V4

La V4 quedó como **Census Ready**:

- Población completa en capas controladas.
- Sin geometrías inválidas.
- Sin geometrías vacías.
- Provincias y departamentos con población aditiva consistente.
- Buenos Aires conserva 135 departamentos/partidos.
- Base maestra en `data/output/arg_geo_censo_census_ready_v4.gpkg`.

## Estado V5.1 aprobado

La V5.1 quedó como **Map Ready Cloudflare Fix**:

- `metadata.json` en estado `OK`.
- Sin advertencias.
- Sin errores bloqueantes.
- Ningún archivo público supera 25 MiB.
- Puntos/localidades particionados por provincia.
- Radios de Buenos Aires particionados por departamento/partido.
- Base maestra GPKG conservada.

Resultado censal validado:

```text
Población nacional provincias:     45.892.285
Población nacional departamentos:  45.892.285
Población nacional fracciones:     45.892.285
Población nacional radios:         45.892.285
Buenos Aires departamentos:        135
Radios BA conservados:             23.901
Población BA radios:               17.523.996
Particiones BA:                    135
```

## Qué agrega V6

V6 agrega una base comercial ficticia y reproducible para el rubro autopartes:

```text
Clientes: 2.000
Productos: 65
Ventas mensuales: enero 2025 a diciembre 2026
Registros de ventas: 128.998
Seed: 20260705
```

Los datos se generan con:

```text
src/generate_business_v6.py
```

Y se validan con:

```text
src/check_business_v6.py
```

## Aviso crítico sobre datos sintéticos

Los datos de V6 son **ficticios**:

- no son clientes reales;
- no son ventas reales;
- no son precios reales;
- no provienen de fuentes comerciales externas;
- se usan solo para pruebas de visualización y modelado frontend.

Cada cliente y venta conserva:

```text
dato_sintetico = true
fuente_dato = sintetico_v6
```

## Integración geográfica V6 con V5.1

V6 usa como base:

```text
public/data/metadata.json
public/data/indexes/provincias_index.json
public/data/indexes/localidades_puntos_index.json
public/data/provincias/<provincia>/puntos.geojson
public/data/provincias/<provincia>/departamentos.geojson
```

Los clientes ficticios se asignan a puntos/localidades existentes V5.1 y se aplica un jitter sintético leve para evitar superposición exacta.

Método:

```text
metodo_geocodificacion = punto_localidad_v5_1_con_jitter_sintetico
confianza_geocodificacion = 0.88
```

## Distribución geográfica V6

```text
Buenos Aires: 1.400 clientes (70,0%)
CABA: 160 clientes (8,0%)
Córdoba: 130 clientes
Santa Fe: 120 clientes
Mendoza: 50 clientes
Entre Ríos: 40 clientes
Tucumán: 35 clientes
Neuquén: 20 clientes
Salta: 20 clientes
Río Negro: 15 clientes
San Luis: 10 clientes
```

Buenos Aires se divide en:

```text
AMBA: 868 clientes
Interior bonaerense: 532 clientes
```

## Estructura pública V6

```text
public/data/business/
  metadata_business_v6.json
  clientes.geojson
  productos.json
  calendario.json
  ventas_mensuales.csv
  agregados/
    ventas_provincia_mes.json
    ventas_departamento_mes.json
    ventas_producto_mes.json
    ventas_cliente_totales.json
    heatmap_clientes_ventas.geojson
```

## Resultado del check V6

```text
Estado final: OK
Clientes generados exactamente: 2.000
Todos los clientes tienen provincia válida
Todos los clientes tienen coordenadas válidas dentro de Argentina
Todos los clientes tienen dato_sintetico=true
Catálogo de productos sin nulos críticos
Ventas para todos los meses 2025-01 a 2026-12
Ventas con valores positivos
Agregados cierran contra ventas
Archivos en public/data no superan 25 MiB
No se crearon rutas públicas largas para Windows
```

Archivo público más pesado:

```text
public/data/business/ventas_mensuales.csv — 14.000 MiB
```

## Reglas de uso frontend futuro

- Vista nacional: `provincias.geojson`.
- Click en provincia: `provincias/<provincia>/departamentos.geojson`.
- Clientes: `business/clientes.geojson`.
- Heatmap: `business/agregados/heatmap_clientes_ventas.geojson`.
- Ventas mensuales: `business/ventas_mensuales.csv`.
- Coroplético comercial por provincia: `business/agregados/ventas_provincia_mes.json`.
- Coroplético comercial por departamento/partido: `business/agregados/ventas_departamento_mes.json`.
- Productos y categorías: `business/productos.json`.
- Calendario: `business/calendario.json`.

No cargar radios de todo el país ni todos los puntos nacionales al inicio.

## Fases del proyecto

```text
V4 — Census Ready
V5 — Map Ready
V5.1 — Map Ready Cloudflare Fix
V6 — Base ficticia de clientes y ventas de autopartes
V7 — Frontend mapa interactivo
V8 — Deploy Cloudflare
V9 — Mejoras UI/UX y performance
```

## Regla crítica actual

No avanzar a V7 hasta que el usuario confirme explícitamente que V6 funciona correctamente.

## Comandos principales V6

Generar:

```powershell
python src\generate_business_v6.py --base-data public\data --out-data data\output\business_v6 --public-out public\data\business --diag-md data\output\diagnostico_business_v6.md --diag-json data\output\diagnostico_business_v6.json --seed 20260705
```

Validar:

```powershell
python src\check_business_v6.py --base-data public\data --business-data public\data\business --diag data\output\diagnostico_business_v6.json --out data\output\check_business_v6.txt
```

Generar pesos:

```powershell
Get-ChildItem public\data -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending | Out-File data\output\v6_file_sizes.txt
```

## Próxima fase sugerida

Solo después de validación del usuario: **V7 — frontend mapa interactivo**.

---

# Actualización V7 — Frontend interactivo del mapa comercial y censal

## Estado V7

Se implementó la V7 como frontend estático compatible con Cloudflare Pages Free:

```text
Vite
React
TypeScript
MapLibre GL JS
Datos estáticos desde public/data
Sin backend obligatorio
Sin claves privadas
Sin deploy en V7
```

## Alcance implementado

- Mapa base de Argentina por provincias.
- Clientes sintéticos V6 como puntos.
- Clusters de clientes.
- Heatmap de clientes/ventas.
- Coroplético de ventas por provincia.
- Coroplético de ventas por departamento/partido bajo demanda.
- Puntos de localidades V5.1 bajo demanda por provincia.
- Filtros por provincia, departamento/partido/localidad, cliente, tipo, segmento, producto, categoría, año, mes y rango calendario.
- KPIs mínimos solicitados.
- Tooltips y paneles de detalle.
- Leyenda dinámica.
- Estados visibles de carga/error.
- Aviso visible de datos comerciales sintéticos.

## Reglas preservadas

```text
No se avanzó a V8.
No se hizo deploy.
No se modificó la lógica censal V5.1.
No se regeneró la base comercial V6.
No se destruyó la base maestra.
No se eliminó trazabilidad.
```

## Carga inicial V7

```text
public/data/metadata.json
public/data/provincias.geojson
public/data/indexes/provincias_index.json
public/data/business/metadata_business_v6.json
public/data/business/agregados/ventas_provincia_mes.json
public/data/business/agregados/ventas_cliente_totales.json
public/data/business/clientes.geojson
public/data/business/productos.json
public/data/business/calendario.json
```

## Carga bajo demanda V7

```text
public/data/provincias/<provincia>/departamentos.geojson
public/data/provincias/<provincia>/puntos.geojson
public/data/business/agregados/ventas_departamento_mes.json
public/data/business/agregados/ventas_producto_mes.json
public/data/business/ventas_mensuales.csv
```

## Validación V7

Script reproducible:

```text
src/check_frontend_v7.py
```

Salidas:

```text
data/output/diagnostico_frontend_v7.md
data/output/diagnostico_frontend_v7.json
data/output/check_frontend_v7.txt
data/output/v7_file_sizes.txt
```

## Próxima fase permitida solo con autorización

```text
V8 — Deploy Cloudflare
```

No avanzar a V8 sin confirmación explícita del usuario.

---

## Estado V7.1 — Frontend runtime fix

Se corrigió la V7 dentro de la misma fase para resolver validación runtime local:

- Spinner persistente de carga de detalle comercial bajo demanda en `npm run dev`.
- Warnings 404 de glyphs MapLibre.
- Favicon faltante.
- Auditorías adicionales en `src/check_frontend_v7.py`.

No se avanzó a V8. No se hizo deploy. No se modificó V5.1. No se regeneró V6.

