# Mapa 2 — V11A D1 Validation

**Generado:** 2026-07-07T12:44:07.971Z

**Estado:** OK

## Resultado de scripts

| Check | Estado | Detalle |
|---|---:|---|
| migrations/0001_schema.sql existe | OK |  |
| data/d1/seed.sql existe | OK |  |
| data/d1/seed_summary.json existe | OK |  |
| package.json existe | OK |  |
| tabla requerida source_catalog | OK |  |
| tabla requerida province | OK |  |
| tabla requerida locality | OK |  |
| tabla requerida postal_code_area | OK |  |
| tabla requerida territorial_alias | OK |  |
| tabla requerida territorial_match_log | OK |  |
| tabla requerida census_population | OK |  |
| tabla requerida geometry_feature | OK |  |
| tabla requerida client | OK |  |
| tabla requerida product | OK |  |
| tabla requerida sale_monthly | OK |  |
| tabla requerida sales_aggregate_province_month | OK |  |
| tabla requerida sales_aggregate_locality_month | OK |  |
| tabla requerida sales_aggregate_product_month | OK |  |
| tabla requerida sales_aggregate_client_month | OK |  |
| tabla requerida app_metadata | OK |  |
| tabla requerida schema_migrations | OK |  |
| índice requerido idx_province_slug | OK |  |
| índice requerido idx_province_official_code | OK |  |
| índice requerido idx_locality_province | OK |  |
| índice requerido idx_locality_slug | OK |  |
| índice requerido idx_locality_province_name | OK |  |
| índice requerido idx_locality_official_code | OK |  |
| índice requerido idx_locality_georef | OK |  |
| índice requerido idx_locality_indec | OK |  |
| índice requerido idx_postal_code_area_cp | OK |  |
| índice requerido idx_postal_code_area_province | OK |  |
| índice requerido idx_postal_code_area_locality | OK |  |
| índice requerido idx_postal_code_area_prov_loc | OK |  |
| índice requerido idx_alias_entity | OK |  |
| índice requerido idx_alias_normalized | OK |  |
| índice requerido idx_census_entity_year | OK |  |
| índice requerido idx_census_province_locality | OK |  |
| índice requerido idx_geometry_entity | OK |  |
| índice requerido idx_geometry_province | OK |  |
| índice requerido idx_geometry_locality | OK |  |
| índice requerido idx_client_province | OK |  |
| índice requerido idx_client_locality | OK |  |
| índice requerido idx_client_postal_code | OK |  |
| índice requerido idx_client_match_confidence | OK |  |
| índice requerido idx_sale_client_period | OK |  |
| índice requerido idx_sale_product_period | OK |  |
| índice requerido idx_sale_period | OK |  |
| índice requerido idx_agg_province_period | OK |  |
| índice requerido idx_agg_locality_period | OK |  |
| índice requerido idx_agg_product_period | OK |  |
| índice requerido idx_agg_client_period | OK |  |
| SQL incompatible ausente: /\bSERIAL\b/i | OK |  |
| SQL incompatible ausente: /\bJSONB\b/i | OK |  |
| SQL incompatible ausente: /\bGEOMETRY\b/i | OK |  |
| SQL incompatible ausente: /\bST_[A-Z0-9_]+\s*\(/i | OK |  |
| SQL incompatible ausente: /\bILIKE\b/i | OK |  |
| SQL incompatible ausente: /\bCREATE\s+EXTENSION\b/i | OK |  |
| SQL incompatible ausente: /\bGENERATED\s+ALWAYS\s+AS\s+IDENTITY\b/i | OK |  |
| seed contiene INSERTs | OK |  |
| cada statement SQL <= 100 KB | OK | {"maxStatementBytes":1235} |
| seed contiene transacciones | OK |  |
| hay provincias | OK | 24 |
| hay localidades | OK | 21289 |
| hay clientes | OK | 2000 |
| hay productos | OK | 65 |
| hay ventas | OK | 128998 |
| hay agregados provincia/mes | OK | 264 |
| hay agregados localidad/mes | OK | 6432 |
| hay códigos postales trazados | OK | 943 |
| clientes V6 esperados preservados | OK | {"expected_clients_v6":2000,"actual_clients":2000,"actual_products":65,"actual_sales":128998,"orphan_sales_without_client":0,"orphan_sales_without_product":0,"orphan_clients_without_province":0,"orphan_clients_without_locality":0,"localities_without_province":0,"synthetic_rows_preserved":true} |
| no hay ventas huérfanas sin cliente | OK | 0 |
| no hay ventas huérfanas sin producto | OK | 0 |
| no hay clientes sin provincia válida | OK | 0 |
| no hay clientes sin localidad válida | OK | 0 |
| datos sintéticos marcados como sintéticos | OK | true |
| período ventas conserva 2025-01 a 2026-12 | OK | {"from":"2025-01","to":"2026-12","period_count":24} |
| geometrías pesadas no se cargan como JSON masivo | OK | {"max_geometry_json_bytes":8000,"geometry_json_rows":18470,"asset_path_rows":21313,"rule":"Polígonos pesados quedan como asset_path + bbox + centroide; D1 no se usa como PostGIS."} |
| script npm data:d1:build existe | OK | "node scripts/build_d1_seed.mjs" |
| script npm data:d1:validate existe | OK | "node scripts/validate_d1_seed.mjs" |
| script npm audit:d1 existe | OK | "node scripts/audit_d1_limits.mjs" |
| script npm validate:v11a existe | OK | "node scripts/validate_v11a.mjs" |
| script npm build existe | OK | "tsc -b && node scripts/check_v10_client_counts.mjs && vite build && node scripts/check_cloudflare_dist.mjs && node scripts/audit_dist_v10.mjs" |

## Validaciones ejecutadas

- Schema textual compatible SQLite/D1.
- Existencia de tablas obligatorias.
- Existencia de índices obligatorios.
- Ausencia de patrones PostgreSQL/PostGIS incompatibles.
- Seed generado y con statements menores a 100 KB.
- Integridad referencial calculada desde archivos fuente.
- Preservación de clientes, productos y ventas sintéticas V6.

## Nota

Esta validación no reemplaza la ejecución real con Wrangler/D1 local. El paso de D1 local se documenta en `docs/V11A_CLOUDFLARE_STEPS.md`.


---

## Auditoría de límites D1 Free

**Generado:** 2026-07-07T12:44:30.709Z

**Estado auditoría:** WARNING

- Tamaño seed completo: 119.822 MB.
- Límite D1 Free por base usado como referencia: 500 MB.
- Filas totales estimadas: 275525.
- Filas escritas remotas estimadas con índices: 826575.
- Mayor statement SQL: 1235 bytes.

- **WARNING — remote_rows_written:** La importación remota completa supera 100.000 filas escritas/día de D1 Free.
- **WARNING — remote_index_writes:** Con índices, la escritura remota puede multiplicar filas escritas. Cargar por chunks y monitorear métricas.
- **INFO — geometry_policy:** Polígonos pesados quedan por asset_path + bbox/centroide; correcto para V11A.
