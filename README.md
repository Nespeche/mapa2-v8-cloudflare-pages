# Mapa2 V7 — Frontend interactivo del mapa comercial y censal

**Estado de fase:** V7 implementada.  
**No se avanzó a V8. No se hizo deploy.**

Mapa2 V7 agrega una aplicación web estática con **Vite + React + TypeScript + MapLibre GL JS** para explorar datos geográficos/censales aprobados en V5.1 y datos comerciales sintéticos de autopartes aprobados en V6.

La app está preparada para ejecución local y futura publicación en **Cloudflare Pages Free**, sin backend obligatorio y sin claves privadas.

---

## Estado preservado

### V5.1 — Base geográfica/censal aprobada

Se preserva la lógica censal validada. La V7 **no modifica ni regenera** la base censal.

Resultado aprobado preservado:

```text
Estado final: OK
Población nacional provincias:     45.892.285
Población nacional departamentos:  45.892.285
Población nacional fracciones:     45.892.285
Población nacional radios:         45.892.285
Buenos Aires departamentos:        135
Archivos public/data >25 MiB:      0
Rutas públicas largas Windows:     0
```

### V6 — Base comercial sintética aprobada

Se preserva la base comercial sintética. La V7 **no regenera ni altera** clientes, productos ni ventas.

Resultado aprobado preservado:

```text
Estado final: OK
Errores: 0
Advertencias: 0
Clientes: 2.000
Productos: 65
Registros de ventas: 128.998
Período: 2025-01 a 2026-12
Meses: 24
Seed: 20260705
Archivo más pesado en public/data: business/ventas_mensuales.csv — 14.0 MiB
Archivos public/data >25 MiB: 0
Rutas largas Windows: 0
```

> Los datos comerciales son **sintéticos**. No representan clientes reales, ventas reales ni precios reales.

---

## Qué implementa V7

- App frontend estática con Vite, React y TypeScript.
- Mapa interactivo con MapLibre GL JS.
- Visualización base de Argentina por provincias.
- Selección de provincia con carga bajo demanda de departamentos/partidos.
- Visualización de clientes ficticios como puntos.
- Clusters de clientes.
- Heatmap de clientes/ventas.
- Coroplético por ventas agregadas por provincia.
- Coroplético por ventas agregadas por departamento/partido.
- Puntos de localidades V5.1 bajo demanda por provincia.
- Panel lateral con filtros, KPIs, leyenda dinámica y ficha de detalle.
- Tooltips por provincia, departamento y cliente.
- Aviso visible de datos comerciales sintéticos.
- Validación reproducible con `src/check_frontend_v7.py`.

---

## Carga de datos

### Carga inicial optimizada

La app carga al inicio solo:

```text
public/data/metadata.json
public/data/provincias.geojson
public/data/indexes/provincias_index.json
public/data/business/metadata_business_v6.json
public/data/business/agregados/ventas_provincia_mes.json
public/data/business/agregados/ventas_cliente_totales.json
public/data/business/clientes.geojson
public/data/business/productos.json
public/data/business/calendario.json
```

### Carga bajo demanda

Se carga solo cuando el usuario filtra o cambia de modo:

```text
public/data/provincias/<provincia>/departamentos.geojson
public/data/provincias/<provincia>/puntos.geojson
public/data/business/agregados/ventas_departamento_mes.json
public/data/business/agregados/ventas_producto_mes.json
public/data/business/ventas_mensuales.csv
```

No se cargan radios nacionales ni radios provinciales en el inicio del frontend.

---

## KPIs visibles

La V7 muestra:

```text
Clientes visibles
Venta neta total
Unidades vendidas
Margen bruto estimado
Volumen kg
Ticket promedio aproximado
Provincia líder por ventas
Producto/categoría líder por ventas
```

Los KPIs usan agregados iniciales cuando es suficiente. Cuando se aplican filtros detallados, como producto, categoría, cliente, tipo, segmento o departamento, se carga `ventas_mensuales.csv` bajo demanda para recomputar con mayor precisión.

---

## Filtros implementados

```text
Provincia
Localidad / departamento / partido
Cliente
Tipo de cliente
Segmento cliente
Categoría de producto
Producto
Año
Mes
Rango calendario desde/hasta
Modo de visualización
```

Las listas se derivan de los datos existentes en el ZIP, no de listas inventadas manualmente.

---

## Capas implementadas

```text
Vista territorial base
Clientes como puntos
Clusters de clientes
Heatmap de clientes/ventas
Coroplético por ventas provincia
Coroplético por ventas departamento/partido
Puntos de localidades V5.1 bajo demanda
```

---

## Paso a paso Windows PowerShell / VSCode

Abrí la carpeta del proyecto en VSCode y ejecutá:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

npm install
npm run dev
npm run build
npm run preview

python src\check_frontend_v7.py --project-root . --out data\output\check_frontend_v7.txt

Get-ChildItem public\data -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending | Out-File data\output\v7_file_sizes.txt
```

Para abrir diagnósticos:

```powershell
code data\output\diagnostico_frontend_v7.md
code data\output\diagnostico_frontend_v7.json
code data\output\check_frontend_v7.txt
code data\output\v7_file_sizes.txt
```

---

## Scripts importantes

```text
src/check_frontend_v7.py
```

Valida:

1. Base V5.1 OK.
2. Base V6 OK.
3. Archivos principales del frontend.
4. Build `npm run build`.
5. Referencias a `public/data`.
6. Ausencia de secretos hardcodeados.
7. Límite de 25 MiB en `public/data`.
8. Rutas compatibles con Windows.
9. Carga inicial sin radios nacionales.
10. Documentación visible de datos sintéticos.

---

## Salidas esperadas

```text
data/output/diagnostico_frontend_v7.md
data/output/diagnostico_frontend_v7.json
data/output/check_frontend_v7.txt
data/output/v7_file_sizes.txt
```

---

## Compatibilidad Cloudflare Pages Free

La V7 es compatible con Cloudflare Pages Free como app estática.

Configuración futura sugerida para V8, todavía no ejecutada:

```text
Build command: npm run build
Build output directory: dist
```

No se hizo deploy en V7.

---

## Pendientes no bloqueantes

- Agregar virtualización avanzada de listas si el catálogo comercial crece mucho.
- Evaluar compresión `.br`/`.gz` prebuild para assets públicos en V8.
- Evaluar code-splitting de MapLibre si se desea reducir el bundle inicial.
- Agregar pruebas visuales automatizadas en una fase posterior.

---

## Regla de fase

No avanzar a V8 hasta que la V7 sea ejecutada, revisada y aprobada explícitamente por el usuario.

### Nota V7 npm registry fix

Este ZIP incluye `.npmrc` con `registry=https://registry.npmjs.org/` y `package-lock.json` con URLs públicas de npm. Si una instalación anterior quedó cortada, borrar `node_modules` y reinstalar antes de ejecutar `npm run dev`.

---

## V7.1 — Fix runtime local

Esta entrega corrige problemas detectados durante `npm run dev`:

- Spinner `Cargando detalle comercial bajo demanda…` persistente en modo desarrollo.
- Warnings 404 de glyphs MapLibre contra `demotiles.maplibre.org`.
- 404 de favicon.

La corrección no altera la base censal V5.1 ni la base comercial sintética V6. No se hizo deploy ni se avanzó a V8.

Comandos recomendados para validar la V7.1:

```powershell
npm install
npm run dev
npm run build
python src\check_frontend_v7.py --project-root . --out data\output\check_frontend_v7.txt
```



---

## V8 — Deploy profesional en Cloudflare Pages Free

Esta entrega prepara Mapa 2 para deploy estático en Cloudflare Pages Free desde GitHub.

Configuración Cloudflare Pages:

```text
Build command: npm run build
Build output directory: dist
Node version: 22.16.0
```

Comandos principales:

```powershell
npm install
npm run dev
npm run build
npm run check:cloudflare
npm run preview
```

Documentación específica:

- `docs/RUNBOOK_V8_CLOUDFLARE_PAGES.md`
- `docs/CHANGELOG_V8.md`
- `docs/DIST_AUDIT_V8.md`
- `docs/DIST_AUDIT_V8.json`

Decisiones V8:

- No se implementó backend.
- No se regeneraron datos censales ni comerciales.
- Se agregó `public/_headers`.
- No se agregó `_redirects` porque Cloudflare Pages maneja SPA fallback automáticamente cuando no existe `404.html` de raíz.
- `.gitignore` excluye artefactos pesados no requeridos para el deploy GitHub → Cloudflare Pages.
