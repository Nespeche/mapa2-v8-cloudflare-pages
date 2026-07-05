# Fuentes y cobertura

## Fuentes oficiales primarias

### Georef / Datos Argentina

Uso: geometrías y códigos normalizados de provincias, departamentos, municipios, gobiernos locales, localidades, localidades censales y asentamientos.

Recursos esperados:

- `provincias`
- `departamentos`
- `municipios`
- `gobiernos-locales`
- `localidades`
- `localidades_censales`
- `asentamientos`

Prioridad de formato:

1. NDJSON
2. GeoJSON
3. Shapefile ZIP

### INDEC Censo 2022

Uso: población total, viviendas, sexo registrado al nacer y cuadros territoriales.

Fuentes cargadas por defecto:

- `c2022_tp_c_resumen.xlsx`: total país y provincias.
- `c2022_tp_gobierno_local_c1.xlsx`: gobiernos locales.
- Cuadros provinciales `c2022_<provincia>_est_c2_<n>.xlsx`: departamento/partido/comuna.
- Exportaciones REDATAM para localidades/localidades censales cuando no haya un CSV plano nacional.

### REFEGLO

Uso: registro de gobiernos locales y localidades administradas. Sirve para vincular gobiernos locales con localidades administradas y enriquecer categorías.

## Fuentes parciales / complementarias

### CABA barrios

Uso: polígonos oficiales de barrios de CABA y población por barrio cuando la publicación indique el año censal correspondiente.

### RENABAP

Uso: barrios populares. No representa todos los barrios de Argentina y no reemplaza a una capa censal de barrios.

### Municipios/provincias/OSM

Uso: completar barrios cuando no haya fuente nacional. Deben quedar marcados con `clasificacion_fuente='municipal'`, `provincial` o `no_oficial` en `fuente_catalogo`, y la población se calcula como estimación si no hay dato publicado.

## Niveles de confianza

- Alta: fuente oficial directa con código y geometría compatible.
- Media: fuente oficial parcial o dato procesado/recalculado.
- Baja: fuente no oficial o matching por nombre sin código.

## Limitaciones conocidas

1. No existe una única capa nacional oficial de todos los barrios con población censal 2022 directa.
2. Las localidades pueden tener representación puntual o multipunto, no siempre polígono.
3. Algunos gobiernos locales y localidades requieren relaciones muchos-a-muchos.
4. Los radios censales tienen finalidad estadística; las estimaciones por overlay son aproximaciones.
