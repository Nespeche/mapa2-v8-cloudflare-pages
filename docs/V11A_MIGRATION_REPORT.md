# Mapa 2 — V11A Migration Report

**Generado:** 2026-07-07T12:44:30.709Z

**Estado:** WARNING

## Datos origen

- provincesGeojson: public/data/provincias.geojson
- departmentPolygons: public/data/localidades_poligonos_departamentos.geojson
- governmentPolygons: public/data/localidades_poligonos_gobiernos_locales.geojson
- municipalityPolygons: public/data/localidades_poligonos_municipios.geojson
- pointsIndex: public/data/indexes/localidades_puntos_index.json
- provinceCentroids: data/semilla/provincias_georef_centroides.csv
- refeglo: data/semilla/datos-refeglo_25-09-2023.csv
- clientsCsv: data/output/business_v6/clientes_v6.csv
- productsCsv: data/output/business_v6/productos_v6.csv
- salesCsv: data/output/business_v6/ventas_mensuales_v6.csv
- aggProvinceCsv: data/output/business_v6/agregados_provincia_mes_v6.csv
- aggLocalityCsv: data/output/business_v6/agregados_departamento_mes_v6.csv
- aggProductCsv: data/output/business_v6/agregados_producto_mes_v6.csv

## Filas generadas por tabla

| Tabla | Filas |
|---|---:|
| source_catalog | 6 |
| app_metadata | 4 |
| province | 24 |
| locality | 21289 |
| postal_code_area | 943 |
| territorial_alias | 21313 |
| territorial_match_log | 2000 |
| census_population | 21313 |
| geometry_feature | 21313 |
| client | 2000 |
| product | 65 |
| sale_monthly | 128998 |
| sales_aggregate_province_month | 264 |
| sales_aggregate_locality_month | 6432 |
| sales_aggregate_product_month | 1560 |
| sales_aggregate_client_month | 48000 |
| schema_migrations | 1 |

## Integridad comercial V6

- Clientes esperados: 2000
- Clientes importados: 2000
- Productos importados: 65
- Ventas importadas: 128998
- Período ventas: 2025-01 a 2026-12
- Ventas huérfanas sin cliente: 0
- Ventas huérfanas sin producto: 0
- Datos sintéticos preservados: sí

## Códigos postales

- Registros importados: 943
- Estrategia: Extracción inicial desde direcciones postales REFLO incluidas en el proyecto. No es dataset postal exhaustivo.
- Regla: Código postal es señal auxiliar; requiere cruce con provincia, localidad, alias, código oficial o coordenadas.

## Geometrías

- Filas con geometry_json liviano: 18470
- Filas con asset_path: 21313
- Regla: Polígonos pesados quedan como asset_path + bbox + centroide; D1 no se usa como PostGIS.

## Chunks generados

| Archivo | Tamaño | Statements | Riesgo remoto Free |
|---|---:|---:|---|
| data/d1/chunks/seed_001_sources_territory.sql | 54.967 MB | 86205 | MEDIUM_BECAUSE_INDEX_WRITES_COUNT |
| data/d1/chunks/seed_002_business_core_and_aggregates.sql | 25.914 MB | 60321 | MEDIUM_BECAUSE_INDEX_WRITES_COUNT |
| data/d1/chunks/seed_003_sales_2025.sql | 19.435 MB | 64414 | MEDIUM_BECAUSE_INDEX_WRITES_COUNT |
| data/d1/chunks/seed_004_sales_2026.sql | 19.506 MB | 64584 | MEDIUM_BECAUSE_INDEX_WRITES_COUNT |
| data/d1/chunks/v11a1_read_models_001.sql | 15.259 MB |  | MEDIUM_BECAUSE_INDEX_WRITES_COUNT |
| data/d1/chunks/v11a1_read_models_002.sql | 15.120 MB |  | MEDIUM_BECAUSE_INDEX_WRITES_COUNT |

## Riesgos y recomendaciones

- **WARNING — remote_rows_written:** La importación remota completa supera 100.000 filas escritas/día de D1 Free.
- **WARNING — remote_index_writes:** Con índices, la escritura remota puede multiplicar filas escritas. Cargar por chunks y monitorear métricas.
- **INFO — geometry_policy:** Polígonos pesados quedan por asset_path + bbox/centroide; correcto para V11A.

## Conclusión

La migración local V11A queda preparada. La carga remota en D1 Free debe hacerse con chunks y monitoreo de filas escritas; no se recomienda ejecutar el seed completo en remoto de una sola vez.
