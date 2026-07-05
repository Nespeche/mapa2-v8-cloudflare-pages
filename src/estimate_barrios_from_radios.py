from __future__ import annotations

import argparse
from pathlib import Path

import geopandas as gpd
import pandas as pd

from utils import normalize_code, normalize_text, safe_float


def main() -> None:
    parser = argparse.ArgumentParser(description='Estima población por barrio cruzando barrios con radios censales.')
    parser.add_argument('--barrios', required=True, help='GeoJSON/GPKG/SHP con polígonos de barrios')
    parser.add_argument('--radios', required=True, help='GeoJSON/GPKG/SHP con polígonos de radios censales')
    parser.add_argument('--radio-pop', required=True, help='CSV con codigo_radio,poblacion_total,viviendas_total')
    parser.add_argument('--out', required=True)
    parser.add_argument('--crs-area', default='EPSG:6933')
    args = parser.parse_args()

    barrios = gpd.read_file(args.barrios)
    radios = gpd.read_file(args.radios)
    pop = pd.read_csv(args.radio_pop, dtype=str)

    # Detectar columnas clave con nombres flexibles.
    barrio_name_col = next((c for c in barrios.columns if c.lower() in {'nombre', 'barrio', 'nombre_barrio'}), None)
    barrio_id_col = next((c for c in barrios.columns if c.lower() in {'id', 'id_barrio', 'codigo_barrio'}), None)
    radio_code_col = next((c for c in radios.columns if c.lower() in {'codigo_radio', 'cod_radio', 'cod_indec', 'radio', 'id'}), None)
    pop_code_col = next((c for c in pop.columns if c.lower() in {'codigo_radio', 'cod_radio', 'cod_indec', 'radio', 'id'}), None)
    if not radio_code_col or not pop_code_col:
        raise SystemExit('No pude detectar columna de código de radio en radios o radio-pop.')

    radios = radios.copy()
    pop = pop.copy()
    radios['codigo_radio_norm'] = radios[radio_code_col].map(normalize_code)
    pop['codigo_radio_norm'] = pop[pop_code_col].map(normalize_code)
    pop['poblacion_total'] = pop.get('poblacion_total', pop.get('poblacion')).map(safe_float)
    pop['viviendas_total'] = pop.get('viviendas_total', pop.get('viviendas')).map(safe_float) if ('viviendas_total' in pop.columns or 'viviendas' in pop.columns) else None
    radios = radios.merge(pop[['codigo_radio_norm', 'poblacion_total', 'viviendas_total']], on='codigo_radio_norm', how='left')

    barrios = barrios.to_crs(args.crs_area)
    radios = radios.to_crs(args.crs_area)
    radios['area_radio_m2'] = radios.geometry.area

    inter = gpd.overlay(
        radios[['codigo_radio_norm', 'poblacion_total', 'viviendas_total', 'area_radio_m2', 'geometry']],
        barrios[[barrio_id_col, barrio_name_col, 'geometry']] if barrio_id_col else barrios[[barrio_name_col, 'geometry']],
        how='intersection'
    )
    inter['area_inter_m2'] = inter.geometry.area
    inter['factor_area'] = inter['area_inter_m2'] / inter['area_radio_m2']
    inter['poblacion_estimada'] = inter['poblacion_total'] * inter['factor_area']
    inter['viviendas_estimadas'] = inter['viviendas_total'] * inter['factor_area']

    group_cols = [barrio_name_col] + ([barrio_id_col] if barrio_id_col else [])
    agg = inter.groupby(group_cols, dropna=False).agg(
        poblacion_estimada=('poblacion_estimada', 'sum'),
        viviendas_estimadas=('viviendas_estimadas', 'sum'),
        radios_intersectados=('codigo_radio_norm', 'nunique'),
        area_inter_m2=('area_inter_m2', 'sum')
    ).reset_index()

    out = barrios.merge(agg, on=group_cols, how='left').to_crs('EPSG:4326')
    out['nombre_normalizado'] = out[barrio_name_col].map(normalize_text)
    out['clasificacion_fuente_censo'] = 'estimada'
    out['metodo_dato'] = 'overlay_radio_area'
    out['nivel_confianza'] = 'media'
    out['observaciones'] = 'Estimación por proporción de área de radios censales; no es dato censal oficial directo por barrio.'

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.suffix.lower() == '.gpkg':
        out.to_file(out_path, layer='barrios_poblacion_estimada', driver='GPKG')
    else:
        out.to_file(out_path, driver='GeoJSON')
    print(f'Estimación escrita: {out_path}')


if __name__ == '__main__':
    main()
