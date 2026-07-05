from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import unicodedata
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fiona
import geopandas as gpd
import pyogrio
import pandas as pd
from shapely import make_valid

try:
    import matplotlib.pyplot as plt
except Exception:  # pragma: no cover - previews are optional
    plt = None

VERSION = "v5_map_ready"
NATIONAL_POPULATION_EXPECTED = 45_892_285
SIZE_WARN_MB = 25.0
PER_PROVINCE_SIZE_WARN_MB = 15.0
COORDINATE_PRECISION = 6

REQUIRED_SOURCE_LAYERS = [
    "app_provincias",
    "georef_departamentos",
    "georef_gobiernos_locales",
    "georef_municipios",
    "georef_aglomerados",
    "georef_fracciones_censales",
    "georef_radios_censales",
    "app_localidades_puntos",
]

BASE_KEEP_FIELDS = [
    "id_entidad",
    "codigo_indec",
    "codigo_georef",
    "codigo_refeglo",
    "nombre",
    "nombre_normalizado",
    "provincia_id",
    "provincia_codigo",
    "provincia_nombre",
    "departamento_id",
    "municipio_id",
    "gobierno_local_id",
    "localidad_id",
    "poblacion_total",
    "viviendas_total",
    "anio_censo",
    "fuente_censo",
    "clasificacion_censo",
    "metodo_dato",
    "confianza_censo",
    "tipo_original",
    "capa_original",
    "display_tipo",
    "app_jerarquia",
    "tooltip_nombre",
    "tooltip_poblacion",
    "nivel_map_ready",
    "render_layer",
    "aditiva",
    "no_aditiva",
    "uso_frontend",
    "loading_strategy",
    "metodo_provincia",
]


@dataclass(frozen=True)
class LayerSpec:
    layer_id: str
    source_layer: str
    output_file: str
    short_name: str
    nivel_map_ready: str
    render_layer: str
    geometry_family: str
    additive: bool
    split_by_province: bool
    national_export: bool
    simplify_tolerance: float
    usage: str
    loading_strategy: str
    notes: str


LAYER_SPECS = [
    LayerSpec(
        layer_id="provincias",
        source_layer="app_provincias",
        output_file="provincias.geojson",
        short_name="provincias",
        nivel_map_ready="provincia",
        render_layer="vista_nacional",
        geometry_family="polygon",
        additive=True,
        split_by_province=False,
        national_export=True,
        simplify_tolerance=0.005,
        usage="Vista nacional, coroplético provincial e inicio del drill-down.",
        loading_strategy="Cargar al iniciar la app.",
        notes="Capa web inicial. Mantiene población provincial completa y geometría optimizada para encuadre de Argentina sin Antártida/Islas en la vista inicial.",
    ),
    LayerSpec(
        layer_id="departamentos",
        source_layer="georef_departamentos",
        output_file="localidades_poligonos_departamentos.geojson",
        short_name="departamentos",
        nivel_map_ready="departamento_partido_comuna",
        render_layer="drilldown_provincia",
        geometry_family="polygon",
        additive=True,
        split_by_province=True,
        national_export=True,
        simplify_tolerance=0.002,
        usage="Click en provincia; coroplético por departamentos, partidos y comunas. Es la jerarquía poligonal aditiva recomendada para drill-down inicial.",
        loading_strategy="Cargar el archivo nacional si el frontend lo tolera; preferir archivo por provincia luego del click.",
        notes="En Buenos Aires debe conservar 135 departamentos/partidos.",
    ),
    LayerSpec(
        layer_id="gobiernos_locales",
        source_layer="georef_gobiernos_locales",
        output_file="localidades_poligonos_gobiernos_locales.geojson",
        short_name="gobiernos_locales",
        nivel_map_ready="gobierno_local",
        render_layer="zoom_intermedio",
        geometry_family="polygon",
        additive=False,
        split_by_province=True,
        national_export=True,
        simplify_tolerance=0.0015,
        usage="Zoom intermedio y lectura administrativa local cuando exista cobertura. No usar para suma nacional.",
        loading_strategy="Cargar por provincia bajo demanda.",
        notes="Capa útil para render, pero no cierra población nacional completa en esta V5; se marca como no aditiva.",
    ),
    LayerSpec(
        layer_id="municipios",
        source_layer="georef_municipios",
        output_file="localidades_poligonos_municipios.geojson",
        short_name="municipios",
        nivel_map_ready="municipio",
        render_layer="zoom_intermedio_overlay",
        geometry_family="polygon",
        additive=False,
        split_by_province=True,
        national_export=True,
        simplify_tolerance=0.001,
        usage="Overlay administrativo cuando la geometría municipal existe. No usar para suma nacional.",
        loading_strategy="Cargar por provincia bajo demanda.",
        notes="Capa parcial/superpuesta de pocos registros; se conserva por trazabilidad.",
    ),
    LayerSpec(
        layer_id="aglomerados",
        source_layer="georef_aglomerados",
        output_file="localidades_poligonos_aglomerados.geojson",
        short_name="aglomerados",
        nivel_map_ready="aglomerado",
        render_layer="overlay_urbano",
        geometry_family="polygon",
        additive=False,
        split_by_province=True,
        national_export=True,
        simplify_tolerance=0.001,
        usage="Overlay urbano/metropolitano. No usar para suma nacional porque puede cruzar jurisdicciones y superponerse.",
        loading_strategy="Cargar bajo demanda; preferir por provincia representante.",
        notes="La provincia se deriva por código cuando es posible o por punto representativo/intersección espacial.",
    ),
    LayerSpec(
        layer_id="fracciones",
        source_layer="georef_fracciones_censales",
        output_file="localidades_poligonos_fracciones.geojson",
        short_name="fracciones",
        nivel_map_ready="fraccion_censal",
        render_layer="zoom_alto_fracciones",
        geometry_family="polygon",
        additive=True,
        split_by_province=True,
        national_export=True,
        simplify_tolerance=0.0007,
        usage="Zoom alto y coroplético de mayor detalle. Es aditiva si se usa como única jerarquía.",
        loading_strategy="No cargar nacional por defecto; cargar por provincia o por bounding box.",
        notes="Población estimada por área sobre departamentos según V4.",
    ),
    LayerSpec(
        layer_id="radios",
        source_layer="georef_radios_censales",
        output_file="localidades_poligonos_radios.geojson",
        short_name="radios",
        nivel_map_ready="radio_censal",
        render_layer="zoom_muy_alto_radios",
        geometry_family="polygon",
        additive=True,
        split_by_province=True,
        national_export=False,
        simplify_tolerance=0.00045,
        usage="Máximo detalle censal. Es aditiva si se usa como única jerarquía, pero no debe cargarse nacionalmente en el navegador.",
        loading_strategy="Cargar exclusivamente por provincia/área visible. No se publica GeoJSON nacional de radios para mantener la V5 liviana en Cloudflare Free.",
        notes="Población estimada por área sobre departamentos según V4.",
    ),
    LayerSpec(
        layer_id="localidades_puntos",
        source_layer="app_localidades_puntos",
        output_file="localidades_puntos.geojson",
        short_name="puntos",
        nivel_map_ready="localidad_asentamiento_punto",
        render_layer="puntos_clusters_heatmap",
        geometry_family="point",
        additive=False,
        split_by_province=True,
        national_export=True,
        simplify_tolerance=0.0,
        usage="Puntos para tooltips, clusters y heatmap. No sumar población porque contiene localidades y asentamientos superpuestos.",
        loading_strategy="Cargar nacional si el peso es aceptable; para performance, preferir carga por provincia.",
        notes="Capa no aditiva por diseño; combina localidades y asentamientos puntuales.",
    ),
]


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    return value or "sin_nombre"


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(round(float(value)))
    except Exception:
        return default


def clean_out_dir(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for item in out_dir.iterdir():
        if item.name in {"metadata.json", "indexes"} or item.suffix.lower() in {".geojson", ".json"} or item.name == "provincias":
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
    (out_dir / "indexes").mkdir(parents=True, exist_ok=True)
    (out_dir / "provincias").mkdir(parents=True, exist_ok=True)


def load_source_layer(gpkg: Path, layer: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(gpkg, layer=layer)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")
    return gdf


def make_valid_geometries(gdf: gpd.GeoDataFrame, tolerance: float) -> tuple[gpd.GeoDataFrame, dict[str, int]]:
    stats = {
        "invalid_before": int((~gdf.geometry.is_valid).sum()),
        "empty_before": int(gdf.geometry.is_empty.sum()),
        "features_before_geometry_filter": int(len(gdf)),
    }
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.apply(lambda geom: make_valid(geom) if geom is not None and not geom.is_valid else geom)
    if tolerance and tolerance > 0:
        gdf["geometry"] = gdf.geometry.simplify(tolerance, preserve_topology=True)
        gdf["geometry"] = gdf.geometry.apply(lambda geom: make_valid(geom) if geom is not None and not geom.is_valid else geom)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    stats.update(
        {
            "invalid_after": int((~gdf.geometry.is_valid).sum()),
            "empty_after": int(gdf.geometry.is_empty.sum()),
            "features_after_geometry_filter": int(len(gdf)),
        }
    )
    return gdf, stats


def province_code_from_id(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = str(value)
    match = re.search(r"(\d{2})", text)
    return match.group(1) if match else None


def code_prefix(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) >= 2:
        return digits[:2]
    return None


def load_province_reference(gpkg: Path) -> gpd.GeoDataFrame:
    prov = load_source_layer(gpkg, "georef_provincias")
    prov = prov.copy()
    prov["provincia_id"] = prov["id_entidad"]
    prov["provincia_codigo"] = prov["codigo_indec"].astype(str).str.zfill(2)
    prov["provincia_nombre"] = prov["nombre"]
    return prov[["provincia_id", "provincia_codigo", "provincia_nombre", "geometry", "poblacion_total"]]


def ensure_province_columns(gdf: gpd.GeoDataFrame, province_ref: gpd.GeoDataFrame, source_layer: str) -> gpd.GeoDataFrame:
    gdf = gdf.copy()
    code_to_id = dict(zip(province_ref["provincia_codigo"], province_ref["provincia_id"]))
    id_to_name = dict(zip(province_ref["provincia_id"], province_ref["provincia_nombre"]))
    id_to_code = dict(zip(province_ref["provincia_id"], province_ref["provincia_codigo"]))

    if "metodo_provincia" not in gdf.columns:
        gdf["metodo_provincia"] = None

    if source_layer in {"georef_provincias", "app_provincias"}:
        if "id_entidad" in gdf.columns:
            gdf["provincia_id"] = gdf["id_entidad"]
        if "codigo_indec" in gdf.columns:
            gdf["provincia_codigo"] = gdf["codigo_indec"].astype(str).str.zfill(2)
        gdf["provincia_nombre"] = gdf.get("nombre")
        gdf["metodo_provincia"] = "provincia_fuente"
        return gdf

    if "provincia_id" not in gdf.columns:
        gdf["provincia_id"] = None

    gdf["provincia_id"] = gdf["provincia_id"].where(gdf["provincia_id"].notna(), None)
    missing = gdf["provincia_id"].isna() | gdf["provincia_id"].astype(str).str.strip().isin(["", "None", "nan"])
    if missing.any():
        derived_code = pd.Series([None] * len(gdf), index=gdf.index, dtype="object")
        for col in ["codigo_indec", "codigo_georef", "id_entidad"]:
            if col in gdf.columns:
                col_codes = gdf[col].apply(code_prefix)
                derived_code = derived_code.where(derived_code.notna(), col_codes)
        matched_ids = derived_code.map(code_to_id)
        assign_mask = missing & matched_ids.notna()
        gdf.loc[assign_mask, "provincia_id"] = matched_ids[assign_mask]
        gdf.loc[assign_mask, "metodo_provincia"] = "codigo_prefijo"

    missing = gdf["provincia_id"].isna() | gdf["provincia_id"].astype(str).str.strip().isin(["", "None", "nan"])
    if missing.any():
        # Representative point avoids centroid-outside-polygon problems and is enough to assign a rendering province.
        work = gdf.loc[missing, ["geometry"]].copy()
        work["geometry"] = work.geometry.representative_point()
        prov_light = province_ref[["provincia_id", "geometry"]].rename(columns={"provincia_id": "provincia_id_join"})
        joined = gpd.sjoin(work, prov_light, how="left", predicate="within")
        joined_ids = joined["provincia_id_join"]
        assign_mask = missing.copy()
        assign_mask.loc[:] = False
        assign_mask.loc[joined.index] = joined_ids.notna().values
        gdf.loc[joined_ids[joined_ids.notna()].index, "provincia_id"] = joined_ids[joined_ids.notna()].values
        gdf.loc[joined_ids[joined_ids.notna()].index, "metodo_provincia"] = "punto_representativo_espacial"

    gdf["provincia_codigo"] = gdf["provincia_id"].map(id_to_code)
    fallback_code = gdf["provincia_id"].apply(province_code_from_id)
    gdf["provincia_codigo"] = gdf["provincia_codigo"].where(gdf["provincia_codigo"].notna(), fallback_code)
    gdf["provincia_nombre"] = gdf["provincia_id"].map(id_to_name)
    gdf["metodo_provincia"] = gdf["metodo_provincia"].fillna("provincia_id_fuente")
    return gdf


def normalize_properties(gdf: gpd.GeoDataFrame, spec: LayerSpec, province_ref: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = ensure_province_columns(gdf, province_ref, spec.source_layer)
    gdf = gdf.copy()
    gdf["poblacion_total"] = pd.to_numeric(gdf.get("poblacion_total"), errors="coerce").fillna(0).round().astype("int64")
    if "viviendas_total" in gdf.columns:
        gdf["viviendas_total"] = pd.to_numeric(gdf["viviendas_total"], errors="coerce").fillna(0).round().astype("int64")
    else:
        gdf["viviendas_total"] = 0
    gdf["nivel_map_ready"] = spec.nivel_map_ready
    gdf["render_layer"] = spec.render_layer
    gdf["aditiva"] = bool(spec.additive)
    gdf["no_aditiva"] = not bool(spec.additive)
    gdf["uso_frontend"] = spec.usage
    gdf["loading_strategy"] = spec.loading_strategy
    if "tooltip_nombre" not in gdf.columns:
        gdf["tooltip_nombre"] = gdf.get("nombre")
    if "tooltip_poblacion" not in gdf.columns:
        gdf["tooltip_poblacion"] = gdf["poblacion_total"].map(lambda x: f"{int(x):,}".replace(",", "."))
    if "tipo_original" not in gdf.columns:
        gdf["tipo_original"] = spec.nivel_map_ready
    if "capa_original" not in gdf.columns:
        gdf["capa_original"] = spec.source_layer
    if "display_tipo" not in gdf.columns:
        gdf["display_tipo"] = "provincia" if spec.layer_id == "provincias" else "localidad"
    if "app_jerarquia" not in gdf.columns:
        gdf["app_jerarquia"] = "Provincia" if spec.layer_id == "provincias" else "Localidad"

    # Keep only lightweight, frontend-safe fields while preserving traceability.
    keep = [col for col in BASE_KEEP_FIELDS if col in gdf.columns]
    gdf = gdf[keep + ["geometry"]].copy()
    return gdf


def export_geojson(gdf: gpd.GeoDataFrame, out_path: Path) -> dict[str, Any]:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    # pyogrio is substantially faster than Fiona for the many province splits.
    # GDAL GeoJSON layer option keeps coordinates rounded for web payload size.
    pyogrio.write_dataframe(
        gdf,
        out_path,
        driver="GeoJSON",
        layer_options={"COORDINATE_PRECISION": str(COORDINATE_PRECISION)},
    )
    return {
        "path": str(out_path).replace("\\", "/"),
        "size_bytes": out_path.stat().st_size,
        "size_mb": round(out_path.stat().st_size / 1024 / 1024, 3),
    }


def layer_summary(gdf: gpd.GeoDataFrame, spec: LayerSpec, output_info: dict[str, Any], geometry_stats: dict[str, int]) -> dict[str, Any]:
    pop_sum = safe_int(pd.to_numeric(gdf["poblacion_total"], errors="coerce").fillna(0).sum()) if "poblacion_total" in gdf.columns else 0
    method_counts = {}
    confidence_counts = {}
    classification_counts = {}
    if "metodo_dato" in gdf.columns:
        method_counts = {str(k): int(v) for k, v in gdf["metodo_dato"].fillna("sin_metodo").value_counts().to_dict().items()}
    if "confianza_censo" in gdf.columns:
        confidence_counts = {str(k): int(v) for k, v in gdf["confianza_censo"].fillna("sin_confianza").value_counts().to_dict().items()}
    if "clasificacion_censo" in gdf.columns:
        classification_counts = {str(k): int(v) for k, v in gdf["clasificacion_censo"].fillna("sin_clasificacion").value_counts().to_dict().items()}
    diff = pop_sum - NATIONAL_POPULATION_EXPECTED if spec.additive else None
    geom_types = sorted([str(x) for x in gdf.geometry.geom_type.dropna().unique()])
    removed_fields = sorted(set(load_schema_fields_hint(spec.source_layer)) - set([c for c in gdf.columns if c != "geometry"]))
    return {
        "layer_id": spec.layer_id,
        "source_layer": spec.source_layer,
        "output_file": spec.output_file if spec.national_export else None,
        "national_export": bool(spec.national_export),
        "relative_path": (output_info["path"].split("public/data/", 1)[-1] if output_info.get("path") and "public/data/" in output_info["path"] else output_info.get("path")),
        "short_name": spec.short_name,
        "feature_count": int(len(gdf)),
        "geometry_types": geom_types,
        "geometry_family": spec.geometry_family,
        "size_bytes": output_info["size_bytes"],
        "size_mb": output_info["size_mb"],
        "fields_included": [c for c in gdf.columns if c != "geometry"],
        "fields_removed_reference": removed_fields,
        "simplification_tolerance_degrees": spec.simplify_tolerance,
        "coordinate_precision_decimals": COORDINATE_PRECISION,
        "aditiva": bool(spec.additive),
        "no_aditiva": not bool(spec.additive),
        "population_sum": pop_sum,
        "population_expected": NATIONAL_POPULATION_EXPECTED if spec.additive else None,
        "population_diff": diff,
        "usage": spec.usage,
        "loading_strategy": spec.loading_strategy,
        "notes": spec.notes,
        "method_counts": method_counts,
        "confidence_counts": confidence_counts,
        "classification_counts": classification_counts,
        "geometry_validation": geometry_stats,
        "warnings": [],
    }


_SCHEMA_HINTS: dict[str, list[str]] = {}


def load_schema_fields_hint(layer: str) -> list[str]:
    return _SCHEMA_HINTS.get(layer, [])


def build_schema_hints(gpkg: Path, layers: list[str]) -> None:
    for layer in layers:
        try:
            with fiona.open(gpkg, layer=layer) as src:
                _SCHEMA_HINTS[layer] = list(src.schema.get("properties", {}).keys())
        except Exception:
            _SCHEMA_HINTS[layer] = []


def province_folder_name(provincia_codigo: Any, provincia_nombre: Any) -> str:
    code = str(provincia_codigo or "na").zfill(2)
    return f"provincia_{code}_{slugify(str(provincia_nombre or 'sin_nombre'))}"


def export_province_splits(
    gdf: gpd.GeoDataFrame,
    out_dir: Path,
    spec: LayerSpec,
    province_ref: gpd.GeoDataFrame,
) -> list[dict[str, Any]]:
    splits: list[dict[str, Any]] = []
    if not spec.split_by_province or "provincia_id" not in gdf.columns:
        return splits

    prov_info = province_ref[["provincia_id", "provincia_codigo", "provincia_nombre"]].drop_duplicates()
    prov_info = prov_info.sort_values("provincia_codigo")
    for _, prov in prov_info.iterrows():
        provincia_id = prov["provincia_id"]
        subset = gdf[gdf["provincia_id"] == provincia_id].copy()
        if subset.empty:
            continue
        folder = out_dir / "provincias" / province_folder_name(prov["provincia_codigo"], prov["provincia_nombre"])
        out_path = folder / f"{spec.short_name}.geojson"
        info = export_geojson(subset, out_path)
        rel = info["path"].split("public/data/", 1)[-1] if "public/data/" in info["path"] else info["path"]
        splits.append(
            {
                "layer_id": spec.layer_id,
                "provincia_id": provincia_id,
                "provincia_codigo": prov["provincia_codigo"],
                "provincia_nombre": prov["provincia_nombre"],
                "relative_path": rel,
                "feature_count": int(len(subset)),
                "population_sum": safe_int(pd.to_numeric(subset["poblacion_total"], errors="coerce").fillna(0).sum()),
                "size_bytes": info["size_bytes"],
                "size_mb": info["size_mb"],
            }
        )
    return splits


def make_indexes(out_dir: Path, metadata: dict[str, Any]) -> None:
    indexes_dir = out_dir / "indexes"
    layers_index = {
        "version": metadata["version"],
        "generated_at": metadata["generated_at"],
        "layers": [
            {
                "layer_id": layer["layer_id"],
                "relative_path": layer["relative_path"],
                "national_export": layer.get("national_export", True),
                "aditiva": layer["aditiva"],
                "no_aditiva": layer["no_aditiva"],
                "feature_count": layer["feature_count"],
                "size_mb": layer["size_mb"],
                "usage": layer["usage"],
                "loading_strategy": layer["loading_strategy"],
            }
            for layer in metadata["layers"]
        ],
    }
    provinces_index: dict[str, Any] = {
        "version": metadata["version"],
        "generated_at": metadata["generated_at"],
        "provinces": {},
    }
    for split in metadata["province_splits"]:
        province_key = split["provincia_id"]
        provinces_index["provinces"].setdefault(
            province_key,
            {
                "provincia_id": split["provincia_id"],
                "provincia_codigo": split["provincia_codigo"],
                "provincia_nombre": split["provincia_nombre"],
                "folder": str(Path(split["relative_path"]).parent).replace("\\", "/"),
                "layers": {},
            },
        )
        provinces_index["provinces"][province_key]["layers"][split["layer_id"]] = {
            "relative_path": split["relative_path"],
            "feature_count": split["feature_count"],
            "population_sum": split["population_sum"],
            "size_mb": split["size_mb"],
        }
    (indexes_dir / "layers_index.json").write_text(json.dumps(layers_index, ensure_ascii=False, indent=2), encoding="utf-8")
    (indexes_dir / "provincias_index.json").write_text(json.dumps(provinces_index, ensure_ascii=False, indent=2), encoding="utf-8")


def generate_markdown_diagnostic(diag: dict[str, Any], out_md: Path) -> None:
    rows = []
    for layer in diag["layers"]:
        rows.append(
            {
                "layer_id": layer["layer_id"],
                "features": layer["feature_count"],
                "geom": ", ".join(layer["geometry_types"]),
                "size_mb": layer["size_mb"],
                "pop_sum": layer["population_sum"],
                "aditiva": "sí" if layer["aditiva"] else "no",
                "diff": layer["population_diff"] if layer["population_diff"] is not None else "no aplica",
                "simpl_deg": layer["simplification_tolerance_degrees"],
                "uso": layer["usage"],
            }
        )
    df = pd.DataFrame(rows)

    split_rows = []
    for split in diag["province_splits"]:
        split_rows.append(
            {
                "provincia": split["provincia_nombre"],
                "layer": split["layer_id"],
                "features": split["feature_count"],
                "size_mb": split["size_mb"],
                "path": split["relative_path"],
            }
        )
    split_df = pd.DataFrame(split_rows)

    warnings = diag.get("warnings", [])
    errors = diag.get("errors", [])
    status = diag.get("status", "UNKNOWN")
    md = []
    md.append("# Diagnóstico Map Ready V5\n")
    md.append(f"Generado: {diag['generated_at']}\n")
    md.append(f"Estado final del export: **{status}**\n")
    md.append("\n## Objetivo de V5\n")
    md.append(
        "La V5 separa las capas poligonales por nivel de render para evitar doble conteo. "
        "La regla principal es usar una sola jerarquía aditiva por coroplético o suma poblacional.\n"
    )
    md.append("\n## Archivos nacionales generados\n")
    md.append(df.to_markdown(index=False) if not df.empty else "Sin archivos nacionales.")
    md.append("\n\n## Reglas de uso frontend\n")
    md.append("- Vista nacional: `provincias.geojson`.\n")
    md.append("- Drill-down al hacer click en provincia: `departamentos.geojson` por provincia, o archivo nacional de departamentos si el frontend lo tolera.\n")
    md.append("- Zoom intermedio: gobiernos locales / municipios, siempre como render layer no aditiva salvo validación posterior.\n")
    md.append("- Zoom alto: fracciones o radios; cargar por provincia o área visible.\n")
    md.append("- Puntos, clusters y heatmap: `localidades_puntos.geojson`; no usar como suma poblacional.\n")
    md.append("- Coroplético: usar una sola jerarquía a la vez. No mezclar departamentos + radios + fracciones.\n")
    md.append("\n## Capas aditivas y no aditivas\n")
    for layer in diag["layers"]:
        md.append(f"\n### {layer['layer_id']}\n")
        md.append(f"- Archivo nacional: `{layer['relative_path'] if layer.get('relative_path') else 'no publicado; usar splits por provincia'}`\n")
        md.append(f"- Fuente GPKG: `{layer['source_layer']}`\n")
        md.append(f"- Aditiva: `{layer['aditiva']}` / no_aditiva: `{layer['no_aditiva']}`\n")
        md.append(f"- Features: `{layer['feature_count']}`\n")
        md.append(f"- Población total: `{layer['population_sum']}`\n")
        if layer["population_diff"] is not None:
            md.append(f"- Diferencia contra población nacional esperada: `{layer['population_diff']}`\n")
        md.append(f"- Simplificación aplicada: `{layer['simplification_tolerance_degrees']}` grados; precisión coordenadas `{layer['coordinate_precision_decimals']}` decimales.\n")
        md.append(f"- Uso recomendado: {layer['usage']}\n")
        md.append(f"- Estrategia de carga: {layer['loading_strategy']}\n")
        md.append(f"- Campos incluidos: `{', '.join(layer['fields_included'])}`\n")
        if layer.get("fields_removed_reference"):
            md.append(f"- Campos removidos desde fuente: `{', '.join(layer['fields_removed_reference'])}`\n")
        if layer.get("method_counts"):
            method_df = pd.DataFrame([{"metodo_dato": k, "features": v} for k, v in layer["method_counts"].items()])
            md.append("\nMétodos de dato:\n\n")
            md.append(method_df.to_markdown(index=False))
            md.append("\n")
    md.append("\n## Archivos por provincia\n")
    if split_df.empty:
        md.append("No se generaron splits por provincia.\n")
    else:
        summary = split_df.groupby(["provincia", "layer"], as_index=False).agg(features=("features", "sum"), size_mb=("size_mb", "sum"))
        md.append(summary.to_markdown(index=False))
    md.append("\n\n## Advertencias\n")
    if warnings:
        for w in warnings:
            md.append(f"- WARN: {w}\n")
    else:
        md.append("- Sin advertencias.\n")
    md.append("\n## Errores\n")
    if errors:
        for e in errors:
            md.append(f"- ERROR: {e}\n")
    else:
        md.append("- Sin errores bloqueantes en export.\n")
    md.append("\n## Resultado\n")
    md.append(f"Resultado final export V5: **{status}**. Ejecutar `python src\\check_map_ready_v5.py --data-dir public\\data --diag data\\output\\diagnostico_map_ready_v5.json` para validación independiente.\n")
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text("".join(md), encoding="utf-8")


def generate_previews(out_dir: Path, previews_dir: Path) -> list[dict[str, Any]]:
    previews: list[dict[str, Any]] = []
    if plt is None:
        return [{"status": "WARN", "message": "matplotlib no disponible; previews no generadas."}]
    previews_dir.mkdir(parents=True, exist_ok=True)

    def save_plot(gdf: gpd.GeoDataFrame, path: Path, column: str | None = "poblacion_total", title: str | None = None, points: bool = False) -> None:
        fig, ax = plt.subplots(figsize=(9, 9))
        if points:
            valid = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
            ax.scatter(valid.geometry.x, valid.geometry.y, s=1, alpha=0.7)
        else:
            gdf.plot(ax=ax, column=column, legend=True if column in gdf.columns else False, linewidth=0.2, edgecolor="black")
        ax.set_axis_off()
        if title:
            ax.set_title(title)
        fig.tight_layout()
        fig.savefig(path, dpi=160)
        plt.close(fig)

    try:
        provincias = gpd.read_file(out_dir / "provincias.geojson")
        save_plot(provincias, previews_dir / "v5_coropletico_argentina_provincias.png", title="V5 provincias")
        previews.append({"file": "public/previews/v5_coropletico_argentina_provincias.png", "status": "OK"})
    except Exception as exc:
        previews.append({"file": "public/previews/v5_coropletico_argentina_provincias.png", "status": "WARN", "message": str(exc)})

    try:
        deps = gpd.read_file(out_dir / "localidades_poligonos_departamentos.geojson")
        ba = deps[deps["provincia_id"] == "provincia:06"].copy()
        save_plot(ba, previews_dir / "v5_coropletico_buenos_aires_departamentos.png", title="V5 Buenos Aires departamentos")
        previews.append({"file": "public/previews/v5_coropletico_buenos_aires_departamentos.png", "status": "OK"})
    except Exception as exc:
        previews.append({"file": "public/previews/v5_coropletico_buenos_aires_departamentos.png", "status": "WARN", "message": str(exc)})

    try:
        puntos = gpd.read_file(out_dir / "localidades_puntos.geojson")
        ba_pts = puntos[puntos["provincia_id"] == "provincia:06"].copy()
        save_plot(ba_pts, previews_dir / "v5_puntos_localidades_buenos_aires.png", title="V5 Buenos Aires puntos", points=True)
        previews.append({"file": "public/previews/v5_puntos_localidades_buenos_aires.png", "status": "OK"})
    except Exception as exc:
        previews.append({"file": "public/previews/v5_puntos_localidades_buenos_aires.png", "status": "WARN", "message": str(exc)})

    return previews


def write_public_data_readme(out_dir: Path) -> None:
    text = """# public/data — V5 Map Ready

Esta carpeta contiene los GeoJSON listos para consumir desde un frontend estático.

Regla principal: **no mezclar capas superpuestas para sumar población**.

- `provincias.geojson`: vista nacional y coroplético provincial.
- `localidades_poligonos_departamentos.geojson`: drill-down por provincia, capa aditiva recomendada.
- `localidades_poligonos_fracciones.geojson`: zoom alto, aditiva si se usa sola.
- Radios censales: se publican por provincia en `public/data/provincias/<provincia>/radios.geojson`; no se publica GeoJSON nacional para no forzar una carga pesada.
- `localidades_poligonos_gobiernos_locales.geojson`, `municipios.geojson`, `aglomerados.geojson`: render layers no aditivas/superpuestas.
- `localidades_puntos.geojson`: puntos para clusters, tooltips y heatmap; no usar para suma.

Los archivos por provincia están en `public/data/provincias/` y deben ser la opción preferida para drill-down y alto zoom.
"""
    (out_dir / "README_PUBLIC_DATA.md").write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Exporta capas GeoJSON map-ready V5 desde el GeoPackage census-ready V4.")
    parser.add_argument("--input", default="data/output/arg_geo_censo_census_ready_v4.gpkg", help="GeoPackage census-ready V4.")
    parser.add_argument("--out-dir", default="public/data", help="Directorio de salida para GeoJSON y metadata.")
    parser.add_argument("--diag-md", default="data/output/diagnostico_map_ready_v5.md", help="Diagnóstico markdown.")
    parser.add_argument("--diag-json", default="data/output/diagnostico_map_ready_v5.json", help="Diagnóstico JSON.")
    parser.add_argument("--previews-dir", default="public/previews", help="Directorio para previews PNG.")
    parser.add_argument("--skip-previews", action="store_true", help="No generar previews PNG.")
    args = parser.parse_args()

    gpkg = Path(args.input)
    out_dir = Path(args.out_dir)
    diag_md = Path(args.diag_md)
    diag_json = Path(args.diag_json)
    previews_dir = Path(args.previews_dir)

    if not gpkg.exists():
        raise SystemExit(f"ERROR: no existe el GeoPackage de entrada: {gpkg}")

    source_layers = set(fiona.listlayers(gpkg))
    missing = [layer for layer in REQUIRED_SOURCE_LAYERS if layer not in source_layers]
    if missing:
        raise SystemExit(f"ERROR: faltan capas fuente requeridas en el GPKG: {missing}")

    clean_out_dir(out_dir)
    build_schema_hints(gpkg, [spec.source_layer for spec in LAYER_SPECS])
    province_ref = load_province_reference(gpkg)
    initial_view = load_source_layer(gpkg, "app_provincias")
    bbox = [float(x) for x in initial_view.total_bounds]

    metadata: dict[str, Any] = {
        "project": "Mapa2",
        "version": VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_gpkg": str(gpkg).replace("\\", "/"),
        "national_population_expected": NATIONAL_POPULATION_EXPECTED,
        "coordinate_reference_system": "EPSG:4326 / CRS84 GeoJSON",
        "initial_view_bbox": bbox,
        "file_size_policy": {
            "national_geojson_warn_mb": SIZE_WARN_MB,
            "province_split_warn_mb": PER_PROVINCE_SIZE_WARN_MB,
            "strategy": "Los archivos pesados se exportan también por provincia para Cloudflare Pages y carga bajo demanda.",
        },
        "recommended_flow": {
            "vista_nacional": "provincias.geojson",
            "click_provincia": "provincias/<provincia>/departamentos.geojson",
            "zoom_intermedio": "gobiernos_locales/municipios por provincia, no aditivos",
            "zoom_alto": "fracciones o radios por provincia/viewport",
            "puntos_clusters_heatmap": "localidades_puntos.geojson o puntos por provincia",
            "coropletico": "una sola jerarquía a la vez",
        },
        "layers": [],
        "province_splits": [],
        "previews": [],
        "warnings": [],
        "errors": [],
        "status": "OK",
    }

    for spec in LAYER_SPECS:
        print(f"Exportando {spec.layer_id} desde {spec.source_layer}...")
        gdf = load_source_layer(gpkg, spec.source_layer)
        gdf = normalize_properties(gdf, spec, province_ref)
        gdf, geom_stats = make_valid_geometries(gdf, spec.simplify_tolerance)
        if spec.national_export:
            out_path = out_dir / spec.output_file
            output_info = export_geojson(gdf, out_path)
        else:
            output_info = {"path": None, "size_bytes": 0, "size_mb": 0}
        summary = layer_summary(gdf, spec, output_info, geom_stats)
        if spec.national_export and summary["size_mb"] > SIZE_WARN_MB:
            summary["warnings"].append(
                f"Archivo nacional {summary['relative_path']} pesa {summary['size_mb']} MB; preferir carga por provincia."
            )
            metadata["warnings"].append(summary["warnings"][-1])
        if not spec.national_export:
            summary["warnings"].append("Sin GeoJSON nacional por diseño; usar splits por provincia.")
        if spec.additive and summary["population_diff"] != 0:
            metadata["errors"].append(
                f"{spec.layer_id}: la capa aditiva no cierra población nacional. Diff={summary['population_diff']}"
            )
        if spec.layer_id == "departamentos":
            ba_count = int((gdf["provincia_id"] == "provincia:06").sum())
            summary["buenos_aires_departamentos_count"] = ba_count
            if ba_count != 135:
                metadata["errors"].append(f"departamentos: Buenos Aires tiene {ba_count} features; esperado 135.")
        if gdf["provincia_id"].isna().any() or gdf["provincia_nombre"].isna().any():
            metadata["errors"].append(f"{spec.layer_id}: hay features sin provincia_id/provincia_nombre.")
        if pd.to_numeric(gdf["poblacion_total"], errors="coerce").isna().any():
            metadata["errors"].append(f"{spec.layer_id}: hay población nula o no numérica.")

        splits = export_province_splits(gdf, out_dir, spec, province_ref)
        for split in splits:
            if split["size_mb"] > PER_PROVINCE_SIZE_WARN_MB:
                warn = f"Split {split['relative_path']} pesa {split['size_mb']} MB; revisar simplificación/carga bajo demanda."
                metadata["warnings"].append(warn)
        metadata["province_splits"].extend(splits)
        metadata["layers"].append(summary)

    make_indexes(out_dir, metadata)
    metadata["metadata_files"] = {
        "metadata": "public/data/metadata.json",
        "layers_index": "public/data/indexes/layers_index.json",
        "provinces_index": "public/data/indexes/provincias_index.json",
    }
    write_public_data_readme(out_dir)

    if not args.skip_previews:
        metadata["previews"] = generate_previews(out_dir, previews_dir)
        for preview in metadata["previews"]:
            if preview.get("status") == "WARN":
                metadata["warnings"].append(f"Preview: {preview.get('file', '')} {preview.get('message', '')}".strip())

    metadata["status"] = "ERROR" if metadata["errors"] else ("WARN" if metadata["warnings"] else "OK")

    (out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    diag_json.parent.mkdir(parents=True, exist_ok=True)
    diag_json.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    generate_markdown_diagnostic(metadata, diag_md)

    print(f"Export V5 finalizado con estado {metadata['status']}")
    print(f"Metadata: {out_dir / 'metadata.json'}")
    print(f"Diagnóstico MD: {diag_md}")
    print(f"Diagnóstico JSON: {diag_json}")

    if metadata["errors"]:
        for err in metadata["errors"]:
            print(f"ERROR: {err}")
        raise SystemExit(2)
    if metadata["warnings"]:
        for warn in metadata["warnings"]:
            print(f"WARN: {warn}")


if __name__ == "__main__":
    main()
