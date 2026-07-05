from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
from shapely.geometry import shape

from utils import load_yaml, normalize_code, normalize_text, sqlite_connect


def read_ndjson_georef(path: Path) -> gpd.GeoDataFrame:
    records: list[dict[str, Any]] = []
    geometries = []
    with open(path, 'r', encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            # Algunos NDJSON incluyen un primer registro de metadatos.
            if 'metadatos' in obj and len(obj) == 1:
                continue
            geom = obj.pop('geometria', None) or obj.pop('geometry', None)
            if geom is None and obj.get('type') == 'Feature':
                geom = obj.get('geometry')
                props = obj.get('properties') or {}
                obj = props
            geometries.append(shape(geom) if geom else None)
            records.append(obj)
    return gpd.GeoDataFrame(records, geometry=geometries, crs='EPSG:4326')


def read_georef_resource(raw_dir: Path, resource: str) -> gpd.GeoDataFrame | None:
    base = raw_dir / 'georef'
    candidates = [base / f'{resource}.ndjson', base / f'{resource}.geojson', base / f'{resource}.zip']
    for path in candidates:
        if not path.exists() or path.stat().st_size == 0:
            continue
        if path.suffix == '.ndjson':
            return read_ndjson_georef(path)
        return gpd.read_file(path)
    return None


def infer_ids(gdf: gpd.GeoDataFrame, tipo: str) -> gpd.GeoDataFrame:
    gdf = gdf.copy()
    id_col = 'id' if 'id' in gdf.columns else None
    if id_col:
        gdf['codigo_georef'] = gdf[id_col].map(lambda x: normalize_code(x))
    elif 'codigo' in gdf.columns:
        gdf['codigo_georef'] = gdf['codigo'].map(lambda x: normalize_code(x))
    else:
        gdf['codigo_georef'] = None
    gdf['tipo_entidad'] = tipo
    if 'nombre' not in gdf.columns:
        name_cols = [c for c in gdf.columns if 'nombre' in c.lower()]
        gdf['nombre'] = gdf[name_cols[0]] if name_cols else gdf['codigo_georef']
    gdf['nombre_normalizado'] = gdf['nombre'].map(normalize_text)
    gdf['id_entidad'] = gdf.apply(lambda r: f'{tipo}:{r.get("codigo_georef") or r.name}', axis=1)
    gdf['clasificacion_fuente'] = 'oficial_directa'
    gdf['metodo_geometria'] = 'descarga_georef'
    gdf['nivel_confianza'] = 'alta'
    return gdf


def write_seed_tables_to_gpkg(seed_db: Path, gpkg: Path) -> None:
    # GeoPackage es SQLite; luego de escribir capas espaciales agregamos tablas relacionales.
    src = sqlite_connect(seed_db)
    dst = sqlite3.connect(gpkg)
    for table in ['fuente_catalogo', 'geo_entidad', 'censo_poblacion', 'refeglo_gobiernos_locales', 'control_cobertura']:
        df = pd.read_sql_query(f'SELECT * FROM {table}', src)
        df.to_sql(table, dst, if_exists='replace', index=False)
    dst.close()
    src.close()


def main() -> None:
    parser = argparse.ArgumentParser(description='Construye GeoPackage con capas Georef y tablas censales semilla.')
    parser.add_argument('--config', required=True)
    parser.add_argument('--raw-dir', required=True)
    parser.add_argument('--seed-db', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    cfg = load_yaml(args.config)
    raw = Path(args.raw_dir)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    wrote_any_layer = False
    for resource, meta in cfg['georef']['resources'].items():
        gdf = read_georef_resource(raw, resource)
        if gdf is None or gdf.empty:
            print(f'WARNING: no se encontró Georef {resource} en {raw / "georef"}.')
            continue
        tipo = meta['tipo_entidad']
        gdf = infer_ids(gdf, tipo)
        gdf['fuente_geografica'] = 'georef'
        gdf['clasificacion_fuente'] = meta.get('clasificacion_fuente', 'oficial_directa')
        gdf['nivel_confianza'] = meta.get('nivel_confianza', 'alta')
        if gdf.crs is None:
            gdf = gdf.set_crs('EPSG:4326')
        else:
            gdf = gdf.to_crs('EPSG:4326')
        layer = resource.replace('-', '_')
        gdf.to_file(out, layer=layer, driver='GPKG')
        wrote_any_layer = True
        print(f'Capa escrita: {layer} ({len(gdf):,} registros)')

    # Si no se descargaron polígonos todavía, crea un GPKG con tablas semilla igualmente.
    if not wrote_any_layer:
        # Crear un GeoPackage mínimo con una capa vacía evita errores de sqlite sobre archivo inexistente.
        empty = gpd.GeoDataFrame({'id': []}, geometry=[], crs='EPSG:4326')
        empty.to_file(out, layer='placeholder', driver='GPKG')

    write_seed_tables_to_gpkg(Path(args.seed_db), out)
    print(f'GeoPackage generado: {out}')


if __name__ == '__main__':
    main()
