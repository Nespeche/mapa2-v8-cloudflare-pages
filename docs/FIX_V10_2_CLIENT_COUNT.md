# Mapa 2 — Fix V10.2: conteo de clientes en tooltip territorial

**Versión:** V10.2 — Client Count Tooltip Fix  
**Base corregida:** V10.1 — Map Visibility Fix  
**Alcance:** corrección funcional dentro de V10. No avanza a V11. No agrega backend. No modifica el modelo territorial País → Provincia → Localidad.

## Problema reportado

En la vista con provincia seleccionada y capa `Clientes`, el mapa ya se visualizaba correctamente, pero el panel contextual mostraba `Clientes 0` para los departamentos/partidos, aunque sí existían ventas netas y clientes sintéticos asociados.

Ejemplo reportado visualmente: departamento/partido Bolívar en Buenos Aires mostraba venta neta, pero `Clientes 0`.

## Causa técnica

V10 optimizó la carga inicial para evitar traer datos pesados al inicio. Como parte de esa optimización, la app empezó a priorizar agregados livianos por provincia/departamento/mes y a diferir `ventas_mensuales.csv`.

El error apareció porque el tooltip territorial usaba este cálculo:

```ts
sales?.clientes.size ?? Number(props.clientes_v7 ?? 0)
```

Pero los agregados por departamento/mes no incluyen IDs individuales de clientes; incluyen el campo agregado `clientes_unicos`. Por eso el `Set` interno `clientes` quedaba vacío aunque la fila agregada sí tuviera clientes. Resultado: el panel mostraba `0`.

## Corrección aplicada

1. Se extendió `AggregatedBucket` con `clientes_unicos`.
2. Se agregó `getBucketClientCount(bucket)` para resolver el conteo de clientes desde:
   - IDs únicos cuando existen (`bucket.clientes.size`), o
   - conteo agregado (`bucket.clientes_unicos`) cuando la fuente no incluye IDs.
3. Los agregados de provincia/departamento ahora conservan `row.clientes_unicos`.
4. Se agregó `computeDepartmentSalesFromClientTotals()` para derivar ventas y clientes por departamento desde `ventas_cliente_totales.json` cuando no hace falta cargar CSV detallado.
5. Se agregó `mergeClientCountsIntoDepartmentSales()` para fusionar conteos de clientes sin pisar ventas agregadas.
6. `enrichGeoJsonWithSales()` ahora escribe `clientes_v7` usando `getBucketClientCount()`.
7. `tooltipFromDepartment()` ahora muestra el conteo correcto desde `clientes_unicos` o desde el fallback de propiedades.
8. Se agregó una auditoría liviana `scripts/check_v10_client_counts.mjs` y el script `npm run check:client-counts`.
9. `npm run build` ejecuta esa auditoría antes de Vite para detectar regresiones de conteo.

## Resultado de auditoría V10.2

- Clientes agregados: `2000`.
- Departamentos con clientes derivados de `ventas_cliente_totales.json`: `268`.
- Caso Bolívar — clientes desde totales cliente: `7`.
- Caso Bolívar — máximo `clientes_unicos` mensual: `7`.
- Errores bloqueantes: `0`.

Reportes generados:

- `docs/CLIENT_COUNT_AUDIT_V10_2.json`
- `docs/CLIENT_COUNT_AUDIT_V10_2.md`

## Por qué no se cargó el CSV detallado para resolverlo

La solución correcta para V10 era mantener la optimización: no cargar `ventas_mensuales.csv` si el caso puede resolverse con agregados livianos. Para este problema, el conteo de clientes podía reconstruirse desde `ventas_cliente_totales.json` y desde `clientes_unicos` de agregados departamentales, por lo tanto no era necesario volver a cargar el CSV pesado al inicio.

## Estado preservado

- V5.1 censal/geográfica preservada.
- V6 comercial sintética preservada.
- V7.1 runtime fix preservado.
- V8 Cloudflare preservado.
- V9 UI/UX preservada.
- V10 performance/carga progresiva preservada.
- V10.1 visibilidad de mapa preservada.

## Validaciones ejecutadas

```powershell
npm install
npm run check:client-counts
npm run build
```

Resultado: sin errores bloqueantes.

## Prevención de regresiones

Este fix agrega una barrera liviana de build para que futuras optimizaciones no vuelvan a dejar los conteos territoriales en cero cuando existen clientes agregados.

Para V11 se recomienda convertir estas validaciones en smoke tests automatizados de UI, pero en V10.2 se mantiene deliberadamente un alcance liviano para no avanzar de fase.
