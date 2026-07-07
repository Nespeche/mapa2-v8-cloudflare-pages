import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = process.cwd();
export const NOW = '2026-07-07T00:00:00.000Z';
export const SCHEMA_VERSION = 'v11a1';

export const rel = (...parts) => path.join(ROOT, ...parts);
export const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
export const readText = (filePath) => fs.readFileSync(filePath, 'utf8');
export const writeText = (filePath, text) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf8');
};
export const readJson = (filePath) => JSON.parse(readText(filePath));
export const writeJson = (filePath, value) => writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
export const fileBytes = (filePath) => fs.statSync(filePath).size;
export const utf8Bytes = (value) => Buffer.byteLength(String(value ?? ''), 'utf8');

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function stableId(prefix, parts) {
  const hash = crypto.createHash('sha1').update(parts.map((v) => String(v ?? '')).join('|')).digest('hex').slice(0, 18);
  return `${prefix}:${hash}`;
}

export function safeFileId(value) {
  return String(value ?? 'sin_id').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'sin_id';
}

export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const text = String(value).trim().replace(/^\uFEFF/, '').replace(/\./g, (match, offset, full) => {
    return full.includes(',') ? '' : match;
  }).replace(',', '.');
  if (!text || text.toLowerCase() === 'nan' || text.toLowerCase() === 'null') return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

export function toInt(value, fallback = null) {
  const n = toNumber(value, fallback);
  return n === null || n === undefined ? fallback : Math.trunc(n);
}

export function round(value, digits = 2) {
  const n = toNumber(value, null);
  if (n === null) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

export function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

export function readCsv(filePath) {
  const text = readText(filePath).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ''));
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    return row;
  });
}

export function sqlValue(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = String(value).replace(/\u0000/g, '').replace(/'/g, "''");
  return `'${text}'`;
}

export function insertSql(table, columns, row, mode = 'INSERT OR REPLACE') {
  return `${mode} INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((c) => sqlValue(row[c])).join(', ')});`;
}

export function splitSqlValues(valueText) {
  const values = [];
  let token = '';
  let inString = false;
  let tokenWasString = false;
  for (let i = 0; i < valueText.length; i += 1) {
    const ch = valueText[i];
    const next = valueText[i + 1];
    if (inString) {
      if (ch === "'" && next === "'") {
        token += "'";
        i += 1;
      } else if (ch === "'") {
        inString = false;
        tokenWasString = true;
      } else {
        token += ch;
      }
    } else if (ch === "'") {
      inString = true;
    } else if (ch === ',') {
      values.push(convertSqlToken(token.trim(), tokenWasString));
      token = '';
      tokenWasString = false;
    } else {
      token += ch;
    }
  }
  values.push(convertSqlToken(token.trim(), tokenWasString));
  return values;
}

function convertSqlToken(token, wasString) {
  if (wasString) return token;
  if (token.toUpperCase() === 'NULL' || token === '') return null;
  if (/^-?\d+(\.\d+)?(?:e[+-]?\d+)?$/i.test(token)) return Number(token);
  return token;
}

export function parseSeedTables(tableNames) {
  const wanted = new Set(tableNames);
  const out = Object.fromEntries([...wanted].map((name) => [name, []]));
  const chunksDir = rel('data', 'd1', 'chunks');
  let files = [];
  if (fs.existsSync(chunksDir)) {
    files = fs.readdirSync(chunksDir)
      .filter((name) => name.endsWith('.sql') && name.startsWith('seed_'))
      .sort()
      .map((name) => path.join(chunksDir, name));
  }
  if (files.length === 0) {
    const seed = rel('data', 'd1', 'seed.sql');
    if (fs.existsSync(seed)) files = [seed];
  }
  const re = /^INSERT OR REPLACE INTO ([a-zA-Z0-9_]+) \(([^)]+)\) VALUES \((.*)\);$/;
  for (const file of files) {
    const text = readText(file);
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(re);
      if (!m) continue;
      const [, table, colsText, valuesText] = m;
      if (!wanted.has(table)) continue;
      const columns = colsText.split(',').map((c) => c.trim());
      const values = splitSqlValues(valuesText);
      if (columns.length !== values.length) {
        throw new Error(`No coincide cantidad de columnas/valores en ${table} dentro de ${path.relative(ROOT, file)}`);
      }
      const row = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx];
      });
      out[table].push(row);
    }
  }
  return out;
}

export function writeSqlChunks(statements, baseName, options = {}) {
  const outDir = options.outDir ?? rel('data', 'd1');
  const chunkDir = options.chunkDir ?? rel('data', 'd1', 'chunks');
  const maxBytes = options.maxBytes ?? 16_000_000;
  const header = options.header ?? '-- Generated by V11A.1 read model pipeline.\n';
  ensureDir(outDir);
  ensureDir(chunkDir);
  const fullPath = path.join(outDir, `${baseName}.sql`);
  const fullText = `${header}\n${statements.join('\n')}\n`;
  writeText(fullPath, fullText);

  const chunks = [];
  let current = [];
  let currentBytes = utf8Bytes(header);
  function flush() {
    if (current.length === 0) return;
    const idx = String(chunks.length + 1).padStart(3, '0');
    const filePath = path.join(chunkDir, `${baseName}_${idx}.sql`);
    const text = `${header}\n${current.join('\n')}\n`;
    writeText(filePath, text);
    chunks.push({ file: path.relative(ROOT, filePath).replaceAll(path.sep, '/'), statement_count: current.length, size_bytes: utf8Bytes(text) });
    current = [];
    currentBytes = utf8Bytes(header);
  }
  for (const statement of statements) {
    const size = utf8Bytes(statement) + 1;
    if (current.length > 0 && currentBytes + size > maxBytes) flush();
    current.push(statement);
    currentBytes += size;
  }
  flush();
  return {
    file: path.relative(ROOT, fullPath).replaceAll(path.sep, '/'),
    statement_count: statements.length,
    size_bytes: utf8Bytes(fullText),
    chunks
  };
}

export function markdownTable(rows, columns) {
  if (!rows.length) return '';
  const header = `| ${columns.map((c) => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((c) => String(row[c.key] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

export function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(abs));
    else out.push(abs);
  }
  return out;
}

export function sizeLabel(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export function parseSqlTablesFromFiles(files, tableNames) {
  const wanted = new Set(tableNames);
  const out = Object.fromEntries([...wanted].map((name) => [name, []]));
  const re = /^INSERT OR REPLACE INTO ([a-zA-Z0-9_]+) \(([^)]+)\) VALUES \((.*)\);$/;
  for (const file of files) {
    const text = readText(file);
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(re);
      if (!m) continue;
      const [, table, colsText, valuesText] = m;
      if (!wanted.has(table)) continue;
      const columns = colsText.split(',').map((c) => c.trim());
      const values = splitSqlValues(valuesText);
      if (columns.length !== values.length) {
        throw new Error(`No coincide cantidad columnas/valores en ${table} dentro de ${path.relative(ROOT, file)}`);
      }
      const row = {};
      columns.forEach((col, idx) => { row[col] = values[idx]; });
      out[table].push(row);
    }
  }
  return out;
}
