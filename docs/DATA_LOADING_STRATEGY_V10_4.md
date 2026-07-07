# Mapa 2 — Estrategia de carga de datos V10.4

**Objetivo:** mejorar filtros, velocidad y consistencia preservando V10.3 y sin implementar backend completo.

## 1. Principio rector

La app debe cargar al inicio solo lo necesario para renderizar el mapa base, KPIs iniciales y filtros principales. Todo dataset pesado o específico debe cargarse bajo demanda.

## 2. Carga inicial preservada

Actualmente `src/data/dataManifest.ts` mantiene como carga inicial:

- `data/metadata.json`
- `data/provincias.geojson`
- `data/indexes/provincias_index.json`
- `data/business/metadata_business_v6.json`
- `data/business/agregados/ventas_provincia_mes.json`
- `data/business/agregados/ventas_cliente_totales.json`
- `data/business/productos.json`
- `data/business/calendario.json`

Esta decisión permite iniciar la app sin cargar clientes, CSV detallado ni radios nacionales.

## 3. Carga bajo demanda preservada

Se preservan como lazy:

- `data/business/clientes.geojson`
- `data/business/agregados/ventas_departamento_mes.json`
- `data/business/agregados/ventas_producto_mes.json`
- `data/business/ventas_mensuales.csv`
- capas provinciales leídas desde `data/indexes/provincias_index.json`

## 4. Regla anti-regresión

No deben pasar a carga inicial:

- `clientes.geojson`
- `ventas_mensuales.csv`
- `radios.geojson`
- cualquier capa nacional pesada que no sea necesaria para el primer render

## 5. Evolución recomendada para V11

### 5.1 Partición comercial

Particionar o generar agregados por:

- provincia;
- localidad/departamento;
- producto;
- categoría;
- período;
- cliente;
- vista analítica.

### 5.2 Partición territorial

Priorizar:

- capas por provincia;
- capas por nivel territorial;
- simplificación geométrica para visualización;
- índices territoriales por `provincia_id` y `departamento_id`;
- manifests con tamaños y checksums.

### 5.3 Prefetch controlado

Prefetch solo cuando el usuario muestre intención clara:

- seleccionar provincia;
- activar clientes/clusters/heatmap;
- abrir filtros producto/categoría;
- seleccionar rango de períodos.

## 6. Impacto esperado

- Filtros por provincia/localidad más rápidos por menor cantidad de datos activos.
- Filtros por producto/categoría/período sin cargar CSV completo si existen agregados precalculados.
- KPIs más consistentes al usar una única semántica de agregación.
- Mejor navegación por estados de carga específicos y no persistentes.
- Mejor preparación para R2 si los datasets crecen.

## 7. No implementado en V10.4

- No se divide todavía `ventas_mensuales.csv`.
- No se mueven datasets a R2.
- No se crean endpoints Workers/Functions.
- No se cambia el modelo territorial.
- No se regeneran V5.1 ni V6.
