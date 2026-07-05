# Diagnóstico de alineación y cobertura

Generado: 2026-07-04T22:27:06.500120+00:00

## Normalización aplicada

- Nombres normalizados: 2,370
- Provincia inferida por prefijo de código: 54
- Departamento inferido por prefijo de código: 0
- Relaciones padre/hijo insertadas o verificadas: 2,369

## Cobertura por jerarquía

| tipo_entidad   |   entidades |   con_codigo_indec |   con_codigo_georef |   con_codigo_refeglo |   con_centroide |   con_geom_wkt |   con_poblacion_2022 |   poblacion_oficial_directa |   poblacion_oficial_procesada |   poblacion_estimada |   relaciones_padre |   relaciones_huerfanas |
|:---------------|------------:|-------------------:|--------------------:|---------------------:|----------------:|---------------:|---------------------:|----------------------------:|------------------------------:|---------------------:|-------------------:|-----------------------:|
| gobierno_local |        2345 |               2291 |                   0 |                 2345 |            2304 |              0 |                 2291 |                        2291 |                             0 |                    0 |               2345 |                      0 |
| pais           |           1 |                  1 |                   1 |                    0 |               0 |              0 |                    1 |                           1 |                             0 |                    0 |                  0 |                      0 |
| provincia      |          24 |                 24 |                  24 |                    0 |              24 |              0 |                   24 |                          24 |                             0 |                    0 |                 24 |                      0 |

## Control poblacional

- Población total país: 45,892,285
- Suma provincias: 45,892,285
- Diferencia país vs provincias: 0
- Suma gobiernos locales: 45,892,285
- Nota: Control informativo: gobiernos locales no siempre son una partición simple equivalente a provincias/departamentos.

## GeoPackage

| table_name                 |   registros |
|:---------------------------|------------:|
| entidades_mapa             |       94542 |
| georef_aglomerados         |         119 |
| georef_asentamientos       |       14466 |
| georef_departamentos       |         529 |
| georef_fracciones_censales |        6571 |
| georef_gobiernos_locales   |        2280 |
| georef_localidades         |        4028 |
| georef_municipios          |          10 |
| georef_provincias          |          24 |
| georef_radios_censales     |       66515 |

## Faltantes y acciones recomendadas

| severidad   | categoria               | entidad_tipo                |   cantidad |
|:------------|:------------------------|:----------------------------|-----------:|
| alta        | fuente_no_materializada | departamento_partido_comuna |          1 |
| alta        | fuente_no_materializada | localidad_censal            |          1 |
| informativa | fuente_no_materializada | barrio                      |          1 |
| informativa | fuente_no_materializada | barrio_popular              |          1 |
| media       | fuente_no_materializada | fraccion_censal             |          1 |
| media       | fuente_no_materializada | localidad                   |          1 |
| media       | fuente_no_materializada | municipio                   |          1 |
| media       | fuente_no_materializada | radio_censal                |          1 |
| media       | poblacion_2022          | gobierno_local              |         54 |

### Primeros faltantes detectados

| severidad   | categoria               | entidad_tipo                | id_entidad            | descripcion                                                                               | accion_recomendada                                                                                               |
|:------------|:------------------------|:----------------------------|:----------------------|:------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------|
| alta        | fuente_no_materializada | departamento_partido_comuna | nan                   | La jerarquía departamento_partido_comuna no está materializada en la base semilla actual. | Descargar Georef departamentos y vincular con Censo 2022 por departamento/partido/comuna.                        |
| media       | fuente_no_materializada | municipio                   | nan                   | La jerarquía municipio no está materializada en la base semilla actual.                   | Descargar Georef municipios; cruzar con gobiernos locales cuando corresponda.                                    |
| media       | fuente_no_materializada | localidad                   | nan                   | La jerarquía localidad no está materializada en la base semilla actual.                   | Descargar Georef localidades; usar BAHRA/Georef y relación provincia/departamento/localidad.                     |
| alta        | fuente_no_materializada | localidad_censal            | nan                   | La jerarquía localidad_censal no está materializada en la base semilla actual.            | Descargar Georef localidades_censales; importar población desde REDATAM/Codgeo exportado.                        |
| media       | fuente_no_materializada | fraccion_censal             | nan                   | La jerarquía fraccion_censal no está materializada en la base semilla actual.             | Descargar o importar fracciones censales INDEC/Georef v2 si están disponibles.                                   |
| media       | fuente_no_materializada | radio_censal                | nan                   | La jerarquía radio_censal no está materializada en la base semilla actual.                | Descargar o importar radios censales INDEC/Georef v2 si están disponibles; necesario para estimar barrios.       |
| informativa | fuente_no_materializada | barrio                      | nan                   | La jerarquía barrio no está materializada en la base semilla actual.                      | Incorporar capas oficiales municipales/provinciales o OSM como no oficial.                                       |
| informativa | fuente_no_materializada | barrio_popular              | nan                   | La jerarquía barrio_popular no está materializada en la base semilla actual.              | Incorporar RENABAP como capa parcial de barrios populares.                                                       |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:303196 | Entidad sin población censal 2022 vinculada: Antelo.                                      | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302864 | Entidad sin población censal 2022 vinculada: Arroyo Corralito.                            | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302274 | Entidad sin población censal 2022 vinculada: Arroyo del Medio - El Gramiyal.              | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349035 | Entidad sin población censal 2022 vinculada: Banco Payaguá.                               | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349049 | Entidad sin población censal 2022 vinculada: Bartolomé de las Casas.                      | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302334 | Entidad sin población censal 2022 vinculada: Chañar.                                      | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309435 | Entidad sin población censal 2022 vinculada: Colonia Oficial N° 13.                       | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309655 | Entidad sin población censal 2022 vinculada: Colonia Reffino.                             | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349056 | Entidad sin población censal 2022 vinculada: Colonia Sarmiento.                           | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309325 | Entidad sin población censal 2022 vinculada: Costa San Antonio.                           | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309335 | Entidad sin población censal 2022 vinculada: Costa Uruguay Sur.                           | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309530 | Entidad sin población censal 2022 vinculada: Crucesitas Séptima.                          | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309535 | Entidad sin población censal 2022 vinculada: Crucesitas Tercera.                          | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:625007 | Entidad sin población censal 2022 vinculada: Cubanea.                                     | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309275 | Entidad sin población censal 2022 vinculada: Distrito Cuarto.                             | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309285 | Entidad sin población censal 2022 vinculada: Distrito Quinto .                            | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309543 | Entidad sin población censal 2022 vinculada: Distrito Sauce.                              | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302920 | Entidad sin población censal 2022 vinculada: Eigenfeld Merou.                             | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349126 | Entidad sin población censal 2022 vinculada: El Potrillo.                                 | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349063 | Entidad sin población censal 2022 vinculada: El Recreo.                                   | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309295 | Entidad sin población censal 2022 vinculada: Estación Lazo.                               | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302509 | Entidad sin población censal 2022 vinculada: Faustino M. Parera - Pastor Britos.          | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349070 | Entidad sin población censal 2022 vinculada: Fortin Sargento 1° Leyes.                    | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:540199 | Entidad sin población censal 2022 vinculada: Fracrán.                                     | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309300 | Entidad sin población censal 2022 vinculada: González Calderón.                           | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302224 | Entidad sin población censal 2022 vinculada: Gualeguaycito .                              | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:386164 | Entidad sin población censal 2022 vinculada: Jama.                                        | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349077 | Entidad sin población censal 2022 vinculada: Juan Gregorio Bazán.                         | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302035 | Entidad sin población censal 2022 vinculada: La Clarita.                                  | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309235 | Entidad sin población censal 2022 vinculada: La Esmeralda.                                | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302348 | Entidad sin población censal 2022 vinculada: La Verbena.                                  | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349098 | Entidad sin población censal 2022 vinculada: Laguna Gallo.                                | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309470 | Entidad sin población censal 2022 vinculada: Las Toscas.                                  | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:303168 | Entidad sin población censal 2022 vinculada: Libaros .                                    | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309210 | Entidad sin población censal 2022 vinculada: Loma Limpia (El Gato).                       | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349014 | Entidad sin población censal 2022 vinculada: Mariano Boedo.                               | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349021 | Entidad sin población censal 2022 vinculada: Mojón de Fierro.                             | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309900 | Entidad sin población censal 2022 vinculada: Molino Doll.                                 | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309305 | Entidad sin población censal 2022 vinculada: Monte Redondo.                               | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309905 | Entidad sin población censal 2022 vinculada: Montoya.                                     | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302308 | Entidad sin población censal 2022 vinculada: Nueva Vizcaya.                               | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349112 | Entidad sin población censal 2022 vinculada: Palma Sola.                                  | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309385 | Entidad sin población censal 2022 vinculada: Perdices.                                    | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349105 | Entidad sin población censal 2022 vinculada: Portón Negro.                                | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349084 | Entidad sin población censal 2022 vinculada: Posta Cambio Zalazar.                        | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349007 | Entidad sin población censal 2022 vinculada: Pozo del Mortero.                            | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309310 | Entidad sin población censal 2022 vinculada: Punta del Monte.                             | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:349091 | Entidad sin población censal 2022 vinculada: San Martín I.                                | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309005 | Entidad sin población censal 2022 vinculada: San Miguel .                                 | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:302259 | Entidad sin población censal 2022 vinculada: San Pedro.                                   | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309225 | Entidad sin población censal 2022 vinculada: Santa Lucía.                                 | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |
| media       | poblacion_2022          | gobierno_local              | gobierno_local:309830 | Entidad sin población censal 2022 vinculada: Sauce Sur.                                   | Importar cuadro oficial si existe; si es barrio, estimar por overlay con radios censales y marcar como estimada. |

## Interpretación

- `oficial_directa`: el dato proviene de una fuente oficial sin estimación propia.
- `oficial_procesada`: el dato proviene de una fuente oficial, pero fue exportado/procesado para poder vincularlo.
- `oficial_parcial`: fuente oficial pero no cubre todo el universo nacional, por ejemplo RENABAP o barrios CABA.
- `estimada`: población calculada por overlay espacial, especialmente barrios contra radios censales.
- `no_oficial`: complemento como OSM; nunca pisa una fuente oficial.