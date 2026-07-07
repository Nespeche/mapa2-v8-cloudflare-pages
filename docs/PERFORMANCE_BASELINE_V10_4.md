# Mapa 2 — Performance baseline V10.4

**Base:** V10.3 aprobada  
**Fase:** V10.4  
**Tipo de medición:** técnica de archivos, build y estrategia de carga. No reemplaza medición Lighthouse/manual en navegador real.

## 1. Build esperado

El build usa:

```bash
npm run build
```

Internamente ejecuta:

```bash
tsc -b
node scripts/check_v10_client_counts.mjs
vite build
node scripts/check_cloudflare_dist.mjs
node scripts/audit_dist_v10.mjs
```

## 2. Baseline de V10.4

Los valores se actualizan ejecutando:

```bash
npm run build
npm run audit:architecture
npm run audit:data-loading
npm run audit:dependencies
```

Reportes generados:

- `docs/DIST_AUDIT_V10.md`
- `docs/DIST_AUDIT_V10.json`
- `docs/ARCHITECTURE_AUDIT_V10_4.md`
- `docs/DATA_LOADING_AUDIT_V10_4.md`
- `docs/DEPENDENCY_AUDIT_V10_4.md`

## 3. Umbrales operativos

- Assets individuales: mantener por debajo del umbral auditado por `check_cloudflare_dist.mjs`.
- Cantidad de archivos: mantener dentro de límites Cloudflare Pages Free.
- CSV detallado: no cargar al inicio.
- Clientes: no cargar al inicio.
- Radios: no cargar al inicio.
- Bundle MapView: mantener lazy con `React.lazy`.

## 4. Objetivos de performance para V11/V12

- Reducir trabajo en hilo principal durante filtros cruzados.
- Evitar parseo de CSV completo cuando existan agregados suficientes.
- Particionar datos comerciales por provincia/período/producto.
- Mantener un manifest con tamaño, tipo de carga y checksum.
- Explorar R2 solo si los datos empiezan a penalizar deploy o cache.

## 5. Observación

V10.4 no cambia algoritmos de mapa ni UI visual. La mejora concreta aplicada es de arquitectura, documentación, auditoría y limpieza de build Cloudflare respecto a Python.


---

## 6. Baseline final ejecutado en V10.4

- Archivos en `dist`: 310
- Tamaño total `dist`: 168.7846 MiB
- Mayor asset: `data/business/ventas_mensuales.csv` — 14.0001 MiB
- Assets > 25 MiB: 0
- `public/data`: 301 archivos — 167.1042 MiB
- Carga inicial conocida: 1.5631 MiB
- Carga bajo demanda conocida: 18.2304 MiB
- Radios publicados: 23 archivos — 59.6659 MiB
- Dependencias producción: 3
- Dependencias desarrollo: 5
- Backend implementado: no
- `requirements.txt` en raíz: no
- `tools/python/requirements.txt`: sí
