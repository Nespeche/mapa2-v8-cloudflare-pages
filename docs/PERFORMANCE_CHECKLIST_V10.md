# Mapa 2 — Checklist de performance V10

## Validación local

- [ ] Extraer ZIP en ruta corta Windows-safe.
- [ ] Ejecutar `npm install`.
- [ ] Ejecutar `npm run dev`.
- [ ] Abrir `http://127.0.0.1:5173/`.
- [ ] Confirmar que la UI muestra `MAPA 2 · V10`.
- [ ] Confirmar que el mapa renderiza.
- [ ] Confirmar que KPIs y filtros funcionan.
- [ ] Confirmar que no queda persistente el mensaje de carga bajo demanda.
- [ ] Abrir DevTools → Console y confirmar que no hay errores bloqueantes.
- [ ] Abrir DevTools → Network y filtrar `404`; confirmar que no hay assets propios faltantes.
- [ ] En Network, recargar la app en modo `base` y confirmar que no se solicita `data/business/clientes.geojson` durante el inicio.
- [ ] Activar capa `Clientes`, `Clusters` o `Heatmap` y confirmar que `data/business/clientes.geojson` se solicita bajo demanda.
- [ ] Seleccionar provincia y confirmar carga bajo demanda de departamentos/partidos.
- [ ] Activar `Puntos localidades` con provincia seleccionada y confirmar carga bajo demanda de puntos.
- [ ] Aplicar filtro de producto/categoría y confirmar que el detalle comercial carga bajo demanda.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npm run preview`.
- [ ] Abrir `http://127.0.0.1:4173/` y repetir smoke visual básico.

## Validación de `dist`

- [ ] `dist/index.html` existe.
- [ ] `dist/_headers` existe.
- [ ] No hay `.gpkg`, `.sqlite`, `.db`, `.zip`, backups ni raw outputs en `dist`.
- [ ] No hay assets mayores a 25 MiB.
- [ ] `docs/DIST_AUDIT_V10.md` se genera.
- [ ] `docs/DIST_AUDIT_V10.json` se genera.
- [ ] `blocking_errors` en el JSON es `0`.

## Validación Cloudflare Pages

- [ ] Subir cambios a GitHub.
- [ ] Confirmar que Cloudflare Pages dispara build automático.
- [ ] Confirmar Build command: `npm run build`.
- [ ] Confirmar Build output directory: `dist`.
- [ ] Confirmar que el deploy finaliza correctamente.
- [ ] Abrir URL publicada.
- [ ] Confirmar `MAPA 2 · V10`.
- [ ] Confirmar mapa, KPIs, filtros, leyenda y detalle.
- [ ] DevTools Console: sin errores bloqueantes.
- [ ] DevTools Network con filtro `404`: sin assets propios faltantes.
