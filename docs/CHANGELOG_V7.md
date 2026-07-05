# CHANGELOG V7 — Frontend interactivo del mapa comercial y censal

## Estado

```text
Versión: V7
Nombre: Frontend interactivo del mapa comercial y censal
Deploy: No ejecutado
Avance a V8: No ejecutado
```

## Cambios principales

- Se agregó frontend estático con Vite, React, TypeScript y MapLibre GL JS.
- Se implementó `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json` y `tsconfig.app.json`.
- Se agregó arquitectura frontend modular en `src/app`, `src/components`, `src/data`, `src/map`, `src/types` y `src/utils`.
- Se implementó mapa base de Argentina con provincias V5.1.
- Se implementó selección de provincia y carga bajo demanda de departamentos/partidos.
- Se implementó carga bajo demanda de puntos de localidades V5.1 por provincia.
- Se implementaron clientes sintéticos V6 como puntos, clusters y heatmap.
- Se implementó coroplético provincial por venta neta sintética.
- Se implementó coroplético departamento/partido con agregados V6 bajo demanda.
- Se implementaron KPIs comerciales y territoriales reactivos a filtros.
- Se implementaron tooltips y ficha de detalle para provincia, departamento y cliente.
- Se agregó aviso visible de datos comerciales sintéticos.
- Se agregó script reproducible `src/check_frontend_v7.py`.
- Se generaron diagnósticos V7 en `data/output`.

## Datos preservados

La V7 no modifica:

```text
public/data/metadata.json
public/data/provincias.geojson
public/data/indexes/provincias_index.json
public/data/business/*
data/output/diagnostico_map_ready_v5_1.json
data/output/diagnostico_business_v6.json
```

La lógica censal V5.1 no fue alterada.

La base comercial sintética V6 no fue regenerada.

## Carga inicial

La carga inicial del frontend quedó limitada a:

```text
metadata.json
provincias.geojson
provincias_index.json
metadata_business_v6.json
ventas_provincia_mes.json
ventas_cliente_totales.json
clientes.geojson
productos.json
calendario.json
```

No se cargan radios nacionales ni provinciales en el inicio del frontend.

## Carga bajo demanda

Se agregó lazy loading de:

```text
provincias/<provincia>/departamentos.geojson
provincias/<provincia>/puntos.geojson
business/agregados/ventas_departamento_mes.json
business/agregados/ventas_producto_mes.json
business/ventas_mensuales.csv
```

## Validación

Nuevo script:

```text
src/check_frontend_v7.py
```

Salidas:

```text
data/output/diagnostico_frontend_v7.md
data/output/diagnostico_frontend_v7.json
data/output/check_frontend_v7.txt
data/output/v7_file_sizes.txt
```

## Archivos nuevos principales

```text
package.json
package-lock.json
vite.config.ts
tsconfig.json
tsconfig.app.json
index.html
src/app/App.tsx
src/app/main.tsx
src/app/styles.css
src/components/*.tsx
src/data/*.ts
src/map/*.ts
src/types/*.ts
src/utils/*.ts
src/check_frontend_v7.py
docs/CHANGELOG_V7.md
docs/RUNBOOK_V7.md
```

## Pendientes no bloqueantes

- Optimizar bundle inicial con code-splitting si se prioriza performance extrema.
- Agregar precarga condicional por viewport/zoom.
- Agregar tests visuales o smoke tests con Playwright en una fase posterior.
- Preparar configuración de Cloudflare Pages en V8.

## Confirmación de alcance

```text
No se avanzó a V8.
No se hizo deploy.
No se modificó la lógica censal V5.1.
No se regeneró la base comercial V6.
No se eliminaron outputs ni trazabilidad de fases anteriores.
```
## V7 npm registry fix

- Se agregó `.npmrc` apuntando a `https://registry.npmjs.org/`.
- Se reemplazaron referencias internas de `package-lock.json` por URLs públicas de npm para evitar `ETIMEDOUT` fuera del entorno de generación.
- No se modificaron datos censales V5.1 ni base comercial V6.

---

## V7.1 — Frontend runtime fix

Corrección dentro de la misma fase V7. No corresponde avance a V8.

### Motivo

Durante la validación local en `npm run dev` se detectó que el mensaje `Cargando detalle comercial bajo demanda…` podía quedar visible de forma permanente cuando React ejecutaba efectos dos veces en modo desarrollo (`React.StrictMode`). También se observaron warnings 404 de glyphs de MapLibre contra `demotiles.maplibre.org` y una solicitud 404 de `favicon.ico`.

### Correcciones aplicadas

- Se corrigió el flujo de carga bajo demanda de `ventas_mensuales.csv` para que sea compatible con React StrictMode.
- Se eliminó la guarda `detailedStatus === 'loading'` que podía impedir que la segunda ejecución real del efecto reiniciara la carga en modo desarrollo.
- Se reemplazó el overlay central de detalle comercial por un estado flotante no bloqueante.
- Se eliminó la capa `symbol` de conteo de clusters que forzaba descarga de glyphs externos no disponibles.
- Se agregó tooltip de cluster con cantidad de clientes agrupados y acción de click para acercar.
- Se removió la dependencia de `glyphs` del estilo base MapLibre.
- Se agregó `public/favicon.svg` y referencia en `index.html`.
- Se mantuvo `.npmrc` apuntando al registry público `https://registry.npmjs.org/`.
- Se reforzó `src/check_frontend_v7.py` para auditar registry npm, StrictMode, overlay no bloqueante y glyphs MapLibre.

### Datos preservados

No se modificaron datos censales V5.1 ni datos comerciales V6. No se regeneró la base de clientes, productos ni ventas.

### Estado

El fix requiere ejecutar localmente:

```powershell
npm install
npm run build
python src\check_frontend_v7.py --project-root . --out data\output\check_frontend_v7.txt
```

En este paquete se dejó un diagnóstico estático con build omitido cuando no hay dependencias instaladas en el entorno de generación. En la PC local, con `node_modules` instalado, el check debe volver a ejecutar el build.

