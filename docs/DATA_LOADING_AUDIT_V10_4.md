# Mapa 2 — Auditoría de carga de datos V10.4

**Fase:** V10.4 — Estrategia de carga de datos  
**Fecha UTC:** 2026-07-07T10:19:26.387Z

## Resultado

**Estado:** OK

- Sin hallazgos bloqueantes.

## Carga inicial

| Clave | Archivo | Existe | Tamaño |
|---|---:|---:|---:|
| metadata | `data/metadata.json` | sí | 0.0998 MiB |
| provinciasGeo | `data/provincias.geojson` | sí | 0.2072 MiB |
| provinciasIndex | `data/indexes/provincias_index.json` | sí | 0.0248 MiB |
| businessMetadata | `data/business/metadata_business_v6.json` | sí | 0.004 MiB |
| ventasProvinciaMes | `data/business/agregados/ventas_provincia_mes.json` | sí | 0.0855 MiB |
| ventasClienteTotales | `data/business/agregados/ventas_cliente_totales.json` | sí | 1.1195 MiB |
| productos | `data/business/productos.json` | sí | 0.0184 MiB |
| calendario | `data/business/calendario.json` | sí | 0.0039 MiB |

**Total inicial conocido:** 1.5631 MiB

## Carga bajo demanda

| Clave | Archivo | Existe | Tamaño |
|---|---:|---:|---:|
| clientesGeo | `data/business/clientes.geojson` | sí | 1.3268 MiB |
| ventasDepartamentoMes | `data/business/agregados/ventas_departamento_mes.json` | sí | 2.3371 MiB |
| ventasProductoMes | `data/business/agregados/ventas_producto_mes.json` | sí | 0.5665 MiB |
| ventasMensualesCsv | `data/business/ventas_mensuales.csv` | sí | 14.0001 MiB |

**Total lazy conocido:** 18.2304 MiB

## Validación anti-regresión

- `clientes.geojson` sigue bajo demanda.
- `ventas_mensuales.csv` sigue bajo demanda.
- No hay `radios.geojson` en carga inicial.
- Las capas provinciales siguen resolviéndose desde `provincias_index.json` y se cargan cuando corresponde.

## Top 20 assets de public/data

1. `data/business/ventas_mensuales.csv` — 14.0001 MiB · business
2. `data/localidades_poligonos_fracciones.geojson` — 9.7286 MiB · territorial
3. `data/provincias/provincia_14_cordoba/radios.geojson` — 9.2504 MiB · radios
4. `data/provincias/provincia_82_santa_fe/radios.geojson` — 7.4155 MiB · radios
5. `data/provincias/provincia_02_ciudad_autonoma_de_buenos_aires/radios.geojson` — 5.2865 MiB · radios
6. `data/provincias/provincia_30_entre_rios/radios.geojson` — 4.5437 MiB · radios
7. `data/provincias/provincia_06_buenos_aires/puntos.geojson` — 4.0444 MiB · localidades_puntos
8. `data/provincias/provincia_06_buenos_aires/fracciones.geojson` — 3.6878 MiB · fracciones
9. `data/localidades_poligonos_gobiernos_locales.geojson` — 3.4197 MiB · territorial
10. `data/provincias/provincia_50_mendoza/radios.geojson` — 3.2745 MiB · radios
11. `data/provincias/provincia_90_tucuman/radios.geojson` — 3.1884 MiB · radios
12. `data/provincias/provincia_18_corrientes/radios.geojson` — 2.801 MiB · radios
13. `data/provincias/provincia_54_misiones/radios.geojson` — 2.8009 MiB · radios
14. `data/provincias/provincia_22_chaco/radios.geojson` — 2.6899 MiB · radios
15. `data/provincias/provincia_66_salta/radios.geojson` — 2.5742 MiB · radios
16. `data/provincias/provincia_14_cordoba/puntos.geojson` — 2.4898 MiB · localidades_puntos
17. `data/business/agregados/ventas_departamento_mes.json` — 2.3371 MiB · business
18. `data/provincias/provincia_06_buenos_aires/radios/d_06427.geojson` — 2.2565 MiB · territorial
19. `data/provincias/provincia_62_rio_negro/radios.geojson` — 1.7055 MiB · radios
20. `data/provincias/provincia_82_santa_fe/puntos.geojson` — 1.6862 MiB · localidades_puntos

## Radios nacionales

- Archivos `radios.geojson` publicados: 23
- Tamaño total aproximado de radios: 59.6659 MiB
- Decisión V10.4: no cargarlos al inicio; mantenerlos como capas bajo demanda o preparar particionado/R2 en fases posteriores si el crecimiento lo requiere.
