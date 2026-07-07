# V11A.1 — Read Models D1

Generado: 2026-07-07T00:00:00.000Z

## Objetivo

Crear tablas de lectura optimizada para que V11B implemente APIs livianas sin escanear `sale_monthly` ni geometrías pesadas. Estas tablas son derivadas y regenerables; la fuente canónica sigue siendo D1 V11A.

## Tablas generadas

| Tabla | Filas |
| --- | --- |
| api_province_summary | 24 |
| api_locality_summary | 21289 |
| api_locality_month_summary | 6432 |
| api_locality_top_products | 3216 |
| api_locality_client_metrics | 2000 |
| api_client_sales_summary | 2000 |
| api_query_budget | 11 |

## Fuentes usadas

| Fuente | Filas |
| --- | --- |
| province | 24 |
| locality | 21289 |
| client | 2000 |
| product | 65 |
| sale_monthly_csv_rows | 128998 |
| agg_locality_month_rows | 6432 |

## SQL generado

- Archivo completo: `data/d1/v11a1_read_models.sql` (30.38 MB, 34980 statements).
- Chunks: 2.

## Contrato por tabla

- `api_province_summary`: resumen provincial para `/api/provinces` y `/api/provinces/:id/summary`.
- `api_locality_summary`: fila única por localidad para `/api/localities/:id/summary`, incluye KPIs, población, bbox/centroide y top products compacto.
- `api_locality_month_summary`: serie mensual por localidad para gráficos y filtros por período.
- `api_locality_top_products`: top 12 productos por localidad, rankeado por venta neta.
- `api_locality_client_metrics`: clientes por localidad con ranking para paginación.
- `api_client_sales_summary`: resumen por cliente con serie mensual compacta y top productos.
- `api_query_budget`: presupuesto de lectura por endpoint futuro.

## Consultas a evitar

- No usar `SELECT * FROM sale_monthly` para endpoints frecuentes.
- No devolver geometrías pesadas inline desde read models.
- No servir clientes completos sin paginación.
- No usar código postal como única verdad territorial.

## Estado

OK. Sin advertencias bloqueantes.
