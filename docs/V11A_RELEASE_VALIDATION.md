# Mapa 2 — V11A Release Validation

**Generado:** 2026-07-07T12:45:23.933Z

**Estado:** OK

| Check | Estado | Detalle |
|---|---:|---|
| archivo requerido wrangler.toml | OK |  |
| archivo requerido migrations/0001_schema.sql | OK |  |
| archivo requerido scripts/build_d1_seed.mjs | OK |  |
| archivo requerido scripts/validate_d1_seed.mjs | OK |  |
| archivo requerido scripts/audit_d1_limits.mjs | OK |  |
| archivo requerido scripts/validate_v11a.mjs | OK |  |
| archivo requerido data/d1/seed.sql | OK |  |
| archivo requerido data/d1/seed_summary.json | OK |  |
| archivo requerido data/d1/d1_audit_report.json | OK |  |
| archivo requerido docs/V11A_D1_SCHEMA.md | OK |  |
| archivo requerido docs/V11A_MIGRATION_REPORT.md | OK |  |
| archivo requerido docs/V11A_D1_VALIDATION.md | OK |  |
| archivo requerido docs/V11A_CLOUDFLARE_STEPS.md | OK |  |
| archivo requerido docs/V11A_GITHUB_STEPS.md | OK |  |
| archivo requerido docs/V11A_ROLLBACK.md | OK |  |
| archivo requerido docs/POSTAL_CODES_SOURCES.md | OK |  |
| archivo requerido docs/V11A_CHANGELOG.md | OK |  |
| script npm data:d1:build | OK | "node scripts/build_d1_seed.mjs" |
| script npm data:d1:validate | OK | "node scripts/validate_d1_seed.mjs" |
| script npm audit:d1 | OK | "node scripts/audit_d1_limits.mjs" |
| script npm validate:v11a | OK | "node scripts/validate_v11a.mjs" |
| script npm build | OK | "tsc -b && node scripts/check_v10_client_counts.mjs && vite build && node scripts/check_cloudflare_dist.mjs && node scripts/audit_dist_v10.mjs" |
| wrangler.toml tiene binding DB | OK |  |
| wrangler.toml usa database_name mapa2-db | OK |  |
| wrangler.toml mantiene placeholder seguro de database_id | OK |  |
| V11A no perdió clientes | OK | 2000 |
| V11A no perdió ventas | OK | 128998 |
| V11A conserva productos | OK | 65 |
| V11A trae localidades normalizadas | OK | 21289 |
| V11A modela códigos postales | OK | 943 |
| no existe .env real en raíz | OK | [] |
| node_modules no forma parte requerida del entregable | OK | "Si existe localmente por npm install, se excluye al generar ZIP." |

## Nota

Este reporte valida artefactos V11A. La validación del frontend se completa con `npm run build`; la validación D1 real se completa con los comandos Wrangler locales documentados.
