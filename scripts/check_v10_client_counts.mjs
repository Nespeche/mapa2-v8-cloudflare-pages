import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const docsDir = join(root, 'docs');
const clientTotalsPath = join(root, 'public/data/business/agregados/ventas_cliente_totales.json');
const departmentMonthPath = join(root, 'public/data/business/agregados/ventas_departamento_mes.json');
const provincesPath = join(root, 'public/data/provincias.geojson');

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`No existe el archivo requerido: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function recordsOf(payload) {
  return Array.isArray(payload) ? payload : payload.records ?? [];
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function formatRows(rows) {
  return rows.map((row) => `| ${row.name} | ${row.id} | ${row.clients} |`).join('\n');
}

mkdirSync(docsDir, { recursive: true });

const clientsPayload = readJson(clientTotalsPath);
const departmentPayload = readJson(departmentMonthPath);
const provincesGeo = readJson(provincesPath);
const clientRows = recordsOf(clientsPayload);
const departmentRows = recordsOf(departmentPayload);

const violations = [];
const warnings = [];

if (clientRows.length < 1) violations.push('ventas_cliente_totales.json no contiene clientes.');
if (departmentRows.length < 1) violations.push('ventas_departamento_mes.json no contiene agregados departamentales.');
if (!provincesGeo?.features?.length) violations.push('provincias.geojson no contiene features.');

const departmentClientCounts = countBy(clientRows, 'departamento_id');
const departmentsWithClients = [...departmentClientCounts.entries()].filter(([, count]) => count > 0).length;
if (departmentsWithClients < 1) violations.push('No hay departamentos con clientes únicos derivados desde ventas_cliente_totales.json.');

const zeroClientDepartments = departmentRows.filter((row) => Number(row.clientes_unicos ?? 0) <= 0);
if (zeroClientDepartments.length > 0) {
  warnings.push(`${zeroClientDepartments.length} filas de ventas_departamento_mes.json tienen clientes_unicos <= 0.`);
}

const bolivarClientRows = clientRows.filter((row) => String(row.departamento_nombre ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'bolivar');
const bolivarMonthRows = departmentRows.filter((row) => String(row.departamento_nombre ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'bolivar');
if (bolivarClientRows.length === 0) warnings.push('No se encontró Bolívar en ventas_cliente_totales.json para validar el caso reportado visualmente.');
if (bolivarMonthRows.length > 0 && Math.max(...bolivarMonthRows.map((row) => Number(row.clientes_unicos ?? 0))) === 0) {
  violations.push('Bolívar existe en ventas_departamento_mes.json pero clientes_unicos es 0 para todas sus filas.');
}

const topDepartments = [...departmentClientCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([id, clients]) => {
    const sample = clientRows.find((row) => row.departamento_id === id);
    return { id, name: sample?.departamento_nombre ?? id, clients };
  });

const report = {
  phase: 'V10.3 — Anti-regresión de conteo de clientes' ,
  generated_at: new Date().toISOString(),
  client_total_records: clientRows.length,
  department_month_records: departmentRows.length,
  province_features: provincesGeo?.features?.length ?? 0,
  departments_with_clients_from_client_totals: departmentsWithClients,
  bolivar_clients_from_client_totals: bolivarClientRows.length,
  bolivar_max_monthly_clients: bolivarMonthRows.length ? Math.max(...bolivarMonthRows.map((row) => Number(row.clientes_unicos ?? 0))) : null,
  top_departments_by_client_count: topDepartments,
  status: violations.length === 0 ? 'OK' : 'ERROR',
  warnings,
  violations,
  blocking_errors: violations.length,
};

writeFileSync(join(docsDir, 'CLIENT_COUNT_AUDIT_V10_3.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const md = `# Mapa 2 — Auditoría anti-regresión de conteo de clientes V10.3\n\n` +
`**Fase:** ${report.phase}  \n` +
`**Generado:** ${report.generated_at}  \n` +
`**Resultado:** ${report.blocking_errors === 0 ? 'sin errores bloqueantes' : 'con errores bloqueantes'}\n\n` +
`## Checks\n\n` +
`- Clientes agregados: \`${report.client_total_records}\`\n` +
`- Agregados departamento/mes: \`${report.department_month_records}\`\n` +
`- Provincias GeoJSON: \`${report.province_features}\`\n` +
`- Departamentos con clientes derivados de ventas_cliente_totales: \`${report.departments_with_clients_from_client_totals}\`\n` +
`- Caso Bolívar — clientes desde totales cliente: \`${report.bolivar_clients_from_client_totals}\`\n` +
`- Caso Bolívar — máximo clientes_unicos mensual: \`${report.bolivar_max_monthly_clients ?? 'N/A'}\`\n\n` +
`## Top departamentos por clientes\n\n| Departamento | ID | Clientes |\n|---|---|---:|\n${formatRows(topDepartments)}\n\n` +
`## Advertencias\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join('\n') : '- Sin advertencias.'}\n\n` +
`## Errores bloqueantes\n\n${violations.length ? violations.map((item) => `- ${item}`).join('\n') : '- Sin errores bloqueantes.'}\n`;

writeFileSync(join(docsDir, 'CLIENT_COUNT_AUDIT_V10_3.md'), md, 'utf8');

console.log('[client-count-v10.3] OK auditoría generada');
console.log(`[client-count-v10.3] clientes=${report.client_total_records} departamentos_con_clientes=${departmentsWithClients} bolivar=${report.bolivar_clients_from_client_totals}`);
if (violations.length > 0) {
  console.error('[client-count-v10.3] ERRORES BLOQUEANTES:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}
