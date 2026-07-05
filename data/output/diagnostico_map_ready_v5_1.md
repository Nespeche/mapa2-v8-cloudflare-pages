# Diagnóstico Map Ready V5.1 — Cloudflare Fix

Generado: 2026-07-05T15:49:40.332653+00:00

Estado final del export V5.1: **OK**

## Objetivo

La V5.1 corrige la V5 Map Ready para que los assets publicados en `public/` sean compatibles con Cloudflare Pages Free, sin avanzar a V6 y sin modificar la lógica censal validada.

## Problema corregido

- Archivo problemático V5: `public/data/provincias/provincia_06_buenos_aires/radios.geojson`.
- Peso original: `35.166 MB`.
- Corrección: partición de radios censales de Buenos Aires por departamento/partido con nombres cortos `d_<codigo>.geojson`.
- Particiones generadas: `135`.
- Radios conservados: `23901`.
- Población conservada: `17523996`.
- Peso máximo de partición: `2.424 MB`.
- Índice: `provincias/provincia_06_buenos_aires/radios/index.json`.

## Corrección preventiva

- `localidades_puntos.geojson` nacional se retiró del bundle público como archivo monolítico.
- Peso original: `24.762 MB`.
- Los puntos se conservan completos por provincia y se indexan en `public/data/indexes/localidades_puntos_index.json`.

## Capas principales

| layer              | archivo_nacional                                |   features |   size_mb | aditiva   |   pop_sum | loading                                                                                                                                                    |
|:-------------------|:------------------------------------------------|-----------:|----------:|:----------|----------:|:-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| provincias         | provincias.geojson                              |         24 |     0.241 | True      |  45892285 | Cargar al iniciar la app.                                                                                                                                  |
| departamentos      | localidades_poligonos_departamentos.geojson     |        529 |     1.73  | True      |  45892285 | Cargar el archivo nacional si el frontend lo tolera; preferir archivo por provincia luego del click.                                                       |
| gobiernos_locales  | localidades_poligonos_gobiernos_locales.geojson |       2280 |     3.756 | False     |  45560279 | Cargar por provincia bajo demanda.                                                                                                                         |
| municipios         | localidades_poligonos_municipios.geojson        |         10 |     0.051 | False     |   6681774 | Cargar por provincia bajo demanda.                                                                                                                         |
| aglomerados        | localidades_poligonos_aglomerados.geojson       |        119 |     0.254 | False     |  34516748 | Cargar bajo demanda; preferir por provincia representante.                                                                                                 |
| fracciones         | localidades_poligonos_fracciones.geojson        |       6571 |    10.611 | True      |  45892285 | No cargar nacional por defecto; cargar por provincia o por bounding box.                                                                                   |
| radios             | no publicado/indexado                           |      66515 |     0     | True      |  45892285 | Cargar por provincia bajo demanda. Para Buenos Aires, cargar radios por departamento/partido desde provincias/provincia_06_buenos_aires/radios/index.json. |
| localidades_puntos | no publicado/indexado                           |      18470 |     0     | False     |  91776372 | No publicar/cargar archivo nacional. Usar indexes/localidades_puntos_index.json y puntos.geojson por provincia.                                            |

## Auditoría de archivos en public/

- Cantidad de archivos en `public/`: `294`.
- Archivo más pesado: `data/localidades_poligonos_fracciones.geojson` — `10.611 MiB`.
- Archivos > 25 MiB: `0`.
- Archivos entre 20 y 25 MiB: `0`.
- Archivos entre 15 y 20 MiB: `0`.

### Top archivos por peso

| relative_path                                                                          |   size_mib |   size_bytes |
|:---------------------------------------------------------------------------------------|-----------:|-------------:|
| data/localidades_poligonos_fracciones.geojson                                          |     10.611 |     11126930 |
| data/provincias/provincia_14_cordoba/radios.geojson                                    |      9.932 |     10414797 |
| data/provincias/provincia_82_santa_fe/radios.geojson                                   |      7.963 |      8349606 |
| data/provincias/provincia_02_ciudad_autonoma_de_buenos_aires/radios.geojson            |      5.663 |      5937870 |
| data/provincias/provincia_30_entre_rios/radios.geojson                                 |      4.888 |      5125132 |
| data/provincias/provincia_06_buenos_aires/puntos.geojson                               |      4.297 |      4505899 |
| data/provincias/provincia_06_buenos_aires/fracciones.geojson                           |      3.988 |      4181471 |
| data/localidades_poligonos_gobiernos_locales.geojson                                   |      3.756 |      3937937 |
| data/provincias/provincia_50_mendoza/radios.geojson                                    |      3.516 |      3686937 |
| data/provincias/provincia_90_tucuman/radios.geojson                                    |      3.423 |      3588837 |
| data/provincias/provincia_18_corrientes/radios.geojson                                 |      3.013 |      3159805 |
| data/provincias/provincia_54_misiones/radios.geojson                                   |      3.01  |      3156477 |
| data/provincias/provincia_22_chaco/radios.geojson                                      |      2.89  |      3030558 |
| data/provincias/provincia_66_salta/radios.geojson                                      |      2.77  |      2904702 |
| data/provincias/provincia_14_cordoba/puntos.geojson                                    |      2.647 |      2775101 |
| data/provincias/provincia_06_buenos_aires/radios/d_06427.geojson |      2.424 |      2542223 |
| data/provincias/provincia_62_rio_negro/radios.geojson                                  |      1.834 |      1923444 |
| data/provincias/provincia_82_santa_fe/puntos.geojson                                   |      1.792 |      1879056 |
| data/provincias/provincia_86_santiago_del_estero/puntos.geojson                        |      1.784 |      1870863 |
| data/localidades_poligonos_departamentos.geojson                                       |      1.73  |      1813573 |

## Reglas de carga recomendadas

- Vista nacional: `provincias.geojson`.
- Click en provincia: usar `provincias/<provincia>/departamentos.geojson`.
- Zoom alto: usar fracciones por provincia o radios bajo demanda.
- Buenos Aires radios: usar `provincias/provincia_06_buenos_aires/radios/index.json` y cargar un partido/departamento por vez.
- Puntos/localidades: usar `indexes/localidades_puntos_index.json` y archivos `puntos.geojson` por provincia.
- Coroplético: usar una sola jerarquía aditiva por vez.

## Errores

- Sin errores bloqueantes.

## Advertencias

- Sin advertencias.

## Resultado

V5.1 queda limitada a corrección Cloudflare. No se generaron clientes ficticios, ventas ni frontend completo.


## Corrección Windows Safe ZIP

- Carpeta raíz sugerida del ZIP: `m2_v51_cf`.
- Particiones de radios de Buenos Aires renombradas a `d_<codigo>.geojson`.
- Motivo: evitar el error de Windows `0x80010135: Ruta de acceso demasiado larga`.
