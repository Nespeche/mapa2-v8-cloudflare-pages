# Mapa 2 — Runbook V9: UI/UX final estilo Apple

**Fase:** V9 — UI/UX final estilo Apple, responsive, navegación profesional, estados visuales y accesibilidad básica  
**Base obligatoria:** V8 — Deploy profesional en Cloudflare Pages Free  
**Fecha:** 2026-07-05

---

## 1. Diagnóstico inicial de V8

El ZIP V8 validado fue inspeccionado y usado como punto de partida. Se confirmó:

- El ZIP extrae correctamente.
- `package.json` mantiene Vite + React + TypeScript + MapLibre.
- `npm install` funciona.
- `npm run build` funciona.
- `dist` se genera correctamente.
- El check de Cloudflare no detecta errores bloqueantes.
- La app preserva datos censales V5.1 y base comercial sintética V6.
- La UI tenía una inconsistencia visual pendiente: mostraba `Mapa2 · V7` y metadata V7.
- DevTools Issues podía advertir formularios sin `id` o `name`.

---

## 2. Alcance aplicado en V9

Se aplicó únicamente UI/UX, responsive, estados visuales, microinteracciones y accesibilidad básica.

No se realizó:

- Backend.
- Workers.
- Pages Functions.
- D1/R2/KV.
- Regeneración censal.
- Regeneración comercial.
- Cambio de modelo territorial.
- Optimización avanzada V10.

---

## 3. Cambios implementados

### UI principal

- Marca visible `MAPA 2 · V9`.
- Header del panel lateral refinado.
- Chips de estado: Censo V5.1, ventas sintéticas V6 y frontend V8 preservado.
- KPIs con jerarquía más clara y fuente de cálculo visible.
- Capas con ayuda contextual.
- Filtros con conteo de activos.
- Topbar del mapa más limpio.
- Leyenda y panel de detalle más claros.

### Responsive

- Sin `min-width` rígido global.
- Layout de dos columnas en escritorio.
- Layout apilado en anchos menores.
- Mapa con altura mínima razonable.
- Right rail reubicado en notebooks/pantallas medianas.

### Estados

- Loading inicial con texto específico V9.
- Estado sin resultados comerciales.
- Estado de carga bajo demanda no bloqueante.
- Error inicial con contexto V9.

### Accesibilidad básica

- `id` y `name` en inputs/selects.
- `htmlFor` en labels.
- `aria-live` en estados.
- `aria-pressed` en botones de capas.
- Región de mapa con `role="region"` y `tabIndex`.
- Foco visible.
- `prefers-reduced-motion`.

---

## 4. Instalación local

En Windows PowerShell:

```powershell
cd C:\Mapa2\mapa2_v9_ui_ux_final
npm install
```

Resultado esperado:

```text
added 51 packages
found 0 vulnerabilities
```

Si ya existían dependencias actualizadas:

```text
up to date
found 0 vulnerabilities
```

---

## 5. Desarrollo local

```powershell
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173/
```

Validar:

- La app abre.
- El mapa renderiza.
- La etiqueta visible dice `MAPA 2 · V9`.
- KPIs visibles.
- Filtros visibles y usables.
- Capas cambian correctamente.
- No queda fijo un mensaje de carga bajo demanda.
- No hay errores bloqueantes en consola.

---

## 6. Build de producción

```powershell
npm run build
```

Este comando ejecuta:

```text
tsc -b
vite build
node scripts/check_cloudflare_dist.mjs
```

Resultado esperado:

```text
[cloudflare-check] Sin errores bloqueantes para Cloudflare Pages Free.
```

---

## 7. Preview de producción

```powershell
npm run preview
```

Abrir:

```text
http://127.0.0.1:4173/
```

Validar:

- `/` responde correctamente.
- `/data/metadata.json` responde correctamente.
- `/data/business/metadata_business_v6.json` responde correctamente.
- `/favicon.svg` responde correctamente.
- Assets bajo `/assets/*` responden correctamente.
- Network filtrado por `404` no muestra assets propios faltantes.

---

## 8. Deploy en Cloudflare Pages

Usar la integración GitHub → Cloudflare Pages ya validada en V8.

Configuración:

```text
Framework preset: React (Vite) o None
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22.16.0
```

No agregar backend ni funciones Cloudflare en V9.

---

## 9. Subir cambios a GitHub

Desde PowerShell:

```powershell
git status
git add .
git commit -m "Implementa Mapa 2 V9 UI UX final"
git push origin main
```

Cloudflare Pages debería disparar un redeploy automático.

---

## 10. Validación post-deploy

En Cloudflare Pages:

1. Abrir el último deployment.
2. Confirmar estado `Success`.
3. Abrir la URL pública.
4. Validar visualmente:
   - etiqueta `MAPA 2 · V9`,
   - mapa,
   - KPIs,
   - filtros,
   - capas,
   - detalle contextual.
5. Abrir DevTools:
   - Console: sin errores bloqueantes.
   - Network: filtrar `404`; no debe haber assets propios faltantes.
   - Issues: las advertencias de forms sin `id`/`name` deberían reducirse o desaparecer.

---

## 11. Riesgos pendientes

- La optimización avanzada de peso y estrategia de assets corresponde a V10; no se abordó en V9.
- `dist` sigue incluyendo datos públicos pesados heredados de V8, pero ninguno supera el límite auditado de 25 MiB por asset.
- La app no es mobile-first; se dejó comportamiento razonable para anchos menores sin rediseñar toda la experiencia móvil.

---

## 12. Qué compartir para validar V9

Compartir:

1. Captura completa de la app en local o Cloudflare.
2. Captura del panel lateral donde se vea `MAPA 2 · V9`.
3. Captura de DevTools Console.
4. Captura de Network filtrado por `404`.
5. Log completo de Cloudflare Pages del nuevo deploy.
6. Log de `npm run build` si hay diferencias locales.

---

## Conclusión técnica

La versión queda funcional y lista para validación de usuario como V9. No conviene avanzar a V10 hasta que V9 sea revisada visualmente y aprobada.
