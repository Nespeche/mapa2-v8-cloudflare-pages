# V11A.1 — Rollback

## Volver a V11A sin tocar D1 remoto

Si todavía no se aplicó migración remota:

```powershell
git status
git restore .
```

O revertir el commit V11A.1:

```powershell
git log --oneline
git revert <HASH_DEL_COMMIT_V11A1>
git push origin main
```

## Ignorar cache estático si falla

La app V11A no depende de `public/data/api-cache`. Si hay problemas con esos assets:

```powershell
Remove-Item -Recurse -Force .\public\data\api-cache
npm run build
```

Luego revertir o regenerar:

```powershell
npm run data:d1:readmodels
npm run data:api-cache:build
```

## Si se aplicó migración local

D1 local puede recrearse limpiando `.wrangler` o creando una DB local nueva. No subir `.wrangler` al repo ni al ZIP.

## Si se aplicó migración remota

No usar `DROP TABLE` manual sobre producción sin respaldo. Crear una migración correctiva que deje las tablas `api_*` sin uso o las regenere correctamente. Como el frontend V11A.1 no depende de D1, la app estática seguirá funcionando aunque las tablas read model fallen.

## Archivos a revertir si V11A.1 se bloquea

- `migrations/0002_v11a1_api_read_optimization.sql`
- `scripts/build_v11a1_read_models.mjs`
- `scripts/generate_v11a1_static_cache.mjs`
- `scripts/audit_v11a1_api_read_budget.mjs`
- `scripts/check_v11a1_query_plans.mjs`
- `scripts/validate_v11a1.mjs`
- `scripts/v11a1_utils.mjs`
- `data/d1/v11a1_*`
- `public/data/api-cache/`
- `docs/V11A1_*`
- `docs/V11B_PREPARATION_NOTES.md`

## Condición de seguridad

No avanzar a V11B si V11A.1 no instala, no compila o `validate:v11a1` falla con errores bloqueantes.
