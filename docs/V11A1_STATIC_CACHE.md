# V11A.1 — Static API Cache

Generado: 2026-07-07T00:00:00.000Z

## Objetivo

Preparar assets JSON livianos para catálogos casi inmutables. Estos archivos reducen lecturas D1 futuras, pero no reemplazan a D1 como fuente canónica.

## Archivos generados

| Archivo | Tamaño |
| --- | --- |
| localities_by_province/index.json | 5.92 KB |
| localities_by_province/provincia_02.json | 90.06 KB |
| localities_by_province/provincia_06.json | 2.36 MB |
| localities_by_province/provincia_10.json | 497.05 KB |
| localities_by_province/provincia_14.json | 1.66 MB |
| localities_by_province/provincia_18.json | 559.52 KB |
| localities_by_province/provincia_22.json | 685.30 KB |
| localities_by_province/provincia_26.json | 312.43 KB |
| localities_by_province/provincia_30.json | 778.33 KB |
| localities_by_province/provincia_34.json | 372.15 KB |
| localities_by_province/provincia_38.json | 458.33 KB |
| localities_by_province/provincia_42.json | 261.46 KB |
| localities_by_province/provincia_46.json | 396.51 KB |
| localities_by_province/provincia_50.json | 534.80 KB |
| localities_by_province/provincia_54.json | 478.40 KB |
| localities_by_province/provincia_58.json | 385.31 KB |
| localities_by_province/provincia_62.json | 404.60 KB |
| localities_by_province/provincia_66.json | 674.97 KB |
| localities_by_province/provincia_70.json | 286.32 KB |
| localities_by_province/provincia_74.json | 365.45 KB |
| localities_by_province/provincia_78.json | 158.87 KB |
| localities_by_province/provincia_82.json | 1.17 MB |
| localities_by_province/provincia_86.json | 1.04 MB |
| localities_by_province/provincia_90.json | 729.08 KB |
| localities_by_province/provincia_94.json | 40.20 KB |
| metadata.json | 1010 B |
| periods.json | 5.04 KB |
| products.json | 21.86 KB |
| provinces.json | 13.84 KB |

## Reglas aplicadas

- No se incluyen ventas crudas.
- No se incluyen clientes completos.
- No se incluyen geometrías pesadas.
- Los nombres de archivos por provincia se sanitizan para Windows: `provincia:06` -> `provincia_06.json`.
- El frontend actual no depende todavía de estos assets.

## Estado

WARNING. Hay advertencias de tamaño en el manifiesto.
