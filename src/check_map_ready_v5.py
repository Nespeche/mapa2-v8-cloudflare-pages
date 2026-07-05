from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fiona
import geopandas as gpd
import pandas as pd

REQUIRED_FIELDS = [
    "id_entidad",
    "nombre",
    "provincia_id",
    "provincia_nombre",
    "poblacion_total",
    "tipo_original",
    "capa_original",
    "nivel_map_ready",
    "render_layer",
    "aditiva",
    "no_aditiva",
]

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


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(round(float(value)))
    except Exception:
        return default


def project_root_from_data_dir(data_dir: Path) -> Path:
    # Expected public/data -> project root.
    if data_dir.name == "data" and data_dir.parent.name == "public":
        return data_dir.parent.parent
    return Path.cwd()


def boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not math.isnan(float(value)):
        return bool(int(value))
    return str(value).strip().lower() in {"true", "1", "si", "sí", "yes"}


def validate_geojson_file(path: Path, layer_meta: dict[str, Any], expected_population: int) -> dict[str, Any]:
    result: dict[str, Any] = {
        "layer_id": layer_meta.get("layer_id"),
        "relative_path": layer_meta.get("relative_path"),
        "path": str(path).replace("\\", "/"),
        "exists": path.exists(),
        "status": "OK",
        "errors": [],
        "warnings": [],
    }
    if not path.exists():
        result["status"] = "ERROR"
        result["errors"].append("No existe el archivo GeoJSON.")
        return result

    try:
        gdf = gpd.read_file(path)
    except Exception as exc:
        result["status"] = "ERROR"
        result["errors"].append(f"No se pudo leer GeoJSON: {exc}")
        return result

    result["feature_count"] = int(len(gdf))
    result["size_mb"] = round(path.stat().st_size / 1024 / 1024, 3)
    result["geometry_types"] = sorted([str(x) for x in gdf.geometry.geom_type.dropna().unique()])
    result["invalid_geometries"] = int((~gdf.geometry.is_valid).sum())
    result["empty_geometries"] = int(gdf.geometry.is_empty.sum())
    result["crs"] = str(gdf.crs)

    missing_fields = [field for field in REQUIRED_FIELDS if field not in gdf.columns]
    if missing_fields:
        result["errors"].append(f"Faltan campos requeridos: {missing_fields}")

    if gdf.empty:
        result["errors"].append("El archivo no tiene features.")
    if result["invalid_geometries"]:
        result["errors"].append(f"Hay {result['invalid_geometries']} geometrías inválidas.")
    if result["empty_geometries"]:
        result["errors"].append(f"Hay {result['empty_geometries']} geometrías vacías.")
    if gdf.crs is not None and gdf.crs.to_epsg() not in {4326, None}:
        result["errors"].append(f"CRS no esperado: {gdf.crs}")

    if "poblacion_total" in gdf.columns:
        pop = pd.to_numeric(gdf["poblacion_total"], errors="coerce")
        result["missing_population"] = int(pop.isna().sum())
        result["population_sum"] = safe_int(pop.fillna(0).sum())
        if result["missing_population"]:
            result["errors"].append(f"Hay {result['missing_population']} poblaciones nulas/no numéricas.")
    else:
        result["missing_population"] = result.get("feature_count", 0)
        result["population_sum"] = 0

    for field in ["provincia_id", "provincia_nombre"]:
        if field in gdf.columns:
            missing = int(gdf[field].isna().sum() + gdf[field].astype(str).str.strip().isin(["", "None", "nan"]).sum())
            result[f"missing_{field}"] = missing
            if missing:
                result["errors"].append(f"Hay {missing} features sin {field}.")

    if "aditiva" in gdf.columns and "no_aditiva" in gdf.columns:
        aditiva_values = set(gdf["aditiva"].map(boolish).unique())
        no_aditiva_values = set(gdf["no_aditiva"].map(boolish).unique())
        expected_additive = bool(layer_meta.get("aditiva"))
        if aditiva_values != {expected_additive}:
            result["errors"].append(f"Campo aditiva inconsistente: {aditiva_values}, esperado {expected_additive}.")
        if no_aditiva_values != {not expected_additive}:
            result["errors"].append(f"Campo no_aditiva inconsistente: {no_aditiva_values}, esperado {not expected_additive}.")

    if layer_meta.get("aditiva"):
        diff = result.get("population_sum", 0) - expected_population
        result["population_diff"] = diff
        if diff != 0:
            result["errors"].append(f"Capa aditiva no cierra población nacional. Diff={diff}.")
    else:
        if not layer_meta.get("no_aditiva", False):
            result["errors"].append("Capa no aditiva no está marcada como no_aditiva en metadata.")

    if layer_meta.get("layer_id") == "departamentos" and "provincia_id" in gdf.columns:
        ba_count = int((gdf["provincia_id"] == "provincia:06").sum())
        result["buenos_aires_departamentos_count"] = ba_count
        if ba_count != 135:
            result["errors"].append(f"Buenos Aires tiene {ba_count} departamentos/partidos; esperado 135.")

    if result["errors"]:
        result["status"] = "ERROR"
    elif result["warnings"]:
        result["status"] = "WARN"
    return result


def validate_split_geojson(path: Path, split_meta: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "layer_id": split_meta.get("layer_id"),
        "provincia_id": split_meta.get("provincia_id"),
        "relative_path": split_meta.get("relative_path"),
        "exists": path.exists(),
        "status": "OK",
        "errors": [],
        "warnings": [],
    }
    if not path.exists():
        result["status"] = "ERROR"
        result["errors"].append("No existe el split GeoJSON.")
        return result
    try:
        gdf = gpd.read_file(path)
    except Exception as exc:
        result["status"] = "ERROR"
        result["errors"].append(f"No se pudo leer split GeoJSON: {exc}")
        return result
    result["feature_count"] = int(len(gdf))
    result["size_mb"] = round(path.stat().st_size / 1024 / 1024, 3)
    result["invalid_geometries"] = int((~gdf.geometry.is_valid).sum())
    result["empty_geometries"] = int(gdf.geometry.is_empty.sum())
    if gdf.empty:
        result["errors"].append("Split sin features.")
    if result["invalid_geometries"]:
        result["errors"].append(f"Hay {result['invalid_geometries']} geometrías inválidas.")
    if result["empty_geometries"]:
        result["errors"].append(f"Hay {result['empty_geometries']} geometrías vacías.")
    for field in ["provincia_id", "provincia_nombre", "poblacion_total", "nivel_map_ready"]:
        if field not in gdf.columns:
            result["errors"].append(f"Falta campo requerido en split: {field}")
    if "poblacion_total" in gdf.columns:
        missing_pop = int(pd.to_numeric(gdf["poblacion_total"], errors="coerce").isna().sum())
        result["missing_population"] = missing_pop
        if missing_pop:
            result["errors"].append(f"Hay {missing_pop} poblaciones nulas/no numéricas.")
    if "provincia_id" in gdf.columns:
        expected_prov = split_meta.get("provincia_id")
        different = int((gdf["provincia_id"] != expected_prov).sum())
        if different:
            result["errors"].append(f"Hay {different} features con provincia_id distinto del split ({expected_prov}).")
    if result["errors"]:
        result["status"] = "ERROR"
    elif result["warnings"]:
        result["status"] = "WARN"
    return result


def render_text_report(report: dict[str, Any]) -> str:
    lines = []
    lines.append("=" * 80)
    lines.append("CHECK MAP READY V5")
    lines.append("=" * 80)
    lines.append(f"Generado: {report['generated_at']}")
    lines.append(f"Estado final: {report['status']}")
    lines.append("")
    lines.append("Capas fuente GPKG")
    lines.append("-" * 80)
    for layer in report["source_layers"]:
        lines.append(f"{layer['layer']}: {layer['status']}")
    lines.append("")
    lines.append("GeoJSON nacionales")
    lines.append("-" * 80)
    for check in report["geojson_checks"]:
        lines.append(
            f"{check['status']:5} | {check.get('layer_id')} | features={check.get('feature_count')} | "
            f"size={check.get('size_mb')} MB | pop={check.get('population_sum')} | {check.get('relative_path')}"
        )
        for err in check.get("errors", []):
            lines.append(f"  ERROR: {err}")
        for warn in check.get("warnings", []):
            lines.append(f"  WARN: {warn}")
    lines.append("")
    lines.append("Splits por provincia")
    lines.append("-" * 80)
    lines.append(f"Archivos split declarados: {report['province_split_count']}")
    lines.append(f"Splits validados: {report.get('province_split_validated_count', 0)}")
    lines.append(f"Splits faltantes: {len(report['missing_splits'])}")
    lines.append(f"Splits con error: {len(report.get('split_errors', []))}")
    for missing in report["missing_splits"][:30]:
        lines.append(f"  ERROR: falta {missing}")
    for split_error in report.get("split_errors", [])[:30]:
        lines.append(f"  ERROR: {split_error}")
    lines.append("")
    lines.append("Advertencias")
    lines.append("-" * 80)
    if report["warnings"]:
        for warning in report["warnings"]:
            lines.append(f"WARN: {warning}")
    else:
        lines.append("Sin advertencias.")
    lines.append("")
    lines.append("Errores")
    lines.append("-" * 80)
    if report["errors"]:
        for error in report["errors"]:
            lines.append(f"ERROR: {error}")
    else:
        lines.append("Sin errores bloqueantes.")
    lines.append("")
    lines.append("Resultado")
    lines.append("-" * 80)
    if report["status"] == "OK":
        lines.append("OK: V5 Map Ready validada.")
    elif report["status"] == "WARN":
        lines.append("WARN: V5 Map Ready usable con advertencias no bloqueantes.")
    else:
        lines.append("ERROR: V5 Map Ready requiere correcciones.")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Valida salidas public/data de V5 Map Ready.")
    parser.add_argument("--data-dir", default="public/data", help="Directorio public/data generado por export_map_ready_v5.py")
    parser.add_argument("--diag", default="data/output/diagnostico_map_ready_v5.json", help="Diagnóstico JSON generado por el export.")
    parser.add_argument("--out", default="data/output/check_map_ready_v5.txt", help="Archivo TXT de salida para el check.")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    diag_path = Path(args.diag)
    out_path = Path(args.out)
    root = project_root_from_data_dir(data_dir)

    errors: list[str] = []
    warnings: list[str] = []
    if not data_dir.exists():
        raise SystemExit(f"ERROR: no existe data-dir: {data_dir}")
    if not diag_path.exists():
        raise SystemExit(f"ERROR: no existe diagnóstico JSON: {diag_path}")

    metadata = json.loads(diag_path.read_text(encoding="utf-8"))
    expected_population = int(metadata.get("national_population_expected", 45_892_285))
    source_gpkg = Path(metadata.get("source_gpkg", "data/output/arg_geo_censo_census_ready_v4.gpkg"))
    if not source_gpkg.is_absolute():
        source_gpkg = root / source_gpkg

    source_layer_checks = []
    if source_gpkg.exists():
        layers = set(fiona.listlayers(source_gpkg))
        for layer in REQUIRED_SOURCE_LAYERS:
            status = "OK" if layer in layers else "ERROR"
            source_layer_checks.append({"layer": layer, "status": status})
            if status == "ERROR":
                errors.append(f"Falta capa fuente en GPKG: {layer}")
    else:
        errors.append(f"No existe GPKG fuente declarado en metadata: {source_gpkg}")
        for layer in REQUIRED_SOURCE_LAYERS:
            source_layer_checks.append({"layer": layer, "status": "ERROR"})

    metadata_file = data_dir / "metadata.json"
    if not metadata_file.exists():
        errors.append("No existe public/data/metadata.json")
    else:
        metadata_public = json.loads(metadata_file.read_text(encoding="utf-8"))
        if metadata_public.get("version") != metadata.get("version"):
            errors.append("metadata.json público no coincide con diagnóstico JSON.")

    geojson_checks = []
    for layer_meta in metadata.get("layers", []):
        rel = layer_meta.get("relative_path")
        if not rel:
            split_sum = sum(int(s.get("population_sum", 0)) for s in metadata.get("province_splits", []) if s.get("layer_id") == layer_meta.get("layer_id"))
            check = {
                "layer_id": layer_meta.get("layer_id"),
                "relative_path": None,
                "exists": False,
                "status": "OK",
                "feature_count": layer_meta.get("feature_count"),
                "size_mb": 0,
                "population_sum": split_sum,
                "errors": [],
                "warnings": ["Sin GeoJSON nacional por diseño; validación de existencia aplicada a splits por provincia."],
            }
            if layer_meta.get("aditiva") and split_sum != expected_population:
                check["status"] = "ERROR"
                check["errors"].append(f"La suma de splits no cierra población nacional. Diff={split_sum - expected_population}.")
            geojson_checks.append(check)
            errors.extend([f"{check.get('layer_id')}: {e}" for e in check.get("errors", [])])
            warnings.extend([f"{check.get('layer_id')}: {w}" for w in check.get("warnings", [])])
            continue
        path = data_dir / rel
        check = validate_geojson_file(path, layer_meta, expected_population)
        geojson_checks.append(check)
        errors.extend([f"{check.get('layer_id')}: {e}" for e in check.get("errors", [])])
        warnings.extend([f"{check.get('layer_id')}: {w}" for w in check.get("warnings", [])])

    missing_splits = []
    split_checks = []
    split_errors = []
    for split in metadata.get("province_splits", []):
        path = data_dir / split["relative_path"]
        split_check = validate_split_geojson(path, split)
        split_checks.append(split_check)
        if not path.exists():
            missing_splits.append(split["relative_path"])
        for err in split_check.get("errors", []):
            split_errors.append(f"{split.get('relative_path')}: {err}")
    if missing_splits:
        errors.append(f"Faltan {len(missing_splits)} archivos split por provincia.")
    if split_errors:
        errors.append(f"Hay {len(split_errors)} errores en splits por provincia.")

    for layer in metadata.get("layers", []):
        if layer.get("size_mb", 0) > metadata.get("file_size_policy", {}).get("national_geojson_warn_mb", 25):
            warnings.append(f"{layer.get('relative_path') or layer.get('layer_id')} supera el peso recomendado nacional ({layer['size_mb']} MB). Usar split por provincia.")
        if layer.get("aditiva") is False and layer.get("no_aditiva") is not True:
            errors.append(f"{layer['layer_id']} no aditiva sin flag no_aditiva=true en metadata.")

    report = {
        "version": metadata.get("version"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "ERROR" if errors else ("WARN" if warnings else "OK"),
        "source_gpkg": str(source_gpkg).replace("\\", "/"),
        "source_layers": source_layer_checks,
        "geojson_checks": geojson_checks,
        "province_split_count": len(metadata.get("province_splits", [])),
        "province_split_validated_count": len(split_checks),
        "split_checks": split_checks,
        "split_errors": split_errors,
        "missing_splits": missing_splits,
        "warnings": warnings,
        "errors": errors,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = render_text_report(report)
    out_path.write_text(text, encoding="utf-8")
    print(text)
    if report["status"] == "ERROR":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
