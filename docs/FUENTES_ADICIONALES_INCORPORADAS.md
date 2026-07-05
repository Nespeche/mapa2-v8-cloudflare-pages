# Fuentes adicionales incorporadas al builder

## Oficiales nacionales

- Georef / Datos Argentina: base completa para provincias, departamentos, municipios, gobiernos locales, localidades, localidades censales y asentamientos.
- INDEC Censo 2022: resumen nacional/provincial, gobiernos locales y cuadros estadísticos por jurisdicción.
- INDEC REDATAM Censo 2022: extracción procesada para localidades y otras desagregaciones no disponibles como CSV único nacional.
- INDEC Geoportal / GeoNode: fracciones censales y radios censales 2022 cuando estén disponibles por capa/provincia.
- REFEGLO: registro oficial de gobiernos locales.

## Oficiales parciales

- Buenos Aires Data: barrios oficiales de CABA y población por barrio cuando el dataset indique año censal.
- RENABAP: barrios populares registrados. No representa todos los barrios de Argentina.

## Complementarias no oficiales o mixtas

- Geofabrik/OpenStreetMap Argentina: barrios/neighbourhoods y límites comunitarios cuando no exista fuente oficial. Deben marcarse como `no_oficial` y validarse.
- Portales provinciales/municipales: barrios locales oficiales o administrativos; deben marcarse como `provincial` o `municipal`.

## Regla de prioridad de fuentes

1. INDEC / Georef / REFEGLO con código oficial.
2. Fuente provincial o municipal oficial con geometría y metadatos.
3. REDATAM exportado y documentado.
4. RENABAP para barrios populares, solo como universo parcial.
5. OSM/Geofabrik para cobertura complementaria, nunca como reemplazo oficial.
6. Estimaciones por radios censales con método explícito.
