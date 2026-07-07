# Mapa 2 — Fix V10.1 de visibilidad del mapa

## Diagnóstico

Durante la validación local de V10 con `npm run dev`, la UI cargaba correctamente, pero el área central del mapa quedaba en blanco. Los KPIs, filtros, leyenda y paneles funcionaban, por lo que el problema no estaba en la carga inicial de datos ni en React completo, sino en la inicialización/renderizado de MapLibre y sus capas.

Causa probable detectada:

1. V10 movió MapLibre a carga diferida con `React.lazy`.
2. La inicialización de capas propias dependía del evento `load` de MapLibre.
3. El estilo base usaba tiles externos de OpenStreetMap.
4. Si los tiles externos se demoraban, fallaban o eran bloqueados, el evento usado para instalar las capas GeoJSON podía no ejecutarse a tiempo, dejando el canvas sin provincias/departamentos visibles.
5. Además, el pseudo-overlay visual de `.map-stage::before` estaba por encima del canvas, lo que podía lavar o cubrir elementos sutiles del mapa.

## Corrección aplicada

- Se mantuvo la carga diferida de `MapView`/MapLibre para preservar la optimización V10.
- Se movió `maplibre-gl/dist/maplibre-gl.css` a `src/app/main.tsx` para que el CSS base de MapLibre esté disponible antes de montar el mapa diferido.
- Se cambió el estilo base a un background interno sin dependencia inicial de tiles externos.
- Se inicializan las capas propias en `style.load` y `load`, con fallback por `requestAnimationFrame` y timeout corto.
- Se agregó `ResizeObserver` para ejecutar `map.resize()` si cambia el contenedor.
- Se corrigió el z-index del canvas para que el mapa quede visualmente por encima del overlay decorativo y por debajo de topbar/right rail.
- Se agregó logging no bloqueante de errores MapLibre para facilitar diagnóstico sin romper la app.

## Archivos modificados

- `src/app/main.tsx`
- `src/components/MapView.tsx`
- `src/map/mapStyle.ts`
- `src/app/styles.css`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/RUNBOOK_V10_PERFORMANCE.md`
- `docs/VALIDATION_LOG_V10.txt`

## Alcance preservado

Este fix no cambia el modelo territorial, no regenera datos censales, no regenera datos comerciales sintéticos, no agrega backend, no incorpora Workers/Functions/D1/R2/KV y no avanza a V11.

## Validación esperada

- `npm install` funciona.
- `npm run dev` muestra el mapa nuevamente.
- `npm run build` genera `dist` sin errores.
- `npm run preview` muestra el mapa nuevamente.
- Network filtrado por `404` no muestra assets propios faltantes.
- `clientes.geojson` no carga inicialmente y se carga al activar Clientes/Clusters/Heatmap.
- La UI mantiene `MAPA 2 · V10`.
