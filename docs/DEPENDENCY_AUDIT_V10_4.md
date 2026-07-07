# Mapa 2 — Auditoría de dependencias V10.4

**Fase:** V10.4 — Auditoría de dependencias y build Cloudflare  
**Fecha UTC:** 2026-07-07T10:19:26.664Z

## Resultado

**Estado:** OK

- Sin hallazgos bloqueantes.

## Node / npm

- Node fijado en `.node-version`: 22.16.0
- `package-lock.json`: presente
- `.npmrc`: presente

## Dependencias frontend

**Producción:** `maplibre-gl`, `react`, `react-dom`  
**Desarrollo:** `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `typescript`, `vite`

## Python / ETL

- `requirements.txt` en raíz: no
- `tools/python/requirements.txt`: sí
- Flujo local recomendado: `make python-install` o `python -m pip install -r tools/python/requirements.txt`.

## Backend

- Backend implementado: no
- `functions/` / Wrangler: sin señales
- Dependencias backend: sin dependencias

## Seguridad

- Archivos `.env` privados detectados: 0
