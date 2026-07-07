# Mapa 2 — Project Context V10.4

**Versión funcional vigente:** V10.4 — Decisión de arquitectura de carga de datos y backend.  
**Base aprobada inmediata:** V10.3 — Estabilización, contratos de datos y anti-regresión.  
**Deploy vigente informado por el usuario:** `https://mapa2-v8-cloudflare-pages.pages.dev` y preview específico V10.3 `https://01a27b81.mapa2-v8-cloudflare-pages.pages.dev`.  
**Nota:** el nombre del proyecto Cloudflare/GitHub puede contener `v8`, pero no debe interpretarse como versión funcional vigente.

## Estado preservado

- V5.1 censal/geográfica preservada.
- V6 comercial sintética preservada.
- V7.1 runtime fix preservado.
- V8 deploy Cloudflare preservado.
- V9 UI/UX preservada.
- V10 performance/carga progresiva preservada.
- V10.3 contratos y anti-regresión preservados.

## Modelo territorial

```text
País → Provincia → Localidad
```

En Mapa 2, Localidad puede representar localidad formal, barrio, municipio, departamento, partido, comuna, aglomerado, gobierno local o división equivalente cuando sea necesario para vincular geometría, población, clientes, ventas, filtros y KPIs.

## Decisión V10.4

- Principal: Cloudflare Pages + datos estáticos mejor particionados.
- Plan B: Cloudflare R2 para datasets pesados/versionados cuando exista necesidad.
- Condicional: Workers/Pages Functions solo para endpoints livianos.
- Limitado: D1 solo para metadata/índices livianos.
- No recomendado por ahora: Railway/Postgres/PostGIS.

## Backend

No hay backend implementado en V10.4. No crear Functions, Workers, D1, Railway ni PostGIS sin autorización explícita posterior.

## Build Cloudflare

V10.4 mueve dependencias Python a:

```text
tools/python/requirements.txt
```

Objetivo: evitar que Cloudflare Pages ejecute `pip install -r requirements.txt` en un build frontend estático.

## Scripts V10.4

```bash
npm run audit:architecture
npm run audit:data-loading
npm run audit:dependencies
npm run validate:architecture
npm run validate:release
```

## Roadmap vigente

```text
V10.3 — Estabilización, contratos de datos y anti-regresión. Aprobada.
V10.4 — Decisión de arquitectura de carga de datos y backend.
V11   — Implementación de arquitectura elegida para datos/backend si se justifica.
V12   — Refactor y mejora profesional del frontend.
V13   — Analytics comercial avanzado y storytelling.
V14   — Producto final, documentación pública y mantenimiento.
```

## Reglas de preservación

- No modificar V5.1/V6 salvo error bloqueante documentado.
- No cambiar modelo territorial.
- No cargar clientes, CSV detallado ni radios al inicio.
- No rediseñar UI durante V10.4.
- No implementar backend completo durante V10.4.
- Mantener compatibilidad Windows y Cloudflare Pages Free.
