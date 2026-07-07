# Mapa 2 — V11A D1 Schema

**Base:** V10.4 Architecture Decision.  
**Fase:** V11A — D1 Schema + Migración local + Códigos postales + Auditoría de límites.  
**Estado:** preparado para validación local con Wrangler/D1.

## Objetivo

V11A incorpora una base relacional compatible con Cloudflare D1/SQLite sin modificar todavía el frontend, sin crear APIs y sin aplicar el rediseño HeroUI. La app estática V10.4 queda preservada y los datos D1 se agregan como pipeline paralelo para la fase V11B.

## Modelo territorial

El modelo operativo queda normalizado como:

```text
País → Provincia → Localidad
```

En este proyecto, `locality` no significa únicamente localidad formal. Puede representar localidad, partido, departamento, comuna, municipio, gobierno local, barrio, asentamiento, aglomerado o división territorial equivalente. Esta decisión permite vincular geometría, población, clientes, ventas, productos y KPIs con una unidad común útil para análisis.

## Tablas creadas

| Tabla | Propósito |
|---|---|
| `source_catalog` | Catálogo de fuentes oficiales, internas, sintéticas y derivadas. |
| `province` | Provincias normalizadas con códigos, bbox y centroides. |
| `locality` | Unidad territorial normalizada para departamentos, partidos, localidades, gobiernos locales, puntos y equivalentes. |
| `postal_code_area` | Códigos postales como señal auxiliar con trazabilidad y confianza. |
| `territorial_alias` | Alias normalizados para matching territorial. |
| `territorial_match_log` | Registro de cómo se resolvieron clientes/localidades/códigos. |
| `census_population` | Población censal por entidad y año. |
| `geometry_feature` | Geometrías livianas, bbox, centroides y rutas a assets pesados. |
| `client` | Clientes sintéticos V6 normalizados territorialmente. |
| `product` | Productos sintéticos de autopartes V6. |
| `sale_monthly` | Ventas mensuales sintéticas 2025-01 a 2026-12. |
| `sales_aggregate_province_month` | Agregados provincia/mes. |
| `sales_aggregate_locality_month` | Agregados localidad normalizada/mes; en V11A usa departamentos/partidos/comunas como localidad poligonal primaria. |
| `sales_aggregate_product_month` | Agregados producto/mes. |
| `sales_aggregate_client_month` | Agregados cliente/mes derivados desde ventas. |
| `app_metadata` | Metadatos de fase y reglas de datos sintéticos. |
| `schema_migrations` | Registro interno de migraciones aplicadas. |

## Índices obligatorios

La migración `migrations/0001_schema.sql` crea índices para:

- `province.slug`, `province.official_code`.
- `locality.province_id`, `locality.slug`, `locality(province_id, name_normalized)`, `locality.official_code`, `locality.georef_id`, `locality.indec_code`.
- `postal_code_area.postal_code`, `postal_code_area.province_id`, `postal_code_area.locality_id`, `postal_code_area(province_id, locality_id)`.
- `territorial_alias(entity_type, entity_id)` y `territorial_alias.alias_normalized`.
- `census_population(entity_type, entity_id, census_year)` y `census_population(province_id, locality_id)`.
- `geometry_feature(entity_type, entity_id, layer_type, simplification_level)`, `geometry_feature.province_id`, `geometry_feature.locality_id`.
- `client.province_id`, `client.locality_id`, `client.department_id`, `client.postal_code`, `client.territorial_match_confidence`.
- `sale_monthly(client_id, period_yyyymm)`, `sale_monthly(product_id, period_yyyymm)`, `sale_monthly.period_yyyymm`.
- Agregados por entidad y período.

## Política de geometrías

D1 no se usa como PostGIS. En V11A:

- Los polígonos pesados no se guardan completos en `geometry_json`.
- Los polígonos quedan registrados como `asset_path` + `bbox` + `centroid` + propiedades mínimas.
- Los puntos/líneas muy livianos pueden guardarse en `geometry_json` si pasan el umbral de tamaño.
- Los assets existentes de `public/data` se preservan para que el mapa no pierda rendimiento ni compatibilidad.

Resultado actual:

- Filas con `geometry_json` liviano: 18,470.
- Filas con `asset_path`: 21,313.

## Conteo actual del seed

| Tabla | Filas |
|---|---:|
| `source_catalog` | 6 |
| `app_metadata` | 4 |
| `province` | 24 |
| `locality` | 21,289 |
| `postal_code_area` | 943 |
| `territorial_alias` | 21,313 |
| `territorial_match_log` | 2,000 |
| `census_population` | 21,313 |
| `geometry_feature` | 21,313 |
| `client` | 2,000 |
| `product` | 65 |
| `sale_monthly` | 128,998 |
| `sales_aggregate_province_month` | 264 |
| `sales_aggregate_locality_month` | 6,432 |
| `sales_aggregate_product_month` | 1,560 |
| `sales_aggregate_client_month` | 48,000 |
| `schema_migrations` | 1 |

## Decisiones de diseño

1. `client.locality_id` queda normalizado al `departamento_id` cuando existe, porque el click poligonal actual usa departamentos/partidos/comunas como unidad territorial primaria. La localidad granular original se conserva en `raw_locality_id` y `raw_locality_name`.
2. `postal_code_area` se carga solo cuando hay fuente interna trazable; no se inventan códigos postales.
3. Los datos comerciales siguen marcados como sintéticos (`synthetic_flag = 1`).
4. Los agregados cliente/mes se derivan desde `sale_monthly` para preparar APIs paginadas y KPIs sin full scans.
5. El frontend V10.4 no se modifica en esta fase.
