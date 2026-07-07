# Mapa 2 V11A.1 — Cloudflare Free Optimization + D1 Read Models

**Estado de fase:** V11A.1 lista para validación local.  
**Base preservada:** V11A D1 schema/migration sobre V10.4, sin cambios visuales ni APIs reales.  
**Modelo territorial:** `País → Provincia → Localidad`, donde localidad puede representar localidad formal, barrio, municipio, departamento, partido, comuna, aglomerado o división equivalente.

> Los clientes, productos y ventas siguen siendo datos sintéticos V6. No representan clientes reales ni operaciones reales.

---

## Objetivo de V11A.1

Preparar Mapa 2 para V11B/V11C optimizando el uso futuro de Cloudflare D1 Free:

- read models D1 para endpoints frecuentes;
- cache JSON estático liviano para catálogos casi inmutables;
- presupuesto de lectura por API futura;
- auditoría de query plans e índices;
- documentación de estrategia Cloudflare Free;
- validación anti-regresión sin cambiar frontend, UI ni MapLibre.

V11A.1 **no** implementa Pages Functions reales, **no** conecta el frontend a D1 y **no** aplica rediseño HeroUI.

---

## Stack

- React
- Vite
- TypeScript
- MapLibre
- Cloudflare Pages Free
- Cloudflare D1 / SQLite compatible schema
- Scripts Node.js sin dependencias nuevas para V11A.1
- Datos estáticos actuales preservados en `public/data`

---

## Validación local recomendada

Desde PowerShell:

```powershell
npm install
npm run data:d1:build
npm run data:d1:validate
npm run data:d1:readmodels
npm run data:api-cache:build
npm run audit:d1
npm run audit:api-budget
npm run audit:query-plans
npm run build
npm run validate:v11a
npm run validate:v11a1
```

Opcional:

```powershell
npm run dev
```

---

## D1 local

```powershell
npx wrangler d1 migrations apply mapa2-db --local
npx wrangler d1 execute mapa2-db --local --file .\data\d1\v11a1_read_models.sql
```

Validar conteos:

```powershell
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS provinces FROM api_province_summary;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS localities FROM api_locality_summary;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS locality_clients FROM api_locality_client_metrics;"
npx wrangler d1 execute mapa2-db --local --command "SELECT COUNT(*) AS client_summaries FROM api_client_sales_summary;"
```

---

## Documentación principal

- `docs/V11A1_OPTIMIZATION_PLAN.md`
- `docs/V11A1_READ_MODELS.md`
- `docs/V11A1_STATIC_CACHE.md`
- `docs/V11A1_API_READ_BUDGET.md`
- `docs/V11A1_QUERY_PLAN_AUDIT.md`
- `docs/V11A1_CLOUDFLARE_FREE_STRATEGY.md`
- `docs/V11A1_VALIDATION.md`
- `docs/V11A1_GITHUB_STEPS.md`
- `docs/V11A1_CLOUDFLARE_STEPS.md`
- `docs/V11A1_ROLLBACK.md`
- `docs/V11B_PREPARATION_NOTES.md`

---

## Notas de entrega

- El ZIP final excluye `node_modules`, `dist`, `.git`, `.wrangler`, `.env`, `.sqlite`, `.db` y ZIPs internos.
- Se removieron del entregable dos binarios internos heredados: `data/output/arg_geo_censo_semilla.sqlite` y `data/raw/georef/municipios.zip`.
- La app actual sigue usando su flujo estático hasta V11C.
