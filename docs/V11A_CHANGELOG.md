# Mapa 2 — V11A Changelog

## Resumen

Se implementó exclusivamente V11A: schema D1, migración local, pipeline de seed, códigos postales iniciales, auditoría de límites y documentación. No se implementaron APIs, no se migró el frontend a API-first y no se aplicó rediseño HeroUI.

## Archivos creados

- `wrangler.toml`
- `migrations/0001_schema.sql`
- `scripts/build_d1_seed.mjs`
- `scripts/validate_d1_seed.mjs`
- `scripts/audit_d1_limits.mjs`
- `scripts/validate_v11a.mjs`
- `data/d1/seed.sql`
- `data/d1/chunks/seed_001_sources_territory.sql`
- `data/d1/chunks/seed_002_business_core_and_aggregates.sql`
- `data/d1/chunks/seed_003_sales_2025.sql`
- `data/d1/chunks/seed_004_sales_2026.sql`
- `data/d1/seed_summary.json`
- `data/d1/validation_report.json`
- `data/d1/d1_audit_report.json`
- `data/d1/v11a_release_validation.json`
- `docs/V11A_D1_SCHEMA.md`
- `docs/V11A_MIGRATION_REPORT.md`
- `docs/V11A_D1_VALIDATION.md`
- `docs/V11A_CLOUDFLARE_STEPS.md`
- `docs/V11A_GITHUB_STEPS.md`
- `docs/V11A_ROLLBACK.md`
- `docs/POSTAL_CODES_SOURCES.md`
- `docs/V11A_CHANGELOG.md`
- `docs/V11A_RELEASE_VALIDATION.md`

## Archivos modificados

- `package.json`: se agregaron scripts `data:d1:build`, `data:d1:validate`, `audit:d1`, `validate:v11a`.
- `.gitignore`: se agregaron reglas para `.wrangler/` y bases D1/SQLite locales.

## Datos preservados

- Clientes V6: 2,000.
- Productos V6: 65.
- Ventas V6: 128,998.
- Período ventas: 2025-01 a 2026-12.
- Datos sintéticos marcados: sí.

## Datos D1 generados

- Provincias: 24.
- Localidades normalizadas: 21,289.
- Códigos postales auxiliares: 943.
- Aliases territoriales: 21,313.
- Logs de matching territorial: 2,000.
- Poblaciones censales: 21,313.
- Geometrías / asset paths: 21,313.
- Agregados cliente/mes: 48,000.

## Decisiones técnicas

1. D1 queda como base canónica relacional, no como motor GIS espacial.
2. Las geometrías pesadas se referencian por `asset_path` y se acompañan con bbox/centroide.
3. Los códigos postales se importan solo desde fuentes internas trazables y con score de confianza.
4. Los clientes se normalizan a departamento/partido/comuna para compatibilidad con click poligonal; la localidad granular se preserva en columnas raw.
5. El seed se divide en chunks para facilitar carga local/remota.

## Estado de auditoría

- `npm run data:d1:build`: OK.
- `npm run data:d1:validate`: OK.
- `npm run audit:d1`: WARNING por límites remotos D1 Free.
- `npm run validate:v11a`: OK.

## Pendientes para V11B

- Crear Pages Functions/Workers.
- Implementar endpoints controlados sobre D1.
- Usar queries parametrizadas y paginación.
- Crear tests API.
- Mantener frontend estático hasta validar API.
