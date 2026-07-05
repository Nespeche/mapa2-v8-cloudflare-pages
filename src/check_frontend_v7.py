#!/usr/bin/env python3
"""Validación reproducible de Mapa2 V7.

Este script valida que la V7 mantenga intactos los insumos aprobados V5.1/V6,
que el frontend Vite/React exista, que el build funcione y que no se rompan
las reglas de carga optimizada para Cloudflare Pages Free.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

PUBLIC_LIMIT_BYTES = 25 * 1024 * 1024
WINDOWS_PATH_WARN = 180

REQUIRED_FRONTEND_FILES = [
    "package.json",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.app.json",
    "index.html",
    "src/app/App.tsx",
    "src/app/main.tsx",
    "src/app/styles.css",
    "src/components/MapView.tsx",
    "src/data/dataClient.ts",
    "src/data/dataPaths.ts",
    ".npmrc",
    "public/favicon.svg",
]

REQUIRED_INITIAL_DATA = [
    "public/data/metadata.json",
    "public/data/provincias.geojson",
    "public/data/indexes/provincias_index.json",
    "public/data/business/metadata_business_v6.json",
    "public/data/business/agregados/ventas_provincia_mes.json",
    "public/data/business/agregados/ventas_cliente_totales.json",
    "public/data/business/clientes.geojson",
    "public/data/business/productos.json",
    "public/data/business/calendario.json",
]

REQUIRED_LAZY_DATA = [
    "public/data/provincias",  # carpeta base para carga por provincia
    "public/data/business/agregados/ventas_departamento_mes.json",
    "public/data/business/agregados/ventas_producto_mes.json",
    "public/data/business/ventas_mensuales.csv",
]

SECRET_PATTERNS = [
    re.compile(r"sk-proj-[A-Za-z0-9_\-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9]{24,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{20,}"),
    re.compile(r"ghp_[0-9A-Za-z_]{20,}"),
    re.compile(r"xox[baprs]-[0-9A-Za-z\-]{20,}"),
    re.compile(r"BEGIN\s+(RSA\s+)?PRIVATE KEY"),
]

DATA_REF_RE = re.compile(r"[\"'`](data/[^\"'`\s)]+)")
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def read_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def add_item(items: List[Dict[str, str]], status: str, name: str, detail: str = "") -> None:
    items.append({"status": status, "name": name, "detail": detail})


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def audit_file_sizes(root: Path) -> Dict[str, Any]:
    public_data = root / "public" / "data"
    files: List[Dict[str, Any]] = []
    for file_path in public_data.rglob("*"):
        if not file_path.is_file():
            continue
        relative_path = rel(file_path, root / "public")
        size = file_path.stat().st_size
        files.append({
            "relative_path": relative_path,
            "size_bytes": size,
            "size_mib": round(size / 1024 / 1024, 3),
            "path_len": len(relative_path),
        })
    files.sort(key=lambda item: item["size_bytes"], reverse=True)
    return {
        "file_count": len(files),
        "max_file": files[0] if files else None,
        "files_over_25_mib": [item for item in files if item["size_bytes"] > PUBLIC_LIMIT_BYTES],
        "long_paths": [item for item in files if item["path_len"] > WINDOWS_PATH_WARN],
        "top_30_files": files[:30],
    }


def write_file_sizes(root: Path, output_dir: Path) -> None:
    audit = audit_file_sizes(root)
    lines = ["Mapa2 V7 — tamaños public/data", f"Generado: {now_iso()}", ""]
    for item in audit["top_30_files"]:
        lines.append(f"{item['size_mib']:>8.3f} MiB | {item['size_bytes']:>12} bytes | {item['relative_path']}")
    (output_dir / "v7_file_sizes.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def scan_data_references(root: Path) -> List[str]:
    source_roots = [root / "src" / folder for folder in ["app", "components", "data", "map", "utils"]]
    refs: List[str] = []
    for source_root in source_roots:
        if not source_root.exists():
            continue
        for file_path in source_root.rglob("*"):
            if file_path.suffix not in {".ts", ".tsx"}:
                continue
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            for match in DATA_REF_RE.finditer(text):
                data_ref = match.group(1).rstrip(";,.]")
                if "${" in data_ref or "<" in data_ref:
                    continue
                refs.append(data_ref)
    return sorted(set(refs))


def scan_secret_patterns(root: Path) -> List[str]:
    candidates = [
        root / ".env.example",
        root / "package.json",
        root / "vite.config.ts",
        root / "index.html",
    ]
    for folder in ["app", "components", "data", "map", "utils"]:
        source_root = root / "src" / folder
        if source_root.exists():
            candidates.extend([p for p in source_root.rglob("*") if p.suffix in {".ts", ".tsx", ".css"}])
    findings: List[str] = []
    for file_path in candidates:
        if not file_path.exists() or not file_path.is_file():
            continue
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                findings.append(rel(file_path, root))
                break
    return sorted(set(findings))


def run_build(root: Path) -> Tuple[bool, str]:
    command = "npm run build" if os.name == "nt" else ["npm", "run", "build"]
    try:
        result = subprocess.run(
            command,
            cwd=root,
            shell=os.name == "nt",
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=240,
            check=False,
        )
    except FileNotFoundError as exc:
        return False, f"npm no disponible: {exc}"
    except subprocess.TimeoutExpired as exc:
        return False, f"npm run build excedió el timeout: {exc}"
    return result.returncode == 0, strip_ansi(result.stdout)


def evaluate(root: Path, skip_build: bool = False) -> Dict[str, Any]:
    output_dir = root / "data" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    items: List[Dict[str, str]] = []
    warnings: List[str] = []
    errors: List[str] = []

    # V5.1
    v51_path = root / "data" / "output" / "diagnostico_map_ready_v5_1.json"
    if v51_path.exists():
        v51 = read_json(v51_path)
        if v51.get("status") == "OK" and not v51.get("errors"):
            add_item(items, "OK", "Base V5.1 preservada en estado OK", f"version={v51.get('version')}")
        else:
            errors.append("La base V5.1 no figura en estado OK o contiene errores.")
            add_item(items, "ERROR", "Base V5.1 no OK", str(v51.get("status")))
    else:
        errors.append("Falta data/output/diagnostico_map_ready_v5_1.json")
        add_item(items, "ERROR", "Falta diagnóstico V5.1", str(v51_path))

    # V6
    v6_path = root / "data" / "output" / "diagnostico_business_v6.json"
    if v6_path.exists():
        v6 = read_json(v6_path)
        validation = v6.get("validation", {})
        validation_errors = validation.get("errors") or []
        if v6.get("status") == "OK" and validation.get("status") == "OK" and not validation_errors:
            counts = v6.get("counts", {})
            detail = f"clientes={counts.get('clientes')} productos={counts.get('productos')} ventas={counts.get('ventas_registros')}"
            add_item(items, "OK", "Base comercial V6 preservada en estado OK", detail)
        else:
            errors.append("La base comercial V6 no figura en estado OK o contiene errores.")
            add_item(items, "ERROR", "Base comercial V6 no OK", str(v6.get("status")))
    else:
        errors.append("Falta data/output/diagnostico_business_v6.json")
        add_item(items, "ERROR", "Falta diagnóstico V6", str(v6_path))

    for relative in REQUIRED_INITIAL_DATA:
        target = root / relative
        if target.exists():
            add_item(items, "OK", f"Existe insumo inicial {relative}", f"{target.stat().st_size} bytes")
        else:
            errors.append(f"Falta insumo inicial: {relative}")
            add_item(items, "ERROR", f"Falta insumo inicial {relative}")

    for relative in REQUIRED_LAZY_DATA:
        target = root / relative
        if target.exists():
            add_item(items, "OK", f"Existe insumo bajo demanda {relative}")
        else:
            errors.append(f"Falta insumo bajo demanda: {relative}")
            add_item(items, "ERROR", f"Falta insumo bajo demanda {relative}")

    for relative in REQUIRED_FRONTEND_FILES:
        target = root / relative
        if target.exists():
            add_item(items, "OK", f"Existe frontend {relative}")
        else:
            errors.append(f"Falta archivo frontend: {relative}")
            add_item(items, "ERROR", f"Falta frontend {relative}")

    # Build
    if skip_build:
        warnings.append("Build omitido por parámetro --skip-build.")
        add_item(items, "WARN", "Build no ejecutado", "--skip-build")
        build_output = "Build omitido."
        build_ok = False
    else:
        build_ok, build_output = run_build(root)
        if build_ok:
            add_item(items, "OK", "Build frontend ejecutado correctamente", "npm run build")
            if "(!)" in build_output or "warning" in build_output.lower():
                warnings.append("El build finalizó pero informó advertencias de Vite/TypeScript.")
                add_item(items, "WARN", "Build con advertencias", "Revisar salida npm run build")
        else:
            errors.append("npm run build falló.")
            add_item(items, "ERROR", "Build frontend falló", "npm run build")

    # Referencias a public/data
    refs = scan_data_references(root)
    broken_refs = []
    for ref in refs:
        if not (root / "public" / ref).exists():
            broken_refs.append(ref)
    if broken_refs:
        errors.append("Existen referencias rotas a public/data: " + ", ".join(broken_refs))
        add_item(items, "ERROR", "Referencias rotas a public/data", ", ".join(broken_refs))
    else:
        add_item(items, "OK", "Referencias literales a public/data válidas", f"refs={len(refs)}")

    # Registro npm público y fixes runtime V7.1
    npmrc_path = root / ".npmrc"
    npmrc_text = npmrc_path.read_text(encoding="utf-8", errors="ignore") if npmrc_path.exists() else ""
    if "registry=https://registry.npmjs.org/" in npmrc_text.replace(" ", ""):
        add_item(items, "OK", "Registry npm público configurado", ".npmrc")
    else:
        errors.append(".npmrc no fuerza el registry público de npm.")
        add_item(items, "ERROR", "Registry npm no público", ".npmrc")

    app_text = (root / "src" / "app" / "App.tsx").read_text(encoding="utf-8", errors="ignore") if (root / "src" / "app" / "App.tsx").exists() else ""
    if "detailedStatus === 'loading') return" in app_text or 'detailedStatus === "loading") return' in app_text:
        errors.append("La carga bajo demanda del CSV conserva una guarda incompatible con React StrictMode y puede quedar en loading permanente.")
        add_item(items, "ERROR", "Carga CSV bajo demanda incompatible con StrictMode", "App.tsx")
    else:
        add_item(items, "OK", "Carga CSV bajo demanda compatible con React StrictMode", "sin guarda loading bloqueante")

    if 'LoadingState label="Cargando detalle comercial bajo demanda' in app_text or "LoadingState label='Cargando detalle comercial bajo demanda" in app_text:
        warnings.append("El detalle CSV bajo demanda usa overlay central bloqueante.")
        add_item(items, "WARN", "Overlay central para CSV bajo demanda", "App.tsx")
    else:
        add_item(items, "OK", "Carga detallada no bloquea el mapa", "estado flotante no central")

    map_sources_text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in [root / "src" / "map" / "mapStyle.ts", root / "src" / "components" / "MapView.tsx"]
        if path.exists()
    )
    if "demotiles.maplibre.org/font" in map_sources_text or "text-font" in map_sources_text:
        warnings.append("MapLibre puede intentar descargar glyphs demo o fuentes inexistentes.")
        add_item(items, "WARN", "Posible warning de glyphs MapLibre", "mapStyle/MapView")
    else:
        add_item(items, "OK", "MapLibre sin dependencia de glyphs demo", "sin symbol text layer")

    # Secretos
    secret_findings = scan_secret_patterns(root)
    if secret_findings:
        errors.append("Se detectaron posibles claves privadas/tokens: " + ", ".join(secret_findings))
        add_item(items, "ERROR", "Posibles secretos hardcodeados", ", ".join(secret_findings))
    else:
        add_item(items, "OK", "No se detectaron claves privadas ni tokens hardcodeados", "scan frontend")

    # Auditoría public/data
    file_audit = audit_file_sizes(root)
    if file_audit["files_over_25_mib"]:
        errors.append("Existen archivos public/data superiores a 25 MiB.")
        add_item(items, "ERROR", "Archivos public/data >25 MiB", str(file_audit["files_over_25_mib"][:3]))
    else:
        max_file = file_audit["max_file"] or {}
        add_item(items, "OK", "Archivos public/data dentro de 25 MiB", f"max={max_file.get('relative_path')} {max_file.get('size_mib')} MiB")

    if file_audit["long_paths"]:
        warnings.append("Existen rutas públicas largas para Windows por encima del umbral preventivo.")
        add_item(items, "WARN", "Rutas públicas largas", str(file_audit["long_paths"][:3]))
    else:
        max_path = max(file_audit["top_30_files"], key=lambda item: item["path_len"], default={}) if file_audit["top_30_files"] else {}
        add_item(items, "OK", "Rutas públicas compatibles con Windows", f"umbral={WINDOWS_PATH_WARN}")

    # Radios no iniciales
    data_paths_file = root / "src" / "data" / "dataPaths.ts"
    data_paths_text = data_paths_file.read_text(encoding="utf-8", errors="ignore") if data_paths_file.exists() else ""
    initial_block = data_paths_text.split("LAZY_DATA_PATHS", 1)[0]
    if "radios" in initial_block.lower():
        errors.append("La carga inicial del frontend contiene una referencia a radios.")
        add_item(items, "ERROR", "Radios en carga inicial", "src/data/dataPaths.ts")
    else:
        add_item(items, "OK", "Carga inicial sin radios nacionales", "INITIAL_DATA_PATHS")

    frontend_sources = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for folder in ["app", "components", "data", "map", "utils"]
        for path in (root / "src" / folder).rglob("*")
        if path.suffix in {".ts", ".tsx"}
    )
    if "radios.geojson" in frontend_sources.lower():
        warnings.append("El frontend contiene referencia literal a radios.geojson. Revisar si es carga avanzada documentada.")
        add_item(items, "WARN", "Referencia literal a radios.geojson", "frontend")
    else:
        add_item(items, "OK", "Frontend sin referencia literal a radios.geojson", "src/app/components/data/map/utils")

    # Documentación sintética visible
    doc_targets = [root / "README.md", root / "docs" / "RUNBOOK_V7.md", root / "docs" / "CHANGELOG_V7.md", root / "src" / "app" / "App.tsx"]
    synthetic_hits = []
    for path in doc_targets:
        if path.exists() and "sint" in path.read_text(encoding="utf-8", errors="ignore").lower():
            synthetic_hits.append(rel(path, root))
    if len(synthetic_hits) >= 3:
        add_item(items, "OK", "Documentación de datos sintéticos visible", ", ".join(synthetic_hits))
    else:
        errors.append("La documentación de datos sintéticos no está suficientemente visible.")
        add_item(items, "ERROR", "Documentación sintética insuficiente", ", ".join(synthetic_hits))

    write_file_sizes(root, output_dir)

    status = "ERROR" if errors else ("WARN" if warnings else "OK")
    diagnostic = {
        "project": "Mapa2",
        "version": "v7_1_frontend_runtime_fix",
        "phase": "V7.1 — Frontend runtime fix dentro de V7",
        "generated_at": now_iso(),
        "status": status,
        "items": items,
        "warnings": warnings,
        "errors": errors,
        "build": {
            "executed": not skip_build,
            "ok": build_ok,
            "output_tail": "\n".join(build_output.splitlines()[-35:]),
        },
        "data_reference_audit": {
            "literal_refs": refs,
            "broken_refs": broken_refs,
        },
        "public_file_audit": file_audit,
        "rules": {
            "no_v8": True,
            "deploy_executed": False,
            "census_logic_modified": False,
            "business_v6_regenerated": False,
            "initial_load_without_national_radios": "radios" not in initial_block.lower(),
        },
    }
    return diagnostic


def write_outputs(root: Path, diagnostic: Dict[str, Any], out_path: Path) -> None:
    output_dir = root / "data" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / "diagnostico_frontend_v7.json"
    md_path = output_dir / "diagnostico_frontend_v7.md"
    json_path.write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Diagnóstico Frontend V7.1 — Mapa2",
        "",
        f"- Estado final: **{diagnostic['status']}**",
        f"- Generado: `{diagnostic['generated_at']}`",
        f"- Fase: {diagnostic['phase']}",
        "- Deploy ejecutado: **No**",
        "- Avance a V8: **No**",
        "- Lógica censal modificada: **No**",
        "- Base comercial V6 regenerada: **No**",
        "",
        "## Resumen de validación",
        "",
    ]
    for item in diagnostic["items"]:
        lines.append(f"- `{item['status']}` — {item['name']}: {item.get('detail', '')}")
    if diagnostic["warnings"]:
        lines.extend(["", "## Advertencias", ""])
        lines.extend(f"- {warning}" for warning in diagnostic["warnings"])
    if diagnostic["errors"]:
        lines.extend(["", "## Errores", ""])
        lines.extend(f"- {error}" for error in diagnostic["errors"])
    lines.extend([
        "",
        "## Build",
        "",
        f"- Ejecutado: {diagnostic['build']['executed']}",
        f"- OK: {diagnostic['build']['ok']}",
        "",
        "```text",
        diagnostic["build"]["output_tail"],
        "```",
        "",
        "## Archivo más pesado en public/data",
        "",
    ])
    max_file = diagnostic["public_file_audit"].get("max_file") or {}
    lines.append(f"- {max_file.get('relative_path')} — {max_file.get('size_mib')} MiB")
    lines.extend([
        "",
        "## Regla de carga inicial",
        "",
        "La carga inicial declarada en `src/data/dataPaths.ts` no incluye radios nacionales ni archivos de radios provinciales. Los datos pesados quedan bajo demanda o fuera del flujo inicial.",
    ])
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    check_lines = [
        "Mapa2 V7.1 — check_frontend_v7",
        f"Estado final: {diagnostic['status']}",
        f"Generado: {diagnostic['generated_at']}",
        "",
    ]
    check_lines.extend(f"[{item['status']}] {item['name']} :: {item.get('detail', '')}" for item in diagnostic["items"])
    if diagnostic["warnings"]:
        check_lines.extend(["", "Advertencias:"])
        check_lines.extend(f"- {warning}" for warning in diagnostic["warnings"])
    if diagnostic["errors"]:
        check_lines.extend(["", "Errores:"])
        check_lines.extend(f"- {error}" for error in diagnostic["errors"])
    check_lines.extend(["", "Build tail:", diagnostic["build"]["output_tail"]])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(check_lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check frontend Mapa2 V7")
    parser.add_argument("--project-root", default=".", help="Raíz del proyecto")
    parser.add_argument("--out", default="data/output/check_frontend_v7.txt", help="Salida TXT del check")
    parser.add_argument("--skip-build", action="store_true", help="Omitir npm run build")
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    out_path = (root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    diagnostic = evaluate(root, skip_build=args.skip_build)
    write_outputs(root, diagnostic, out_path)
    print(f"Estado final: {diagnostic['status']}")
    print(f"Salida: {out_path}")
    return 1 if diagnostic["status"] == "ERROR" else 0


if __name__ == "__main__":
    sys.exit(main())
