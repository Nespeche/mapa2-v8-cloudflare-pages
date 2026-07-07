# V11A.1 — Optimization Plan

## Objetivo

V11A.1 prepara Mapa 2 para V11B/V11C sin implementar todavía APIs reales ni frontend API-first. La fase agrega read models D1, cache JSON liviano, auditorías de presupuesto de lectura y checks de query plans para reducir lecturas futuras en Cloudflare D1 Free.

## Problema que resuelve

V11A ya creó una base D1 canónica con tablas normalizadas y seed completo. La auditoría V11A indicó que la importación remota completa puede superar el presupuesto diario de escrituras de D1 Free y que V11B debe evitar queries pesadas sobre `sale_monthly`. V11A.1 evita que las futuras APIs tengan que recalcular totales, top productos o rankings en cada request.

## Qué queda en D1 canónico

- `province`, `locality`, `postal_code_area`, `territorial_alias`, `territorial_match_log`.
- `census_population`.
- `geometry_feature` con bbox, centroides, geometría liviana o `asset_path`.
- `client`, `product`, `sale_monthly`.
- Agregados V11A.

## Qué se agrega como read model D1

- `api_province_summary`.
- `api_locality_summary`.
- `api_locality_month_summary`.
- `api_locality_top_products`.
- `api_locality_client_metrics`.
- `api_client_sales_summary`.
- `api_query_budget`.

Estos modelos son derivables y regenerables. No reemplazan a las tablas canónicas.

## Qué queda como asset estático

En `public/data/api-cache` se generan catálogos livianos:

- `metadata.json`.
- `provinces.json`.
- `localities_by_province/index.json`.
- `localities_by_province/provincia_XX.json`.
- `products.json`.
- `periods.json`.
- `cache_manifest.json`.

No se incluyen ventas crudas, clientes completos ni geometrías pesadas.

## Qué queda para V11B

- Implementar Pages Functions/Workers reales.
- Conectar binding D1 `DB`.
- Exponer endpoints parametrizados.
- Aplicar validaciones anti SQL injection.
- Agregar cache HTTP y límites por endpoint.

## Qué queda para V11C

- Crear API client frontend.
- Cambiar carga de datos comercial pesada hacia APIs.
- Implementar selección Provincia → Localidad dinámica.
- Click en localidad → resumen + clientes paginados.

## Cómo se evita romper la app actual

- No se modifica `src` ni el flujo visual.
- No se eliminan `public/data` ni CSV/JSON que usa la app estática.
- El frontend no depende de D1 ni de `public/data/api-cache` en esta fase.
- No se implementan Pages Functions reales.
- No se implementa HeroUI.

## Estado esperado

V11A.1 debe poder validarse localmente con scripts Node, build Vite y migraciones D1 local/remoto opcionales. La app debe seguir funcionando como V11A, con nuevos artefactos de optimización disponibles para V11B.
