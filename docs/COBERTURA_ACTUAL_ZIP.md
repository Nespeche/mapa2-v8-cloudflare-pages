# Cobertura actual del ZIP

Este ZIP es un **constructor de base** y trae una **semilla verificable**, pero no trae materializados todos los polígonos y todos los censos del país dentro del archivo comprimido.

## Ya incluido en `data/output/arg_geo_censo_semilla.sqlite`

- País Argentina con población Censo 2022.
- 24 jurisdicciones/provincias con población Censo 2022.
- Gobiernos locales con población Censo 2022 desde el cuadro nacional de INDEC.
- REFEGLO para enriquecer gobiernos locales.
- Fuentes catalogadas y clasificación de confianza.

## No incluido materializado en el ZIP

- Polígonos completos de provincias, departamentos, municipios, gobiernos locales, localidades, localidades censales y asentamientos.
- Población Censo 2022 por todos los departamentos/partidos/comunas en tabla unificada final.
- Población Censo 2022 por todas las localidades/localidades censales en tabla plana nacional.
- Radios censales nacionales con población asociada.
- Barrios nacionales completos, porque no existe una capa nacional oficial homogénea de todos los barrios con población censal directa.

## Cómo se completa

1. `download_sources.py` descarga capas completas de Georef y archivos INDEC disponibles.
2. `build_full_gpkg.py` normaliza y arma una capa única lista para mapa.
3. `import_indec_departamentos.py` incorpora cuadros departamentales descargados.
4. `import_redatam_localidades.py` incorpora localidades exportadas desde REDATAM.
5. `import_barrios.py` incorpora barrios CABA, municipales, provinciales, RENABAP u OSM con clasificación.
6. `estimate_barrios_from_radios.py` estima población por barrio mediante radios censales cuando no haya dato directo.

## Clasificación obligatoria

- `oficial_directa`: dato oficial con geometría/código o cuadro censal directo.
- `oficial_procesada`: dato oficial reprocesado o exportado desde REDATAM.
- `oficial_parcial`: capa oficial que no cubre todo el universo nacional, por ejemplo RENABAP o barrios CABA.
- `municipal` / `provincial`: fuentes subnacionales.
- `no_oficial`: OSM u otras fuentes comunitarias.
- `estimada`: población calculada por overlay con radios censales.
