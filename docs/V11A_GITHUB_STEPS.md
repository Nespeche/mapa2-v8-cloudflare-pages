# Mapa 2 — V11A GitHub Steps

## 1. Ver estado

```powershell
git status
```

## 2. Validar antes de commitear

```powershell
npm install
npm run data:d1:build
npm run data:d1:validate
npm run audit:d1
npm run build
npm run validate:v11a
```

## 3. Revisar que no entren archivos prohibidos

```powershell
git status --short
git ls-files | Select-String -Pattern "node_modules|\.env|dist|\.zip$|\.sqlite$|\.db$"
```

Notas:

- `node_modules/`, `dist/`, `.env`, `.wrangler/`, `.db`, `.sqlite`, `.zip` no deben commitearse.
- `data/d1/seed.sql`, `data/d1/chunks/*.sql`, `data/d1/*.json` sí forman parte de V11A porque son artefactos reproducibles del seed D1.
- `data/raw/` y `data/output/business_v6/` ya están ignorados para deploy; se conservan en el ZIP como trazabilidad de fase, no para producción Cloudflare Pages.

## 4. Commit

```powershell
git add .
git commit -m "V11A D1 schema and migration pipeline"
git push origin main
```

## 5. Validación posterior al push

```powershell
git status
```

Esperado:

```text
nothing to commit, working tree clean
```

## 6. Archivos principales que deben quedar versionados

- `wrangler.toml`
- `migrations/0001_schema.sql`
- `scripts/build_d1_seed.mjs`
- `scripts/validate_d1_seed.mjs`
- `scripts/audit_d1_limits.mjs`
- `scripts/validate_v11a.mjs`
- `data/d1/seed.sql`
- `data/d1/chunks/*.sql`
- `data/d1/seed_summary.json`
- `data/d1/d1_audit_report.json`
- `docs/V11A_*.md`
- `docs/POSTAL_CODES_SOURCES.md`
