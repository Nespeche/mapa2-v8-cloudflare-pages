# CHANGELOG V5.1 — Map Ready Cloudflare Fix

Fecha: 2026-07-05

## Tipo de versión

Corrección técnica de V5. No es avance de fase.

## Problema corregido

El archivo de radios censales de Buenos Aires publicado en V5 superaba el límite de Cloudflare Pages Free:

```text
public/data/provincias/provincia_06_buenos_aires/radios.geojson ≈ 35.166 MB
```

## Cambios implementados

### Datos públicos

- Eliminado del bundle público el archivo monolítico de radios de Buenos Aires.
- Particionados los radios de Buenos Aires por departamento/partido.
- Agregado índice:

```text
public/data/provincias/provincia_06_buenos_aires/radios/index.json
```

- Generados 135 GeoJSON departamentales de radios.
- Conservados 23.901 radios censales de Buenos Aires.
- Conservada población total de radios de Buenos Aires: 17.523.996.
- Peso máximo final de una partición de radios BA: 2.424 MB.

### Optimización preventiva

- Eliminado del bundle público el archivo nacional:

```text
public/data/localidades_puntos.geojson
```

- Los puntos se conservan por provincia.
- Agregado índice:

```text
public/data/indexes/localidades_puntos_index.json
```

### Scripts nuevos

```text
src/export_map_ready_v5_1.py
src/check_map_ready_v5_1.py
```

### Diagnósticos nuevos

```text
data/output/diagnostico_map_ready_v5_1.md
data/output/diagnostico_map_ready_v5_1.json
data/output/check_map_ready_v5_1.txt
data/output/v5_1_file_sizes.txt
```

### Documentación actualizada

```text
docs/PROJECT_CONTEXT.md
docs/CHANGELOG_V5_1.md
docs/RUNBOOK_V5_1.md
README.md
public/data/README_PUBLIC_DATA.md
```

## Resultado de validación

```text
Estado final: OK
Archivos >25 MiB: 0
Archivos 20-25 MiB: 0
Archivos 15-20 MiB: 0
Splits provincia validados: 144
Particiones especiales validadas: 135
Particiones con error: 0
Errores bloqueantes: 0
```

## Qué no se hizo

- No se avanzó a V6.
- No se generaron clientes ficticios.
- No se generaron ventas de autopartes.
- No se creó frontend completo.
- No se hizo deploy.
- No se modificó la lógica censal validada.
- No se destruyó el GeoPackage maestro.


## Corrección Windows Safe ZIP

Esta entrega usa carpeta raíz corta `m2_v51_cf` y particiones de radios de Buenos Aires con nombres cortos `d_<codigo>.geojson`. Esta decisión evita el error de Windows `0x80010135: Ruta de acceso demasiado larga` al extraer el ZIP.

Recomendación de extracción en Windows: crear una carpeta corta, por ejemplo `C:\Mapa2`, y extraer allí el ZIP. Evitar extraer dentro de rutas largas como Escritorio sincronizado con OneDrive, subcarpetas profundas o carpetas con nombres extensos.
