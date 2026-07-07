# Mapa 2 — Runbook V10 Performance / V10.1 Map Visibility Fix

Este runbook describe cómo aplicar, validar, subir a GitHub y desplegar V10 en Cloudflare Pages Free. Incluye el fix V10.1 de visibilidad del mapa reportado durante `npm run dev`.

## 1. Extraer ZIP

Usar una ruta corta para evitar problemas de Windows:

```powershell
mkdir C:\Mapa2
```

Extraer el ZIP en:

```text
C:\Mapa2\mapa2_v10_performance_optimized
```

Entrar al proyecto:

```powershell
cd C:\Mapa2\mapa2_v10_performance_optimized
```

## 2. Abrir en VSCode

```powershell
code .
```

## 3. Instalar dependencias

```powershell
npm install
```

Resultado esperado:

```text
found 0 vulnerabilities
```

Puede aparecer algún mensaje de funding; no es bloqueante.

## 4. Ejecutar local

```powershell
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173/
```

Validar:

- UI muestra `MAPA 2 · V10`.
- El mapa muestra geometrías de Argentina; no debe quedar como fondo azul/gris vacío.
- Mapa renderiza y muestra provincias/geometrías; no debe quedar el canvas vacío.
- KPIs visibles.
- Filtros visibles.
- Leyenda visible.
- Detalle/tooltip funciona.
- No hay carga infinita.

## 5. Validar Network local

En Chrome/Edge:

1. Abrir DevTools con `F12`.
2. Ir a `Network`.
3. Activar `Disable cache` mientras DevTools está abierto.
4. Recargar la app.
5. Filtrar `404`.
6. Confirmar que no hay assets propios faltantes.
7. Limpiar filtro.
8. Buscar `clientes.geojson`.
9. Confirmar que no aparece en la carga inicial de la capa base.
10. Activar `Clientes`, `Clusters` o `Heatmap`.
11. Confirmar que `clientes.geojson` aparece recién bajo demanda.

## 6. Build de producción

```powershell
npm run build
```

Este comando ejecuta:

```text
tsc -b
vite build
node scripts/check_cloudflare_dist.mjs
node scripts/audit_dist_v10.mjs
```

Resultado esperado:

- `dist` generado correctamente.
- Sin errores TypeScript.
- Sin errores bloqueantes Cloudflare.
- `docs/DIST_AUDIT_V10.md` generado.
- `docs/DIST_AUDIT_V10.json` generado.

## 7. Preview del build

```powershell
npm run preview
```

Abrir:

```text
http://127.0.0.1:4173/
```

Repetir smoke visual:

- Mapa renderiza y muestra provincias/geometrías; no debe quedar el canvas vacío.
- KPIs funcionan.
- Filtros funcionan.
- No hay errores de consola.
- Network `404` sin assets propios faltantes.

## 8. Subir a GitHub

Desde la carpeta del repo local:

```powershell
git status
```

Agregar cambios:

```powershell
git add .
```

Crear commit:

```powershell
git commit -m "Implement V10 performance optimization"
```

Subir a GitHub:

```powershell
git push origin main
```

## 9. Validar Cloudflare Pages

En Cloudflare Pages:

1. Entrar al proyecto conectado a `Nespeche/mapa2-v8-cloudflare-pages`.
2. Verificar que se inicia un nuevo deploy por el push a `main`.
3. Abrir el deploy log.
4. Confirmar:

```text
npm run build
vite build
check_cloudflare_dist
DIST_AUDIT_V10
```

5. Confirmar resultado final exitoso.
6. Abrir la URL publicada.
7. Validar que la app muestre `MAPA 2 · V10`.

## 10. Qué compartir para aprobación V10

Compartir en el chat:

1. Captura de la app publicada mostrando `MAPA 2 · V10`.
2. Captura del mapa renderizado.
3. Captura de KPIs/filtros visibles.
4. Captura DevTools Console sin errores bloqueantes.
5. Captura Network filtrado por `404` sin assets propios faltantes.
6. Captura Network donde `clientes.geojson` no aparezca en carga inicial y aparezca al activar Clientes/Clusters/Heatmap.
7. Log completo de Cloudflare Pages del deploy V10.
8. Si es posible, adjuntar:

```text
docs/DIST_AUDIT_V10.json
docs/DIST_AUDIT_V10.md
docs/VALIDATION_LOG_V10.txt
docs/FIX_V10_1_MAP_VISIBILITY.md
```

## 11. Rollback

Si el deploy V10 falla:

1. En Cloudflare Pages, usar rollback al deploy V9 aprobado.
2. En Git, volver al commit anterior estable si corresponde.
3. Compartir log de error y captura de consola para preparar fix V10.1.

No avanzar a V11 sin aprobación explícita.

## Fix V10.2 — Conteo de clientes en tooltip territorial

Si el mapa se visualiza correctamente pero el panel contextual muestra `Clientes 0` para departamentos/partidos con ventas, validar:

```powershell
npm run check:client-counts
npm run build
```

Resultado esperado:

```text
[client-count-v10.2] OK auditoría generada
[client-count-v10.2] clientes=2000 departamentos_con_clientes=268 bolivar=7
```

La causa corregida fue que V10 usaba agregados livianos sin IDs individuales de clientes. El conteo ahora se toma desde `clientes_unicos` o desde `ventas_cliente_totales.json` sin cargar `ventas_mensuales.csv` al inicio.
