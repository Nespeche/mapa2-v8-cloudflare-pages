# Diagnóstico Frontend V7.1 — Mapa2

- Estado final: **WARN**
- Generado: `2026-07-05T19:46:30+00:00`
- Fase: V7.1 — Frontend runtime fix dentro de V7
- Deploy ejecutado: **No**
- Avance a V8: **No**
- Lógica censal modificada: **No**
- Base comercial V6 regenerada: **No**

## Resumen de validación

- `OK` — Base V5.1 preservada en estado OK: version=v5_1_map_ready_cloudflare_fix
- `OK` — Base comercial V6 preservada en estado OK: clientes=2000 productos=65 ventas=128998
- `OK` — Existe insumo inicial public/data/metadata.json: 143818 bytes
- `OK` — Existe insumo inicial public/data/provincias.geojson: 252719 bytes
- `OK` — Existe insumo inicial public/data/indexes/provincias_index.json: 37150 bytes
- `OK` — Existe insumo inicial public/data/business/metadata_business_v6.json: 5979 bytes
- `OK` — Existe insumo inicial public/data/business/agregados/ventas_provincia_mes.json: 124020 bytes
- `OK` — Existe insumo inicial public/data/business/agregados/ventas_cliente_totales.json: 1530247 bytes
- `OK` — Existe insumo inicial public/data/business/clientes.geojson: 1949275 bytes
- `OK` — Existe insumo inicial public/data/business/productos.json: 25746 bytes
- `OK` — Existe insumo inicial public/data/business/calendario.json: 6114 bytes
- `OK` — Existe insumo bajo demanda public/data/provincias: 
- `OK` — Existe insumo bajo demanda public/data/business/agregados/ventas_departamento_mes.json: 
- `OK` — Existe insumo bajo demanda public/data/business/agregados/ventas_producto_mes.json: 
- `OK` — Existe insumo bajo demanda public/data/business/ventas_mensuales.csv: 
- `OK` — Existe frontend package.json: 
- `OK` — Existe frontend vite.config.ts: 
- `OK` — Existe frontend tsconfig.json: 
- `OK` — Existe frontend tsconfig.app.json: 
- `OK` — Existe frontend index.html: 
- `OK` — Existe frontend src/app/App.tsx: 
- `OK` — Existe frontend src/app/main.tsx: 
- `OK` — Existe frontend src/app/styles.css: 
- `OK` — Existe frontend src/components/MapView.tsx: 
- `OK` — Existe frontend src/data/dataClient.ts: 
- `OK` — Existe frontend src/data/dataPaths.ts: 
- `OK` — Existe frontend .npmrc: 
- `OK` — Existe frontend public/favicon.svg: 
- `WARN` — Build no ejecutado: --skip-build
- `OK` — Referencias literales a public/data válidas: refs=12
- `OK` — Registry npm público configurado: .npmrc
- `OK` — Carga CSV bajo demanda compatible con React StrictMode: sin guarda loading bloqueante
- `OK` — Carga detallada no bloquea el mapa: estado flotante no central
- `OK` — MapLibre sin dependencia de glyphs demo: sin symbol text layer
- `OK` — No se detectaron claves privadas ni tokens hardcodeados: scan frontend
- `OK` — Archivos public/data dentro de 25 MiB: max=data/business/ventas_mensuales.csv 14.0 MiB
- `OK` — Rutas públicas compatibles con Windows: umbral=180
- `OK` — Carga inicial sin radios nacionales: INITIAL_DATA_PATHS
- `OK` — Frontend sin referencia literal a radios.geojson: src/app/components/data/map/utils
- `OK` — Documentación de datos sintéticos visible: README.md, docs/RUNBOOK_V7.md, docs/CHANGELOG_V7.md

## Advertencias

- Build omitido por parámetro --skip-build.

## Build

- Ejecutado: False
- OK: False

```text
Build omitido.
```

## Archivo más pesado en public/data

- data/business/ventas_mensuales.csv — 14.0 MiB

## Regla de carga inicial

La carga inicial declarada en `src/data/dataPaths.ts` no incluye radios nacionales ni archivos de radios provinciales. Los datos pesados quedan bajo demanda o fuera del flujo inicial.
