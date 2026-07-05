import type { LngLatBoundsLike } from 'maplibre-gl';
import type { GeoJsonFeature, GeoJsonFeatureCollection } from '../types/geo';

type Coordinates = number | Coordinates[];

function walkCoordinates(coords: Coordinates, collector: Array<[number, number]>): void {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    collector.push([coords[0] as number, coords[1] as number]);
    return;
  }
  for (const child of coords) walkCoordinates(child as Coordinates, collector);
}

export function boundsFromFeature(feature: GeoJsonFeature): LngLatBoundsLike | null {
  const geometry = feature.geometry as { coordinates?: Coordinates } | null;
  if (!geometry?.coordinates) return null;
  const points: Array<[number, number]> = [];
  walkCoordinates(geometry.coordinates, points);
  if (!points.length) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function findFeatureById(geojson: GeoJsonFeatureCollection, id: string): GeoJsonFeature | null {
  return geojson.features.find((feature) => {
    const props = feature.properties ?? {};
    return props.id_entidad === id || props.provincia_id === id || props.departamento_id === id;
  }) ?? null;
}
