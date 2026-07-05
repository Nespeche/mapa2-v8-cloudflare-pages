# Entradas manuales o semi-automatizadas

Algunas fuentes no tienen un CSV nacional plano único o requieren validación local. Colocar aquí esos insumos para integrarlos sin perder trazabilidad.

## Localidades REDATAM

Archivo esperado:

```text
data/manual/localidades_redatam/localidades_censo_2022.csv
```

Columnas:

```text
codigo_provincia,codigo_departamento,codigo_localidad_censal,nombre_localidad,poblacion_total,viviendas_total,fuente_url,fecha_extraccion
```

## Barrios

Directorio:

```text
data/manual/barrios/
```

Ejemplos:

- `caba_barrios.geojson`
- `renabap.geojson`
- `municipio_x_barrios.geojson`
- `osm_neighbourhoods.geojson`

Importar con `src/import_barrios.py` para que cada capa quede clasificada por fuente y nivel de confianza.

## Radios censales

Para estimaciones por overlay:

```text
data/manual/radios_censales_2022.geojson
data/manual/radios_poblacion_2022.csv
```

El CSV de población de radios debe tener al menos:

```text
codigo_radio,poblacion_total
```

Si la geometría usa otro campo de código, renombrarlo antes o adaptar el script.
