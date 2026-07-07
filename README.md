# Mapa 2 V10.4 — Decisión de arquitectura de carga de datos y backend

**Estado de fase:** V10.4 implementada sobre V10.3 aprobada.  
**Base preservada:** V5.1 censal/geográfica, V6 comercial sintética, V7.1 runtime fix, V8 Cloudflare Pages, V9 UI/UX, V10 performance/carga progresiva y V10.3 contratos/anti-regresión.  
**Modelo territorial:** `País → Provincia → Localidad`.

> Los clientes, productos y ventas son datos sintéticos V6. No representan clientes reales ni operaciones reales.

---

## 1. Objetivo de V10.4

V10.4 no implementa backend completo. Su objetivo es dejar una decisión técnica fundada para evolucionar Mapa 2 en las próximas fases:

1. mantener Cloudflare Pages estático optimizado;
2. mejorar particionado de datos estáticos;
3. evaluar R2 como plan B para datasets pesados;
4. reservar Workers/Pages Functions para endpoints livianos concretos;
5. reservar D1 para metadata/índices livianos;
6. descartar Railway/Postgres/PostGIS por ahora salvo necesidad real de GIS dinámico.

---

## 2. Decisión arquitectónica

**Recomendación principal:** Cloudflare Pages + datos estáticos mejor particionados + contratos de carga.  
**Plan B:** Cloudflare R2 para separar datasets pesados del build de Pages cuando el crecimiento lo justifique.  
**No recomendado por ahora:** Railway/Postgres/PostGIS, porque la app todavía puede resolver filtros y visuales mediante datos precalculados, particionados y cacheados.

Documentación central:

- `docs/ARCHITECTURE_DECISION_V10_4.md`
- `docs/BACKEND_DECISION_MATRIX_V10_4.md`
- `docs/DATA_LOADING_STRATEGY_V10_4.md`
- `docs/CLOUDFLARE_BUILD_OPTIMIZATION_V10_4.md`
- `docs/PERFORMANCE_BASELINE_V10_4.md`
- `docs/ROADMAP_AFTER_V10_4.md`

---

## 3. Cambios mínimos aplicados

- Se actualizó metadata visual/runtime a `V10.4`.
- Se preservaron contratos V10.3 y checks anti-regresión.
- Se agregaron scripts de auditoría de arquitectura, carga y dependencias.
- Se movió `requirements.txt` a `tools/python/requirements.txt` para que Cloudflare Pages no instale Python en builds frontend estáticos.
- Se agregó `make python-install` para preservar flujo local Python/ETL.
- Se actualizó documentación de contexto, skill, changelog y roadmap.

No se modificaron datos censales ni comerciales.

---

## 4. Stack

- React
- Vite
- TypeScript
- MapLibre
- Cloudflare Pages Free
- Datos estáticos en `public/data`
- Carga bajo demanda
- Scripts Node sin dependencias nuevas
- Python/ETL preservado fuera del build frontend

---

## 5. Instalación local

Usar una ruta corta en Windows, por ejemplo:

```powershell
C:\Mapa2\mapa2_v10_4_architecture_decision
```

Instalar dependencias frontend:

```powershell
npm install
```

Dependencias Python solo si se ejecutan pipelines históricos de datos:

```powershell
python -m pip install -r tools/python/requirements.txt
```

O:

```powershell
make python-install
```

---

## 6. Comandos principales

```powershell
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run build
npm run check:cloudflare
npm run audit:dist
npm run audit:architecture
npm run audit:data-loading
npm run audit:dependencies
npm run validate:architecture
npm run validate:release
npm run preview
```

---

## 7. Estrategia de carga

Carga inicial:

- metadata;
- provincias;
- índice de provincias;
- metadata comercial;
- agregados provincia/mes;
- agregados cliente/totales;
- productos;
- calendario.

Carga bajo demanda:

- `clientes.geojson`;
- `ventas_mensuales.csv`;
- agregados departamento/mes;
- agregados producto/mes;
- capas provinciales;
- motor MapLibre vía `React.lazy`.

Regla anti-regresión: no cargar clientes, CSV detallado ni radios nacionales al inicio.

---

## 8. Cloudflare Pages

Configuración esperada:

```text
Build command: npm run build
Build output directory: dist
```

Validar en logs que no aparezca:

```text
pip install -r requirements.txt
```

Si aparece, revisar configuración del proyecto Cloudflare. En V10.4 las dependencias Python están en `tools/python/requirements.txt`.

---

## 9. GitHub

Antes de commitear:

```powershell
git status
```

No subir:

- `node_modules/`
- `dist/`
- `.env`
- `.zip`
- `.gpkg`
- `.sqlite`
- `.db`
- `data/raw/`
- outputs pesados innecesarios

Filtros sugeridos:

```powershell
git status --short | Select-String -Pattern '^\s*(\?\?|[MADRCU ]{2})\s+(node_modules/|dist/|data/raw/|\.env$)|\.(zip|gpkg|sqlite|db)$'
```

Después de `git add .`:

```powershell
git diff --cached --name-only | Select-String -Pattern '^(node_modules/|dist/|data/raw/|\.env$)|\.(zip|gpkg|sqlite|db)$'
```

Resultado esperado: sin salida.

Commit sugerido:

```powershell
git add .
git commit -m "Implement V10.4 architecture decision and data loading strategy"
git push origin main
```

---

## 10. Roadmap vigente

```text
V10.3 — Estabilización, contratos de datos y anti-regresión. Aprobada.
V10.4 — Decisión de arquitectura de carga de datos y backend.
V11   — Implementación de arquitectura elegida para datos/backend si se justifica.
V12   — Refactor y mejora profesional del frontend.
V13   — Analytics comercial avanzado y storytelling.
V14   — Producto final, documentación pública y mantenimiento.
```

---

## 11. Conclusión

V10.4 deja la app funcional, preserva V10.3 y documenta una arquitectura evolutiva sin backend prematuro. La próxima fase debe implementar particionado/manifest avanzado y solo reabrir backend si existe evidencia técnica suficiente.
