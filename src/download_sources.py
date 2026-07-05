from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
import re

import requests
from tqdm import tqdm

from utils import ensure_dir, load_yaml


def download_file(url: str, out: Path, *, timeout: int = 60, retries: int = 2) -> bool:
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and out.stat().st_size > 0:
        print(f'OK existe: {out}')
        return True
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with requests.get(url, stream=True, timeout=timeout) as r:
                if r.status_code == 404:
                    print(f'No existe 404: {url}')
                    return False
                r.raise_for_status()
                total = int(r.headers.get('content-length') or 0)
                tmp = out.with_suffix(out.suffix + '.part')
                with open(tmp, 'wb') as fh, tqdm(total=total, unit='B', unit_scale=True, desc=out.name) as bar:
                    for chunk in r.iter_content(chunk_size=1024 * 512):
                        if chunk:
                            fh.write(chunk)
                            bar.update(len(chunk))
                tmp.rename(out)
                print(f'Descargado: {out}')
                return True
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            wait = 2 ** attempt
            print(f'Error descargando {url}: {exc}. Reintento en {wait}s')
            time.sleep(wait)
    print(f'Fallo definitivo: {url} ({last_exc})')
    return False


def georef_url(base: str, resource: str, fmt: str) -> str:
    if fmt == 'shp':
        return f'{base}/{resource}?formato=shp'
    return f'{base}/{resource}.{fmt}'


def download_codgeo_index(index_url: str, out_dir: Path) -> list[Path]:
    """Descarga el índice de códigos geográficos 2022 y todos los links detectados.

    REDATAM puede cambiar nombres de archivos; por eso no hardcodeamos extensiones.
    Se guarda el HTML y cualquier href relativo/absoluto encontrado bajo Docs/.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / 'codcart_index.html'
    ok = download_file(index_url, index_path, retries=1)
    downloaded: list[Path] = []
    if not ok:
        return downloaded
    html = index_path.read_text(encoding='utf-8', errors='ignore')
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.I)
    for href in hrefs:
        if href.startswith('#') or href.lower().startswith(('javascript:', 'mailto:')):
            continue
        url = urljoin(index_url, href)
        name = Path(urlparse(url).path).name or 'descarga_codgeo'
        # Se priorizan archivos de nomenclador/códigos, no assets de estilo.
        if not re.search(r'\.(csv|txt|xls|xlsx|zip|pdf|htm|html)$', name, flags=re.I):
            continue
        out = out_dir / name
        if download_file(url, out, retries=1):
            downloaded.append(out)
    return downloaded


def iter_optional_georef_resources(cfg: dict) -> list[tuple[str, dict, list[str]]]:
    out = []
    optional = cfg.get('georef', {}).get('optional_resources', {}) or {}
    for key, meta in optional.items():
        candidates = meta.get('candidates') or [key]
        out.append((key, meta, candidates))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description='Descarga fuentes oficiales y auxiliares para la base Argentina Geo + Censo.')
    parser.add_argument('--config', required=True)
    parser.add_argument('--raw-dir', required=True)
    parser.add_argument('--allow-partial', action='store_true', default=True)
    args = parser.parse_args()

    cfg = load_yaml(args.config)
    raw = ensure_dir(args.raw_dir)

    failures: list[str] = []

    # Georef full downloads
    base = cfg['georef']['base_v2'].rstrip('/')
    formats = cfg['georef'].get('preferred_formats', ['ndjson', 'geojson', 'shp'])
    for resource in cfg['georef']['resources']:
        got_any = False
        for fmt in formats:
            suffix = 'zip' if fmt == 'shp' else fmt
            url = georef_url(base, resource, fmt)
            out = raw / 'georef' / f'{resource}.{suffix}'
            if download_file(url, out, retries=1):
                got_any = True
                # Con una descarga completa alcanza; ndjson/geojson preferidos, shp como respaldo.
                break
        if not got_any:
            failures.append(f'georef:{resource}')

    # Georef optional/new resources. No fallan el proceso si todavía no están expuestos en descarga completa.
    for key, meta, candidates in iter_optional_georef_resources(cfg):
        got_any = False
        for candidate in candidates:
            for fmt in formats:
                suffix = 'zip' if fmt == 'shp' else fmt
                url = georef_url(base, candidate, fmt)
                out = raw / 'georef' / f'{candidate}.{suffix}'
                if download_file(url, out, retries=0):
                    got_any = True
                    break
            if got_any:
                break
        if not got_any:
            print(f'WARNING: recurso opcional Georef no descargado: {key} ({", ".join(candidates)})')

    # INDEC core files
    indec = cfg['indec']['censo_2022']
    for key in ['resumen_pais_provincias', 'gobiernos_locales']:
        item = indec[key]
        if not download_file(item['url'], raw / item['filename']):
            failures.append(f'indec:{key}')

    # INDEC department/province files: try several slugs/suffixes and keep successful files.
    pattern = indec.get('departamentos_pattern', {})
    base_pattern = pattern.get('base')
    for prov_code, slugs in pattern.get('slugs', {}).items():
        for slug in slugs:
            for n in pattern.get('n_values', [1, 2, 3]):
                url = base_pattern.format(slug=slug, n=n)
                out = raw / 'indec' / 'departamentos' / f'c2022_{prov_code}_{slug}_c2_{n}.xlsx'
                ok = download_file(url, out, retries=0)
                if ok:
                    break
            if ok:
                break

    # INDEC Codgeo / REDATAM geographic codes.
    codgeo_index = indec.get('codgeo_2022_index') or cfg.get('indec', {}).get('geoestadistica', {}).get('codgeo_2022_index')
    if codgeo_index:
        downloaded = download_codgeo_index(codgeo_index, raw / 'indec' / 'codgeo_2022')
        print(f'Codgeo 2022: {len(downloaded)} archivos vinculados descargados.')

    # REFEGLO
    refeglo = cfg['refeglo']
    if not download_file(refeglo['url'], raw / refeglo['filename']):
        failures.append('refeglo')

    if failures:
        print('\nFuentes no descargadas:')
        for f in failures:
            print(f' - {f}')
        if not args.allow_partial:
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
