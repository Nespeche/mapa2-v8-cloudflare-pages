from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text

from load_to_gpkg import infer_ids, read_georef_resource
from utils import load_yaml, sqlite_connect


def configured_georef_resources(cfg: dict) -> list[tuple[str, dict]]:
    items: list[tuple[str, dict]] = list(cfg['georef']['resources'].items())
    for key, meta in (cfg.get('georef', {}).get('optional_resources', {}) or {}).items():
        for c in (meta.get('candidates') or [key]):
            meta2 = dict(meta)
            meta2['_logical_name'] = key
            items.append((c, meta2))
    return items


def load_seed_tables(seed_db: Path, engine) -> None:
    src = sqlite_connect(seed_db)
    for table in ['fuente_catalogo', 'geo_entidad', 'censo_poblacion', 'refeglo_gobiernos_locales', 'control_cobertura']:
        df = pd.read_sql_query(f'SELECT * FROM {table}', src)
        df.to_sql(table, engine, if_exists='append' if table in {'fuente_catalogo', 'geo_entidad', 'censo_poblacion'} else 'replace', index=False)
    src.close()


def main() -> None:
    parser = argparse.ArgumentParser(description='Carga fuentes descargadas a PostGIS.')
    parser.add_argument('--config', required=True)
    parser.add_argument('--raw-dir', required=True)
    parser.add_argument('--seed-db', required=True)
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--replace-spatial', action='store_true', default=False)
    args = parser.parse_args()

    cfg = load_yaml(args.config)
    raw = Path(args.raw_dir)
    engine = create_engine(args.database_url)

    with engine.begin() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS postgis'))

    # Carga tablas semilla. Para producción, primero ejecutar sql/00_schema_postgis.sql.
    load_seed_tables(Path(args.seed_db), engine)

    loaded_optional: set[str] = set()
    for resource, meta in configured_georef_resources(cfg):
        logical = meta.get('_logical_name', resource)
        if logical in loaded_optional:
            continue
        gdf = read_georef_resource(raw, resource)
        if gdf is None or gdf.empty:
            print(f'WARNING: no se encontró Georef {logical}')
            continue
        loaded_optional.add(logical)
        tipo = meta['tipo_entidad']
        gdf = infer_ids(gdf, tipo)
        gdf['fuente_geografica'] = 'georef'
        gdf['clasificacion_fuente'] = meta.get('clasificacion_fuente', 'oficial_directa')
        gdf['nivel_confianza'] = meta.get('nivel_confianza', 'alta')
        if gdf.crs is None:
            gdf = gdf.set_crs('EPSG:4326')
        else:
            gdf = gdf.to_crs('EPSG:4326')
        layer = f'stg_georef_{resource.replace("-", "_")}'
        gdf.to_postgis(layer, engine, if_exists='replace' if args.replace_spatial else 'append', index=False)
        print(f'Cargado a PostGIS: {layer} ({len(gdf):,})')

    print('Carga PostGIS finalizada. Ejecutar vistas en sql/01_views.sql si aún no existen.')


if __name__ == '__main__':
    main()
