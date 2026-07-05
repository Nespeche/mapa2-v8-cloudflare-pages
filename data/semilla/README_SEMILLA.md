# Datos semilla incluidos

Archivos incluidos para comprobar parseo y esquema:

- `c2022_tp_c_resumen.xlsx`: resumen país/provincias Censo 2022.
- `c2022_tp_gobierno_local_c1.xlsx`: gobiernos locales Censo 2022.
- `datos-refeglo_25-09-2023.csv`: REFEGLO.
- `provincias_georef_centroides.csv`: centroides provinciales Georef para semilla.

La semilla no reemplaza las descargas completas de polígonos. Los polígonos se descargan con:

```bash
python src/download_sources.py --config config/sources.yml --raw-dir data/raw
```
