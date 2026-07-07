# V11A.1 — Cloudflare Steps

## Escenario A — Deploy estático automático desde GitHub

Este escenario debe seguir funcionando aunque todavía no se use D1 desde frontend.

```powershell
npm install
npm run data:d1:build
npm run data:d1:readmodels
npm run data:api-cache:build
npm run build
git add .
git commit -m "V11A.1 Cloudflare Free optimization and API read models"
git push origin main
```

En Cloudflare Pages mantener:

```text
Build command: npm run build
Build output directory: dist
```

Validar:

- Deploy exitoso.
- App carga.
- Mapa carga.
- No hay errores de consola.
- No hay cambios visuales inesperados.
- Assets disponibles bajo `/data/api-cache/...`.

## Escenario B — Aplicar migración/read models en D1 local y remoto

### Local

```powershell
npx wrangler d1 migrations apply mapa2-db --local
npx wrangler d1 execute mapa2-db --local --file .\data\d1\v11a1_read_models.sql
```

Si se prefiere por chunks:

```powershell
npx wrangler d1 execute mapa2-db --local --file .\data\d1\chunks\v11a1_read_models_001.sql
npx wrangler d1 execute mapa2-db --local --file .\data\d1\chunks\v11a1_read_models_002.sql
```

Validar tablas:

```powershell
npx wrangler d1 execute mapa2-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'api_%' ORDER BY name;"
```

Validar conteos:

```powershell
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS provinces FROM api_province_summary;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS localities FROM api_locality_summary;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS locality_clients FROM api_locality_client_metrics;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS client_summaries FROM api_client_sales_summary;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS budgets FROM api_query_budget;"
```

Validar query plans:

```powershell
npx wrangler d1 execute mapa2-db --local --file .\data\d1\v11a1_query_plan_checks.sql
```

### Remoto

No aplicar remoto si falla local.

```powershell
npx wrangler d1 migrations apply mapa2-db --remote
npx wrangler d1 execute mapa2-db --remote --file .\data\d1\v11a1_read_models.sql
```

O por chunks:

```powershell
npx wrangler d1 execute mapa2-db --remote --file .\data\d1\chunks\v11a1_read_models_001.sql
npx wrangler d1 execute mapa2-db --remote --file .\data\d1\chunks\v11a1_read_models_002.sql
```

Validar remoto:

```powershell
npx wrangler d1 execute mapa2-db --remote --command "SELECT COUNT(*) AS provinces FROM api_province_summary;"
npx wrangler d1 execute mapa2-db --remote --command "SELECT COUNT(*) AS localities FROM api_locality_summary;"
npx wrangler d1 execute mapa2-db --remote --command "SELECT COUNT(*) AS locality_clients FROM api_locality_client_metrics;"
npx wrangler d1 execute mapa2-db --remote --command "SELECT COUNT(*) AS client_summaries FROM api_client_sales_summary;"
```

## Binding D1

Si ya está configurado desde V11A:

```text
Binding name: DB
Database: mapa2-db
```

En V11A.1 el frontend todavía no depende de este binding.
