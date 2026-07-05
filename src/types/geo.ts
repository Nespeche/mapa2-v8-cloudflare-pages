export type GeoJsonFeature = {
  type: 'Feature';
  geometry: unknown;
  properties: Record<string, unknown>;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  name?: string;
  features: GeoJsonFeature[];
  [key: string]: unknown;
};

export interface ProvinceIndexLayer {
  relative_path: string;
  feature_count: number;
  population_sum?: number;
  size_mb?: number;
}

export interface ProvinceIndexEntry {
  provincia_id: string;
  provincia_codigo: string;
  provincia_nombre: string;
  folder: string;
  layers: Record<string, ProvinceIndexLayer>;
}

export interface ProvincesIndex {
  version: string;
  generated_at: string;
  cloudflare_single_asset_limit_mib: number;
  provinces: Record<string, ProvinceIndexEntry>;
}
