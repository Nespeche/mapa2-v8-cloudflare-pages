export const GEO_CONTRACT_VERSION = 'geo-v5.1-contract-v10.3' as const;

export const GEO_EXPECTED_COUNTS = {
  provinciasGeojsonFeatures: 24,
  provinciasIndex: 24,
} as const;

export const CLOUDFLARE_PAGES_LIMITS = {
  singleAssetLimitMiB: 25,
  softWarnMiB: 20,
} as const;

export const TERRITORIAL_MODEL = 'País → Provincia → Localidad' as const;

export const GEO_LOADING_CONTRACT = {
  initialLayers: ['metadata', 'provincias.geojson', 'provincias_index.json'],
  lazyLayers: ['departamentos por provincia', 'localidades por provincia', 'clientes.geojson', 'ventas_mensuales.csv'],
  forbiddenInitialLoads: ['radios nacionales', 'clientes.geojson', 'ventas_mensuales.csv'],
} as const;
