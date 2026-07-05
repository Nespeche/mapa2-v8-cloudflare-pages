from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import fiona
import geopandas as gpd
import pandas as pd

REQUIRED_LAYERS = [
    "georef_provincias",
    "georef_departamentos",
    "georef_municipios",
    "georef_gobiernos_locales",
    "georef_aglomerados",
    "georef_fracciones_censales",
    "georef_radios_censales",
    "georef_localidades",
    "georef_asentamientos",
    "app_provincias",
    "app_localidades_poligonos",
    "app_localidades_puntos",
    "entidades_mapa_enriquecidas",
]

SOURCE_LAYERS = [
    "georef_provincias",
    "georef_departamentos",
    "georef_municipios",
    "georef_gobiernos_locales",
    "georef_aglomerados",
    "georef_fracciones_censales",
    "georef_radios_censales",
    "georef_localidades",
    "georef_asentamientos",
]


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def main() -> None:
    parser = argparse.ArgumentParser(description="Valida que el GPKG v4 esté listo para mapa censal.")
    parser.add_argument("--gpkg", default="data/output/arg_geo_censo_census_ready_v4.gpkg")
    args = parser.parse_args()
    gpkg = Path(args.gpkg)
    if not gpkg.exists():
        raise SystemExit(f"ERROR: no existe {gpkg}")

    errors: list[str] = []
    warnings: list[str] = []
    layers = set(fiona.listlayers(gpkg))
    missing_layers = [l for l in REQUIRED_LAYERS if l not in layers]
    if missing_layers:
        errors.append(f"Faltan capas requeridas: {missing_layers}")

    print_section("Capas, población y geometrías")
    rows = []
    for layer in [l for l in REQUIRED_LAYERS if l in layers]:
        gdf = gpd.read_file(gpkg, layer=layer)
        pop_missing = int(gdf["poblacion_total"].isna().sum()) if "poblacion_total" in gdf.columns else len(gdf)
        invalid = int((~gdf.geometry.is_valid).sum())
        empty = int(gdf.geometry.is_empty.sum())
        pop_sum = int(round(pd.to_numeric(gdf.get("poblacion_total", 0), errors="coerce").fillna(0).sum()))
        rows.append({
            "layer": layer,
            "registros": len(gdf),
            "geom": ",".join(sorted(gdf.geometry.geom_type.unique())),
            "sin_pop": pop_missing,
            "invalidas": invalid,
            "vacias": empty,
            "poblacion_sum": pop_sum,
        })
        if layer in SOURCE_LAYERS and pop_missing:
            errors.append(f"{layer}: {pop_missing} registros sin población")
        if layer in SOURCE_LAYERS and invalid:
            errors.append(f"{layer}: {invalid} geometrías inválidas")
        if empty:
            errors.append(f"{layer}: {empty} geometrías vacías")
    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    print_section("Control provincia -> departamentos")
    with sqlite3.connect(gpkg) as conn:
        if "control_poblacion_provincia_departamento_v4" in layers:
            controls = pd.read_sql_query("SELECT * FROM control_poblacion_provincia_departamento_v4", conn)
            print(controls.to_string(index=False))
            bad = controls[controls["diferencia"].astype(float).abs() > 0]
            if not bad.empty:
                errors.append("Hay diferencias entre población provincial y suma departamental")
        else:
            errors.append("Falta tabla control_poblacion_provincia_departamento_v4")

        if "poblacion_vinculada_v4" in layers:
            methods = pd.read_sql_query(
                """
                SELECT capa_original, clasificacion_censo, confianza_censo, metodo_dato, COUNT(*) AS registros
                FROM poblacion_vinculada_v4
                GROUP BY capa_original, clasificacion_censo, confianza_censo, metodo_dato
                ORDER BY capa_original, registros DESC
                """,
                conn,
            )
            print_section("Métodos censales usados")
            print(methods.to_string(index=False))
            low = methods[methods["confianza_censo"].eq("baja")]["registros"].sum()
            if low:
                warnings.append(f"Hay {int(low)} entidades con población estimada de confianza baja; son puntos/agregados sin dato censal directo.")
        else:
            errors.append("Falta tabla poblacion_vinculada_v4")

    if not any("barrio" in l.lower() for l in layers):
        warnings.append("No hay capa nacional de barrios en el ZIP; el modelo está preparado para importarla, pero no fue inventada.")

    print_section("Resultado")
    for w in warnings:
        print(f"WARN: {w}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        raise SystemExit(2)
    print("OK: base censal/geográfica lista para la fase de tiles y frontend.")


if __name__ == "__main__":
    main()
