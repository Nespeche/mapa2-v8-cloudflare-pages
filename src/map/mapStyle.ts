import type { StyleSpecification } from 'maplibre-gl';

export const argentinaInitialCenter: [number, number] = [-64.4, -38.4];
export const argentinaInitialZoom = 3.35;

export const mapBaseStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-opacity': 0.46,
        'raster-saturation': -0.68,
        'raster-contrast': 0.05,
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
