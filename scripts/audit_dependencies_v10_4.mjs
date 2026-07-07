import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsDir = path.join(root, 'docs');
fs.mkdirSync(docsDir, { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const rootRequirements = fs.existsSync(path.join(root, 'requirements.txt'));
const toolsRequirements = fs.existsSync(path.join(root, 'tools/python/requirements.txt'));
const packageLock = fs.existsSync(path.join(root, 'package-lock.json'));
const nodeVersion = fs.existsSync(path.join(root, '.node-version')) ? fs.readFileSync(path.join(root, '.node-version'), 'utf8').trim() : '';
const npmrc = fs.existsSync(path.join(root, '.npmrc')) ? fs.readFileSync(path.join(root, '.npmrc'), 'utf8').trim().split(/\r?\n/) : [];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const files = walk(root).map((file) => path.relative(root, file).replaceAll(path.sep, '/'));
const envFiles = files.filter((file) => /^\.env($|\.)/.test(file) && file !== '.env.example');
const backendSignals = files.filter((file) => file.startsWith('functions/') || /^wrangler\.(toml|json|jsonc)$/.test(file));
const deps = Object.keys(pkg.dependencies ?? {}).sort();
const devDeps = Object.keys(pkg.devDependencies ?? {}).sort();
const backendDeps = [...deps, ...devDeps].filter((dep) => ['wrangler', '@cloudflare/workers-types', 'pg', 'postgres', 'drizzle-orm', 'kysely'].includes(dep));

const findings = [];
if (rootRequirements) findings.push('requirements.txt existe en raíz; Cloudflare puede intentar instalar dependencias Python.');
if (!toolsRequirements) findings.push('Falta tools/python/requirements.txt para conservar dependencias ETL fuera del build frontend.');
if (!packageLock) findings.push('Falta package-lock.json; npm clean-install en Cloudflare sería menos reproducible.');
if (envFiles.length) findings.push(`Archivos .env no permitidos detectados: ${envFiles.join(', ')}`);
if (backendSignals.length) findings.push(`Señales de backend implementado detectadas: ${backendSignals.join(', ')}`);
if (backendDeps.length) findings.push(`Dependencias backend detectadas sin autorización V10.4: ${backendDeps.join(', ')}`);

const report = {
  phase: 'V10.4 — Auditoría de dependencias y build Cloudflare',
  timestamp_utc: new Date().toISOString(),
  node_version: nodeVersion,
  npmrc,
  package_lock_exists: packageLock,
  dependencies: deps,
  dev_dependencies: devDeps,
  python: {
    root_requirements_exists: rootRequirements,
    tools_python_requirements_exists: toolsRequirements,
    requirements_path_for_local_etl: 'tools/python/requirements.txt',
  },
  backend: {
    implemented: false,
    backend_signals: backendSignals,
    backend_dependencies: backendDeps,
  },
  security: {
    env_files_detected: envFiles,
  },
  findings,
  status: findings.length === 0 ? 'OK' : 'WARN',
};

fs.writeFileSync(path.join(docsDir, 'DEPENDENCY_AUDIT_V10_4.json'), JSON.stringify(report, null, 2), 'utf8');
const md = `# Mapa 2 — Auditoría de dependencias V10.4

**Fase:** ${report.phase}  
**Fecha UTC:** ${report.timestamp_utc}

## Resultado

**Estado:** ${report.status}

${findings.length ? findings.map((finding) => `- ${finding}`).join('\n') : '- Sin hallazgos bloqueantes.'}

## Node / npm

- Node fijado en \`.node-version\`: ${nodeVersion || 'N/D'}
- \`package-lock.json\`: ${packageLock ? 'presente' : 'ausente'}
- \`.npmrc\`: ${npmrc.length ? 'presente' : 'ausente'}

## Dependencias frontend

**Producción:** ${deps.length ? deps.map((dep) => `\`${dep}\``).join(', ') : 'ninguna'}  
**Desarrollo:** ${devDeps.length ? devDeps.map((dep) => `\`${dep}\``).join(', ') : 'ninguna'}

## Python / ETL

- \`requirements.txt\` en raíz: ${rootRequirements ? 'sí' : 'no'}
- \`tools/python/requirements.txt\`: ${toolsRequirements ? 'sí' : 'no'}
- Flujo local recomendado: \`make python-install\` o \`python -m pip install -r tools/python/requirements.txt\`.

## Backend

- Backend implementado: no
- \`functions/\` / Wrangler: ${backendSignals.length ? backendSignals.join(', ') : 'sin señales'}
- Dependencias backend: ${backendDeps.length ? backendDeps.join(', ') : 'sin dependencias'}

## Seguridad

- Archivos \`.env\` privados detectados: ${envFiles.length ? envFiles.join(', ') : '0'}
`;
fs.writeFileSync(path.join(docsDir, 'DEPENDENCY_AUDIT_V10_4.md'), md, 'utf8');

console.log('[audit-dependencies-v10.4] Reportes generados:');
console.log('  - docs/DEPENDENCY_AUDIT_V10_4.json');
console.log('  - docs/DEPENDENCY_AUDIT_V10_4.md');
console.log(`[audit-dependencies-v10.4] status=${report.status} deps=${deps.length} devDeps=${devDeps.length}`);
if (findings.length) for (const finding of findings) console.warn(`  - ${finding}`);
