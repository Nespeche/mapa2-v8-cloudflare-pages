# V11A.1 — Cloudflare Free Strategy

## Objetivo

Maximizar navegación y consultas diarias en Cloudflare Free reduciendo lecturas D1 innecesarias, evitando full scans y sirviendo catálogos estáticos cuando los datos son casi inmutables.

## Principio de arquitectura

```text
D1 canónico = verdad relacional y trazable.
Read models D1 = respuestas API frecuentes.
Assets estáticos = catálogos livianos casi inmutables.
Frontend actual = se mantiene estático hasta V11C.
```

## Qué servir como asset estático

- Metadata de versión y conteos.
- Listado de provincias.
- Listado de localidades por provincia sin geometrías.
- Productos sintéticos V6.
- Períodos comerciales.

Esto reduce lecturas D1 para navegación inicial y filtros de catálogo.

## Qué servir desde read models D1

- Resumen de localidad.
- Productos top por localidad.
- Clientes por localidad con ranking y paginación.
- Resumen de cliente.
- Series mensuales por localidad.

## Qué servir desde tablas canónicas D1

- Búsqueda territorial usando `province`, `locality`, `territorial_alias` y `postal_code_area`.
- Detalle de entidades cuando falte el read model.
- Ventas crudas solo con filtros altamente selectivos.

## Cómo reducir escrituras remotas

- Validar todo local antes de aplicar remoto.
- Aplicar `0002_v11a1_api_read_optimization.sql` una sola vez.
- Cargar `v11a1_read_models.sql` o chunks solo cuando cambien los datos.
- Evitar regenerar y reimportar el seed V11A completo si solo cambian read models.
- Si Cloudflare corta por límite de escritura, continuar al día siguiente con el siguiente chunk.

## Cómo evitar full scans

- No usar `sale_monthly` para `/api/provinces`, `/api/localities/:id/summary`, `/api/sales/summary` general.
- Usar `api_locality_summary` por PK.
- Usar `api_locality_client_metrics(locality_id, rank_net_sales)` para clientes paginados.
- Usar `api_locality_month_summary(locality_id, period_yyyymm)` para series.
- Usar `api_client_sales_summary(client_id)` para detalle por cliente.

## Paginación y límites sugeridos

- `pageSize` default: 25.
- `pageSize` máximo: 100.
- Búsqueda territorial: 20 resultados.
- Top productos: 10 o 12 resultados.
- Rango mensual normal: 24 períodos.

## Cache HTTP futuro para V11B

- Assets: `Cache-Control: public, max-age=3600, s-maxage=86400`, con hash/ETag por archivo.
- Summary por localidad: `s-maxage=300` si la base no cambia frecuentemente.
- Search: cache corta o sin cache según parámetros.
- Clientes paginados: cache corta por `localityId + page + pageSize`.

## Advertencias

- Los límites vigentes de Cloudflare deben revisarse al momento del deploy.
- D1 no es PostGIS; no usarlo para operaciones espaciales complejas.
- Los archivos por provincia `provincia_06.json` y `provincia_14.json` pueden ser más grandes que el resto; V11B puede servirlos desde D1 paginado si se busca menor payload inicial.
