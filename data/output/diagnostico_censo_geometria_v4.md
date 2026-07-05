# Diagnóstico censal y geográfico v4

Generado: 2026-07-04T23:41:12.997266+00:00

## Decisión de modelo

- La app se simplifica a dos niveles visibles: **Provincia → Localidad**.
- Para no perder trazabilidad, cada entidad conserva `tipo_original` y `capa_original`.
- Departamentos, partidos, comunas, gobiernos locales, municipios, fracciones, radios y aglomerados se exponen al frontend como `display_tipo = localidad`.
- Las localidades y asentamientos puntuales se exponen como `app_localidades_puntos`; las entidades poligonales se exponen como `app_localidades_poligonos`.
- Para el encuadre web inicial se excluyen Antártida Argentina e Islas del Atlántico Sur de las capas app, pero se conserva la base completa enriquecida en las capas fuente.

## Cobertura por capa

| layer                       |   records |   invalid_before |   invalid_after |   empty |   missing_population |   population_sum |   excluded_from_web |
|:----------------------------|----------:|-----------------:|----------------:|--------:|---------------------:|-----------------:|--------------------:|
| georef_provincias           |        24 |                1 |               0 |       0 |                    0 |      4.58923e+07 |                   0 |
| georef_departamentos        |       529 |                0 |               0 |       0 |                    0 |      4.58923e+07 |                   0 |
| georef_municipios           |        10 |                0 |               0 |       0 |                    0 |      6.68177e+06 |                   0 |
| georef_gobiernos_locales    |      2280 |               22 |               0 |       0 |                    0 |      4.55603e+07 |                   0 |
| georef_aglomerados          |       119 |                7 |               0 |       0 |                    0 |      3.45167e+07 |                   0 |
| georef_fracciones_censales  |      6571 |                9 |               0 |       0 |                    0 |      4.58923e+07 |                   0 |
| georef_radios_censales      |     66515 |                8 |               0 |       0 |                    0 |      4.58923e+07 |                   0 |
| georef_localidades          |      4028 |                0 |               0 |       0 |                    0 |      4.58853e+07 |                   0 |
| georef_asentamientos        |     14466 |                0 |               0 |       0 |                    0 |      4.58923e+07 |                   0 |
| app_provincias              |        24 |                1 |               0 |       0 |                    0 |      4.58923e+07 |                   0 |
| app_localidades_poligonos   |     76018 |                0 |               0 |       0 |                    0 |      2.24432e+08 |                   6 |
| app_localidades_puntos      |     18470 |                0 |               0 |       0 |                    0 |      9.17764e+07 |                  24 |
| entidades_mapa_enriquecidas |     94542 |                0 |               0 |       0 |                    0 |      3.62106e+08 |                   0 |

## Métodos de población por capa

### georef_provincias
| metodo_dato          |   cantidad |
|:---------------------|-----------:|
| cuadro_resumen_indec |         24 |

### georef_departamentos
| metodo_dato                                                              |   cantidad |
|:-------------------------------------------------------------------------|-----------:|
| oficial_gobiernos_locales_overlay_departamental+residual_provincial_area |        379 |
| oficial_gobiernos_locales_directo_codigo                                 |        150 |

### georef_municipios
| metodo_dato                                       |   cantidad |
|:--------------------------------------------------|-----------:|
| estimacion_overlay_municipio_sobre_gobierno_local |         10 |

### georef_gobiernos_locales
| metodo_dato                 |   cantidad |
|:----------------------------|-----------:|
| cuadro_gobierno_local_indec |       2280 |

### georef_aglomerados
| metodo_dato                                      |   cantidad |
|:-------------------------------------------------|-----------:|
| estimacion_overlay_aglomerado_sobre_departamento |        119 |

### georef_fracciones_censales
| metodo_dato                                 |   cantidad |
|:--------------------------------------------|-----------:|
| estimacion_area_fraccion_sobre_departamento |       6571 |

### georef_radios_censales
| metodo_dato                              |   cantidad |
|:-----------------------------------------|-----------:|
| estimacion_area_radio_sobre_departamento |      66515 |

### georef_localidades
| metodo_dato                                      |   cantidad |
|:-------------------------------------------------|-----------:|
| estimacion_prorrateo_localidades_en_departamento |       4028 |

### georef_asentamientos
| metodo_dato                                        |   cantidad |
|:---------------------------------------------------|-----------:|
| estimacion_prorrateo_asentamientos_en_departamento |      14466 |

### app_provincias
| metodo_dato          |   cantidad |
|:---------------------|-----------:|
| cuadro_resumen_indec |         24 |

### app_localidades_poligonos
| metodo_dato                                                              |   cantidad |
|:-------------------------------------------------------------------------|-----------:|
| estimacion_area_radio_sobre_departamento                                 |      66513 |
| estimacion_area_fraccion_sobre_departamento                              |       6569 |
| cuadro_gobierno_local_indec                                              |       2280 |
| oficial_gobiernos_locales_overlay_departamental+residual_provincial_area |        377 |
| oficial_gobiernos_locales_directo_codigo                                 |        150 |
| estimacion_overlay_aglomerado_sobre_departamento                         |        119 |
| estimacion_overlay_municipio_sobre_gobierno_local                        |         10 |

### app_localidades_puntos
| metodo_dato                                        |   cantidad |
|:---------------------------------------------------|-----------:|
| estimacion_prorrateo_asentamientos_en_departamento |      14443 |
| estimacion_prorrateo_localidades_en_departamento   |       4027 |

### entidades_mapa_enriquecidas
| metodo_dato                                                              |   cantidad |
|:-------------------------------------------------------------------------|-----------:|
| estimacion_area_radio_sobre_departamento                                 |      66515 |
| estimacion_prorrateo_asentamientos_en_departamento                       |      14466 |
| estimacion_area_fraccion_sobre_departamento                              |       6571 |
| estimacion_prorrateo_localidades_en_departamento                         |       4028 |
| cuadro_gobierno_local_indec                                              |       2280 |
| oficial_gobiernos_locales_overlay_departamental+residual_provincial_area |        379 |
| oficial_gobiernos_locales_directo_codigo                                 |        150 |
| estimacion_overlay_aglomerado_sobre_departamento                         |        119 |
| cuadro_resumen_indec                                                     |         24 |
| estimacion_overlay_municipio_sobre_gobierno_local                        |         10 |

## Controles provincia/departamentos

| provincia_id   | provincia                                             |   poblacion_provincia |   suma_departamentos |   diferencia |   departamentos |
|:---------------|:------------------------------------------------------|----------------------:|---------------------:|-------------:|----------------:|
| provincia:02   | Ciudad Autónoma de Buenos Aires                       |               3121707 |              3121707 |            0 |              15 |
| provincia:58   | Neuquén                                               |                710814 |               710814 |            0 |              16 |
| provincia:74   | San Luis                                              |                542069 |               542069 |            0 |               9 |
| provincia:82   | Santa Fe                                              |               3544908 |              3544908 |            0 |              19 |
| provincia:46   | La Rioja                                              |                383865 |               383865 |            0 |              18 |
| provincia:10   | Catamarca                                             |                429562 |               429562 |            0 |              16 |
| provincia:90   | Tucumán                                               |               1731820 |              1731820 |            0 |              17 |
| provincia:22   | Chaco                                                 |               1129606 |              1129606 |            0 |              25 |
| provincia:34   | Formosa                                               |                607419 |               607419 |            0 |               9 |
| provincia:78   | Santa Cruz                                            |                337226 |               337226 |            0 |               7 |
| provincia:26   | Chubut                                                |                592621 |               592621 |            0 |              15 |
| provincia:50   | Mendoza                                               |               2043540 |              2043540 |            0 |              18 |
| provincia:30   | Entre Ríos                                            |               1425578 |              1425578 |            0 |              17 |
| provincia:70   | San Juan                                              |                822853 |               822853 |            0 |              19 |
| provincia:38   | Jujuy                                                 |                811611 |               811611 |            0 |              16 |
| provincia:86   | Santiago del Estero                                   |               1060906 |              1060906 |            0 |              27 |
| provincia:62   | Río Negro                                             |                750768 |               750768 |            0 |              13 |
| provincia:18   | Corrientes                                            |               1212696 |              1212696 |            0 |              25 |
| provincia:54   | Misiones                                              |               1278873 |              1278873 |            0 |              17 |
| provincia:66   | Salta                                                 |               1441351 |              1441351 |            0 |              23 |
| provincia:14   | Córdoba                                               |               3840905 |              3840905 |            0 |              26 |
| provincia:06   | Buenos Aires                                          |              17523996 |             17523996 |            0 |             135 |
| provincia:42   | La Pampa                                              |                361859 |               361859 |            0 |              22 |
| provincia:94   | Tierra del Fuego, Antártida e Islas del Atlántico Sur |                185732 |               185732 |            0 |               5 |

## Fuentes y reglas usadas

| fuente                                   | uso                                                                                                            | estado                |
|:-----------------------------------------|:---------------------------------------------------------------------------------------------------------------|:----------------------|
| INDEC Censo 2022 resumen/provincias      | Población oficial directa de país y provincias.                                                                | incluida_en_zip       |
| INDEC Censo 2022 gobiernos locales       | Población oficial directa de gobiernos locales; base para agregación departamental.                            | incluida_en_zip       |
| Georef / IGN / BAHRA / INDEC cartografía | Geometrías y códigos oficiales de provincias, departamentos, localidades, radios/fracciones y otras entidades. | incluida_en_zip       |
| Estimación por overlay/área/prorrateo    | Completar población en capas sin dato censal directo para habilitar tooltips y modos de mapa.                  | calculada_en_pipeline |

## Interpretación para terminal

- `missing_population = 0` indica que la capa quedó utilizable para tooltip/coroplético/calor/cluster según su geometría.
- `oficial_directa` se usa cuando el dato ya venía vinculado en la capa o en la semilla censal.
- `oficial_procesada` se usa cuando la población oficial se agrega o cruza contra otra geometría oficial.
- `estimada` se usa cuando no existe dato directo para esa geometría y se prorratea por área o por cantidad de entidades dentro de su padre.
- Los barrios no se inventan: el modelo queda preparado para importarlos, pero en este ZIP no había una capa nacional de barrios. Los asentamientos sí quedan como puntos tipo localidad.