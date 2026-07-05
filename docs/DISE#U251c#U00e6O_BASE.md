# Diseño de base relacional y espacial

## Entidades principales

### `geo_entidad`

Representa cualquier unidad territorial: país, provincia, departamento/partido/comuna, municipio, gobierno local, localidad, localidad censal, asentamiento, fracción, radio o barrio.

Campos clave:

- `id_entidad`: clave técnica estable con prefijo por tipo.
- `tipo_entidad`: nivel geográfico.
- `codigo_indec`, `codigo_georef`, `codigo_refeglo`, `codigo_bahra`, `codigo_osm`: códigos de interoperabilidad.
- `nombre`, `nombre_normalizado`: nombre original y versión normalizada para matching.
- `provincia_id`, `departamento_id`, `municipio_id`, `gobierno_local_id`, `localidad_id`: jerarquía principal cuando es inequívoca.
- `geom`: geometría en EPSG:4326.
- `centroide`: punto para visualización rápida.
- `clasificacion_fuente`, `metodo_geometria`, `nivel_confianza`: trazabilidad.

### `geo_relacion`

Resuelve relaciones que no son estrictamente jerárquicas.

Ejemplos:

- gobierno local que intersecta más de un departamento,
- localidad administrada por un gobierno local,
- barrio estimado a partir de radios censales,
- equivalente entre código INDEC y Georef.

### `censo_poblacion`

Guarda métricas censales por entidad y año.

La clave no presupone que una entidad tenga un único dato poblacional. Puede haber:

- dato oficial directo,
- dato oficial procesado,
- dato estimado,
- dato histórico.

La vista `vw_mapa_entidades` prioriza 2022 y fuentes oficiales directas.

## Regla de oro para matching

1. Coincidencia exacta por código INDEC/Georef/REFEGLO.
2. Coincidencia por código provincial + código departamental + nombre normalizado.
3. Coincidencia por nombre normalizado + provincia + geometría/intersección.
4. Matching manual en `staging_match_log` si el score no es confiable.

## Barrios

Barrios no se guardan como una jerarquía nacional obligatoria. Se guardan como `tipo_entidad='barrio'` o `tipo_entidad='barrio_popular'` con:

- fuente,
- método,
- confianza,
- relación espacial con localidad/municipio/departamento/provincia.

La población por barrio solo se marca como `oficial_directa` cuando la fuente la publica directamente. En caso contrario se marca como `estimada`.

## Mapa

Para el mapa usar:

```sql
SELECT * FROM vw_mapa_entidades WHERE tipo_entidad = 'provincia';
SELECT * FROM vw_mapa_entidades WHERE tipo_entidad = 'departamento_partido_comuna';
SELECT * FROM vw_mapa_entidades WHERE tipo_entidad = 'gobierno_local';
SELECT * FROM vw_mapa_entidades WHERE tipo_entidad = 'localidad_censal';
SELECT * FROM vw_mapa_entidades WHERE tipo_entidad IN ('barrio','barrio_popular');
```

En PostGIS se recomienda exponer las capas como vector tiles con Tegola, Martin, pg_tileserv o una API propia.
