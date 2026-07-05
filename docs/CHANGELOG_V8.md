# Mapa 2 — Changelog V8

**Versión:** V8 — Deploy profesional en Cloudflare Pages Free  
**Fecha:** 2026-07-05  
**Base:** V7.1 — Frontend runtime fix validado

## Objetivo

Preparar Mapa 2 para publicación estática en Cloudflare Pages Free, preservando la funcionalidad validada de V7.1, la base censal V5.1 y la base comercial sintética V6.

## Cambios incorporados

1. `package.json`
   - Nombre actualizado a `mapa2-v8-cloudflare-pages-ready`.
   - Versión actualizada a `8.0.0`.
   - Script `build` extendido para ejecutar auditoría Cloudflare después de `vite build`.
   - Nuevo script `check:cloudflare`.
   - Nuevo script `preview:prod`.

2. `package-lock.json`
   - Actualizado para reflejar nombre y versión V8.

3. `.node-version`
   - Se fija Node.js `22.16.0`, compatible con el build validado y con el build image v3 de Cloudflare Pages.

4. `.gitignore`
   - Evita subir `node_modules`, `dist`, entornos locales y artefactos pesados no requeridos para el deploy.
   - Excluye `data/raw/`, `.gpkg`, `.sqlite`, `.db` y outputs pesados duplicados.
   - Preserva `public/data`, que es la base runtime que consume la app.

5. `.gitattributes`
   - Normalización de finales de línea para mantener compatibilidad Windows-safe.

6. `public/_headers`
   - Headers básicos para Cloudflare Pages.
   - Cache largo solo en `/assets/*`, porque Vite genera assets con hash.

7. `scripts/check_cloudflare_dist.mjs`
   - Auditoría automática de `dist`.
   - Valida cantidad de archivos.
   - Valida límite de 25 MiB por asset.
   - Detecta extensiones no aptas para producción en `dist`.
   - Confirma existencia de `index.html` y reporta `_headers`/`_redirects`.

8. Documentación V8
   - `docs/RUNBOOK_V8_CLOUDFLARE_PAGES.md`
   - `docs/DIST_AUDIT_V8.md`
   - `docs/DIST_AUDIT_V8.json`
   - `docs/CHANGELOG_V8.md`

## Decisiones técnicas

### No se agregó `_redirects`

No corresponde agregar `_redirects` en esta fase porque la app es una SPA completa y no existe `404.html` en raíz. Cloudflare Pages aplica fallback SPA automáticamente en ese escenario. Evité una regla catch-all para no arriesgar reescrituras indebidas de assets.

### No se agregó backend

La V8 mantiene la arquitectura estática. No se incorporaron Cloudflare Workers, Pages Functions, D1, KV ni R2.

### No se regeneraron datos

No se regeneró la base censal V5.1 ni la base comercial sintética V6. Los datos runtime bajo `public/data` se preservan.

## Resultado de validación local

- `npm install`: OK.
- `npm run dev`: OK.
- `npm run build`: OK.
- `dist`: generado correctamente.
- `dist` file count: 309.
- `dist` total: 182.73 MiB.
- Mayor archivo en `dist`: `data/business/ventas_mensuales.csv` — 14.00 MiB.
- Archivos mayores a 25 MiB en `dist`: 0.
- `.gpkg`, `.sqlite`, `.db`, `.zip` en `dist`: 0.
- Preview local de producción: OK.

## Estado final

La versión V8 queda lista para deploy en Cloudflare Pages Free vía GitHub, pero la aprobación final requiere publicar la URL preview/production y validar navegador/consola sobre Cloudflare.

## Nota GitHub / archivos pesados

La V8 agrega `.gitignore` para excluir del repositorio de deploy archivos de trazabilidad heredados que no son necesarios en producción, especialmente `data/raw/`, `.gpkg`, `.sqlite` y duplicados de `data/output/business_v6/`. La app mantiene sus datos runtime en `public/data`, que sí deben entrar al build y a `dist`.
