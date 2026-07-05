# CHANGELOG V5 — Map Ready

**Fecha:** 2026-07-05  
**Versión:** V5 Map Ready  
**Estado:** Usable con advertencias no bloqueantes

## Agregado

- `src/export_map_ready_v5.py`
  - Exporta capas GeoJSON optimizadas para frontend.
  - Separa jerarquías para evitar doble conteo.
  - Genera `metadata.json`.
  - Genera índices por capa y por provincia.
  - Genera diagnóstico Markdown y JSON.

- `src/check_map_ready_v5.py`
  - Valida existencia de capas fuente en GPKG.
  - Valida GeoJSON nacionales.
  - Valida splits por provincia.
  - Controla geometrías inválidas/vacías.
  - Controla población nula.
  - Controla campos mínimos.
  - Controla cierre poblacional de capas aditivas.
  - Controla Buenos Aires = 135 departamentos/partidos.
  - Genera `data/output/check_map_ready_v5.txt`.

- `src/generate_previews_v5.py`
  - Genera previews PNG estáticas de la V5.

- `public/data/`
  - `metadata.json`
  - `provincias.geojson`
  - `localidades_puntos.geojson`
  - `localidades_poligonos_departamentos.geojson`
  - `localidades_poligonos_gobiernos_locales.geojson`
  - `localidades_poligonos_municipios.geojson`
  - `localidades_poligonos_aglomerados.geojson`
  - `localidades_poligonos_fracciones.geojson`
  - `indexes/layers_index.json`
  - `indexes/provincias_index.json`
  - `provincias/<provincia>/*.geojson`

- `public/previews/`
  - `v5_coropletico_argentina_provincias.png`
  - `v5_coropletico_buenos_aires_departamentos.png`
  - `v5_puntos_localidades_buenos_aires.png`

- `docs/PROJECT_CONTEXT.md`
- `docs/CHANGELOG_V5.md`
- `docs/RUNBOOK_V5.md`

## Cambiado

- Se dejó de usar `app_localidades_poligonos` como capa acumulativa.
- Se separaron las capas por nivel map-ready:
  - provincias,
  - departamentos,
  - gobiernos locales,
  - municipios,
  - aglomerados,
  - fracciones,
  - radios,
  - puntos.
- Se agregó `nivel_map_ready` y `render_layer` a las salidas frontend.
- Se completó `provincia_id`, `provincia_codigo` y `provincia_nombre` cuando la fuente no lo traía directamente.
- Se redujeron columnas para mejorar peso de archivos web sin perder trazabilidad crítica.
- Se exportó todo en EPSG:4326 / CRS84 GeoJSON.
- Se aplicó simplificación segura y precisión de coordenadas de 6 decimales para evitar geometrías inválidas por redondeo.

## Decisiones de performance

- No se publica un GeoJSON nacional único de radios censales.
- Los radios censales quedan completos por provincia.
- Buenos Aires conserva un archivo de radios pesado por concentración de features; se documenta como advertencia no bloqueante.
- Para V7 se recomienda carga por viewport, tiles o partición subprovincial si el frontend necesita radios de Buenos Aires con máxima fluidez.

## Validación ejecutada

Comando ejecutado:

```powershell
python src\check_map_ready_v5.py --data-dir public\data --diag data\output\diagnostico_map_ready_v5.json --out data\output\check_map_ready_v5.txt
```

Resultado:

```text
Estado final: WARN
Sin errores bloqueantes.
Splits validados: 145
Splits faltantes: 0
Splits con error: 0
Buenos Aires departamentos/partidos: 135
```

## Advertencias no bloqueantes

- Radios no tienen GeoJSON nacional por diseño; usar splits por provincia.
- `provincias/provincia_06_buenos_aires/radios.geojson` supera el umbral recomendado de peso para carga directa.
- Algunas capas siguen usando población estimada heredada de V4, marcada en `metodo_dato`, `clasificacion_censo` y `confianza_censo`.

## No realizado en V5

- No se generaron clientes ficticios.
- No se generaron ventas.
- No se implementó frontend React/MapLibre.
- No se preparó deploy Cloudflare.
- No se creó base D1.

## Próximo paso sugerido

Esperar confirmación explícita del usuario para iniciar V6.
