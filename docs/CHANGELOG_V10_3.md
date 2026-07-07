# Mapa 2 — CHANGELOG V10.3

> **Nota V10.4:** este documento queda como registro histórico de V10.3. La versión funcional vigente es V10.4 sobre V10.3 aprobada.


**Fase:** Estabilización, contratos de datos y anti-regresión  
**Base:** `mapa2_v10_2_client_count_fix.zip`

## Cambios

- Se agregó capa `src/domain` con versión de app, contratos comerciales, contratos geográficos y contrato de datos agregado.
- Se agregó `src/data/dataManifest.ts` para separar explícitamente carga inicial y carga bajo demanda.
- Se agregó `src/data/dataValidators.ts` con validaciones runtime sin dependencias nuevas.
- Se agregó capa `src/services` como migración progresiva sobre `src/utils/aggregations.ts`.
- Se conectaron validadores en `src/data/dataClient.ts`.
- Se actualizó `src/app/App.tsx` para usar versión V10.3 y servicios nuevos sin rediseñar UI.
- Se agregaron scripts contractuales y smoke test estático de mapa.
- Se actualizó README, `docs/PROJECT_CONTEXT.md` y `SKILL.md` para reflejar V10.3 como versión actual.
- Se documentó nuevo orden posterior: V10.4, V11, V12, V13, V14.

## No se modificó

- No se implementó backend.
- No se regeneró V5.1.
- No se regeneró V6.
- No se cambió el modelo territorial.
- No se eliminó carga bajo demanda.
- No se incorporaron dependencias nuevas.
- No se rediseñó UI.

## Scripts agregados

```json
{
  "check:data-contracts": "node scripts/check_data_contracts.mjs",
  "check:business-contracts": "node scripts/check_business_contracts.mjs",
  "check:geo-contracts": "node scripts/check_geo_contracts.mjs",
  "check:map-smoke": "node scripts/check_map_smoke_v10_3.mjs",
  "validate:release": "npm run build && npm run check:data-contracts && npm run check:business-contracts && npm run check:geo-contracts"
}
```

## Resultado esperado

V10.3 debe fallar rápido si se rompe mapa, clientes, KPIs, contratos comerciales, contratos geográficos, carga progresiva o compatibilidad Cloudflare Pages Free.
