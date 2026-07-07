import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

export const CONTRACT_VERSION = 'V10.3';
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const NUMERIC_TOLERANCE = 0.05;

export function posix(path) {
  return path.replace(/\\/g, '/');
}

export function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(3)} MiB`;
}

export function ensureFile(path, violations, label = path) {
  if (!existsSync(path)) {
    violations.push(`Falta archivo requerido: ${label}`);
    return false;
  }
  return true;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function recordsOf(payload) {
  return Array.isArray(payload) ? payload : payload.records ?? [];
}

export function stripBom(value) {
  return String(value ?? '').replace(/^\uFEFF/, '');
}

export function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function readCsvRows(path) {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(stripBom);
  return lines.slice(1).filter(Boolean).map((line) => {
    const columns = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) row[headers[i]] = columns[i] ?? '';
    return row;
  });
}

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function addMetric(target, row) {
  target.registros_venta += 1;
  target.unidades += toNumber(row.unidades);
  target.venta_neta += toNumber(row.venta_neta);
  target.costo_estimado += toNumber(row.costo_estimado);
  target.margen_bruto += toNumber(row.margen_bruto);
  target.volumen_kg += toNumber(row.volumen_kg);
}

export function emptyMetrics() {
  return {
    registros_venta: 0,
    unidades: 0,
    venta_neta: 0,
    costo_estimado: 0,
    margen_bruto: 0,
    volumen_kg: 0,
    clientes: new Set(),
  };
}

export function assertCount(label, actual, expected, violations) {
  if (actual !== expected) violations.push(`${label}: esperado ${expected}, recibido ${actual}`);
}

export function assertPositive(label, value, violations) {
  if (!(Number(value) > 0)) violations.push(`${label}: esperado valor positivo, recibido ${value}`);
}

export function compareNumber(label, actual, expected, violations, tolerance = NUMERIC_TOLERANCE) {
  const diff = Math.abs(round2(actual) - round2(expected));
  if (diff > tolerance) violations.push(`${label}: esperado ${round2(expected)}, recibido ${round2(actual)}, diff=${diff}`);
}

export function compareAggregates(records, aggregateMap, keyFn, scope, violations) {
  const fields = ['registros_venta', 'unidades', 'venta_neta', 'costo_estimado', 'margen_bruto', 'volumen_kg'];
  for (const record of records) {
    const key = keyFn(record);
    const aggregate = aggregateMap.get(key);
    if (!aggregate) {
      violations.push(`${scope}: falta agregado calculado para ${key}`);
      if (violations.length > 50) return;
      continue;
    }
    for (const field of fields) {
      compareNumber(`${scope}.${key}.${field}`, toNumber(record[field]), aggregate[field], violations);
      if (violations.length > 50) return;
    }
    if ('clientes_unicos' in record) {
      compareNumber(`${scope}.${key}.clientes_unicos`, toNumber(record.clientes_unicos), aggregate.clientes.size, violations, 0);
      if (violations.length > 50) return;
    }
  }
  if (records.length !== aggregateMap.size) {
    violations.push(`${scope}: cantidad de agregados no coincide. Archivo=${records.length}, calculado=${aggregateMap.size}`);
  }
}

export function walkFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

export function largestFiles(dir, limit = 10) {
  return walkFiles(dir)
    .map((absolute) => ({ absolute, rel: posix(relative(dir, absolute)), size: statSync(absolute).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit);
}

export function publicAssetAudit(root, violations, warnings) {
  const dataDir = join(root, 'public/data');
  const files = walkFiles(dataDir);
  const forbiddenExtensions = new Set(['.gpkg', '.sqlite', '.db', '.zip', '.7z', '.rar']);
  let max = { rel: '', size: 0 };
  for (const absolute of files) {
    const rel = posix(relative(join(root, 'public'), absolute));
    const size = statSync(absolute).size;
    if (size > max.size) max = { rel, size };
    if (size > MAX_ASSET_BYTES) violations.push(`Asset público supera 25 MiB: ${rel} (${formatMiB(size)})`);
    if (forbiddenExtensions.has(extname(rel).toLowerCase())) violations.push(`Archivo no apto en public/: ${rel}`);
    if (rel.startsWith('data/raw/') || rel.startsWith('data/output/')) warnings.push(`Revisar archivo público potencialmente raw/output: ${rel}`);
  }
  return { fileCount: files.length, maxAsset: max, top: largestFiles(dataDir, 10).map((file) => ({ rel: posix(relative(join(root, 'public'), file.absolute)), size_bytes: file.size, size_mib: +(file.size / 1024 / 1024).toFixed(3) })) };
}

export function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function writeMd(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

export function finalStatus(violations) {
  return violations.length === 0 ? 'OK' : 'ERROR';
}

export function exitIfViolations(prefix, violations) {
  if (violations.length > 0) {
    console.error(`[${prefix}] ERRORES BLOQUEANTES:`);
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }
}
