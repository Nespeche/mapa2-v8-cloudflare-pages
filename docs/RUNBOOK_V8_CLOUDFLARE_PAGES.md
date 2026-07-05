# Mapa 2 — Runbook V8: Deploy profesional en Cloudflare Pages Free

**Fase:** V8 — Deploy profesional en Cloudflare Pages Free  
**Base validada:** V7.1 — Frontend runtime fix  
**Objetivo:** publicar Mapa 2 como app estática en Cloudflare Pages Free sin backend y sin modificar las bases V5.1/V6/V7.1.

---

## 1. Estado preservado

Esta versión parte de V7.1 y mantiene:

- Frontend Vite + React + TypeScript + MapLibre.
- Datos públicos runtime en `public/data`.
- Base censal V5.1 preservada.
- Base comercial sintética V6 preservada.
- Carga bajo demanda de detalle comercial.
- Sin backend.
- Sin servicios pagos.

No se regeneraron datos censales ni comerciales.

---

## 2. Archivos agregados o modificados en V8

### Agregados

- `.gitignore`
- `.gitattributes`
- `.node-version`
- `public/_headers`
- `scripts/check_cloudflare_dist.mjs`
- `docs/RUNBOOK_V8_CLOUDFLARE_PAGES.md`
- `docs/CHANGELOG_V8.md`
- `docs/DIST_AUDIT_V8.md`
- `docs/DIST_AUDIT_V8.json`

### Modificados

- `package.json`
- `package-lock.json`

---

## 3. Requisitos locales

Recomendado:

```powershell
node -v
npm -v
```

Versión validada:

```text
Node.js: v22.16.0
npm: 10.9.2
```

Cloudflare Pages build image v3 también soporta Node.js `22.16.0`. El archivo `.node-version` fija esta versión para reducir riesgos de build.

---

## 4. Instalación local desde Windows / PowerShell

1. Extraer el ZIP V8 en una ruta corta, por ejemplo:

```powershell
C:\Mapa2\mapa2_v8_cloudflare_pages_ready
```

2. Entrar a la carpeta del proyecto:

```powershell
cd C:\Mapa2\mapa2_v8_cloudflare_pages_ready
```

3. Instalar dependencias:

```powershell
npm install
```

Resultado esperado:

```text
added 51 packages
found 0 vulnerabilities
```

---

## 5. Validación local de desarrollo

Ejecutar:

```powershell
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173/
```

Validar:

- La app abre.
- El mapa renderiza.
- No hay errores bloqueantes en consola.
- No aparece carga infinita.
- No queda fijo el mensaje `Cargando detalle comercial bajo demanda…`.
- Filtros, capas, KPIs y detalle comercial bajo demanda mantienen el comportamiento de V7.1.

Para detener el servidor:

```powershell
Ctrl + C
```

---

## 6. Build de producción

Ejecutar:

```powershell
npm run build
```

Este comando ejecuta:

```text
tsc -b
vite build
node scripts/check_cloudflare_dist.mjs
```

Resultado esperado:

```text
[cloudflare-check] Sin errores bloqueantes para Cloudflare Pages Free.
```

Métricas validadas en esta entrega:

```text
Archivos en dist: 309
Tamaño total dist: 182.73 MiB
Mayor asset: data/business/ventas_mensuales.csv — 14.00 MiB
Archivos mayores a 25 MiB: 0
```

---

## 7. Preview local de producción

Después de `npm run build`, ejecutar:

```powershell
npm run preview
```

Abrir:

```text
http://127.0.0.1:4173/
```

Validar:

- `/` responde 200.
- `/data/metadata.json` responde 200.
- `/data/business/metadata_business_v6.json` responde 200.
- `/favicon.svg` responde 200.
- Los assets bajo `/assets/*` responden 200.
- No hay 404 de assets propios.

---

## 8. Configuración Cloudflare Pages

Usar integración GitHub → Cloudflare Pages.

Configuración:

```text
Framework preset: React (Vite) o None
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22.16.0
```

No configurar backend, Workers, Pages Functions, D1, R2 ni KV en V8.

---

## 9. Preparar repositorio GitHub

> Recomendado: usar Git desde terminal o GitHub Desktop. No subir manualmente por navegador.

1. Crear un repositorio vacío en GitHub, por ejemplo:

```text
mapa2-v8-cloudflare-pages
```

2. Desde la carpeta del proyecto:

```powershell
git init
git branch -M main
git status
```

3. Confirmar que `.gitignore` excluye artefactos pesados no requeridos para deploy:

```powershell
git status --ignored
```

Deben quedar ignorados, entre otros:

```text
node_modules/
dist/
data/raw/
data/output/*.gpkg
data/output/*.sqlite
data/output/business_v6/
```

4. Agregar y commitear:

```powershell
git add .
git commit -m "Mapa 2 V8 Cloudflare Pages deploy ready"
```

5. Conectar remoto y subir:

```powershell
git remote add origin https://github.com/TU_USUARIO/mapa2-v8-cloudflare-pages.git
git push -u origin main
```

---

## 10. Crear proyecto en Cloudflare Pages

1. Entrar a Cloudflare Dashboard.
2. Ir a **Workers & Pages**.
3. Seleccionar **Create application**.
4. Seleccionar **Pages**.
5. Elegir **Import from an existing Git repository**.
6. Conectar GitHub si aún no está conectado.
7. Elegir el repositorio `mapa2-v8-cloudflare-pages`.
8. Configurar:

```text
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
```

9. En variables de entorno, agregar si Cloudflare no toma `.node-version`:

```text
NODE_VERSION=22.16.0
```

10. Seleccionar **Save and Deploy**.

---

## 11. Validación del primer deploy Preview

Cuando Cloudflare finalice el build:

1. Abrir la URL preview o production generada.
2. Abrir DevTools con `F12`.
3. Revisar pestaña **Console**:
   - No debe haber errores bloqueantes.
   - No debe haber errores MapLibre.
   - No debe haber errores de carga persistente.
4. Revisar pestaña **Network**:
   - Filtrar por `404`.
   - No debe haber 404 en assets propios.
   - Validar que carguen:
     - `/data/metadata.json`
     - `/data/provincias.geojson`
     - `/data/indexes/provincias_index.json`
     - `/data/business/metadata_business_v6.json`
     - `/data/business/agregados/ventas_provincia_mes.json`
     - `/data/business/clientes.geojson`
     - `/assets/*.js`
     - `/assets/*.css`
5. Validar visualmente:
   - Mapa visible.
   - KPIs visibles.
   - Filtros operativos.
   - Capas operativas.
   - Tooltips operativos.
   - Detalle comercial bajo demanda operativo.

---

## 12. Checklist local

- [ ] `npm install` finaliza sin errores.
- [ ] `npm run dev` levanta Vite.
- [ ] `http://127.0.0.1:5173/` abre la app.
- [ ] `npm run build` finaliza sin errores.
- [ ] `dist` se genera.
- [ ] `npm run check:cloudflare` finaliza sin errores bloqueantes.
- [ ] `npm run preview` abre el build de producción.
- [ ] No hay 404 de assets propios.
- [ ] No hay archivos >25 MiB en `dist`.
- [ ] No hay `.gpkg`, `.sqlite`, `.db`, `.zip` dentro de `dist`.
- [ ] No se modificó ni regeneró V5.1/V6.

---

## 13. Checklist Cloudflare

- [ ] Repositorio conectado desde GitHub.
- [ ] Production branch: `main`.
- [ ] Build command: `npm run build`.
- [ ] Build output directory: `dist`.
- [ ] Node version: `22.16.0`.
- [ ] Build log sin errores.
- [ ] Log incluye auditoría `[cloudflare-check]`.
- [ ] URL preview abre.
- [ ] URL production abre si se activa producción.
- [ ] Console sin errores bloqueantes.
- [ ] Network sin 404 de assets propios.
- [ ] Mapa renderiza.
- [ ] Capas cargan.
- [ ] Filtros funcionan.
- [ ] KPIs se actualizan.
- [ ] Detalle comercial bajo demanda funciona.

---

## 14. Rollback

Cloudflare Pages permite volver a un deployment productivo anterior desde el panel de Deployments.

Procedimiento:

1. Entrar a Cloudflare Dashboard.
2. Ir a **Workers & Pages**.
3. Abrir el proyecto de Mapa 2.
4. Entrar a **Deployments**.
5. Buscar el deployment productivo anterior estable.
6. Abrir el menú de tres puntos.
7. Seleccionar **Rollback to this deployment**.
8. Confirmar.
9. Validar nuevamente la URL production.

Nota: los preview deployments no son destinos válidos de rollback productivo; el rollback se hace contra deployments de producción correctamente construidos.

---

## 15. Qué compartir para validar V8 publicada

Compartime estos elementos después del deploy:

1. URL preview de Cloudflare Pages.
2. URL production si ya la activaste.
3. Captura o texto completo del build log de Cloudflare.
4. Captura de la app abierta en Cloudflare.
5. Captura de DevTools → Console.
6. Captura de DevTools → Network filtrando `404`.
7. Captura de DevTools → Network filtrando `data/metadata.json`.
8. Captura de DevTools → Network filtrando `assets`.
9. Confirmación visual de:
   - mapa,
   - filtros,
   - capas,
   - KPIs,
   - detalle comercial bajo demanda.

---

## 16. Conclusión técnica

La V8 queda preparada para Cloudflare Pages Free y no avanza a V9. La aprobación final requiere validar el deploy real con URL de Cloudflare y consola del navegador.

---

## 17. Referencias oficiales consultadas

- Cloudflare Pages — Build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Pages — Vite deploy guide: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- Cloudflare Pages — Limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages — Serving Pages / SPA behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
- Cloudflare Pages — Headers: https://developers.cloudflare.com/pages/configuration/headers/
- Cloudflare Pages — Direct Upload limits: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages — Build image / Node.js: https://developers.cloudflare.com/pages/configuration/build-image/
- Cloudflare Pages — Rollbacks: https://developers.cloudflare.com/pages/configuration/rollbacks/
- Vite — Building for Production: https://vite.dev/guide/build
- Vite — Preview CLI: https://vite.dev/guide/cli
- GitHub — About large files: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

---

## 18. Nota sobre archivos pesados y GitHub

El ZIP V8 conserva artefactos de trazabilidad heredados de fases anteriores, pero `.gitignore` evita que se suban al repositorio de deploy. Esto es importante porque GitHub bloquea archivos individuales mayores a 100 MiB en repositorios Git normales.

Para deploy en Cloudflare Pages desde GitHub, el contenido runtime necesario es el que Vite copia desde `public/` hacia `dist/`, más el bundle generado desde `src/`. Los archivos pesados de `data/output` y `data/raw` no forman parte de producción.
