# Diagnóstico Map Ready V5
Generado: 2026-07-05T03:19:26.359874+00:00
Estado final del export: **WARN**

## Objetivo de V5
La V5 separa las capas poligonales por nivel de render para evitar doble conteo. La regla principal es usar una sola jerarquía aditiva por coroplético o suma poblacional.

## Archivos nacionales generados
| layer_id           |   features | geom                  |   size_mb |   pop_sum | aditiva   | diff      |   simpl_deg | uso                                                                                                                                           |
|:-------------------|-----------:|:----------------------|----------:|----------:|:----------|:----------|------------:|:----------------------------------------------------------------------------------------------------------------------------------------------|
| provincias         |         24 | MultiPolygon, Polygon |     0.241 |  45892285 | sí        | 0         |     0.005   | Vista nacional, coroplético provincial e inicio del drill-down.                                                                               |
| departamentos      |        529 | MultiPolygon, Polygon |     1.73  |  45892285 | sí        | 0         |     0.002   | Click en provincia; coroplético por departamentos, partidos y comunas. Es la jerarquía poligonal aditiva recomendada para drill-down inicial. |
| gobiernos_locales  |       2280 | MultiPolygon, Polygon |     3.756 |  45560279 | no        | no aplica |     0.0015  | Zoom intermedio y lectura administrativa local cuando exista cobertura. No usar para suma nacional.                                           |
| municipios         |         10 | MultiPolygon, Polygon |     0.051 |   6681774 | no        | no aplica |     0.001   | Overlay administrativo cuando la geometría municipal existe. No usar para suma nacional.                                                      |
| aglomerados        |        119 | MultiPolygon, Polygon |     0.254 |  34516748 | no        | no aplica |     0.001   | Overlay urbano/metropolitano. No usar para suma nacional porque puede cruzar jurisdicciones y superponerse.                                   |
| fracciones         |       6571 | MultiPolygon, Polygon |    10.611 |  45892285 | sí        | 0         |     0.0007  | Zoom alto y coroplético de mayor detalle. Es aditiva si se usa como única jerarquía.                                                          |
| radios             |      66515 | MultiPolygon, Polygon |     0     |  45892285 | sí        | 0         |     0.00045 | Máximo detalle censal. Es aditiva si se usa como única jerarquía, pero no debe cargarse nacionalmente en el navegador.                        |
| localidades_puntos |      18470 | Point                 |    24.762 |  91776372 | no        | no aplica |     0       | Puntos para tooltips, clusters y heatmap. No sumar población porque contiene localidades y asentamientos superpuestos.                        |

## Reglas de uso frontend
- Vista nacional: `provincias.geojson`.
- Drill-down al hacer click en provincia: `departamentos.geojson` por provincia, o archivo nacional de departamentos si el frontend lo tolera.
- Zoom intermedio: gobiernos locales / municipios, siempre como render layer no aditiva salvo validación posterior.
- Zoom alto: fracciones o radios; cargar por provincia o área visible.
- Puntos, clusters y heatmap: `localidades_puntos.geojson`; no usar como suma poblacional.
- Coroplético: usar una sola jerarquía a la vez. No mezclar departamentos + radios + fracciones.

## Capas aditivas y no aditivas

### provincias
- Archivo nacional: `provincias.geojson`
- Fuente GPKG: `app_provincias`
- Aditiva: `True` / no_aditiva: `False`
- Features: `24`
- Población total: `45892285`
- Diferencia contra población nacional esperada: `0`
- Simplificación aplicada: `0.005` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Vista nacional, coroplético provincial e inicio del drill-down.
- Estrategia de carga: Cargar al iniciar la app.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato          |   features |
|:---------------------|-----------:|
| cuadro_resumen_indec |         24 |

### departamentos
- Archivo nacional: `localidades_poligonos_departamentos.geojson`
- Fuente GPKG: `georef_departamentos`
- Aditiva: `True` / no_aditiva: `False`
- Features: `529`
- Población total: `45892285`
- Diferencia contra población nacional esperada: `0`
- Simplificación aplicada: `0.002` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Click en provincia; coroplético por departamentos, partidos y comunas. Es la jerarquía poligonal aditiva recomendada para drill-down inicial.
- Estrategia de carga: Cargar el archivo nacional si el frontend lo tolera; preferir archivo por provincia luego del click.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                                                              |   features |
|:-------------------------------------------------------------------------|-----------:|
| oficial_gobiernos_locales_overlay_departamental+residual_provincial_area |        379 |
| oficial_gobiernos_locales_directo_codigo                                 |        150 |

### gobiernos_locales
- Archivo nacional: `localidades_poligonos_gobiernos_locales.geojson`
- Fuente GPKG: `georef_gobiernos_locales`
- Aditiva: `False` / no_aditiva: `True`
- Features: `2280`
- Población total: `45560279`
- Simplificación aplicada: `0.0015` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Zoom intermedio y lectura administrativa local cuando exista cobertura. No usar para suma nacional.
- Estrategia de carga: Cargar por provincia bajo demanda.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                 |   features |
|:----------------------------|-----------:|
| cuadro_gobierno_local_indec |       2280 |

### municipios
- Archivo nacional: `localidades_poligonos_municipios.geojson`
- Fuente GPKG: `georef_municipios`
- Aditiva: `False` / no_aditiva: `True`
- Features: `10`
- Población total: `6681774`
- Simplificación aplicada: `0.001` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Overlay administrativo cuando la geometría municipal existe. No usar para suma nacional.
- Estrategia de carga: Cargar por provincia bajo demanda.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                                       |   features |
|:--------------------------------------------------|-----------:|
| estimacion_overlay_municipio_sobre_gobierno_local |         10 |

### aglomerados
- Archivo nacional: `localidades_poligonos_aglomerados.geojson`
- Fuente GPKG: `georef_aglomerados`
- Aditiva: `False` / no_aditiva: `True`
- Features: `119`
- Población total: `34516748`
- Simplificación aplicada: `0.001` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Overlay urbano/metropolitano. No usar para suma nacional porque puede cruzar jurisdicciones y superponerse.
- Estrategia de carga: Cargar bajo demanda; preferir por provincia representante.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                                      |   features |
|:-------------------------------------------------|-----------:|
| estimacion_overlay_aglomerado_sobre_departamento |        119 |

### fracciones
- Archivo nacional: `localidades_poligonos_fracciones.geojson`
- Fuente GPKG: `georef_fracciones_censales`
- Aditiva: `True` / no_aditiva: `False`
- Features: `6571`
- Población total: `45892285`
- Diferencia contra población nacional esperada: `0`
- Simplificación aplicada: `0.0007` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Zoom alto y coroplético de mayor detalle. Es aditiva si se usa como única jerarquía.
- Estrategia de carga: No cargar nacional por defecto; cargar por provincia o por bounding box.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                                 |   features |
|:--------------------------------------------|-----------:|
| estimacion_area_fraccion_sobre_departamento |       6571 |

### radios
- Archivo nacional: `no publicado; usar splits por provincia`
- Fuente GPKG: `georef_radios_censales`
- Aditiva: `True` / no_aditiva: `False`
- Features: `66515`
- Población total: `45892285`
- Diferencia contra población nacional esperada: `0`
- Simplificación aplicada: `0.00045` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Máximo detalle censal. Es aditiva si se usa como única jerarquía, pero no debe cargarse nacionalmente en el navegador.
- Estrategia de carga: Cargar exclusivamente por provincia/área visible. No se publica GeoJSON nacional de radios para mantener la V5 liviana en Cloudflare Free.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                              |   features |
|:-----------------------------------------|-----------:|
| estimacion_area_radio_sobre_departamento |      66515 |

### localidades_puntos
- Archivo nacional: `localidades_puntos.geojson`
- Fuente GPKG: `app_localidades_puntos`
- Aditiva: `False` / no_aditiva: `True`
- Features: `18470`
- Población total: `91776372`
- Simplificación aplicada: `0.0` grados; precisión coordenadas `6` decimales.
- Uso recomendado: Puntos para tooltips, clusters y heatmap. No sumar población porque contiene localidades y asentamientos superpuestos.
- Estrategia de carga: Cargar nacional si el peso es aceptable; para performance, preferir carga por provincia.
- Campos incluidos: `id_entidad, codigo_indec, codigo_georef, codigo_refeglo, nombre, nombre_normalizado, provincia_id, provincia_codigo, provincia_nombre, departamento_id, municipio_id, gobierno_local_id, localidad_id, poblacion_total, viviendas_total, anio_censo, fuente_censo, clasificacion_censo, metodo_dato, confianza_censo, tipo_original, capa_original, display_tipo, app_jerarquia, tooltip_nombre, tooltip_poblacion, nivel_map_ready, render_layer, aditiva, no_aditiva, uso_frontend, loading_strategy, metodo_provincia`
- Campos removidos desde fuente: `anio_fuente, clasificacion_fuente, fuente_geografica, metodo_geometria, modo_recomendado, nivel_confianza, source_resource, tipo_entidad`

Métodos de dato:

| metodo_dato                                        |   features |
|:---------------------------------------------------|-----------:|
| estimacion_prorrateo_asentamientos_en_departamento |      14443 |
| estimacion_prorrateo_localidades_en_departamento   |       4027 |

## Archivos por provincia
| provincia                                             | layer              |   features |   size_mb |
|:------------------------------------------------------|:-------------------|-----------:|----------:|
| Buenos Aires                                          | aglomerados        |         12 |     0.026 |
| Buenos Aires                                          | departamentos      |        135 |     0.283 |
| Buenos Aires                                          | fracciones         |       2772 |     3.988 |
| Buenos Aires                                          | gobiernos_locales  |        135 |     0.263 |
| Buenos Aires                                          | localidades_puntos |       3193 |     4.297 |
| Buenos Aires                                          | municipios         |          5 |     0.02  |
| Buenos Aires                                          | radios             |      23901 |    35.166 |
| Catamarca                                             | aglomerados        |          4 |     0.007 |
| Catamarca                                             | departamentos      |         16 |     0.046 |
| Catamarca                                             | fracciones         |         99 |     0.174 |
| Catamarca                                             | gobiernos_locales  |         36 |     0.078 |
| Catamarca                                             | localidades_puntos |        665 |     0.891 |
| Catamarca                                             | radios             |        693 |     1.068 |
| Chaco                                                 | aglomerados        |          1 |     0.002 |
| Chaco                                                 | departamentos      |         25 |     0.051 |
| Chaco                                                 | fracciones         |        203 |     0.316 |
| Chaco                                                 | gobiernos_locales  |         70 |     0.125 |
| Chaco                                                 | localidades_puntos |        887 |     1.19  |
| Chaco                                                 | radios             |       1947 |     2.89  |
| Chubut                                                | departamentos      |         15 |     0.048 |
| Chubut                                                | fracciones         |        117 |     0.217 |
| Chubut                                                | gobiernos_locales  |         47 |     0.074 |
| Chubut                                                | localidades_puntos |        384 |     0.513 |
| Chubut                                                | radios             |       1028 |     1.586 |
| Ciudad Autónoma de Buenos Aires                       | aglomerados        |          8 |     0.034 |
| Ciudad Autónoma de Buenos Aires                       | departamentos      |         15 |     0.027 |
| Ciudad Autónoma de Buenos Aires                       | fracciones         |        356 |     0.508 |
| Ciudad Autónoma de Buenos Aires                       | gobiernos_locales  |         15 |     0.026 |
| Ciudad Autónoma de Buenos Aires                       | localidades_puntos |         98 |     0.134 |
| Ciudad Autónoma de Buenos Aires                       | radios             |       3820 |     5.663 |
| Corrientes                                            | aglomerados        |          3 |     0.005 |
| Corrientes                                            | departamentos      |         25 |     0.08  |
| Corrientes                                            | fracciones         |        289 |     0.484 |
| Corrientes                                            | gobiernos_locales  |         75 |     0.158 |
| Corrientes                                            | localidades_puntos |        703 |     0.946 |
| Corrientes                                            | radios             |       1985 |     3.013 |
| Córdoba                                               | aglomerados        |         28 |     0.055 |
| Córdoba                                               | departamentos      |         26 |     0.07  |
| Córdoba                                               | fracciones         |        397 |     0.628 |
| Córdoba                                               | gobiernos_locales  |        427 |     0.655 |
| Córdoba                                               | localidades_puntos |       1980 |     2.647 |
| Córdoba                                               | municipios         |          2 |     0.009 |
| Córdoba                                               | radios             |       6720 |     9.932 |
| Entre Ríos                                            | aglomerados        |          3 |     0.006 |
| Entre Ríos                                            | departamentos      |         17 |     0.059 |
| Entre Ríos                                            | fracciones         |        302 |     0.548 |
| Entre Ríos                                            | gobiernos_locales  |        240 |     0.377 |
| Entre Ríos                                            | localidades_puntos |        851 |     1.145 |
| Entre Ríos                                            | radios             |       3224 |     4.888 |
| Formosa                                               | aglomerados        |          2 |     0.003 |
| Formosa                                               | departamentos      |          9 |     0.027 |
| Formosa                                               | fracciones         |        114 |     0.197 |
| Formosa                                               | gobiernos_locales  |         37 |     0.078 |
| Formosa                                               | localidades_puntos |        485 |     0.653 |
| Formosa                                               | radios             |        981 |     1.494 |
| Jujuy                                                 | aglomerados        |          2 |     0.005 |
| Jujuy                                                 | departamentos      |         16 |     0.04  |
| Jujuy                                                 | fracciones         |        114 |     0.187 |
| Jujuy                                                 | gobiernos_locales  |         63 |     0.11  |
| Jujuy                                                 | localidades_puntos |        582 |     0.777 |
| Jujuy                                                 | radios             |       1019 |     1.526 |
| La Pampa                                              | aglomerados        |          2 |     0.003 |
| La Pampa                                              | departamentos      |         22 |     0.038 |
| La Pampa                                              | fracciones         |        108 |     0.162 |
| La Pampa                                              | gobiernos_locales  |         80 |     0.119 |
| La Pampa                                              | localidades_puntos |        274 |     0.367 |
| La Pampa                                              | radios             |        904 |     1.34  |
| La Rioja                                              | departamentos      |         18 |     0.037 |
| La Rioja                                              | fracciones         |         54 |     0.088 |
| La Rioja                                              | gobiernos_locales  |         18 |     0.033 |
| La Rioja                                              | localidades_puntos |        535 |     0.717 |
| La Rioja                                              | radios             |        497 |     0.743 |
| Mendoza                                               | aglomerados        |          8 |     0.013 |
| Mendoza                                               | departamentos      |         18 |     0.048 |
| Mendoza                                               | fracciones         |        221 |     0.344 |
| Mendoza                                               | gobiernos_locales  |         18 |     0.045 |
| Mendoza                                               | localidades_puntos |        729 |     0.98  |
| Mendoza                                               | radios             |       2379 |     3.516 |
| Misiones                                              | aglomerados        |          8 |     0.012 |
| Misiones                                              | departamentos      |         17 |     0.05  |
| Misiones                                              | fracciones         |        217 |     0.358 |
| Misiones                                              | gobiernos_locales  |         77 |     0.138 |
| Misiones                                              | localidades_puntos |        590 |     0.793 |
| Misiones                                              | municipios         |          1 |     0.015 |
| Misiones                                              | radios             |       2012 |     3.01  |
| Neuquén                                               | aglomerados        |          2 |     0.017 |
| Neuquén                                               | departamentos      |         16 |     0.049 |
| Neuquén                                               | fracciones         |         74 |     0.137 |
| Neuquén                                               | gobiernos_locales  |         57 |     0.093 |
| Neuquén                                               | localidades_puntos |        478 |     0.637 |
| Neuquén                                               | radios             |       1075 |     1.634 |
| Río Negro                                             | aglomerados        |          2 |     0.004 |
| Río Negro                                             | departamentos      |         13 |     0.034 |
| Río Negro                                             | fracciones         |        125 |     0.207 |
| Río Negro                                             | gobiernos_locales  |         74 |     0.145 |
| Río Negro                                             | localidades_puntos |        489 |     0.657 |
| Río Negro                                             | municipios         |          1 |     0.005 |
| Río Negro                                             | radios             |       1215 |     1.834 |
| Salta                                                 | aglomerados        |          6 |     0.012 |
| Salta                                                 | departamentos      |         23 |     0.067 |
| Salta                                                 | fracciones         |        160 |     0.277 |
| Salta                                                 | gobiernos_locales  |         60 |     0.126 |
| Salta                                                 | localidades_puntos |        888 |     1.188 |
| Salta                                                 | radios             |       1830 |     2.77  |
| San Juan                                              | aglomerados        |          3 |     0.005 |
| San Juan                                              | departamentos      |         19 |     0.048 |
| San Juan                                              | fracciones         |        101 |     0.165 |
| San Juan                                              | gobiernos_locales  |         19 |     0.044 |
| San Juan                                              | localidades_puntos |        372 |     0.5   |
| San Juan                                              | radios             |        888 |     1.325 |
| San Luis                                              | aglomerados        |          3 |     0.007 |
| San Luis                                              | departamentos      |          9 |     0.028 |
| San Luis                                              | fracciones         |         87 |     0.14  |
| San Luis                                              | gobiernos_locales  |         67 |     0.096 |
| San Luis                                              | localidades_puntos |        449 |     0.597 |
| San Luis                                              | radios             |        894 |     1.341 |
| Santa Cruz                                            | departamentos      |          7 |     0.029 |
| Santa Cruz                                            | fracciones         |         57 |     0.12  |
| Santa Cruz                                            | gobiernos_locales  |         20 |     0.03  |
| Santa Cruz                                            | localidades_puntos |        199 |     0.265 |
| Santa Cruz                                            | radios             |        463 |     0.724 |
| Santa Fe                                              | aglomerados        |          7 |     0.015 |
| Santa Fe                                              | departamentos      |         19 |     0.056 |
| Santa Fe                                              | fracciones         |        238 |     0.382 |
| Santa Fe                                              | gobiernos_locales  |        365 |     0.548 |
| Santa Fe                                              | localidades_puntos |       1336 |     1.792 |
| Santa Fe                                              | radios             |       5386 |     7.963 |
| Santiago del Estero                                   | aglomerados        |          4 |     0.007 |
| Santiago del Estero                                   | departamentos      |         27 |     0.07  |
| Santiago del Estero                                   | fracciones         |        151 |     0.265 |
| Santiago del Estero                                   | gobiernos_locales  |        165 |     0.22  |
| Santiago del Estero                                   | localidades_puntos |       1339 |     1.784 |
| Santiago del Estero                                   | radios             |       1096 |     1.703 |
| Tierra del Fuego, Antártida e Islas del Atlántico Sur | departamentos      |          5 |     0.413 |
| Tierra del Fuego, Antártida e Islas del Atlántico Sur | fracciones         |         24 |     0.435 |
| Tierra del Fuego, Antártida e Islas del Atlántico Sur | gobiernos_locales  |          3 |     0.005 |
| Tierra del Fuego, Antártida e Islas del Atlántico Sur | localidades_puntos |         49 |     0.067 |
| Tierra del Fuego, Antártida e Islas del Atlántico Sur | radios             |        238 |     0.762 |
| Tucumán                                               | aglomerados        |         11 |     0.018 |
| Tucumán                                               | departamentos      |         17 |     0.039 |
| Tucumán                                               | fracciones         |        191 |     0.289 |
| Tucumán                                               | gobiernos_locales  |        112 |     0.174 |
| Tucumán                                               | localidades_puntos |        915 |     1.229 |
| Tucumán                                               | municipios         |          1 |     0.004 |
| Tucumán                                               | radios             |       2320 |     3.423 |

## Advertencias
- WARN: Split provincias/provincia_06_buenos_aires/radios.geojson pesa 35.166 MB; revisar simplificación/carga bajo demanda.

## Errores
- Sin errores bloqueantes en export.

## Resultado
Resultado final export V5: **WARN**. Ejecutar `python src\check_map_ready_v5.py --data-dir public\data --diag data\output\diagnostico_map_ready_v5.json` para validación independiente.

## Previews generadas

| preview | estado |
|---|---|
| `public/previews/v5_coropletico_argentina_provincias.png` | OK |
| `public/previews/v5_coropletico_buenos_aires_departamentos.png` | OK |
| `public/previews/v5_puntos_localidades_buenos_aires.png` | OK |
