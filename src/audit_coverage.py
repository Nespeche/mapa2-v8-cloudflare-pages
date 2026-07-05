from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import pandas as pd

from utils import sqlite_connect


def sqlite_report(sqlite_path: Path) -> pd.DataFrame:
    conn = sqlite_connect(sqlite_path)
    df = pd.read_sql_query(
        """
        SELECT
            g.tipo_entidad,
            COUNT(*) AS entidades,
            SUM(CASE WHEN g.codigo_indec IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo_indec,
            SUM(CASE WHEN g.codigo_georef IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo_georef,
            SUM(CASE WHEN g.codigo_refeglo IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo_refeglo,
            SUM(CASE WHEN g.geom_wkt IS NOT NULL THEN 1 ELSE 0 END) AS con_geom_wkt,
            SUM(CASE WHEN g.centroid_lat IS NOT NULL AND g.centroid_lon IS NOT NULL THEN 1 ELSE 0 END) AS con_centroide,
            SUM(CASE WHEN p.id_poblacion IS NOT NULL THEN 1 ELSE 0 END) AS con_poblacion_2022,
            SUM(CASE WHEN p.clasificacion_fuente = 'oficial_directa' THEN 1 ELSE 0 END) AS poblacion_oficial_directa,
            SUM(CASE WHEN p.clasificacion_fuente = 'oficial_procesada' THEN 1 ELSE 0 END) AS poblacion_oficial_procesada,
            SUM(CASE WHEN p.clasificacion_fuente = 'estimada' THEN 1 ELSE 0 END) AS poblacion_estimada
        FROM geo_entidad g
        LEFT JOIN censo_poblacion p ON p.id_entidad = g.id_entidad AND p.anio_censo = 2022
        GROUP BY g.tipo_entidad
        ORDER BY g.tipo_entidad
        """,
        conn,
    )
    conn.close()
    return df


def gpkg_layers(gpkg: Path) -> pd.DataFrame:
    if not gpkg.exists():
        return pd.DataFrame()
    conn = sqlite3.connect(gpkg)
    try:
        layers = pd.read_sql_query("SELECT table_name, data_type, identifier FROM gpkg_contents ORDER BY table_name", conn)
    except Exception:
        layers = pd.DataFrame()
    finally:
        conn.close()
    return layers


def main() -> None:
    parser = argparse.ArgumentParser(description='Genera reporte de cobertura de la base semilla/GeoPackage.')
    parser.add_argument('--sqlite', required=True)
    parser.add_argument('--gpkg', default=None)
    parser.add_argument('--out-md', required=True)
    args = parser.parse_args()

    report = sqlite_report(Path(args.sqlite))
    lines = ['# Reporte de cobertura', '', '## SQLite semilla', '', report.to_markdown(index=False)]
    if args.gpkg:
        layers = gpkg_layers(Path(args.gpkg))
        lines += ['', '## Capas GeoPackage', '', layers.to_markdown(index=False) if not layers.empty else 'No se detectaron capas GeoPackage.']
    Path(args.out_md).write_text('\n'.join(lines), encoding='utf-8')
    print(f'Reporte escrito: {args.out_md}')


if __name__ == '__main__':
    main()
