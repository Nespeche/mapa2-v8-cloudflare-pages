# public/data — V5.1 Map Ready Cloudflare Fix

Esta carpeta contiene los GeoJSON listos para consumir desde un frontend estático compatible con Cloudflare Pages Free.

Regla principal: **no mezclar capas superpuestas para sumar población**.

## Carga recomendada

- `provincias.geojson`: vista nacional y coroplético provincial.
- `localidades_poligonos_departamentos.geojson`: drill-down nacional liviano; preferir splits por provincia luego del click.
- `localidades_poligonos_fracciones.geojson`: zoom alto; no cargar por defecto si no hace falta.
- Radios censales: no existe GeoJSON nacional. Se cargan por provincia; en Buenos Aires se cargan por departamento/partido usando `provincias/provincia_06_buenos_aires/radios/index.json`.
- Puntos/localidades: usar `indexes/localidades_puntos_index.json` y `provincias/<provincia>/puntos.geojson`.
- Gobiernos locales, municipios y aglomerados: render layers no aditivas.

## Cloudflare

V5.1 garantiza que ningún archivo dentro de `public/` supere 25 MiB. Los archivos mayores a 15 MiB deben tratarse como advertencia preventiva.
