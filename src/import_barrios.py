from __future__ import annotations

import argparse
import datetime as dt
import sqlite3
from pathlib import Path

import geopandas as gpd
import pandas as pd

from utils import normalize_code, normalize_text


SOURCE_PRESETS = {
    'caba': {
        'tipo_entidad': 'barrio',
        'fuente': 'badata_barrios_caba',
        'clasificacion_fuente': 'oficial_parcial',
        'metodo_geometria': 'descarga_directa_municipal',
        'nivel_confianza': 'alta',
    },
    'renabap': {
        'tipo_entidad': 'barrio_popular',
        'fuente': 'renabap',
        'clasificacion_fuente': 'oficial_parcial',
        'metodo_geometria': 'descarga_directa_renabap',
        'nivel_confianza': 'media',
    },
    'municipal': {
        'tipo_entidad': 'barrio',
        'fuente': 'municipal',
        'clasificacion_fuente': 'oficial_parcial',
        'metodo_geometria': 'descarga_directa_municipal',
        'nivel_confianza': 'media',
    },
    'provincial': {
        'tipo_entidad': 'barrio',
        'fuente': 'provincial',
        'clasificacion_fuente': 'oficial_parcial',
        'metodo_geometria': 'descarga_directa_provincial',
        'nivel_confianza': 'media',
    },
    'osm': {
        'tipo_entidad': 'barrio',
        'fuente': 'osm_geofabrik',
        'clasificacion_fuente': 'no_oficial',
        'metodo_geometria': 'osm_boundary_neighbourhood',
        'nivel_confianza': 'baja',
    },
}


def main() -> None:
    parser = argparse.ArgumentParser(description='Importa capa de barrios a GeoPackage normalizado.')
    parser.add_argument('--input', required=True, help='GeoJSON/SHP/GPKG de barrios')
    parser.add_argument('--out-gpkg', required=True)
    parser.add_argument('--source-type', required=True, choices=sorted(SOURCE_PRESETS))
    parser.add_argument('--layer-name', default='barrios_importados')
    parser.add_argument('--name-field', default='nombre')
    parser.add_argument('--code-field', default=None)
    parser.add_argument('--provincia-code', default=None)
    parser.add_argument('--departamento-code', default=None)
    parser.add_argument('--municipio-code', default=None)
    parser.add_argument('--overwrite-layer', action='store_true')
    args = parser.parse_args()

    src = Path(args.input)
    gpkg = Path(args.out_gpkg)
    if not src.exists():
        raise SystemExit(f'No existe input: {src}')
    if not gpkg.exists():
        raise SystemExit(f'No existe GeoPackage destino: {gpkg}')

    preset = SOURCE_PRESETS[args.source_type]
    gdf = gpd.read_file(src)
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4326')
    else:
        gdf = gdf.to_crs('EPSG:4326')

    rows = []
    for idx, row in gdf.iterrows():
        name = str(row.get(args.name_field) or row.get('name') or row.get('NOMBRE') or '').strip()
        if not name:
            name = f'barrio_{idx}'
        code = normalize_code(row.get(args.code_field)) if args.code_field else None
        norm = normalize_text(name)
        stable_code = code or f'{normalize_text(args.source_type)}_{idx}'
        rows.append({
            'id_entidad': f'{preset["tipo_entidad"]}:{args.source_type}:{stable_code}',
            'tipo_entidad': preset['tipo_entidad'],
            'codigo_indec': None,
            'codigo_georef': None,
            'codigo_refeglo': None,
            'codigo_fuente': code,
            'nombre': name,
            'nombre_normalizado': norm,
            'provincia_id': f'provincia:{normalize_code(args.provincia_code, 2)}' if args.provincia_code else None,
            'departamento_id': f'departamento:{normalize_code(args.departamento_code)}' if args.departamento_code else None,
            'municipio_id': f'municipio:{normalize_code(args.municipio_code)}' if args.municipio_code else None,
            'fuente_geografica': preset['fuente'],
            'clasificacion_fuente': preset['clasificacion_fuente'],
            'metodo_geometria': preset['metodo_geometria'],
            'nivel_confianza': preset['nivel_confianza'],
            'fecha_importacion': dt.datetime.now(dt.UTC).isoformat(),
        })

    out = gpd.GeoDataFrame(rows, geometry=gdf.geometry, crs='EPSG:4326')
    mode = 'w' if args.overwrite_layer else 'a'
    out.to_file(gpkg, layer=args.layer_name, driver='GPKG', mode=mode)

    with sqlite3.connect(gpkg) as conn:
        pd.DataFrame([{
            'id_fuente': preset['fuente'],
            'nombre_fuente': f'Barrios {args.source_type}',
            'organismo': args.source_type,
            'url_origen': str(src),
            'tipo_fuente': 'oficial' if args.source_type in {'caba','municipal','provincial','renabap'} else 'no_oficial',
            'licencia': None,
            'fecha_publicacion': None,
            'fecha_actualizacion': None,
            'fecha_extraccion': dt.datetime.now(dt.UTC).isoformat(),
            'observaciones': 'Importado por src/import_barrios.py',
        }]).to_sql('fuente_catalogo', conn, if_exists='append', index=False)

    print(f'Capa de barrios importada: {args.layer_name} ({len(out):,} registros)')


if __name__ == '__main__':
    main()
