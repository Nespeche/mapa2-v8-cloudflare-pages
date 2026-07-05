# RUNBOOK V5.1 — Map Ready Cloudflare Fix

## Objetivo

Ejecutar y validar la V5.1 del proyecto Mapa2 desde VSCode en Windows PowerShell.

La V5.1 corrige compatibilidad Cloudflare sin avanzar a V6.

## 1. Abrir proyecto

Descomprimir el ZIP y abrir la carpeta:

```text
argentina_geo_censo_builder_v5_1_map_ready_cloudflare_fix
```

En VSCode:

```powershell
code .
```

## 2. Crear entorno virtual

```powershell
python -m venv .venv
```

## 3. Activar entorno virtual

```powershell
.\.venv\Scripts\Activate.ps1
```

Si PowerShell bloquea la activación:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## 4. Instalar dependencias

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 5. Regenerar V5.1 desde cero

```powershell
python src\export_map_ready_v5_1.py --input data\output\arg_geo_censo_census_ready_v4.gpkg --out-dir public\data --diag-md data\output\diagnostico_map_ready_v5_1.md --diag-json data\output\diagnostico_map_ready_v5_1.json
```

Este comando ejecuta la exportación V5 base y luego aplica la corrección V5.1.

Modo rápido si ya existen outputs V5 y solo se quiere reaplicar la corrección:

```powershell
python src\export_map_ready_v5_1.py --skip-base-export --out-dir public\data --diag-md data\output\diagnostico_map_ready_v5_1.md --diag-json data\output\diagnostico_map_ready_v5_1.json
```

## 6. Ejecutar check V5.1

```powershell
python src\check_map_ready_v5_1.py --data-dir public\data --diag data\output\diagnostico_map_ready_v5_1.json --out data\output\check_map_ready_v5_1.txt
```

Resultado esperado:

```text
Estado final: OK
Archivos >25 MiB: 0
Splits provincia con error: 0
Particiones con error: 0
Sin errores bloqueantes.
```

## 7. Generar archivo de pesos

```powershell
Get-ChildItem public\data -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending | Out-File data\output\v5_1_file_sizes.txt
```

## 8. Abrir diagnósticos

```powershell
code data\output\diagnostico_map_ready_v5_1.md
code data\output\check_map_ready_v5_1.txt
code data\output\v5_1_file_sizes.txt
code public\data\metadata.json
code public\data\indexes\provincias_index.json
```

## 9. Validación visual en QGIS

Abrir opcionalmente:

```text
public/data/provincias.geojson
public/data/localidades_poligonos_departamentos.geojson
public/data/provincias/provincia_06_buenos_aires/departamentos.geojson
public/data/provincias/provincia_06_buenos_aires/radios/departamento_06427_la_matanza.geojson
```

Validar:

- Geometrías visibles.
- CRS EPSG:4326.
- Campos `provincia_id`, `provincia_nombre`, `poblacion_total`.
- En radios BA, campos `departamento_id` y `departamento_nombre`.

## 10. Criterios de aprobación

V5.1 se considera aprobada si:

- `check_map_ready_v5_1.txt` indica `Estado final: OK`.
- No hay archivos en `public/` mayores a 25 MiB.
- Los radios de Buenos Aires están particionados.
- Buenos Aires conserva 135 departamentos/partidos.
- Buenos Aires conserva 23.901 radios y población 17.523.996.
- Radios nacionales cierran población 45.892.285 sumando splits/particiones.
- No hay geometrías inválidas ni vacías.
- No hay poblaciones nulas.

## 11. No avanzar automáticamente

No avanzar a V6 hasta que el usuario confirme explícitamente que V5.1 funciona correctamente.


## Corrección Windows Safe ZIP

Esta entrega usa carpeta raíz corta `m2_v51_cf` y particiones de radios de Buenos Aires con nombres cortos `d_<codigo>.geojson`. Esta decisión evita el error de Windows `0x80010135: Ruta de acceso demasiado larga` al extraer el ZIP.

Recomendación de extracción en Windows: crear una carpeta corta, por ejemplo `C:\Mapa2`, y extraer allí el ZIP. Evitar extraer dentro de rutas largas como Escritorio sincronizado con OneDrive, subcarpetas profundas o carpetas con nombres extensos.
