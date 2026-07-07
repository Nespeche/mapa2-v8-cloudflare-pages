-- Mapa 2 V11A — Cloudflare D1 / SQLite schema
-- Objetivo: base canónica relacional para provincias, localidades normalizadas,
-- censo, códigos postales, clientes sintéticos, productos, ventas, agregados,
-- geometrías livianas/asset paths y trazabilidad.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source_catalog (
  source_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  license TEXT,
  retrieved_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS province (
  province_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  official_code TEXT,
  indec_code TEXT,
  georef_id TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  bbox_min_lng REAL,
  bbox_min_lat REAL,
  bbox_max_lng REAL,
  bbox_max_lat REAL,
  source_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (source_id) REFERENCES source_catalog(source_id)
);

CREATE TABLE IF NOT EXISTS locality (
  locality_id TEXT PRIMARY KEY,
  province_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  source_type TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  official_code TEXT,
  indec_code TEXT,
  georef_id TEXT,
  parent_admin_id TEXT,
  postal_code_primary TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  bbox_min_lng REAL,
  bbox_min_lat REAL,
  bbox_max_lng REAL,
  bbox_max_lat REAL,
  population_2022 INTEGER,
  confidence_level TEXT,
  data_source TEXT,
  source_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (source_id) REFERENCES source_catalog(source_id)
);

CREATE TABLE IF NOT EXISTS postal_code_area (
  postal_code_id TEXT PRIMARY KEY,
  postal_code TEXT NOT NULL,
  postal_code_type TEXT,
  province_id TEXT,
  locality_id TEXT,
  province_name_original TEXT,
  locality_name_original TEXT,
  locality_name_normalized TEXT,
  source_id TEXT,
  source_type TEXT,
  confidence_score REAL,
  match_method TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (source_id) REFERENCES source_catalog(source_id)
);

CREATE TABLE IF NOT EXISTS territorial_alias (
  alias_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  province_id TEXT,
  alias_original TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  source_id TEXT,
  confidence_score REAL,
  notes TEXT,
  created_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (source_id) REFERENCES source_catalog(source_id)
);

CREATE TABLE IF NOT EXISTS territorial_match_log (
  match_id TEXT PRIMARY KEY,
  input_type TEXT NOT NULL,
  input_value TEXT NOT NULL,
  province_input TEXT,
  locality_input TEXT,
  postal_code_input TEXT,
  matched_province_id TEXT,
  matched_locality_id TEXT,
  matched_by TEXT NOT NULL,
  confidence_score REAL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT,
  FOREIGN KEY (matched_province_id) REFERENCES province(province_id),
  FOREIGN KEY (matched_locality_id) REFERENCES locality(locality_id)
);

CREATE TABLE IF NOT EXISTS census_population (
  census_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  province_id TEXT,
  locality_id TEXT,
  census_year INTEGER NOT NULL,
  population_total INTEGER,
  source_id TEXT,
  confidence_level TEXT,
  notes TEXT,
  created_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (source_id) REFERENCES source_catalog(source_id)
);

CREATE TABLE IF NOT EXISTS geometry_feature (
  geometry_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  province_id TEXT,
  locality_id TEXT,
  layer_type TEXT NOT NULL,
  simplification_level TEXT NOT NULL,
  geometry_json TEXT,
  asset_path TEXT,
  bbox_min_lng REAL,
  bbox_min_lat REAL,
  bbox_max_lng REAL,
  bbox_max_lat REAL,
  centroid_lat REAL,
  centroid_lng REAL,
  properties_json TEXT,
  source_id TEXT,
  created_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (source_id) REFERENCES source_catalog(source_id)
);

CREATE TABLE IF NOT EXISTS client (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  province_id TEXT,
  locality_id TEXT,
  department_id TEXT,
  raw_locality_id TEXT,
  raw_locality_name TEXT,
  postal_code TEXT,
  lat REAL,
  lng REAL,
  segment TEXT,
  client_type TEXT,
  territorial_match_method TEXT,
  territorial_match_confidence REAL,
  synthetic_flag INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id)
);

CREATE TABLE IF NOT EXISTS product (
  product_id TEXT PRIMARY KEY,
  sku TEXT,
  product_name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  unit_measure TEXT,
  base_price REAL,
  estimated_weight_kg REAL,
  base_margin_pct REAL,
  synthetic_flag INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sale_monthly (
  sale_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  period_yyyymm TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  synthetic_flag INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  FOREIGN KEY (client_id) REFERENCES client(client_id),
  FOREIGN KEY (product_id) REFERENCES product(product_id)
);

CREATE TABLE IF NOT EXISTS sales_aggregate_province_month (
  aggregate_id TEXT PRIMARY KEY,
  province_id TEXT,
  locality_id TEXT,
  client_id TEXT,
  product_id TEXT,
  period_yyyymm TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  client_count INTEGER,
  sales_count INTEGER,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  created_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id)
);

CREATE TABLE IF NOT EXISTS sales_aggregate_locality_month (
  aggregate_id TEXT PRIMARY KEY,
  province_id TEXT,
  locality_id TEXT,
  client_id TEXT,
  product_id TEXT,
  period_yyyymm TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  client_count INTEGER,
  sales_count INTEGER,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  created_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id)
);

CREATE TABLE IF NOT EXISTS sales_aggregate_product_month (
  aggregate_id TEXT PRIMARY KEY,
  province_id TEXT,
  locality_id TEXT,
  client_id TEXT,
  product_id TEXT,
  period_yyyymm TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  client_count INTEGER,
  sales_count INTEGER,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  created_at TEXT,
  FOREIGN KEY (product_id) REFERENCES product(product_id)
);

CREATE TABLE IF NOT EXISTS sales_aggregate_client_month (
  aggregate_id TEXT PRIMARY KEY,
  province_id TEXT,
  locality_id TEXT,
  client_id TEXT,
  product_id TEXT,
  period_yyyymm TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  client_count INTEGER,
  sales_count INTEGER,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  created_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (client_id) REFERENCES client(client_id)
);

CREATE TABLE IF NOT EXISTS app_metadata (
  metadata_key TEXT PRIMARY KEY,
  metadata_value TEXT NOT NULL,
  value_type TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_province_slug ON province(slug);
CREATE INDEX IF NOT EXISTS idx_province_official_code ON province(official_code);

CREATE INDEX IF NOT EXISTS idx_locality_province ON locality(province_id);
CREATE INDEX IF NOT EXISTS idx_locality_slug ON locality(slug);
CREATE INDEX IF NOT EXISTS idx_locality_province_name ON locality(province_id, name_normalized);
CREATE INDEX IF NOT EXISTS idx_locality_official_code ON locality(official_code);
CREATE INDEX IF NOT EXISTS idx_locality_georef ON locality(georef_id);
CREATE INDEX IF NOT EXISTS idx_locality_indec ON locality(indec_code);

CREATE INDEX IF NOT EXISTS idx_postal_code_area_cp ON postal_code_area(postal_code);
CREATE INDEX IF NOT EXISTS idx_postal_code_area_province ON postal_code_area(province_id);
CREATE INDEX IF NOT EXISTS idx_postal_code_area_locality ON postal_code_area(locality_id);
CREATE INDEX IF NOT EXISTS idx_postal_code_area_prov_loc ON postal_code_area(province_id, locality_id);

CREATE INDEX IF NOT EXISTS idx_alias_entity ON territorial_alias(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alias_normalized ON territorial_alias(alias_normalized);

CREATE INDEX IF NOT EXISTS idx_census_entity_year ON census_population(entity_type, entity_id, census_year);
CREATE INDEX IF NOT EXISTS idx_census_province_locality ON census_population(province_id, locality_id);

CREATE INDEX IF NOT EXISTS idx_geometry_entity ON geometry_feature(entity_type, entity_id, layer_type, simplification_level);
CREATE INDEX IF NOT EXISTS idx_geometry_province ON geometry_feature(province_id);
CREATE INDEX IF NOT EXISTS idx_geometry_locality ON geometry_feature(locality_id);

CREATE INDEX IF NOT EXISTS idx_client_province ON client(province_id);
CREATE INDEX IF NOT EXISTS idx_client_locality ON client(locality_id);
CREATE INDEX IF NOT EXISTS idx_client_department ON client(department_id);
CREATE INDEX IF NOT EXISTS idx_client_postal_code ON client(postal_code);
CREATE INDEX IF NOT EXISTS idx_client_match_confidence ON client(territorial_match_confidence);

CREATE INDEX IF NOT EXISTS idx_sale_client_period ON sale_monthly(client_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_sale_product_period ON sale_monthly(product_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_sale_period ON sale_monthly(period_yyyymm);

CREATE INDEX IF NOT EXISTS idx_agg_province_period ON sales_aggregate_province_month(province_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_agg_locality_period ON sales_aggregate_locality_month(locality_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_agg_product_period ON sales_aggregate_product_month(product_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_agg_client_period ON sales_aggregate_client_month(client_id, period_yyyymm);

INSERT OR REPLACE INTO schema_migrations (migration_id, applied_at, description)
VALUES ('0001_schema', '2026-07-07T00:00:00.000Z', 'V11A initial D1 schema for Mapa 2');
