# Mapa 2 — Changelog V10.4

**Fase:** V10.4 — Decisión de arquitectura de carga de datos y backend  
**Base:** V10.3 aprobada

## Cambios aplicados

### Arquitectura/documentación

- Se creó `docs/ARCHITECTURE_DECISION_V10_4.md`.
- Se creó `docs/BACKEND_DECISION_MATRIX_V10_4.md`.
- Se creó `docs/DATA_LOADING_STRATEGY_V10_4.md`.
- Se creó `docs/CLOUDFLARE_BUILD_OPTIMIZATION_V10_4.md`.
- Se creó `docs/PERFORMANCE_BASELINE_V10_4.md`.
- Se creó `docs/ROADMAP_AFTER_V10_4.md`.
- Se actualizó `README.md`.
- Se actualizó `docs/PROJECT_CONTEXT.md`.
- Se actualizó `SKILL.md`.

### Scripts

- Se agregó `scripts/audit_architecture_v10_4.mjs`.
- Se agregó `scripts/audit_data_loading_v10_4.mjs`.
- Se agregó `scripts/audit_dependencies_v10_4.mjs`.
- Se agregaron scripts npm:
  - `audit:architecture`
  - `audit:data-loading`
  - `audit:dependencies`
  - `validate:architecture`
  - `validate:v10.4`

### Build Cloudflare

- Se movió `requirements.txt` desde raíz a `tools/python/requirements.txt`.
- Se agregó `make python-install`.
- Objetivo: evitar `pip install -r requirements.txt` en Cloudflare Pages cuando el build solo requiere frontend.

### Runtime/metadata

- Se actualizó `src/domain/appVersion.ts` a V10.4.
- Se actualizó `index.html` a V10.4.
- Se agregó chip visual `Arquitectura V10.4` preservando `Contratos V10.3`.
- Se actualizó comentario de `public/_headers` a V10.4.

## Sin cambios de alcance

- No se implementó backend.
- No se agregaron Workers/Pages Functions.
- No se agregó D1.
- No se agregó Railway/PostGIS.
- No se movieron datasets a R2.
- No se rediseñó UI.
- No se regeneró V5.1.
- No se regeneró V6.
- No se cambió el modelo territorial.

## Decisión final

Arquitectura principal recomendada: Cloudflare Pages + datos estáticos mejor particionados.  
Plan B: Cloudflare R2 para datasets pesados/versionados cuando exista evidencia.
