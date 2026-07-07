# Mapa 2 — Checklist anti-regresión V10.3

## Checks automáticos

```powershell
npm install
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run build
npm run validate:release
npm run preview
```

## Mapa

- [ ] La app abre en `http://127.0.0.1:5173/`.
- [ ] Existe contenedor `.map-canvas`.
- [ ] `maplibre-gl/dist/maplibre-gl.css` se importa en `src/app/main.tsx`.
- [ ] El canvas del mapa no queda oculto por CSS.
- [ ] `.map-stage` conserva altura visible.
- [ ] `provincias-fill` existe como layer MapLibre.
- [ ] Buenos Aires se puede seleccionar.
- [ ] Al seleccionar Buenos Aires se cargan departamentos/partidos.
- [ ] No vuelve el problema de pantalla vacía o mapa oculto.

## Clientes

- [ ] KPIs sin filtros muestran clientes > 0.
- [ ] KPIs sin filtros muestran ventas > 0.
- [ ] Buenos Aires conserva clientes.
- [ ] Bolívar no vuelve a `Clientes 0` cuando existen clientes.
- [ ] Activar `Clientes` carga `clientes.geojson` bajo demanda.
- [ ] Activar `Clusters` muestra clusters.
- [ ] Activar `Heatmap` mantiene mapa visible.

## Filtros y detalle

- [ ] Filtro producto/categoría carga `ventas_mensuales.csv` solo cuando corresponde.
- [ ] Filtro período produce ventas coherentes.
- [ ] Los agregados por provincia, departamento, producto y cliente cierran contra CSV.
- [ ] No hay loading persistente de detalle comercial.

## Cloudflare/dist

- [ ] `dist` se genera.
- [ ] `dist/index.html` existe.
- [ ] No hay assets > 25 MiB.
- [ ] `dist` no incluye `.gpkg`, `.sqlite`, `.db`, `.zip`, `data/raw` ni `data/output`.
- [ ] Build command Cloudflare: `npm run build`.
- [ ] Output directory Cloudflare: `dist`.
- [ ] Network filtrado por `404` no muestra assets propios faltantes.
- [ ] Consola navegador sin errores rojos bloqueantes.
