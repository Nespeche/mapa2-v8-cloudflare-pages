# Extracción segura en Windows — V5.1

Esta versión corrige el problema de extracción de Windows `0x80010135: Ruta de acceso demasiado larga`.

Cambios aplicados:

- Carpeta raíz del ZIP acortada a `m2_v51_cf`.
- Particiones de radios censales de Buenos Aires renombradas de `departamento_<codigo>_<nombre_largo>.geojson` a `d_<codigo>.geojson`.
- Los nombres completos de departamentos/partidos se conservan dentro de cada GeoJSON y en `public/data/provincias/provincia_06_buenos_aires/radios/index.json`.
- Los índices y `metadata.json` fueron actualizados.

## Recomendación

Extraer en una ruta corta:

```powershell
C:\Mapa2\m2_v51_cf
```

Evitar rutas profundas como:

```powershell
C:\Users\Usuario\OneDrive\Escritorio\proyectos largos\...
```

## Validación

Ejecutar:

```powershell
python src\check_map_ready_v5_1.py --data-dir public\data --diag data\output\diagnostico_map_ready_v5_1.json --out data\output\check_map_ready_v5_1.txt
```
