# Mapa 2 V9 — UI/UX final para Cloudflare Pages

**Estado de fase:** V9 implementada sobre V8 validada.  
**Deploy objetivo:** Cloudflare Pages Free.  
**Build command:** `npm run build`  
**Build output directory:** `dist`

Mapa 2 V9 refina la experiencia visual y de uso de la app geoespacial publicada en V8. Mantiene la arquitectura estática con **Vite + React + TypeScript + MapLibre**, preserva la base censal V5.1, la base comercial sintética V6, el fix runtime V7.1 y la configuración de deploy V8.

> Los clientes, productos y ventas son datos sintéticos. No representan clientes reales ni operaciones reales.

---

## Qué cambia en V9

- Corrección visible de versión: la UI y metadata ya no muestran “V7”; ahora muestran `MAPA 2 · V9`.
- UI más profesional: panel lateral refinado, KPIs con mayor jerarquía, tarjetas glass moderadas, mejor espaciado y contraste.
- Navegación más clara: capas con ayuda contextual, filtros con conteo de activos y estados de carga más visibles.
- Responsive mejorado: se elimina el ancho mínimo rígido y se adapta mejor a notebooks y pantallas medianas.
- Accesibilidad básica: inputs/selects con `id` y `name`, labels asociados, foco visible y estados con `aria-live`.
- Estados visuales: loading inicial, carga bajo demanda, estado sin resultados y error inicial más claros.
- Microinteracciones: hover/focus states, transiciones sutiles y soporte de `prefers-reduced-motion`.

---

## Estado preservado

V9 no regenera ni modifica datos censales o comerciales. Se preserva:

```text
V5.1 — base censal y geográfica validada
V6   — base comercial sintética de autopartes
V7.1 — fix runtime de frontend
V8   — deploy profesional en Cloudflare Pages Free
```

---

## Instalación local en Windows / PowerShell

Extraé el ZIP en una ruta corta, por ejemplo:

```powershell
C:\Mapa2\mapa2_v9_ui_ux_final
```

Entrá a la carpeta:

```powershell
cd C:\Mapa2\mapa2_v9_ui_ux_final
```

Instalá dependencias:

```powershell
npm install
```

Corré local:

```powershell
npm run dev
```

Abrí:

```text
http://127.0.0.1:5173/
```

Build de producción:

```powershell
npm run build
```

Preview del build:

```powershell
npm run preview
```

Abrí:

```text
http://127.0.0.1:4173/
```

---

## Validación mínima

Validar localmente:

- `npm install` funciona.
- `npm run dev` abre la app.
- `npm run build` genera `dist`.
- El mapa renderiza.
- Los KPIs funcionan.
- Los filtros funcionan.
- El detalle comercial bajo demanda funciona.
- La UI muestra `MAPA 2 · V9`.
- No aparece nuevamente un mensaje fijo de carga bajo demanda.
- No hay errores bloqueantes en consola.
- En Network, filtrar `404` y confirmar que no haya assets propios faltantes.

---

## Deploy Cloudflare Pages

Usar GitHub integration con la misma configuración validada en V8:

```text
Framework preset: React (Vite) o None
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22.16.0
```

No se requiere backend, Workers, Pages Functions, D1, R2 ni KV para V9.

---

## Documentación V9

Ver:

```text
docs/RUNBOOK_V9_UI_UX_FINAL.md
docs/CHANGELOG_V9.md
docs/DIST_AUDIT_V9.md
docs/DIST_AUDIT_V9.json
docs/VALIDATION_LOG_V9.txt
```
