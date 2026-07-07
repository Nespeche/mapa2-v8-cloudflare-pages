# Mapa 2 — Contratos de datos V10.3

**Fase:** V10.3 — Estabilización, contratos de datos y anti-regresión  
**Modelo territorial:** `País → Provincia → Localidad`  
**Regla:** V10.3 no regenera datos V5.1/V6; solo valida y blinda.

---

## Contrato comercial V6

| Entidad | Contrato |
|---|---:|
| Clientes | 2.000 |
| Productos | 65 |
| Ventas mensuales CSV | 128.998 registros |
| Calendario | 24 meses |
| Período inicial | 2025-01 |
| Período final | 2026-12 |
| `ventas_cliente_totales.json` | 2.000 registros |
| `ventas_departamento_mes.json` | 6.432 registros |
| `ventas_producto_mes.json` | 1.560 registros |
| `ventas_provincia_mes.json` | 264 registros |

Validaciones:

- Todo cliente debe tener `cliente_id`, `provincia_id`, `departamento_id`, `lat`, `lon` y `dato_sintetico = true`.
- Toda venta debe tener `cliente_id` existente.
- Toda venta debe tener `producto_id` existente.
- Todo producto debe tener `producto_id` y `categoria_producto`.
- Los agregados por cliente, departamento/mes, producto/mes y provincia/mes deben cerrar contra `ventas_mensuales.csv`.
- Buenos Aires debe conservar clientes.
- Bolívar debe conservar clientes.
- Venta neta sin filtros no puede ser 0.

---

## Contrato geográfico/censal V5.1

| Entidad | Contrato |
|---|---:|
| `provincias.geojson` | 24 features |
| `provincias_index.json` | 24 provincias |
| Asset público máximo | ≤ 25 MiB |

Validaciones:

- IDs de provincia de clientes existen en `provincias.geojson`.
- IDs de departamento de clientes existen en capas `departamentos.geojson`.
- Capas departamentales declaradas en el índice existen y no están vacías.
- No hay geometrías públicas vacías críticas para capas usadas por el frontend.
- No se cargan radios nacionales al inicio.
- Se conserva carga por provincia/capa.

---

## Contrato de carga progresiva

### Permitido al inicio

- Provincias.
- Índice de provincias.
- Metadata censal/comercial.
- Productos.
- Calendario.
- Agregados provincia/mes.
- Agregados cliente total.

### Prohibido al inicio

- `clientes.geojson`.
- `ventas_mensuales.csv`.
- radios nacionales.
- outputs raw o archivos de trabajo pesados.

### Permitido bajo demanda

- Clientes al activar `Clientes`, `Clusters` o `Heatmap`.
- Departamentos al seleccionar provincia o coroplético departamento.
- Producto/mes al filtrar producto/categoría.
- CSV detallado cuando el filtro lo requiere.

---

## Semántica KPI

| KPI | Definición |
|---|---|
| `clientesVisibles` | Clientes territoriales filtrados cuando se usan agregados. Cuando el cálculo usa `detalle-csv`, clientes con ventas activas en el período/producto/categoría filtrado. |
| `ventaNeta` | Suma de `venta_neta` para el conjunto filtrado. |
| `unidades` | Suma de `unidades` para el conjunto filtrado. |
| `margenBruto` | Suma de `margen_bruto` para el conjunto filtrado. |
| `ticketPromedio` | `ventaNeta / clientesVisibles`; si `clientesVisibles = 0`, devuelve 0. |
| `provinciaLider` | Provincia con mayor `venta_neta` dentro del filtro activo. |
| `productoLider` | Producto con mayor `venta_neta` cuando hay detalle; con agregados iniciales usa fallback de metadata. |
| `categoriaLider` | Categoría con mayor `venta_neta` cuando hay detalle; con agregados iniciales puede quedar sin datos. |
| `fuente` | Origen del cálculo: `agregados`, `cliente-agregado`, `departamento-agregado` o `detalle-csv`. |

---

## Scripts contractuales

```powershell
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run validate:release
```
