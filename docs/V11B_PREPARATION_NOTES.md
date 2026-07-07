# V11B — Preparation Notes from V11A.1

## Endpoints que deberían usar assets

- `GET /api/metadata` → `public/data/api-cache/metadata.json`.
- `GET /api/provinces` → `public/data/api-cache/provinces.json` o `api_province_summary`.
- `GET /api/provinces/:provinceId/localities` → `public/data/api-cache/localities_by_province/{safe_id}.json` o `api_locality_summary` filtrado por `province_id`.
- Catálogo de productos, si se expone → `public/data/api-cache/products.json`.

## Endpoints que deberían usar read models

- `GET /api/localities/:localityId/summary` → `api_locality_summary` + `api_locality_top_products`.
- `GET /api/localities/:localityId/clients` → `api_locality_client_metrics`.
- `GET /api/clients/:clientId` → `api_client_sales_summary`.
- `GET /api/sales/summary` → `api_locality_month_summary` o agregados existentes.

## Endpoints que pueden usar tablas canónicas

- `GET /api/search/territory` → `province`, `locality`, `territorial_alias`, `postal_code_area`.
- `GET /api/clients/:clientId/sales` → `sale_monthly` solo filtrado por `client_id`, período y opcionalmente `product_id`.

## Endpoints que requieren paginación

- `GET /api/localities/:localityId/clients?page=&pageSize=`.
- `GET /api/search/territory?q=&provinceId=&postalCode=`.

## Límites recomendados

- `pageSize` default: 25.
- `pageSize` máximo: 100.
- Search limit: 20.
- Top products limit: 10 o 12.
- Rango mensual máximo recomendado: 24 períodos para V11B inicial.

## Contratos JSON sugeridos

### `/api/provinces`

```json
{
  "data": [{ "province_id": "provincia:06", "name": "Buenos Aires", "locality_count": 0, "client_count": 0 }],
  "meta": { "source": "asset|d1", "generated_at": "..." }
}
```

### `/api/localities/:localityId/summary`

```json
{
  "data": {
    "locality_id": "departamento:06749",
    "province_id": "provincia:06",
    "name": "San Fernando",
    "population_2022": 0,
    "kpis": { "client_count": 0, "net_sales_total": 0, "gross_margin_total": 0 },
    "top_products": []
  },
  "meta": { "source": "api_locality_summary" }
}
```

### `/api/localities/:localityId/clients`

```json
{
  "data": [],
  "pagination": { "page": 1, "pageSize": 25, "hasMore": true },
  "meta": { "source": "api_locality_client_metrics" }
}
```

## Validaciones anti SQL injection

- No concatenar parámetros dentro del SQL.
- Usar `stmt.bind(...)` en Workers/Pages Functions.
- Validar IDs con allowlist/patrones (`provincia:NN`, `departamento:NNNNN`, `C00001`, `P0001`).
- Validar `from` y `to` con formato `YYYY-MM`.
- Normalizar `q` de búsqueda y limitar longitud.
- Rechazar `pageSize > 100`.

## Recomendaciones de caching HTTP

- Assets con cache largo y checksum.
- Summary de localidad con `s-maxage=300`.
- Clientes paginados con cache corta por query completa.
- Search territorial con cache corta o sin cache, según UX.

## Consultas que no deben implementarse

```text
Prohibido consultar la tabla sale_monthly sin filtros selectivos.
Prohibido usar sale_monthly como fuente de resumen territorial general.
```

Para ventas por cliente, exigir `client_id`. Para resumen por territorio, usar read models o agregados.
