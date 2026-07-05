from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fiona
import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, box
from shapely.ops import unary_union
try:
    from shapely.validation import make_valid as _make_valid
except Exception:  # pragma: no cover
    _make_valid = None

from utils import normalize_text

AREA_CRS = "+proj=aea +lat_1=-18 +lat_2=-54 +lat_0=-32 +lon_0=-64 +datum=WGS84 +units=m +no_defs"
WEB_LAT_MIN = -56.0
WEB_DEPARTAMENTOS_EXCLUIDOS = {"departamento:94021", "departamento:94028"}

POP_COLS = [
    "anio_censo",
    "poblacion_total",
    "viviendas_total",
    "fuente_censo",
    "clasificacion_censo",
    "metodo_dato",
    "confianza_censo",
]

BASE_ATTR_COLS = [
    "id_entidad",
    "tipo_entidad",
    "codigo_indec",
    "codigo_georef",
    "codigo_refeglo",
    "nombre",
    "nombre_normalizado",
    "provincia_id",
    "departamento_id",
    "municipio_id",
    "gobierno_local_id",
    "localidad_id",
    "fuente_geografica",
    "clasificacion_fuente",
    "metodo_geometria",
    "nivel_confianza",
    "anio_fuente",
    "source_resource",
]

POLYGON_LAYERS = [
    "georef_provincias",
    "georef_departamentos",
    "georef_municipios",
    "georef_gobiernos_locales",
    "georef_aglomerados",
    "georef_fracciones_censales",
    "georef_radios_censales",
]
POINT_LAYERS = ["georef_localidades", "georef_asentamientos"]
ALL_SOURCE_LAYERS = POLYGON_LAYERS + POINT_LAYERS


@dataclass
class LayerDiag:
    layer: str
    records: int
    geometry_types: dict[str, int]
    invalid_before: int
    invalid_after: int
    empty: int
    missing_population: int
    population_sum: float | None
    population_methods: dict[str, int]
    excluded_from_web: int = 0


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fix_mojibake(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    s = value
    if "Ã" in s or "Â" in s or "�" in s:
        try:
            fixed = s.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
            if fixed and len(fixed) >= max(1, len(s) - 2):
                return fixed
        except Exception:
            return s
    return s


def clean_text_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    for c in ["nombre", "nombre_normalizado"]:
        if c in gdf.columns:
            gdf[c] = gdf[c].map(fix_mojibake)
    if "nombre" in gdf.columns:
        gdf["nombre_normalizado"] = gdf["nombre"].map(lambda x: normalize_text(fix_mojibake(x)))
    return gdf


def polygonal_only(geom):
    if geom is None or geom.is_empty:
        return geom
    gt = geom.geom_type
    if gt in {"Polygon", "MultiPolygon"}:
        return geom
    if gt == "GeometryCollection":
        parts: list[Polygon] = []
        for g in geom.geoms:
            if g.is_empty:
                continue
            if g.geom_type == "Polygon":
                parts.append(g)
            elif g.geom_type == "MultiPolygon":
                parts.extend(list(g.geoms))
        if not parts:
            return geom
        if len(parts) == 1:
            return parts[0]
        return MultiPolygon(parts)
    return geom


def _fix_one_geometry(geom):
    if geom is None or geom.is_empty or geom.is_valid:
        return geom
    if _make_valid is not None:
        try:
            return _make_valid(geom)
        except Exception:
            pass
    try:
        return geom.buffer(0)
    except Exception:
        return geom


def make_geometries_valid(gdf: gpd.GeoDataFrame, polygonal: bool = False) -> tuple[gpd.GeoDataFrame, int, int]:
    invalid_before = int((~gdf.geometry.is_valid).sum())
    if invalid_before:
        gdf["geometry"] = gdf.geometry.map(_fix_one_geometry)
    if polygonal:
        gdf["geometry"] = gdf.geometry.map(polygonal_only)
    invalid_after = int((~gdf.geometry.is_valid).sum())
    return gdf, invalid_before, invalid_after


def read_layer(gpkg: Path, layer: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(gpkg, layer=layer)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    else:
        gdf = gdf.to_crs("EPSG:4326")
    gdf = clean_text_columns(gdf)
    polygonal = layer in POLYGON_LAYERS or layer == "entidades_mapa"
    gdf, invalid_before, invalid_after = make_geometries_valid(gdf, polygonal=polygonal)
    gdf.attrs["invalid_before"] = invalid_before
    gdf.attrs["invalid_after"] = invalid_after
    for c in BASE_ATTR_COLS + POP_COLS:
        if c not in gdf.columns:
            gdf[c] = None
    return gdf


def area_m2(gdf: gpd.GeoDataFrame) -> pd.Series:
    if gdf.empty:
        return pd.Series(dtype=float, index=gdf.index)
    return gdf.to_crs(AREA_CRS).geometry.area.astype(float)


def representative_points_in_layer(points: gpd.GeoDataFrame, polygons: gpd.GeoDataFrame, poly_id_col: str) -> pd.Series:
    # Spatial fallback when an explicit parent code is missing.
    if points.empty or polygons.empty:
        return pd.Series(index=points.index, dtype=object)
    joined = gpd.sjoin(points[["geometry"]], polygons[[poly_id_col, "geometry"]], how="left", predicate="within")
    return joined.groupby(joined.index)[poly_id_col].first().reindex(points.index)


def int_round_preserve_total(values: pd.Series, target_total: int | float | None) -> pd.Series:
    values = pd.to_numeric(values, errors="coerce").fillna(0.0).clip(lower=0.0)
    if target_total is None or pd.isna(target_total):
        return values.round().astype("int64")
    target = int(round(float(target_total)))
    if values.sum() <= 0:
        if len(values) == 0:
            return values.astype("int64")
        base = pd.Series(np.zeros(len(values), dtype="int64"), index=values.index)
        for idx in list(values.index)[:target]:
            base.loc[idx] += 1
        return base
    scaled = values * (target / float(values.sum()))
    floors = np.floor(scaled).astype(int)
    remainder = int(target - floors.sum())
    out = pd.Series(floors, index=values.index, dtype="int64")
    if remainder > 0:
        frac = (scaled - floors).sort_values(ascending=False)
        for idx in frac.index[:remainder]:
            out.loc[idx] += 1
    elif remainder < 0:
        frac = (scaled - floors).sort_values(ascending=True)
        for idx in frac.index[: abs(remainder)]:
            if out.loc[idx] > 0:
                out.loc[idx] -= 1
    return out


def allocate_by_group(
    child: gpd.GeoDataFrame,
    group_col: str,
    parent_pop: pd.Series,
    method: str,
    source: str,
    confidence: str,
    weight_mode: str = "area",
) -> gpd.GeoDataFrame:
    out = child.copy()
    if weight_mode == "area" and not out.empty and out.geom_type.iloc[0] != "Point":
        weights = area_m2(out).replace(0, np.nan)
    else:
        weights = pd.Series(1.0, index=out.index)
    weights = weights.fillna(1.0)
    out["_weight"] = weights
    out["poblacion_total"] = np.nan
    for parent_id, idx in out.groupby(group_col, dropna=False).groups.items():
        if parent_id is None or pd.isna(parent_id) or parent_id not in parent_pop.index:
            continue
        target = parent_pop.loc[parent_id]
        vals = out.loc[idx, "_weight"]
        alloc = vals / vals.sum() * float(target) if vals.sum() > 0 else pd.Series(0.0, index=idx)
        out.loc[idx, "poblacion_total"] = int_round_preserve_total(alloc, target)
    out["poblacion_total"] = pd.to_numeric(out["poblacion_total"], errors="coerce")
    out["anio_censo"] = 2022
    out["fuente_censo"] = source
    out["clasificacion_censo"] = "estimada"
    out["metodo_dato"] = method
    out["confianza_censo"] = confidence
    out = out.drop(columns=["_weight"], errors="ignore")
    return out


def allocate_polygons_by_overlay(
    target: gpd.GeoDataFrame,
    source: gpd.GeoDataFrame,
    source_pop_col: str,
    method: str,
    source_name: str,
    confidence: str,
) -> gpd.GeoDataFrame:
    """Estima población de polígonos target por intersección con polígonos source.

    La población de cada source se reparte por área intersectada entre targets.
    Sirve para aglomerados/municipios u otras capas que no forman una partición censal.
    """
    out = target.copy()
    out["poblacion_total"] = np.nan
    if out.empty or source.empty:
        return out
    t = out[["id_entidad", "geometry"]].rename(columns={"id_entidad": "target_id"})
    s = source[["id_entidad", source_pop_col, "geometry"]].rename(columns={"id_entidad": "source_id", source_pop_col: "source_pop"})
    t = t.to_crs(AREA_CRS)
    s = s.to_crs(AREA_CRS)
    inter = gpd.overlay(t, s, how="intersection", keep_geom_type=False)
    if inter.empty:
        return out
    inter["area_inter"] = inter.geometry.area.astype(float)
    denom = inter.groupby("source_id")["area_inter"].transform("sum")
    inter = inter[denom > 0].copy()
    inter["alloc"] = inter["source_pop"].astype(float) * inter["area_inter"] / denom[denom > 0]
    pop = inter.groupby("target_id")["alloc"].sum()
    out["poblacion_total"] = out["id_entidad"].map(pop).round().astype("Int64")
    out["anio_censo"] = 2022
    out["fuente_censo"] = source_name
    out["clasificacion_censo"] = "estimada"
    out["metodo_dato"] = method
    out["confianza_censo"] = confidence
    return out


def build_department_population(provinces: gpd.GeoDataFrame, departments: gpd.GeoDataFrame, gl: gpd.GeoDataFrame) -> pd.DataFrame:
    dept = departments[["id_entidad", "codigo_indec", "nombre", "provincia_id", "geometry"]].copy()
    dept["area_m2"] = area_m2(dept).replace(0, np.nan).fillna(1.0)
    prov_pop = provinces.set_index("id_entidad")["poblacion_total"].astype(float)
    gl2 = gl[["id_entidad", "codigo_indec", "nombre", "provincia_id", "poblacion_total", "geometry"]].copy()
    gl2 = gl2[pd.notna(gl2["poblacion_total"])].copy()

    # 1) Oficial directa para CABA y Buenos Aires: código de gobierno local 6 dígitos -> depto/comuna 5 dígitos.
    direct_rows = []
    for _, r in gl2.iterrows():
        code = str(r.get("codigo_indec") or "")
        if len(code) == 6 and code[:2] in {"02", "06"}:
            dept_code = code[:2] + code[3:]
            dept_id = f"departamento:{dept_code}"
            if dept_id in set(dept["id_entidad"]):
                direct_rows.append({"id_entidad": dept_id, "pop_direct": float(r["poblacion_total"])})
    direct = pd.DataFrame(direct_rows).groupby("id_entidad", as_index=True)["pop_direct"].sum() if direct_rows else pd.Series(dtype=float)

    # 2) Para las demás provincias, repartir gobiernos locales contra departamentos por área de intersección.
    dept_ov = dept[~dept["id_entidad"].isin(direct.index)][["id_entidad", "provincia_id", "geometry"]].rename(columns={"id_entidad": "dept_id"}).to_crs(AREA_CRS)
    gl_ov = gl2[~gl2["provincia_id"].isin(["provincia:02", "provincia:06"])][["id_entidad", "provincia_id", "poblacion_total", "geometry"]].rename(columns={"id_entidad": "gl_id", "poblacion_total": "gl_pop"}).to_crs(AREA_CRS)
    overlay_pop = pd.Series(dtype=float)
    if not dept_ov.empty and not gl_ov.empty:
        inter = gpd.overlay(dept_ov, gl_ov, how="intersection", keep_geom_type=False)
        if not inter.empty:
            inter["area_inter"] = inter.geometry.area.astype(float)
            denom = inter.groupby("gl_id")["area_inter"].transform("sum")
            inter = inter[denom > 0].copy()
            inter["alloc"] = inter["gl_pop"].astype(float) * inter["area_inter"] / denom[denom > 0]
            overlay_pop = inter.groupby("dept_id")["alloc"].sum()

    dept_pop = pd.Series(0.0, index=dept["id_entidad"], dtype=float)
    for idx, val in direct.items():
        dept_pop.loc[idx] += float(val)
    for idx, val in overlay_pop.items():
        if idx in dept_pop.index:
            dept_pop.loc[idx] += float(val)

    # 3) Residual provincia -> departamentos por área, preservando el total provincial.
    dept["base_pop"] = dept["id_entidad"].map(dept_pop).fillna(0.0)
    final = []
    for prov_id, sub in dept.groupby("provincia_id", dropna=False):
        if prov_id not in prov_pop.index:
            target_total = float(sub["base_pop"].sum())
        else:
            target_total = float(prov_pop.loc[prov_id])
        residual = target_total - float(sub["base_pop"].sum())
        add = pd.Series(0.0, index=sub.index)
        if abs(residual) > 0.5:
            weights = sub["area_m2"].astype(float)
            if weights.sum() <= 0:
                weights = pd.Series(1.0, index=sub.index)
            add = residual * weights / weights.sum()
        values = sub["base_pop"].astype(float) + add
        rounded = int_round_preserve_total(values, target_total)
        for idx, pop in rounded.items():
            r = dept.loc[idx]
            method = "oficial_gobiernos_locales_directo_codigo" if r["id_entidad"] in direct.index else "oficial_gobiernos_locales_overlay_departamental"
            classification = "oficial_procesada"
            confidence = "alta" if abs(residual) <= 0.5 or r["id_entidad"] in direct.index else "media"
            if abs(residual) > 0.5 and r["id_entidad"] not in direct.index:
                method += "+residual_provincial_area"
            final.append({
                "id_entidad": r["id_entidad"],
                "codigo_indec": r["codigo_indec"],
                "nombre": r["nombre"],
                "provincia_id": prov_id,
                "poblacion_total": int(pop),
                "anio_censo": 2022,
                "fuente_censo": "indec_censo_2022_gobiernos_locales_y_provincias",
                "clasificacion_censo": classification,
                "metodo_dato": method,
                "confianza_censo": confidence,
                "base_gl_overlay": float(r["base_pop"]),
                "residual_provincial_total": float(residual),
            })
    return pd.DataFrame(final)


def apply_direct_population(gdf: gpd.GeoDataFrame, source_name: str = "indec_censo_2022") -> gpd.GeoDataFrame:
    out = gdf.copy()
    out["anio_censo"] = 2022
    out["fuente_censo"] = out["fuente_censo"].fillna(source_name)
    out["clasificacion_censo"] = out["clasificacion_censo"].fillna("oficial_directa")
    out["metodo_dato"] = out["metodo_dato"].fillna("dato_original_en_capa")
    out["confianza_censo"] = out["confianza_censo"].fillna("alta")
    return out


def fill_from_parent_fallback(gdf: gpd.GeoDataFrame, dept_pop: pd.Series, prov_pop: pd.Series) -> gpd.GeoDataFrame:
    out = gdf.copy()
    missing = out["poblacion_total"].isna()
    if not missing.any():
        return out
    # First: if entity has departamento_id, split department population equally among missing siblings in this layer.
    for dept_id, idx in out[missing].groupby("departamento_id", dropna=False).groups.items():
        if dept_id in dept_pop.index:
            share = int(round(float(dept_pop.loc[dept_id]) / max(1, len(idx))))
            out.loc[idx, "poblacion_total"] = share
            out.loc[idx, "metodo_dato"] = out.loc[idx, "metodo_dato"].fillna("fallback_prorrateo_departamental")
    missing = out["poblacion_total"].isna()
    for prov_id, idx in out[missing].groupby("provincia_id", dropna=False).groups.items():
        if prov_id in prov_pop.index:
            share = int(round(float(prov_pop.loc[prov_id]) / max(1, len(idx))))
            out.loc[idx, "poblacion_total"] = share
            out.loc[idx, "metodo_dato"] = out.loc[idx, "metodo_dato"].fillna("fallback_prorrateo_provincial")
    out["poblacion_total"] = pd.to_numeric(out["poblacion_total"], errors="coerce").fillna(0).round().astype("int64")
    out["anio_censo"] = 2022
    out["fuente_censo"] = out["fuente_censo"].fillna("pipeline_censo_v4")
    out["clasificacion_censo"] = out["clasificacion_censo"].fillna("estimada")
    out["confianza_censo"] = out["confianza_censo"].fillna("baja")
    return out


def add_display_fields(gdf: gpd.GeoDataFrame, original_layer: str) -> gpd.GeoDataFrame:
    out = gdf.copy()
    out["display_tipo"] = np.where(out["tipo_entidad"].eq("provincia"), "provincia", "localidad")
    out["tipo_original"] = out["tipo_entidad"]
    out["capa_original"] = original_layer
    out["tooltip_nombre"] = out["nombre"]
    out["tooltip_poblacion"] = out["poblacion_total"].fillna(0).round().astype("int64")
    out["app_jerarquia"] = np.where(out["tipo_entidad"].eq("provincia"), "Provincia", "Localidad")
    out["modo_recomendado"] = np.where(out.geometry.geom_type.isin(["Point", "MultiPoint"]), "clusters_calor", "coropletico")
    return out


def build_web_provinces(provinces: gpd.GeoDataFrame, departments_enriched: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    out = provinces.copy()
    # Recompone Tierra del Fuego web con solo Río Grande/Tolhuin/Ushuaia para evitar Antártida e Islas en el encuadre inicial.
    tdf_parts = departments_enriched[departments_enriched["id_entidad"].isin({"departamento:94008", "departamento:94011", "departamento:94015"})]
    if not tdf_parts.empty:
        geom = unary_union(list(tdf_parts.geometry))
        idx = out.index[out["id_entidad"].eq("provincia:94")]
        if len(idx):
            out.loc[idx[0], "geometry"] = geom
            out.loc[idx[0], "metodo_geometria"] = "web_union_departamentos_tdf_sin_antartida_islas"
    out = add_display_fields(out, "app_provincias")
    return out


def filter_web_layer(gdf: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, int]:
    before = len(gdf)
    out = gdf.copy()
    if "departamento_id" in out.columns:
        out = out[~out["departamento_id"].isin(WEB_DEPARTAMENTOS_EXCLUIDOS)].copy()
    out = out[~out["id_entidad"].isin(WEB_DEPARTAMENTOS_EXCLUIDOS)].copy()
    # Excluye geometrías cuyo centroide cae en Antártida. Conserva Tierra del Fuego.
    cent = out.geometry.representative_point()
    out = out[cent.y >= WEB_LAT_MIN].copy()
    return out, before - len(out)


def layer_diag(layer: str, gdf: gpd.GeoDataFrame, excluded_web: int = 0) -> LayerDiag:
    methods = gdf.get("metodo_dato", pd.Series(dtype=object)).fillna("sin_metodo").value_counts().to_dict()
    pop_sum = None if "poblacion_total" not in gdf.columns else float(pd.to_numeric(gdf["poblacion_total"], errors="coerce").fillna(0).sum())
    return LayerDiag(
        layer=layer,
        records=int(len(gdf)),
        geometry_types={str(k): int(v) for k, v in gdf.geometry.geom_type.value_counts().to_dict().items()},
        invalid_before=int(gdf.attrs.get("invalid_before", 0)),
        invalid_after=int((~gdf.geometry.is_valid).sum()),
        empty=int(gdf.geometry.is_empty.sum()),
        missing_population=int(gdf["poblacion_total"].isna().sum()) if "poblacion_total" in gdf.columns else int(len(gdf)),
        population_sum=pop_sum,
        population_methods={str(k): int(v) for k, v in methods.items()},
        excluded_from_web=excluded_web,
    )


def write_non_spatial_table(gpkg: Path, table_name: str, df: pd.DataFrame) -> None:
    df = df.copy()
    for c in df.columns:
        if df[c].apply(lambda x: isinstance(x, (dict, list))).any():
            df[c] = df[c].map(lambda x: json.dumps(x, ensure_ascii=False) if isinstance(x, (dict, list)) else x)
    with sqlite3.connect(gpkg) as conn:
        df.to_sql(table_name, conn, if_exists="replace", index=False)


def safe_write_layer(gdf: gpd.GeoDataFrame, gpkg: Path, layer: str) -> None:
    gdf = gdf.copy()
    for c in gdf.columns:
        if c == "geometry":
            continue
        if pd.api.types.is_integer_dtype(gdf[c]) and str(gdf[c].dtype).startswith("Int"):
            gdf[c] = gdf[c].astype("float")
        if gdf[c].apply(lambda x: isinstance(x, (dict, list))).any():
            gdf[c] = gdf[c].map(lambda x: json.dumps(x, ensure_ascii=False) if isinstance(x, (dict, list)) else x)
    gdf.to_file(gpkg, layer=layer, driver="GPKG")


def render_markdown(diags: list[LayerDiag], controls: pd.DataFrame, source_notes: list[dict[str, Any]]) -> str:
    lines = []
    lines.append("# Diagnóstico censal y geográfico v4")
    lines.append("")
    lines.append(f"Generado: {now_iso()}")
    lines.append("")
    lines.append("## Decisión de modelo")
    lines.append("")
    lines.append("- La app se simplifica a dos niveles visibles: **Provincia → Localidad**.")
    lines.append("- Para no perder trazabilidad, cada entidad conserva `tipo_original` y `capa_original`.")
    lines.append("- Departamentos, partidos, comunas, gobiernos locales, municipios, fracciones, radios y aglomerados se exponen al frontend como `display_tipo = localidad`.")
    lines.append("- Las localidades y asentamientos puntuales se exponen como `app_localidades_puntos`; las entidades poligonales se exponen como `app_localidades_poligonos`.")
    lines.append("- Para el encuadre web inicial se excluyen Antártida Argentina e Islas del Atlántico Sur de las capas app, pero se conserva la base completa enriquecida en las capas fuente.")
    lines.append("")
    lines.append("## Cobertura por capa")
    lines.append("")
    diag_df = pd.DataFrame([d.__dict__ for d in diags])
    if not diag_df.empty:
        show = diag_df[["layer", "records", "invalid_before", "invalid_after", "empty", "missing_population", "population_sum", "excluded_from_web"]].copy()
        lines.append(show.to_markdown(index=False))
    lines.append("")
    lines.append("## Métodos de población por capa")
    lines.append("")
    for d in diags:
        lines.append(f"### {d.layer}")
        method_df = pd.DataFrame([{"metodo_dato": k, "cantidad": v} for k, v in d.population_methods.items()])
        lines.append(method_df.to_markdown(index=False) if not method_df.empty else "Sin métodos registrados.")
        lines.append("")
    lines.append("## Controles provincia/departamentos")
    lines.append("")
    lines.append(controls.to_markdown(index=False) if not controls.empty else "Sin controles.")
    lines.append("")
    lines.append("## Fuentes y reglas usadas")
    lines.append("")
    src = pd.DataFrame(source_notes)
    lines.append(src.to_markdown(index=False) if not src.empty else "Sin fuentes registradas.")
    lines.append("")
    lines.append("## Interpretación para terminal")
    lines.append("")
    lines.append("- `missing_population = 0` indica que la capa quedó utilizable para tooltip/coroplético/calor/cluster según su geometría.")
    lines.append("- `oficial_directa` se usa cuando el dato ya venía vinculado en la capa o en la semilla censal.")
    lines.append("- `oficial_procesada` se usa cuando la población oficial se agrega o cruza contra otra geometría oficial.")
    lines.append("- `estimada` se usa cuando no existe dato directo para esa geometría y se prorratea por área o por cantidad de entidades dentro de su padre.")
    lines.append("- Los barrios no se inventan: el modelo queda preparado para importarlos, pero en este ZIP no había una capa nacional de barrios. Los asentamientos sí quedan como puntos tipo localidad.")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Enriquece el GeoPackage con población 2022 completa y capas app Provincia -> Localidad.")
    parser.add_argument("--input", required=True, help="GeoPackage base, ej. data/output/arg_geo_censo_full.gpkg")
    parser.add_argument("--out", required=True, help="GeoPackage enriquecido de salida")
    parser.add_argument("--diag-md", required=True)
    parser.add_argument("--diag-json", required=True)
    args = parser.parse_args()

    gpkg_in = Path(args.input)
    gpkg_out = Path(args.out)
    if not gpkg_in.exists():
        raise SystemExit(f"No existe {gpkg_in}")
    gpkg_out.parent.mkdir(parents=True, exist_ok=True)
    if gpkg_out.exists():
        gpkg_out.unlink()

    available = set(fiona.listlayers(gpkg_in))
    layers: dict[str, gpd.GeoDataFrame] = {}
    for layer in ALL_SOURCE_LAYERS:
        if layer not in available:
            print(f"WARNING: falta capa {layer}; se omite", file=sys.stderr)
            continue
        print(f"Leyendo {layer}...")
        layers[layer] = read_layer(gpkg_in, layer)

    required = ["georef_provincias", "georef_departamentos", "georef_gobiernos_locales"]
    missing_required = [l for l in required if l not in layers]
    if missing_required:
        raise SystemExit(f"Faltan capas requeridas: {missing_required}")

    provinces = apply_direct_population(layers["georef_provincias"], "indec_censo_2022_resumen")
    gl = apply_direct_population(layers["georef_gobiernos_locales"], "indec_censo_2022_gobiernos_locales")
    prov_pop = provinces.set_index("id_entidad")["poblacion_total"].astype(float)

    print("Calculando población departamental por códigos/overlay/residual...")
    dept_pop_df = build_department_population(provinces, layers["georef_departamentos"], gl)
    dept_pop = dept_pop_df.set_index("id_entidad")["poblacion_total"].astype(float)

    enriched: dict[str, gpd.GeoDataFrame] = {}
    enriched["georef_provincias"] = add_display_fields(provinces, "georef_provincias")

    departments = layers["georef_departamentos"].merge(
        dept_pop_df[["id_entidad", "poblacion_total", "anio_censo", "fuente_censo", "clasificacion_censo", "metodo_dato", "confianza_censo"]],
        on="id_entidad",
        how="left",
        suffixes=("", "_calc"),
    )
    for c in ["poblacion_total", "anio_censo", "fuente_censo", "clasificacion_censo", "metodo_dato", "confianza_censo"]:
        calc = f"{c}_calc"
        if calc in departments.columns:
            departments[c] = departments[calc].combine_first(departments[c])
            departments = departments.drop(columns=[calc])
    departments = fill_from_parent_fallback(departments, dept_pop, prov_pop)
    enriched["georef_departamentos"] = add_display_fields(departments, "georef_departamentos")

    gl = fill_from_parent_fallback(gl, dept_pop, prov_pop)
    enriched["georef_gobiernos_locales"] = add_display_fields(gl, "georef_gobiernos_locales")

    if "georef_fracciones_censales" in layers:
        print("Estimando fracciones por área dentro del departamento...")
        frac = allocate_by_group(
            layers["georef_fracciones_censales"], "departamento_id", dept_pop,
            "estimacion_area_fraccion_sobre_departamento", "indec_censo_2022_gobiernos_locales_y_provincias", "media", "area"
        )
        frac = fill_from_parent_fallback(frac, dept_pop, prov_pop)
        enriched["georef_fracciones_censales"] = add_display_fields(frac, "georef_fracciones_censales")

    if "georef_radios_censales" in layers:
        print("Estimando radios por área dentro del departamento...")
        radios = allocate_by_group(
            layers["georef_radios_censales"], "departamento_id", dept_pop,
            "estimacion_area_radio_sobre_departamento", "indec_censo_2022_gobiernos_locales_y_provincias", "media", "area"
        )
        radios = fill_from_parent_fallback(radios, dept_pop, prov_pop)
        enriched["georef_radios_censales"] = add_display_fields(radios, "georef_radios_censales")

    if "georef_localidades" in layers:
        print("Estimando localidades puntuales por prorrateo departamental...")
        loc = allocate_by_group(
            layers["georef_localidades"], "departamento_id", dept_pop,
            "estimacion_prorrateo_localidades_en_departamento", "indec_censo_2022_gobiernos_locales_y_provincias", "baja", "equal"
        )
        loc = fill_from_parent_fallback(loc, dept_pop, prov_pop)
        enriched["georef_localidades"] = add_display_fields(loc, "georef_localidades")

    if "georef_asentamientos" in layers:
        print("Estimando asentamientos puntuales por prorrateo departamental...")
        asent = allocate_by_group(
            layers["georef_asentamientos"], "departamento_id", dept_pop,
            "estimacion_prorrateo_asentamientos_en_departamento", "indec_censo_2022_gobiernos_locales_y_provincias", "baja", "equal"
        )
        asent = fill_from_parent_fallback(asent, dept_pop, prov_pop)
        enriched["georef_asentamientos"] = add_display_fields(asent, "georef_asentamientos")

    if "georef_municipios" in layers:
        print("Estimando municipios por overlay con gobiernos locales...")
        muni = allocate_polygons_by_overlay(
            layers["georef_municipios"], gl, "poblacion_total",
            "estimacion_overlay_municipio_sobre_gobierno_local", "indec_censo_2022_gobiernos_locales", "media"
        )
        muni = fill_from_parent_fallback(muni, dept_pop, prov_pop)
        enriched["georef_municipios"] = add_display_fields(muni, "georef_municipios")

    if "georef_aglomerados" in layers:
        print("Estimando aglomerados por overlay con departamentos...")
        dept_for_overlay = enriched["georef_departamentos"][["id_entidad", "poblacion_total", "geometry"]].copy()
        aglo = allocate_polygons_by_overlay(
            layers["georef_aglomerados"], dept_for_overlay, "poblacion_total",
            "estimacion_overlay_aglomerado_sobre_departamento", "indec_censo_2022_departamentos_estimados", "baja"
        )
        aglo = fill_from_parent_fallback(aglo, dept_pop, prov_pop)
        enriched["georef_aglomerados"] = add_display_fields(aglo, "georef_aglomerados")

    # Escribe capas fuente enriquecidas.
    print("Escribiendo GeoPackage enriquecido...")
    diags: list[LayerDiag] = []
    for layer in ALL_SOURCE_LAYERS:
        if layer not in enriched:
            continue
        gdf = enriched[layer]
        gdf["poblacion_total"] = pd.to_numeric(gdf["poblacion_total"], errors="coerce").fillna(0).round().astype("int64")
        gdf["anio_censo"] = 2022
        safe_write_layer(gdf, gpkg_out, layer)
        diags.append(layer_diag(layer, gdf))

    # Capas app.
    app_prov = build_web_provinces(enriched["georef_provincias"], enriched["georef_departamentos"])
    app_prov, excl = filter_web_layer(app_prov)
    app_prov.attrs["invalid_before"] = enriched["georef_provincias"].attrs.get("invalid_before", 0)
    safe_write_layer(app_prov, gpkg_out, "app_provincias")
    diags.append(layer_diag("app_provincias", app_prov, excl))

    poly_parts = []
    for layer in ["georef_departamentos", "georef_gobiernos_locales", "georef_municipios", "georef_aglomerados", "georef_fracciones_censales", "georef_radios_censales"]:
        if layer in enriched:
            poly_parts.append(enriched[layer])
    app_poly = gpd.GeoDataFrame(pd.concat(poly_parts, ignore_index=True), geometry="geometry", crs="EPSG:4326") if poly_parts else gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    app_poly, excl_poly = filter_web_layer(app_poly)
    app_poly["display_tipo"] = "localidad"
    app_poly["app_jerarquia"] = "Localidad"
    app_poly["modo_recomendado"] = "coropletico"
    safe_write_layer(app_poly, gpkg_out, "app_localidades_poligonos")
    diags.append(layer_diag("app_localidades_poligonos", app_poly, excl_poly))

    point_parts = []
    for layer in ["georef_localidades", "georef_asentamientos"]:
        if layer in enriched:
            point_parts.append(enriched[layer])
    app_points = gpd.GeoDataFrame(pd.concat(point_parts, ignore_index=True), geometry="geometry", crs="EPSG:4326") if point_parts else gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    app_points, excl_points = filter_web_layer(app_points)
    app_points["display_tipo"] = "localidad"
    app_points["app_jerarquia"] = "Localidad"
    app_points["modo_recomendado"] = "clusters_calor"
    safe_write_layer(app_points, gpkg_out, "app_localidades_puntos")
    diags.append(layer_diag("app_localidades_puntos", app_points, excl_points))

    # Entidades unificadas enriquecidas, útil para búsquedas y tooltips offline.
    entidades = gpd.GeoDataFrame(pd.concat([enriched[l] for l in ALL_SOURCE_LAYERS if l in enriched], ignore_index=True), geometry="geometry", crs="EPSG:4326")
    safe_write_layer(entidades, gpkg_out, "entidades_mapa_enriquecidas")
    diags.append(layer_diag("entidades_mapa_enriquecidas", entidades))

    # Tablas de diagnóstico.
    diag_df = pd.DataFrame([d.__dict__ for d in diags])
    controls = []
    dept_en = enriched["georef_departamentos"].copy()
    for prov_id, prov in enriched["georef_provincias"].set_index("id_entidad").iterrows():
        sub = dept_en[dept_en["provincia_id"].eq(prov_id)]
        controls.append({
            "provincia_id": prov_id,
            "provincia": prov["nombre"],
            "poblacion_provincia": int(round(float(prov["poblacion_total"]))),
            "suma_departamentos": int(round(pd.to_numeric(sub["poblacion_total"], errors="coerce").fillna(0).sum())),
            "diferencia": int(round(float(prov["poblacion_total"]) - pd.to_numeric(sub["poblacion_total"], errors="coerce").fillna(0).sum())),
            "departamentos": int(len(sub)),
        })
    controls_df = pd.DataFrame(controls)

    source_notes = [
        {
            "fuente": "INDEC Censo 2022 resumen/provincias",
            "uso": "Población oficial directa de país y provincias.",
            "estado": "incluida_en_zip",
        },
        {
            "fuente": "INDEC Censo 2022 gobiernos locales",
            "uso": "Población oficial directa de gobiernos locales; base para agregación departamental.",
            "estado": "incluida_en_zip",
        },
        {
            "fuente": "Georef / IGN / BAHRA / INDEC cartografía",
            "uso": "Geometrías y códigos oficiales de provincias, departamentos, localidades, radios/fracciones y otras entidades.",
            "estado": "incluida_en_zip",
        },
        {
            "fuente": "Estimación por overlay/área/prorrateo",
            "uso": "Completar población en capas sin dato censal directo para habilitar tooltips y modos de mapa.",
            "estado": "calculada_en_pipeline",
        },
    ]
    sources_df = pd.DataFrame(source_notes)
    pop_table = entidades[[
        "id_entidad", "tipo_original", "display_tipo", "capa_original", "codigo_indec", "codigo_georef", "nombre", "provincia_id", "departamento_id",
        "anio_censo", "poblacion_total", "fuente_censo", "clasificacion_censo", "metodo_dato", "confianza_censo"
    ]].copy()

    write_non_spatial_table(gpkg_out, "diagnostico_censo_geometria_v4", diag_df)
    write_non_spatial_table(gpkg_out, "control_poblacion_provincia_departamento_v4", controls_df)
    write_non_spatial_table(gpkg_out, "poblacion_vinculada_v4", pop_table)
    write_non_spatial_table(gpkg_out, "fuentes_metodos_v4", sources_df)

    out_md = Path(args.diag_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(render_markdown(diags, controls_df, source_notes), encoding="utf-8")
    payload = {
        "generated_at": now_iso(),
        "input": str(gpkg_in),
        "output": str(gpkg_out),
        "diagnostics": [d.__dict__ for d in diags],
        "controls": controls,
        "source_notes": source_notes,
        "app_layers": {
            "app_provincias": len(app_prov),
            "app_localidades_poligonos": len(app_poly),
            "app_localidades_puntos": len(app_points),
        },
    }
    Path(args.diag_json).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    hard_missing = int(diag_df[diag_df["layer"].isin(ALL_SOURCE_LAYERS)]["missing_population"].sum())
    hard_invalid = int(diag_df[diag_df["layer"].isin(ALL_SOURCE_LAYERS)]["invalid_after"].sum())
    print(f"OK: salida {gpkg_out}")
    print(f"Poblaciones faltantes en capas fuente: {hard_missing}")
    print(f"Geometrías inválidas post-fix en capas fuente: {hard_invalid}")
    if hard_missing or hard_invalid:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
