import type { StyleSpecification } from 'maplibre-gl';

export const argentinaInitialCenter: [number, number] = [-64.4, -38.4];
export const argentinaInitialZoom = 3.35;

// V10.1: estilo base interno, sin dependencia inicial de tiles externos.
// La app geoespacial renderiza con GeoJSON propio; esto evita que un bloqueo o latencia de OSM
// impida el evento de estilo y deje el mapa en blanco durante desarrollo o deploy estático.
export const mapBaseStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'mapa2-background',
      type: 'background',
      paint: {
        'background-color': '#dbe4f0',
      },
    },
  ],
};

export function choroplethFill(maxValue: number): any[] {
  const max = Math.max(maxValue || 1, 1);
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', 'venta_neta_v7'], 0],
    0,
    'rgba(236, 242, 255, 0.62)',
    max * 0.18,
    'rgba(178, 207, 255, 0.72)',
    max * 0.38,
    'rgba(112, 161, 255, 0.78)',
    max * 0.68,
    'rgba(62, 103, 219, 0.84)',
    max,
    'rgba(24, 47, 137, 0.9)',
  ];
}

export function heatmapWeight(maxValue: number): any[] {
  const max = Math.max(maxValue || 1, 1);
  return ['interpolate', ['linear'], ['coalesce', ['get', 'venta_neta_v7'], ['get', 'venta_neta'], 1], 0, 0.15, max, 1];
}
