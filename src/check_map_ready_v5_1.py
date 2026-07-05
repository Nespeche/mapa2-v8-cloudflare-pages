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

VERSION = "v5_1_map_ready_cloudflare_fix"
NATIONAL_POPULATION_EXPECTED = 45_892_285
CF_SINGLE_ASSET_LIMIT_MIB = 25.0
CF_WARN_MIB = 15.0
CF_PREDEPLOY_WARN_MIB = 20.0
WINDOWS_SAFE_RELATIVE_PATH_LIMIT = 180

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


def boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not math.isnan(float(value)):
        return bool(int(value))
    return str(value).strip().lower() in {"true", "1", "si", "sí", "yes"}


def project_root_from_data_dir(data_dir: Path) -> Path:
    if data_dir.name == "data" and data_dir.parent.name == "public":
        return data_dir.parent.parent
    return Path.cwd()


def size_mib(path: Path) -> float:
    return round(path.stat().st_size / 1024 / 1024, 3)


def scan_public_files(public_dir: Path) -> dict[str, Any]:
    files = []
    for path in public_dir.rglob("*"):
        if not path.is_file():
            continue
        files.append(
            {
                "relative_path": path.relative_to(public_dir).as_posix(),
                "size_bytes": path.stat().st_size,
                "size_mib": size_mib(path),
            }
        )
    files.sort(key=lambda x: x["size_bytes"], reverse=True)
    return {
        "file_count": len(files),
        "max_file": files[0] if files else None,
        "files_over_25_mib": [f for f in files if f["size_mib"] > CF_SINGLE_ASSET_LIMIT_MIB],
        "files_between_20_and_25_mib": [f for f in files if CF_PREDEPLOY_WARN_MIB < f["size_mib"] <= CF_SINGLE_ASSET_LIMIT_MIB],
        "files_between_15_and_20_mib": [f for f in files if CF_WARN_MIB < f["size_mib"] <= CF_PREDEPLOY_WARN_MIB],
        "top_20_files": files[:20],
    }


def scan_windows_paths(project_root: Path, public_dir: Path) -> dict[str, Any]:
    all_paths = []
    public_paths = []
    for path in project_root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(project_root).as_posix()
        item = {"relative_path": rel, "length": len(rel)}
        all_paths.append(item)
        try:
            pub_rel = path.relative_to(public_dir).as_posix()
            public_paths.append({"relative_path": pub_rel, "length": len(pub_rel)})
        except ValueError:
            pass
    all_paths.sort(key=lambda x: x["length"], reverse=True)
    public_paths.sort(key=lambda x: x["length"], reverse=True)
    long_public = [x for x in public_paths if x["length"] > WINDOWS_SAFE_RELATIVE_PATH_LIMIT]
    return {
        "relative_path_limit": WINDOWS_SAFE_RELATIVE_PATH_LIMIT,
        "max_project_relative_path_length": all_paths[0]["length"] if all_paths else 0,
        "max_project_relative_path": all_paths[0]["relative_path"] if all_paths else None,
        "max_public_relative_path_length": public_paths[0]["length"] if public_paths else 0,
        "max_public_relative_path": public_paths[0]["relative_path"] if public_paths else None,
        "long_public_paths_count": len(long_public),
        "long_public_paths_top": long_public[:20],
        "top_project_paths": all_paths[:20],
    }


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
    result["size_mb"] = size_mib(path)
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


def validate_split_geojson(path: Path, split_meta: dict[str, Any], partitioned: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {
        "layer_id": split_meta.get("layer_id"),
        "provincia_id": split_meta.get("provincia_id"),
        "relative_path": split_meta.get("relative_path"),
        "partitioned": partitioned,
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
    result["size_mb"] = size_mib(path)
    result["invalid_geometries"] = int((~gdf.geometry.is_valid).sum())
    result["empty_geometries"] = int(gdf.geometry.is_empty.sum())
    result["population_sum"] = safe_int(pd.to_numeric(gdf.get("poblacion_total"), errors="coerce").fillna(0).sum()) if "poblacion_total" in gdf.columns else 0

    if gdf.empty:
        result["errors"].append("Split sin features.")
    if result["invalid_geometries"]:
        result["errors"].append(f"Hay {result['invalid_geometries']} geometrías inválidas.")
    if result["empty_geometries"]:
        result["errors"].append(f"Hay {result['empty_geometries']} geometrías vacías.")

    required = ["provincia_id", "provincia_nombre", "poblacion_total", "nivel_map_ready", "tipo_original"]
    if partitioned and split_meta.get("layer_id") == "radios":
        required.extend(["departamento_id", "departamento_nombre"])
    for field in required:
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
    if partitioned and "departamento_id" in gdf.columns and split_meta.get("departamento_id"):
        different_dept = int((gdf["departamento_id"].astype(str) != str(split_meta.get("departamento_id"))).sum())
        if different_dept:
            result["errors"].append(f"Hay {different_dept} features con departamento_id distinto del archivo.")

    if result["errors"]:
        result["status"] = "ERROR"
    elif result["warnings"]:
        result["status"] = "WARN"
    return result


def render_text_report(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("=" * 80)
    lines.append("CHECK MAP READY V5.1 — CLOUDFLARE FIX")
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
        for info in check.get("info", []):
            lines.append(f"  INFO: {info}")
        for err in check.get("errors", []):
            lines.append(f"  ERROR: {err}")
        for warn in check.get("warnings", []):
            lines.append(f"  WARN: {warn}")
    lines.append("")
    lines.append("Splits por provincia")
    lines.append("-" * 80)
    lines.append(f"Archivos split GeoJSON declarados: {report['province_split_count']}")
    lines.append(f"Splits provincia validados: {report.get('province_split_validated_count', 0)}")
    lines.append(f"Splits provincia faltantes: {len(report['missing_splits'])}")
    lines.append(f"Splits provincia con error: {len(report.get('split_errors', []))}")
    lines.append("")
    lines.append("Particiones especiales")
    lines.append("-" * 80)
    lines.append(f"Particiones declaradas: {report.get('partitioned_split_file_count', 0)}")
    lines.append(f"Particiones validadas: {report.get('partitioned_split_validated_count', 0)}")
    lines.append(f"Particiones con error: {len(report.get('partitioned_split_errors', []))}")
    if report.get("buenos_aires_radios"):
        ba = report["buenos_aires_radios"]
        lines.append(
            f"Buenos Aires radios: features={ba.get('feature_count')} | pop={ba.get('population_sum')} | "
            f"particiones={ba.get('partition_count')} | max_file={ba.get('max_partition_size_mb')} MB"
        )
    lines.append("")
    lines.append("Auditoría Cloudflare public/")
    lines.append("-" * 80)
    audit = report.get("public_file_audit", {})
    max_file = audit.get("max_file") or {}
    lines.append(f"Archivos en public/: {audit.get('file_count')}")
    lines.append(f"Archivo más pesado: {max_file.get('relative_path')} ({max_file.get('size_mib')} MiB)")
    lines.append(f"Archivos >25 MiB: {len(audit.get('files_over_25_mib', []))}")
    lines.append(f"Archivos 20-25 MiB: {len(audit.get('files_between_20_and_25_mib', []))}")
    lines.append(f"Archivos 15-20 MiB: {len(audit.get('files_between_15_and_20_mib', []))}")
    lines.append("")
    lines.append("Auditoría rutas Windows")
    lines.append("-" * 80)
    path_audit = report.get("windows_path_safety", {})
    lines.append(f"Límite relativo preventivo: {path_audit.get('relative_path_limit')}")
    lines.append(f"Ruta pública relativa más larga: {path_audit.get('max_public_relative_path_length')} caracteres | {path_audit.get('max_public_relative_path')}")
    lines.append(f"Rutas públicas > límite preventivo: {path_audit.get('long_public_paths_count')}")
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
        lines.append("OK: V5.1 Map Ready Cloudflare Fix validada. No se avanzó a V6.")
    elif report["status"] == "WARN":
        lines.append("WARN: V5.1 usable con advertencias no bloqueantes. No se avanzó a V6.")
    else:
        lines.append("ERROR: V5.1 requiere correcciones antes de avanzar.")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Valida salidas public/data de V5.1 Map Ready Cloudflare Fix.")
    parser.add_argument("--data-dir", default="public/data", help="Directorio public/data generado por export_map_ready_v5_1.py")
    parser.add_argument("--diag", default="data/output/diagnostico_map_ready_v5_1.json", help="Diagnóstico JSON V5.1.")
    parser.add_argument("--out", default="data/output/check_map_ready_v5_1.txt", help="Archivo TXT de salida para el check.")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    diag_path = Path(args.diag)
    out_path = Path(args.out)
    root = project_root_from_data_dir(data_dir)
    public_dir = data_dir.parent

    errors: list[str] = []
    warnings: list[str] = []
    info: list[str] = []

    if not data_dir.exists():
        raise SystemExit(f"ERROR: no existe data-dir: {data_dir}")
    if not diag_path.exists():
        raise SystemExit(f"ERROR: no existe diagnóstico JSON: {diag_path}")

    metadata = json.loads(diag_path.read_text(encoding="utf-8"))
    expected_population = int(metadata.get("national_population_expected", NATIONAL_POPULATION_EXPECTED))
    if metadata.get("version") != VERSION:
        errors.append(f"Versión esperada {VERSION}, recibida {metadata.get('version')}")

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

    # Validate national layers, or additive sum from normal + partitioned splits if national layer is not published.
    geojson_checks = []
    normal_split_sum_by_layer: dict[str, int] = {}
    for split in metadata.get("province_splits", []):
        normal_split_sum_by_layer[split.get("layer_id", "")] = normal_split_sum_by_layer.get(split.get("layer_id", ""), 0) + int(split.get("population_sum", 0))
    partition_split_sum_by_layer: dict[str, int] = {}
    for part in metadata.get("partitioned_splits", []):
        partition_split_sum_by_layer[part.get("layer_id", "")] = partition_split_sum_by_layer.get(part.get("layer_id", ""), 0) + int(part.get("population_sum", 0))

    for layer_meta in metadata.get("layers", []):
        rel = layer_meta.get("relative_path")
        if not rel:
            layer_id = layer_meta.get("layer_id")
            split_sum = normal_split_sum_by_layer.get(layer_id, 0) + partition_split_sum_by_layer.get(layer_id, 0)
            check = {
                "layer_id": layer_id,
                "relative_path": None,
                "exists": False,
                "status": "OK",
                "feature_count": layer_meta.get("feature_count"),
                "size_mb": 0,
                "population_sum": split_sum,
                "errors": [],
                "warnings": [],
                "info": ["Sin GeoJSON nacional por diseño; se valida mediante splits/indexación."],
            }
            if layer_meta.get("aditiva") and split_sum != expected_population:
                check["status"] = "ERROR"
                check["errors"].append(f"La suma de splits/particiones no cierra población nacional. Diff={split_sum - expected_population}.")
            geojson_checks.append(check)
            errors.extend([f"{layer_id}: {e}" for e in check.get("errors", [])])
            info.extend([f"{layer_id}: {msg}" for msg in check.get("info", [])])
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

    partitioned_split_checks = []
    partitioned_split_errors = []
    partitioned_file_count = 0
    ba_radios_summary = None
    for part in metadata.get("partitioned_splits", []):
        index_path = data_dir / part["index_relative_path"]
        if not index_path.exists():
            errors.append(f"No existe índice particionado: {part['index_relative_path']}")
            continue
        index = json.loads(index_path.read_text(encoding="utf-8"))
        files = index.get("files", [])
        partitioned_file_count += len(files)
        feature_sum = 0
        pop_sum = 0
        max_partition_size = 0.0
        for file_meta in files:
            split_meta = {
                "layer_id": part.get("layer_id"),
                "provincia_id": part.get("provincia_id"),
                "relative_path": file_meta.get("relative_path"),
                "departamento_id": file_meta.get("departamento_id"),
            }
            path = data_dir / file_meta["relative_path"]
            split_check = validate_split_geojson(path, split_meta, partitioned=True)
            partitioned_split_checks.append(split_check)
            feature_sum += int(split_check.get("feature_count", 0))
            pop_sum += int(split_check.get("population_sum", 0))
            max_partition_size = max(max_partition_size, float(split_check.get("size_mb", 0) or 0))
            for err in split_check.get("errors", []):
                partitioned_split_errors.append(f"{file_meta.get('relative_path')}: {err}")
        if feature_sum != int(part.get("feature_count", 0)):
            errors.append(f"Partición {part.get('index_relative_path')} no conserva features: {feature_sum} vs {part.get('feature_count')}")
        if pop_sum != int(part.get("population_sum", 0)):
            errors.append(f"Partición {part.get('index_relative_path')} no conserva población: {pop_sum} vs {part.get('population_sum')}")
        if part.get("layer_id") == "radios" and part.get("provincia_id") == "provincia:06":
            ba_radios_summary = {
                "feature_count": feature_sum,
                "population_sum": pop_sum,
                "partition_count": len(files),
                "max_partition_size_mb": round(max_partition_size, 3),
            }
            if feature_sum != 23901:
                errors.append(f"Buenos Aires no conserva 23901 radios: {feature_sum}")
            if pop_sum != 17523996:
                errors.append(f"Buenos Aires radios no conserva población 17523996: {pop_sum}")
    if partitioned_split_errors:
        errors.append(f"Hay {len(partitioned_split_errors)} errores en particiones especiales.")

    # Buenos Aires departamentos count from national layer.
    departamentos_path = data_dir / "localidades_poligonos_departamentos.geojson"
    if departamentos_path.exists():
        deps = gpd.read_file(departamentos_path)
        ba_count = int((deps["provincia_id"] == "provincia:06").sum()) if "provincia_id" in deps.columns else -1
        if ba_count != 135:
            errors.append(f"Buenos Aires tiene {ba_count} departamentos/partidos; esperado 135.")

    # Required index files.
    for rel in [
        "indexes/layers_index.json",
        "indexes/provincias_index.json",
        "indexes/localidades_puntos_index.json",
        "provincias/provincia_06_buenos_aires/radios/index.json",
    ]:
        if not (data_dir / rel).exists():
            errors.append(f"Falta índice V5.1 requerido: {rel}")

    provincias_index_path = data_dir / "indexes" / "provincias_index.json"
    if provincias_index_path.exists():
        provinces_index = json.loads(provincias_index_path.read_text(encoding="utf-8"))
        ba_layers = provinces_index.get("provinces", {}).get("provincia:06", {}).get("layers", {})
        ba_radios = ba_layers.get("radios", {})
        if not ba_radios.get("partitioned"):
            errors.append("provincias_index.json no apunta a radios particionados para Buenos Aires.")
        if ba_radios.get("index_relative_path") != "provincias/provincia_06_buenos_aires/radios/index.json":
            errors.append("provincias_index.json tiene index_relative_path inesperado para radios de Buenos Aires.")

    public_file_audit = scan_public_files(public_dir)
    windows_path_safety = scan_windows_paths(root, public_dir)
    if windows_path_safety.get("long_public_paths_count", 0):
        warnings.append(
            f"Hay {windows_path_safety['long_public_paths_count']} rutas públicas relativas mayores a "
            f"{WINDOWS_SAFE_RELATIVE_PATH_LIMIT} caracteres. Extraer en ruta corta."
        )
    for item in public_file_audit["files_over_25_mib"]:
        errors.append(f"Archivo en public/ supera 25 MiB: {item['relative_path']} ({item['size_mib']} MiB)")
    for item in public_file_audit["files_between_20_and_25_mib"]:
        warnings.append(f"Archivo en public/ entre 20 y 25 MiB: {item['relative_path']} ({item['size_mib']} MiB)")
    for item in public_file_audit["files_between_15_and_20_mib"]:
        warnings.append(f"Archivo en public/ entre 15 y 20 MiB: {item['relative_path']} ({item['size_mib']} MiB)")

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
        "partitioned_split_file_count": partitioned_file_count,
        "partitioned_split_validated_count": len(partitioned_split_checks),
        "partitioned_split_checks": partitioned_split_checks,
        "partitioned_split_errors": partitioned_split_errors,
        "buenos_aires_radios": ba_radios_summary,
        "public_file_audit": public_file_audit,
        "windows_path_safety": windows_path_safety,
        "info": info,
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
