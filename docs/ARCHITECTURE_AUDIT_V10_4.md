# Mapa 2 — Auditoría de arquitectura V10.4

**Fase:** V10.4 — Decisión de arquitectura de carga de datos y backend  
**Base:** V10.3 — Estabilización, contratos de datos y anti-regresión aprobada  
**Fecha UTC:** 2026-07-07T10:19:26.104Z

## Resultado

**Estado:** OK

- Sin hallazgos bloqueantes.

## Estructura crítica revisada

- Archivos obligatorios revisados: 48
- Archivos faltantes: 0
- Backend implementado: no
- Directorio `functions/`: ausente
- Configuración Wrangler: ausente

## Build / dist

- `dist` existe: sí
- Archivos en `dist`: 310
- Tamaño total `dist`: 168.7846 MiB
- Mayor asset: data/business/ventas_mensuales.csv (14.0001 MiB)
- Assets > 25 MiB: 0

## Top 20 assets

1. `data/business/ventas_mensuales.csv` — 14.0001 MiB
2. `data/localidades_poligonos_fracciones.geojson` — 9.7286 MiB
3. `data/provincias/provincia_14_cordoba/radios.geojson` — 9.2504 MiB
4. `data/provincias/provincia_82_santa_fe/radios.geojson` — 7.4155 MiB
5. `data/provincias/provincia_02_ciudad_autonoma_de_buenos_aires/radios.geojson` — 5.2865 MiB
6. `data/provincias/provincia_30_entre_rios/radios.geojson` — 4.5437 MiB
7. `data/provincias/provincia_06_buenos_aires/puntos.geojson` — 4.0444 MiB
8. `data/provincias/provincia_06_buenos_aires/fracciones.geojson` — 3.6878 MiB
9. `data/localidades_poligonos_gobiernos_locales.geojson` — 3.4197 MiB
10. `data/provincias/provincia_50_mendoza/radios.geojson` — 3.2745 MiB
11. `data/provincias/provincia_90_tucuman/radios.geojson` — 3.1884 MiB
12. `data/provincias/provincia_18_corrientes/radios.geojson` — 2.801 MiB
13. `data/provincias/provincia_54_misiones/radios.geojson` — 2.8009 MiB
14. `data/provincias/provincia_22_chaco/radios.geojson` — 2.6899 MiB
15. `data/provincias/provincia_66_salta/radios.geojson` — 2.5742 MiB
16. `data/provincias/provincia_14_cordoba/puntos.geojson` — 2.4898 MiB
17. `data/business/agregados/ventas_departamento_mes.json` — 2.3371 MiB
18. `data/provincias/provincia_06_buenos_aires/radios/d_06427.geojson` — 2.2565 MiB
19. `data/provincias/provincia_62_rio_negro/radios.geojson` — 1.7055 MiB
20. `data/provincias/provincia_82_santa_fe/puntos.geojson` — 1.6862 MiB

## Python / ETL

- `requirements.txt` en raíz: no
- `tools/python/requirements.txt`: sí
- Decisión: las dependencias Python quedan fuera de la raíz para evitar que Cloudflare Pages ejecute `pip install -r requirements.txt` en un deploy frontend estático.

## Seguridad de deploy

El ZIP puede conservar artefactos históricos para trazabilidad. Para GitHub/Cloudflare, seguir usando `.gitignore` y los filtros documentados para no subir `node_modules/`, `dist/`, `.env`, `.zip`, `.gpkg`, `.sqlite`, `.db`, `data/raw/` ni outputs pesados innecesarios.
