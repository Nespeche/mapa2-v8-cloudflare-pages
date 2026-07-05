# RUNBOOK V5 — ejecución en VSCode / Windows PowerShell

Este runbook permite regenerar y validar la V5 Map Ready desde cero usando el GeoPackage V4 incluido.

## 1. Abrir el proyecto

1. Descomprimir el ZIP completo.
2. Abrir la carpeta raíz en VSCode:

```text
argentina_geo_censo_builder_v5_map_ready
```

3. Abrir una terminal PowerShell dentro de VSCode.

## 2. Crear entorno virtual

```powershell
python -m venv .venv
```

Activar:

```powershell
.\.venv\Scripts\Activate.ps1
```

Si PowerShell bloquea scripts, ejecutar solo para esta sesión:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## 3. Instalar dependencias

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. Verificar insumo V4

Debe existir:

```text
data\output\arg_geo_censo_census_ready_v4.gpkg
```

Validación opcional de V4:

```powershell
python src\check_census_ready.py --gpkg data\output\arg_geo_censo_census_ready_v4.gpkg
```

## 5. Regenerar V5 Map Ready

```powershell
python src\export_map_ready_v5.py --input data\output\arg_geo_censo_census_ready_v4.gpkg --out-dir public\data --diag-md data\output\diagnostico_map_ready_v5.md --diag-json data\output\diagnostico_map_ready_v5.json
```

Si solo se quieren regenerar datos sin previews:

```powershell
python src\export_map_ready_v5.py --input data\output\arg_geo_censo_census_ready_v4.gpkg --out-dir public\data --diag-md data\output\diagnostico_map_ready_v5.md --diag-json data\output\diagnostico_map_ready_v5.json --skip-previews
```

## 6. Generar previews aparte

```powershell
python src\generate_previews_v5.py --data-dir public\data --previews-dir public\previews --metadata public\data\metadata.json --diag-json data\output\diagnostico_map_ready_v5.json
```

## 7. Ejecutar check V5

```powershell
python src\check_map_ready_v5.py --data-dir public\data --diag data\output\diagnostico_map_ready_v5.json --out data\output\check_map_ready_v5.txt
```

## 8. Abrir diagnósticos

Desde VSCode:

```powershell
code data\output\diagnostico_map_ready_v5.md
code data\output\diagnostico_map_ready_v5.json
code data\output\check_map_ready_v5.txt
code public\data\metadata.json
```

## 9. Checks esperados

El check debe indicar:

```text
Estado final: WARN
Sin errores bloqueantes.
```

Puntos clave esperados:

```text
app_provincias: OK
georef_departamentos: OK
georef_gobiernos_locales: OK
georef_municipios: OK
georef_aglomerados: OK
georef_fracciones_censales: OK
georef_radios_censales: OK
app_localidades_puntos: OK
```

```text
provincias: pop=45892285
departamentos: pop=45892285
fracciones: pop=45892285
radios: pop=45892285 por suma de splits
Buenos Aires departamentos/partidos: 135
Splits validados: 145
Splits faltantes: 0
Splits con error: 0
```

## 10. Validación visual en QGIS

Abrir estos archivos:

```text
public\data\provincias.geojson
public\data\localidades_poligonos_departamentos.geojson
public\data\localidades_poligonos_fracciones.geojson
public\data\provincias\provincia_06_buenos_aires\radios.geojson
public\data\localidades_puntos.geojson
```

Validar visualmente:

- Argentina se ve correctamente en vista nacional.
- Buenos Aires tiene 135 partidos/departamentos.
- Los radios de Buenos Aires se cargan desde split provincial, no desde archivo nacional.
- Las capas superpuestas no se usan para suma.

## 11. Errores frecuentes

### No existe geopandas/fiona/pyogrio

Reinstalar dependencias:

```powershell
pip install -r requirements.txt
```

### No aparece el GPKG V4

Verificar que el archivo exista en:

```text
data\output\arg_geo_censo_census_ready_v4.gpkg
```

### El check queda en WARN

Es esperado si la única advertencia es radios sin GeoJSON nacional. La V5 es usable.

### Buenos Aires radios pesa mucho

No es error. En V7 resolver con carga por viewport, tiles, PMTiles o partición subprovincial.

## 12. Regla de continuidad

No avanzar a V6 sin confirmación explícita del usuario.
