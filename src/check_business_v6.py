#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check V6 comercial sintético — Mapa2."""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

VERSION = "v6_business_synthetic_autoparts"
EXPECTED_CLIENTS = 2000
EXPECTED_PERIODS = [f"{year}-{month:02d}" for year in (2025, 2026) for month in range(1, 13)]
ARG_BBOX = {"lon_min": -74.2, "lon_max": -52.0, "lat_min": -56.2, "lat_max": -21.0}
MAX_PUBLIC_FILE_MIB = 25.0
MAX_PUBLIC_REL_PATH_LEN = 180


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "sí", "si", "yes", "y"}


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def records_from_json(path: Path) -> List[Dict[str, Any]]:
    data = read_json(path)
    if isinstance(data, dict) and "records" in data:
        return list(data["records"])
    if isinstance(data, list):
        return data
    raise ValueError(f"No se encontró lista de records en {path}")


def geojson_features(path: Path) -> List[Dict[str, Any]]:
    data = read_json(path)
    if data.get("type") != "FeatureCollection":
        raise ValueError(f"GeoJSON inválido en {path}")
    return list(data.get("features", []))


class CheckReport:
    def __init__(self) -> None:
        self.items: List[Dict[str, Any]] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def ok(self, name: str, detail: str = "") -> None:
        self.items.append({"status": "OK", "name": name, "detail": detail})

    def warn(self, name: str, detail: str) -> None:
        self.items.append({"status": "WARN", "name": name, "detail": detail})
        self.warnings.append(f"{name}: {detail}")

    def error(self, name: str, detail: str) -> None:
        self.items.append({"status": "ERROR", "name": name, "detail": detail})
        self.errors.append(f"{name}: {detail}")

    @property
    def status(self) -> str:
        if self.errors:
            return "ERROR"
        if self.warnings:
            return "WARN"
        return "OK"


def required_file(report: CheckReport, path: Path, label: str) -> bool:
    if path.exists() and path.is_file():
        report.ok(label, str(path))
        return True
    report.error(label, f"No existe: {path}")
    return False


def round2(value: float) -> float:
    return round(float(value), 2)


def round3(value: float) -> float:
    return round(float(value), 3)


def compare_amount(report: CheckReport, label: str, expected: float, observed: float, tolerance: float = 0.05) -> None:
    if abs(round2(expected) - round2(observed)) <= tolerance:
        report.ok(label, f"{observed:,.2f}")
    else:
        report.error(label, f"Esperado {expected:,.2f}; observado {observed:,.2f}")


def sum_sales_by_keys(sales: List[Dict[str, str]], clients: Dict[str, Dict[str, Any]], products: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[Tuple[str, ...], Dict[str, float]]]:
    result: Dict[str, Dict[Tuple[str, ...], Dict[str, float]]] = {
        "provincia_mes": defaultdict(lambda: defaultdict(float)),
        "departamento_mes": defaultdict(lambda: defaultdict(float)),
        "producto_mes": defaultdict(lambda: defaultdict(float)),
        "cliente_totales": defaultdict(lambda: defaultdict(float)),
    }
    for s in sales:
        c = clients[s["cliente_id"]]
        p = products[s["producto_id"]]
        metrics = {
            "unidades": to_float(s["unidades"]),
            "venta_neta": to_float(s["venta_neta"]),
            "costo_estimado": to_float(s["costo_estimado"]),
            "margen_bruto": to_float(s["margen_bruto"]),
            "volumen_kg": to_float(s["volumen_kg"]),
            "registros_venta": 1.0,
        }
        keys = {
            "provincia_mes": (s["periodo"], c["provincia_id"]),
            "departamento_mes": (s["periodo"], c["departamento_id"]),
            "producto_mes": (s["periodo"], p["producto_id"]),
            "cliente_totales": (c["cliente_id"],),
        }
        for grain, key in keys.items():
            bucket = result[grain][key]
            for metric, value in metrics.items():
                bucket[metric] += value
    return result


def validate_aggregate(
    report: CheckReport,
    grain: str,
    rows: List[Dict[str, Any]],
    expected: Dict[Tuple[str, ...], Dict[str, float]],
    key_fields: List[str],
) -> None:
    observed_keys = set()
    mismatches = []
    for row in rows:
        key = tuple(str(row[field]) for field in key_fields)
        observed_keys.add(key)
        exp = expected.get(key)
        if exp is None:
            mismatches.append(f"clave extra {key}")
            continue
        for metric in ("unidades", "venta_neta", "costo_estimado", "margen_bruto", "volumen_kg", "registros_venta"):
            obs = to_float(row.get(metric))
            tol = 0.05 if metric != "volumen_kg" else 0.005
            if abs(obs - exp[metric]) > tol:
                mismatches.append(f"{key} {metric}: esperado={exp[metric]} observado={obs}")
                break
    missing = set(expected.keys()) - observed_keys
    if missing:
        mismatches.append(f"claves faltantes={len(missing)}")
    if mismatches:
        sample = "; ".join(mismatches[:5])
        report.error(f"Agregado {grain} cierra contra ventas", sample)
    else:
        report.ok(f"Agregado {grain} cierra contra ventas", f"records={len(rows)}")


def public_file_audit(public_data: Path) -> Dict[str, Any]:
    files = []
    for p in public_data.rglob("*"):
        if p.is_file():
            rel = p.relative_to(public_data.parent).as_posix()  # public/data/...
            size = p.stat().st_size
            files.append({"relative_path": rel, "size_bytes": size, "size_mib": round(size / 1024 / 1024, 3), "path_len": len(rel)})
    files.sort(key=lambda x: x["size_bytes"], reverse=True)
    return {
        "file_count": len(files),
        "max_file": files[0] if files else None,
        "files_over_25_mib": [f for f in files if f["size_mib"] > MAX_PUBLIC_FILE_MIB],
        "files_between_20_and_25_mib": [f for f in files if 20.0 <= f["size_mib"] <= MAX_PUBLIC_FILE_MIB],
        "long_paths": [f for f in files if f["path_len"] > MAX_PUBLIC_REL_PATH_LEN],
        "max_path": max(files, key=lambda f: f["path_len"]) if files else None,
        "top_20_files": files[:20],
    }


def update_markdown_validation(diag_md: Path, status: str, report: CheckReport, audit: Dict[str, Any]) -> None:
    if not diag_md.exists():
        return
    text = diag_md.read_text(encoding="utf-8")
    start = "<!-- VALIDATION_BLOCK_START -->"
    end = "<!-- VALIDATION_BLOCK_END -->"
    lines = [
        start,
        f"Validación ejecutada: `{now_iso()}`",
        "",
        f"Estado final: **{status}**",
        "",
        f"- Checks OK: {sum(1 for i in report.items if i['status'] == 'OK')}",
        f"- Advertencias: {len(report.warnings)}",
        f"- Errores: {len(report.errors)}",
        f"- Archivos public/data: {audit['file_count']}",
        f"- Archivo público más pesado: `{audit['max_file']['relative_path'] if audit['max_file'] else 'N/A'}` — {audit['max_file']['size_mib'] if audit['max_file'] else 0} MiB",
        f"- Ruta pública más larga: `{audit['max_path']['relative_path'] if audit['max_path'] else 'N/A'}` — {audit['max_path']['path_len'] if audit['max_path'] else 0} caracteres",
        "",
        "### Detalle de validaciones",
        "",
    ]
    for item in report.items:
        detail = f" — {item['detail']}" if item.get("detail") else ""
        lines.append(f"- `{item['status']}` {item['name']}{detail}")
    lines.append(end)
    block = "\n".join(lines)
    if start in text and end in text:
        before = text.split(start)[0]
        after = text.split(end, 1)[1]
        text = before + block + after
    else:
        text += "\n\n" + block + "\n"
    text = text.replace("Estado: `PENDING_CHECK` hasta ejecutar el check V6.", f"Estado: `{status}`.")
    diag_md.write_text(text, encoding="utf-8")


def render_check_text(report: CheckReport, audit: Dict[str, Any], extra: Dict[str, Any]) -> str:
    line = "=" * 80
    out = [
        line,
        "CHECK BUSINESS V6 — CLIENTES Y VENTAS SINTÉTICAS AUTOPARTES",
        line,
        f"Generado: {now_iso()}",
        f"Estado final: {report.status}",
        "",
        "Resumen",
        "-" * 80,
        f"Clientes: {extra.get('clientes')}",
        f"Productos: {extra.get('productos')}",
        f"Registros de ventas: {extra.get('ventas_registros')}",
        f"Períodos: {extra.get('periodos_desde')} a {extra.get('periodos_hasta')}",
        f"Venta total: {extra.get('venta_total'):,.2f}",
        f"Venta 2025: {extra.get('venta_2025'):,.2f}",
        f"Venta 2026: {extra.get('venta_2026'):,.2f}",
        f"Clientes Buenos Aires: {extra.get('clientes_ba')} ({extra.get('clientes_ba_pct')}%)",
        "",
        "Validaciones",
        "-" * 80,
    ]
    for item in report.items:
        detail = f" | {item['detail']}" if item.get("detail") else ""
        out.append(f"{item['status']:<5} | {item['name']}{detail}")
    out.extend([
        "",
        "Auditoría public/data",
        "-" * 80,
        f"Archivos en public/data: {audit['file_count']}",
        f"Archivo más pesado: {audit['max_file']['relative_path'] if audit['max_file'] else 'N/A'} ({audit['max_file']['size_mib'] if audit['max_file'] else 0} MiB)",
        f"Archivos >25 MiB: {len(audit['files_over_25_mib'])}",
        f"Archivos 20-25 MiB: {len(audit['files_between_20_and_25_mib'])}",
        f"Ruta más larga: {audit['max_path']['relative_path'] if audit['max_path'] else 'N/A'} ({audit['max_path']['path_len'] if audit['max_path'] else 0} caracteres)",
        f"Rutas > límite preventivo {MAX_PUBLIC_REL_PATH_LEN}: {len(audit['long_paths'])}",
        "",
    ])
    if report.warnings:
        out.extend(["Advertencias", "-" * 80])
        out.extend([f"WARN | {w}" for w in report.warnings])
        out.append("")
    if report.errors:
        out.extend(["Errores", "-" * 80])
        out.extend([f"ERROR | {e}" for e in report.errors])
        out.append("")
    out.extend([
        "Resultado final",
        "-" * 80,
        f"Estado final: {report.status}",
        "No se avanzó a V7. No se creó frontend completo. No se hizo deploy.",
        "",
    ])
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida la capa comercial sintética V6 de Mapa2.")
    parser.add_argument("--base-data", default="public/data", help="Directorio base V5.1 public/data")
    parser.add_argument("--business-data", default="public/data/business", help="Directorio público comercial V6")
    parser.add_argument("--diag", default="data/output/diagnostico_business_v6.json", help="Diagnóstico JSON V6 a actualizar")
    parser.add_argument("--out", default="data/output/check_business_v6.txt", help="Archivo TXT del check")
    args = parser.parse_args()

    report = CheckReport()
    base_data = Path(args.base_data)
    business_data = Path(args.business_data)
    diag_path = Path(args.diag)
    out_path = Path(args.out)

    # 1 y 2. Base V5.1 e índices.
    base_metadata_path = base_data / "metadata.json"
    provincias_index_path = base_data / "indexes" / "provincias_index.json"
    localidades_index_path = base_data / "indexes" / "localidades_puntos_index.json"
    for label, path in (
        ("Existe metadata.json V5.1", base_metadata_path),
        ("Existe provincias_index.json", provincias_index_path),
        ("Existe localidades_puntos_index.json", localidades_index_path),
    ):
        required_file(report, path, label)

    provinces = {}
    if base_metadata_path.exists():
        base_metadata = read_json(base_metadata_path)
        if base_metadata.get("status") == "OK":
            report.ok("Base V5.1 en estado OK", f"version={base_metadata.get('version')}")
        else:
            report.error("Base V5.1 en estado OK", f"status={base_metadata.get('status')}")
    if provincias_index_path.exists():
        provinces = read_json(provincias_index_path).get("provinces", {})
        if provinces:
            report.ok("Provincias válidas cargadas", f"{len(provinces)} provincias")
        else:
            report.error("Provincias válidas cargadas", "Índice vacío")

    # Archivos V6 esperados.
    expected_files = {
        "metadata_business_v6.json": business_data / "metadata_business_v6.json",
        "clientes.geojson": business_data / "clientes.geojson",
        "productos.json": business_data / "productos.json",
        "calendario.json": business_data / "calendario.json",
        "ventas_mensuales.csv": business_data / "ventas_mensuales.csv",
        "ventas_provincia_mes.json": business_data / "agregados" / "ventas_provincia_mes.json",
        "ventas_departamento_mes.json": business_data / "agregados" / "ventas_departamento_mes.json",
        "ventas_producto_mes.json": business_data / "agregados" / "ventas_producto_mes.json",
        "ventas_cliente_totales.json": business_data / "agregados" / "ventas_cliente_totales.json",
        "heatmap_clientes_ventas.geojson": business_data / "agregados" / "heatmap_clientes_ventas.geojson",
    }
    for label, path in expected_files.items():
        required_file(report, path, f"Existe {label}")

    # Cargas principales.
    clients_features = geojson_features(expected_files["clientes.geojson"]) if expected_files["clientes.geojson"].exists() else []
    clients = []
    for feat in clients_features:
        props = dict(feat.get("properties") or {})
        coords = (feat.get("geometry") or {}).get("coordinates") or [None, None]
        props["lon"] = coords[0]
        props["lat"] = coords[1]
        clients.append(props)
    products_records = records_from_json(expected_files["productos.json"]) if expected_files["productos.json"].exists() else []
    calendar_records = records_from_json(expected_files["calendario.json"]) if expected_files["calendario.json"].exists() else []
    sales_records = read_csv(expected_files["ventas_mensuales.csv"]) if expected_files["ventas_mensuales.csv"].exists() else []
    agg_prov = records_from_json(expected_files["ventas_provincia_mes.json"]) if expected_files["ventas_provincia_mes.json"].exists() else []
    agg_dept = records_from_json(expected_files["ventas_departamento_mes.json"]) if expected_files["ventas_departamento_mes.json"].exists() else []
    agg_prod = records_from_json(expected_files["ventas_producto_mes.json"]) if expected_files["ventas_producto_mes.json"].exists() else []
    agg_client = records_from_json(expected_files["ventas_cliente_totales.json"]) if expected_files["ventas_cliente_totales.json"].exists() else []
    heat_features = geojson_features(expected_files["heatmap_clientes_ventas.geojson"]) if expected_files["heatmap_clientes_ventas.geojson"].exists() else []

    # Clientes.
    if len(clients) == EXPECTED_CLIENTS:
        report.ok("Clientes generados exactamente", f"{len(clients)}")
    else:
        report.error("Clientes generados exactamente", f"{len(clients)} != {EXPECTED_CLIENTS}")

    province_ids_valid = set(provinces.keys())
    bad_prov = [c.get("cliente_id") for c in clients if c.get("provincia_id") not in province_ids_valid]
    if not bad_prov:
        report.ok("Todos los clientes tienen provincia válida", f"clientes={len(clients)}")
    else:
        report.error("Todos los clientes tienen provincia válida", f"muestra={bad_prov[:10]}")

    missing_client_ids = [i for i, c in enumerate(clients, start=1) if not c.get("cliente_id")]
    duplicate_client_ids = [cid for cid, cnt in Counter(c.get("cliente_id") for c in clients).items() if cid and cnt > 1]
    if not missing_client_ids and not duplicate_client_ids:
        report.ok("No existen clientes sin cliente_id ni duplicados")
    else:
        report.error("No existen clientes sin cliente_id ni duplicados", f"faltantes={len(missing_client_ids)} duplicados={duplicate_client_ids[:10]}")

    missing_prov_fields = [c.get("cliente_id") for c in clients if not c.get("provincia_id") or not c.get("provincia_nombre")]
    if not missing_prov_fields:
        report.ok("No existen clientes sin provincia_id/provincia_nombre")
    else:
        report.error("No existen clientes sin provincia_id/provincia_nombre", f"muestra={missing_prov_fields[:10]}")

    bad_coords = []
    for c in clients:
        lat = to_float(c.get("lat"), 999)
        lon = to_float(c.get("lon"), 999)
        if not (ARG_BBOX["lat_min"] <= lat <= ARG_BBOX["lat_max"] and ARG_BBOX["lon_min"] <= lon <= ARG_BBOX["lon_max"]):
            bad_coords.append(c.get("cliente_id"))
    if not bad_coords:
        report.ok("Todos los clientes tienen coordenadas válidas dentro de Argentina", f"bbox={ARG_BBOX}")
    else:
        report.error("Todos los clientes tienen coordenadas válidas dentro de Argentina", f"muestra={bad_coords[:10]}")

    synthetic_bad = [c.get("cliente_id") for c in clients if not truthy(c.get("dato_sintetico"))]
    if not synthetic_bad:
        report.ok("Todos los clientes tienen dato_sintetico=true")
    else:
        report.error("Todos los clientes tienen dato_sintetico=true", f"muestra={synthetic_bad[:10]}")

    ba_count = sum(1 for c in clients if c.get("provincia_id") == "provincia:06")
    ba_pct = round(ba_count / max(1, len(clients)) * 100, 2)
    if 65.0 <= ba_pct <= 75.0:
        report.ok("Mayoría de clientes en Buenos Aires según regla", f"{ba_count} clientes ({ba_pct}%)")
    else:
        report.error("Mayoría de clientes en Buenos Aires según regla", f"{ba_count} clientes ({ba_pct}%)")

    caba_count = sum(1 for c in clients if c.get("provincia_id") == "provincia:02")
    caba_pct = round(caba_count / max(1, len(clients)) * 100, 2)
    if 5.0 <= caba_pct <= 10.0:
        report.ok("Clientes CABA dentro de regla sugerida", f"{caba_count} clientes ({caba_pct}%)")
    else:
        report.warn("Clientes CABA dentro de regla sugerida", f"{caba_count} clientes ({caba_pct}%)")

    # Productos.
    product_required = ["producto_id", "categoria_producto", "subcategoria_producto", "producto_nombre", "precio_base", "peso_estimado_kg", "margen_base_pct", "dato_sintetico"]
    product_critical_missing = []
    for p in products_records:
        for field in product_required:
            if p.get(field) in (None, ""):
                product_critical_missing.append((p.get("producto_id"), field))
    if products_records and not product_critical_missing:
        report.ok("Catálogo de productos sin nulos críticos", f"productos={len(products_records)}")
    else:
        report.error("Catálogo de productos sin nulos críticos", f"faltantes={product_critical_missing[:10]}")

    product_ids = {str(p.get("producto_id")) for p in products_records}
    if len(product_ids) == len(products_records) and products_records:
        report.ok("Producto_id único y válido", f"productos={len(product_ids)}")
    else:
        report.error("Producto_id único y válido", f"ids_unicos={len(product_ids)} records={len(products_records)}")

    # Calendario y ventas.
    periods = sorted({str(r.get("periodo")) for r in calendar_records})
    sales_periods = sorted({str(s.get("periodo")) for s in sales_records})
    if periods == EXPECTED_PERIODS and sales_periods == EXPECTED_PERIODS:
        report.ok("Existen ventas para todos los meses 2025-01 a 2026-12", f"meses={len(sales_periods)}")
    else:
        report.error("Existen ventas para todos los meses 2025-01 a 2026-12", f"calendario={periods[:3]}..{periods[-3:] if periods else []}; ventas={sales_periods}")

    positive_bad = []
    for s in sales_records:
        if to_float(s.get("unidades")) <= 0 or to_float(s.get("precio_unitario")) <= 0 or to_float(s.get("venta_neta")) <= 0 or to_float(s.get("costo_estimado")) <= 0 or to_float(s.get("margen_bruto")) <= 0:
            positive_bad.append(s.get("venta_id"))
    if not positive_bad and sales_records:
        report.ok("Ventas con valores positivos", f"registros={len(sales_records)}")
    else:
        report.error("Ventas con valores positivos", f"muestra={positive_bad[:10]}")

    client_ids = {str(c.get("cliente_id")) for c in clients}
    sale_client_bad = [s.get("venta_id") for s in sales_records if s.get("cliente_id") not in client_ids]
    if not sale_client_bad:
        report.ok("No existen ventas sin cliente válido")
    else:
        report.error("No existen ventas sin cliente válido", f"muestra={sale_client_bad[:10]}")

    sale_product_bad = [s.get("venta_id") for s in sales_records if s.get("producto_id") not in product_ids]
    if not sale_product_bad:
        report.ok("No existen ventas sin producto válido")
    else:
        report.error("No existen ventas sin producto válido", f"muestra={sale_product_bad[:10]}")

    clients_with_sales = {s.get("cliente_id") for s in sales_records}
    if client_ids == clients_with_sales:
        report.ok("Todos los clientes tienen al menos una venta")
    else:
        report.warn("Todos los clientes tienen al menos una venta", f"faltantes={len(client_ids - clients_with_sales)}")

    if len(heat_features) == len(clients):
        report.ok("Heatmap tiene un punto por cliente", f"features={len(heat_features)}")
    else:
        report.error("Heatmap tiene un punto por cliente", f"heatmap={len(heat_features)} clientes={len(clients)}")

    # Agregados.
    clients_map = {str(c.get("cliente_id")): c for c in clients}
    products_map = {str(p.get("producto_id")): p for p in products_records}
    if not sale_client_bad and not sale_product_bad:
        expected_aggs = sum_sales_by_keys(sales_records, clients_map, products_map)
        validate_aggregate(report, "provincia_mes", agg_prov, expected_aggs["provincia_mes"], ["periodo", "provincia_id"])
        validate_aggregate(report, "departamento_mes", agg_dept, expected_aggs["departamento_mes"], ["periodo", "departamento_id"])
        validate_aggregate(report, "producto_mes", agg_prod, expected_aggs["producto_mes"], ["periodo", "producto_id"])
        validate_aggregate(report, "cliente_totales", agg_client, expected_aggs["cliente_totales"], ["cliente_id"])

        compare_amount(report, "Agregados por provincia cierran contra ventas", sum(to_float(s["venta_neta"]) for s in sales_records), sum(to_float(r["venta_neta"]) for r in agg_prov))

    # Auditoría de archivos.
    audit = public_file_audit(base_data)
    if not audit["files_over_25_mib"]:
        report.ok("Archivos en public/data no superan 25 MiB", f"max={audit['max_file']['size_mib'] if audit['max_file'] else 0} MiB")
    else:
        report.error("Archivos en public/data no superan 25 MiB", f"{audit['files_over_25_mib'][:3]}")
    if not audit["long_paths"]:
        report.ok("No se crearon rutas públicas demasiado largas para Windows", f"max_len={audit['max_path']['path_len'] if audit['max_path'] else 0}")
    else:
        report.error("No se crearon rutas públicas demasiado largas para Windows", f"{audit['long_paths'][:3]}")

    # Extra resumen.
    venta_2025 = sum(to_float(s.get("venta_neta")) for s in sales_records if str(s.get("anio")) == "2025")
    venta_2026 = sum(to_float(s.get("venta_neta")) for s in sales_records if str(s.get("anio")) == "2026")
    extra = {
        "clientes": len(clients),
        "productos": len(products_records),
        "ventas_registros": len(sales_records),
        "periodos_desde": min(sales_periods) if sales_periods else None,
        "periodos_hasta": max(sales_periods) if sales_periods else None,
        "venta_total": venta_2025 + venta_2026,
        "venta_2025": venta_2025,
        "venta_2026": venta_2026,
        "clientes_ba": ba_count,
        "clientes_ba_pct": ba_pct,
    }

    # Actualizar diagnósticos y metadata pública.
    validation_payload = {
        "executed_at": now_iso(),
        "status": report.status,
        "items": report.items,
        "warnings": report.warnings,
        "errors": report.errors,
        "public_file_audit": audit,
        "summary": extra,
    }
    if diag_path.exists():
        diag = read_json(diag_path)
    else:
        diag = {}
    diag["validation"] = validation_payload
    diag["status"] = report.status
    write_json(diag_path, diag)

    metadata_business_path = business_data / "metadata_business_v6.json"
    if metadata_business_path.exists():
        metadata_business = read_json(metadata_business_path)
        metadata_business["status"] = report.status
        metadata_business["validation"] = {"executed_at": validation_payload["executed_at"], "warnings": report.warnings, "errors": report.errors}
        write_json(metadata_business_path, metadata_business)

    if base_metadata_path.exists():
        base_metadata = read_json(base_metadata_path)
        if "business_v6" in base_metadata:
            base_metadata["business_v6"]["status"] = report.status
            base_metadata["business_v6"]["check_path"] = "data/output/check_business_v6.txt"
        write_json(base_metadata_path, base_metadata)

    update_markdown_validation(diag_path.with_suffix(".md"), report.status, report, audit)

    out_text = render_check_text(report, audit, extra)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(out_text, encoding="utf-8")
    print(out_text)
    return 0 if report.status in {"OK", "WARN"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
