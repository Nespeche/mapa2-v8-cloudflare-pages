# Mapa 2 — Validation Log V10.3

**Fase:** V10.3 — Estabilización, contratos de datos y anti-regresión  
**Fecha de ejecución:** 2026-07-07 UTC  
**Entorno:** Node `22.16.0`, npm `10.9.2`

---

## Validaciones ejecutadas

```powershell
npm install
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run build
npm run validate:release
npm run preview
```

---

## Resultado

| Comando | Resultado |
|---|---|
| `npm install` | OK, 0 vulnerabilities |
| `npm run check:client-counts` | OK, clientes=2000, departamentos_con_clientes=268, Bolívar=7 |
| `npm run check:data-contracts` | OK, 18 archivos obligatorios, 301 archivos en public/data |
| `npm run check:business-contracts` | OK, clientes=2000, productos=65, ventas_csv=128998, Bolívar=7 |
| `npm run check:geo-contracts` | OK, provincias=24, departamentos_ids=529 |
| `npm run check:map-smoke` | OK, smoke test estático MapLibre generado |
| `npm run build` | OK, `dist` generado |
| `npm run validate:release` | OK |
| `npm run preview` | OK, HTTP 200 en `http://127.0.0.1:4173/` |

---

## Build / Cloudflare

- Archivos en `dist`: `310`.
- Tamaño total `dist`: `168.78 MiB`.
- Mayor asset: `data/business/ventas_mensuales.csv` (`14.00 MiB`).
- Assets públicos > 25 MiB: `0`.
- Errores bloqueantes Cloudflare: `0`.
- Advertencia no bloqueante: no se incluye `_redirects`; se mantiene como aceptable para SPA actual sin `404.html`.

Top 10 assets de `dist`:

```text
data/business/ventas_mensuales.csv: 14.00 MiB
data/localidades_poligonos_fracciones.geojson: 9.73 MiB
data/provincias/provincia_14_cordoba/radios.geojson: 9.25 MiB
data/provincias/provincia_82_santa_fe/radios.geojson: 7.42 MiB
data/provincias/provincia_02_ciudad_autonoma_de_buenos_aires/radios.geojson: 5.29 MiB
data/provincias/provincia_30_entre_rios/radios.geojson: 4.54 MiB
data/provincias/provincia_06_buenos_aires/puntos.geojson: 4.04 MiB
data/provincias/provincia_06_buenos_aires/fracciones.geojson: 3.69 MiB
data/localidades_poligonos_gobiernos_locales.geojson: 3.42 MiB
data/provincias/provincia_50_mendoza/radios.geojson: 3.27 MiB
```

---

## Preview

`npm run preview -- --port 4173` sirvió la app correctamente y respondió:

```text
HTTP/1.1 200 OK
Content-Type: text/html
```

El HTML generado contiene:

```html
<title>Mapa 2 · V10.3 · Contratos de datos y anti-regresión</title>
```

---

## Validaciones manuales pendientes del usuario

Por limitación del entorno, la validación visual completa en navegador debe confirmarse localmente:

1. Abrir `http://127.0.0.1:5173/`.
2. Confirmar mapa visible.
3. Confirmar KPIs con clientes > 0 y ventas > 0.
4. Seleccionar Buenos Aires.
5. Activar coroplético departamento.
6. Activar Clientes, Clusters y Heatmap.
7. Filtrar producto y confirmar carga bajo demanda de CSV.
8. Network filtrado por `404` sin assets propios faltantes.
9. Consola sin errores rojos bloqueantes.
