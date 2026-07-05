# Mapa 2 — Changelog V9

**Fase:** V9 — UI/UX final estilo Apple, responsive, navegación profesional y estados visuales  
**Base:** V8 — Deploy profesional en Cloudflare Pages Free validado  
**Fecha:** 2026-07-05

---

## Decisión técnica

Se implementó V9 como refinamiento de interfaz y experiencia sobre V8, sin regenerar datos censales, sin regenerar datos comerciales, sin backend y sin modificar la arquitectura de Cloudflare Pages Free.

---

## Cambios principales

### Identidad visible

- Se corrigió la etiqueta visible `Mapa2 · V7` a `MAPA 2 · V9`.
- Se actualizó `index.html` con título y descripción V9.
- Se actualizó `package.json` a `mapa2-v9-ui-ux-final` versión `9.0.0`.

### UI/UX

- Rediseño del panel lateral con estilo más limpio, moderno y jerárquico.
- Mejora de tarjetas KPI con hover states, jerarquía tipográfica y chip de fuente de cálculo.
- Mejora de controles de capas con ayuda contextual visible.
- Mejora del topbar sobre el mapa.
- Mejora de leyenda y panel de detalle contextual.
- Uso de sombras, bordes, radios y transparencias moderadas.

### Responsive

- Eliminado el `min-width` rígido del body.
- Layout adaptado para escritorio, notebooks, pantallas medianas y anchos menores.
- Paneles no quedan inaccesibles en pantallas menores.
- El mapa mantiene altura razonable cuando el layout pasa a una columna.

### Estados visuales

- Loading inicial más claro.
- Carga bajo demanda no bloqueante conservada.
- Estado sin resultados comerciales.
- Error inicial más claro.
- No se reintroduce el problema de carga persistente corregido en V7.1.

### Accesibilidad básica

- Inputs y selects con `id` y `name`.
- Labels asociados con `htmlFor`.
- Foco visible para botones, inputs, selects y región del mapa.
- Uso de `aria-live` para estados.
- Botones de capas con `aria-pressed`.
- Soporte `prefers-reduced-motion`.

---

## Archivos modificados

```text
README.md
index.html
package.json
package-lock.json
public/_headers
src/app/App.tsx
src/app/styles.css
src/components/ErrorState.tsx
src/components/FilterPanel.tsx
src/components/KpiCards.tsx
src/components/LayerControls.tsx
src/components/Legend.tsx
src/components/LoadingState.tsx
src/components/MapView.tsx
src/components/TooltipPanel.tsx
docs/CHANGELOG_V9.md
docs/RUNBOOK_V9_UI_UX_FINAL.md
docs/DIST_AUDIT_V9.md
docs/DIST_AUDIT_V9.json
docs/VALIDATION_LOG_V9.txt
```

---

## Archivos no modificados por decisión

- No se modificaron datos censales en `public/data`.
- No se modificó la base comercial sintética V6 en `public/data/business`.
- No se agregaron dependencias nuevas.
- No se agregó backend.
- No se modificó la configuración de Cloudflare Pages: `npm run build` + `dist`.

---

## Resultado

V9 es una mejora visual y de experiencia sobre V8, manteniendo funcionalidad y compatibilidad de deploy.
