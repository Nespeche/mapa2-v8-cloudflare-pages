import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = (...parts) => path.join(ROOT, ...parts);
const now = new Date().toISOString();
const summaryPath = rel('data', 'd1', 'seed_summary.json');
if (!fs.existsSync(summaryPath)) {
  console.error('[V11A] No existe data/d1/seed_summary.json. Ejecutá npm run data:d1:build primero.');
  process.exit(1);
}
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

const limits = {
  source: 'Cloudflare D1 docs, consultadas 2026-07-07',
  free_database_size_bytes: 500 * 1024 * 1024,
  free_account_storage_bytes: 5 * 1024 * 1024 * 1024,
  free_rows_read_per_day: 5_000_000,
  free_rows_written_per_day: 100_000,
  max_sql_statement_bytes: 100_000,
  max_row_or_string_bytes: 2_000_000,
  max_queries_per_worker_invocation_free: 50,
  max_d1_execute_import_bytes: 5 * 1024 * 1024 * 1024
};

const seedPath = rel('data', 'd1', 'seed.sql');
const chunkDir = rel('data', 'd1', 'chunks');
const chunkFiles = fs.existsSync(chunkDir)
  ? fs.readdirSync(chunkDir).filter((name) => name.endsWith('.sql')).sort().map((name) => {
      const abs = path.join(chunkDir, name);
      const found = summary.chunks?.find((chunk) => chunk.file === name) ?? {};
      return {
        file: `data/d1/chunks/${name}`,
        size_bytes: fs.statSync(abs).size,
        statement_count: found.statementCount ?? null,
        max_statement_bytes: found.maxStatementBytes ?? null,
        description: found.description ?? null,
        remote_free_write_risk: (found.statementCount ?? 0) > limits.free_rows_written_per_day ? 'HIGH' : 'MEDIUM_BECAUSE_INDEX_WRITES_COUNT'
      };
    })
  : [];

const seedSize = fs.existsSync(seedPath) ? fs.statSync(seedPath).size : 0;
const tableCounts = summary.table_counts ?? {};
const totalRows = summary.total_rows ?? Object.values(tableCounts).reduce((a, b) => a + b, 0);
const indexedWriteMultiplierEstimate = 3;
const estimatedRemoteRowsWrittenWithIndexes = totalRows * indexedWriteMultiplierEstimate;
const storageUsageRatio = seedSize / limits.free_database_size_bytes;
const overDailyWrites = totalRows > limits.free_rows_written_per_day;
const overDailyWritesWithIndexes = estimatedRemoteRowsWrittenWithIndexes > limits.free_rows_written_per_day;
const maxStatementBytes = summary.file_sizes?.max_statement_bytes ?? 0;

const risks = [];
if (seedSize > limits.free_database_size_bytes) risks.push({ level: 'BLOCKED', item: 'seed_size', message: 'El seed SQL supera el tamaño máximo de DB Free como proxy conservador.' });
if (maxStatementBytes > limits.max_sql_statement_bytes) risks.push({ level: 'BLOCKED', item: 'statement_size', message: 'Hay statements mayores a 100 KB.' });
if (overDailyWrites) risks.push({ level: 'WARNING', item: 'remote_rows_written', message: 'La importación remota completa supera 100.000 filas escritas/día de D1 Free.' });
if (overDailyWritesWithIndexes) risks.push({ level: 'WARNING', item: 'remote_index_writes', message: 'Con índices, la escritura remota puede multiplicar filas escritas. Cargar por chunks y monitorear métricas.' });
if ((summary.geometry_policy?.asset_path_rows ?? 0) > 0) risks.push({ level: 'INFO', item: 'geometry_policy', message: 'Polígonos pesados quedan por asset_path + bbox/centroide; correcto para V11A.' });
if ((summary.postal_codes?.rows ?? 0) === 0) risks.push({ level: 'WARNING', item: 'postal_codes', message: 'No hay códigos postales importados; queda preparada la estructura.' });

const status = risks.some((r) => r.level === 'BLOCKED') ? 'BLOCKED' : risks.some((r) => r.level === 'WARNING') ? 'WARNING' : 'OK';

const report = {
  phase: 'V11A D1 limits audit',
  generated_at: now,
  status,
  limits,
  seed: {
    seed_sql_bytes: seedSize,
    seed_sql_mb: Number((seedSize / 1024 / 1024).toFixed(3)),
    storage_usage_ratio_vs_free_db_limit: Number(storageUsageRatio.toFixed(4)),
    max_statement_bytes: maxStatementBytes
  },
  rows: {
    table_counts: tableCounts,
    total_rows: totalRows,
    estimated_remote_rows_written_with_indexes: estimatedRemoteRowsWrittenWithIndexes
  },
  geometry: summary.geometry_policy,
  postal_codes: summary.postal_codes,
  chunks: chunkFiles,
  risks,
  recommendations: [
    'Validar localmente con Wrangler antes de ejecutar remoto.',
    'Para remoto Free, no ejecutar seed.sql completo de una vez; usar chunks y monitorear filas escritas.',
    'Si Cloudflare corta por filas escritas, reanudar al día siguiente desde el próximo chunk.',
    'En V11B usar APIs paginadas, queries parametrizadas e índices existentes.',
    'No mover polígonos pesados a geometry_json sin nueva auditoría de tamaño.'
  ]
};

fs.writeFileSync(rel('data', 'd1', 'd1_audit_report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

const tableRowsMd = Object.entries(tableCounts).map(([table, count]) => `| ${table} | ${count} |`).join('\n');
const chunkRowsMd = chunkFiles.map((chunk) => `| ${chunk.file} | ${(chunk.size_bytes / 1024 / 1024).toFixed(3)} MB | ${chunk.statement_count ?? ''} | ${chunk.remote_free_write_risk} |`).join('\n');
const risksMd = risks.map((risk) => `- **${risk.level} — ${risk.item}:** ${risk.message}`).join('\n') || '- Sin riesgos bloqueantes detectados.';

const migrationMd = `# Mapa 2 — V11A Migration Report\n\n**Generado:** ${now}\n\n**Estado:** ${status}\n\n## Datos origen\n\n${Object.entries(summary.input_files ?? {}).map(([key, value]) => `- ${key}: ${value ?? 'no encontrado'}`).join('\n')}\n\n## Filas generadas por tabla\n\n| Tabla | Filas |\n|---|---:|\n${tableRowsMd}\n\n## Integridad comercial V6\n\n- Clientes esperados: ${summary.business_integrity?.expected_clients_v6}\n- Clientes importados: ${summary.business_integrity?.actual_clients}\n- Productos importados: ${summary.business_integrity?.actual_products}\n- Ventas importadas: ${summary.business_integrity?.actual_sales}\n- Período ventas: ${summary.sale_period?.from} a ${summary.sale_period?.to}\n- Ventas huérfanas sin cliente: ${summary.business_integrity?.orphan_sales_without_client}\n- Ventas huérfanas sin producto: ${summary.business_integrity?.orphan_sales_without_product}\n- Datos sintéticos preservados: ${summary.business_integrity?.synthetic_rows_preserved ? 'sí' : 'no'}\n\n## Códigos postales\n\n- Registros importados: ${summary.postal_codes?.rows}\n- Estrategia: ${summary.postal_codes?.strategy}\n- Regla: ${summary.postal_codes?.confidence_rule}\n\n## Geometrías\n\n- Filas con geometry_json liviano: ${summary.geometry_policy?.geometry_json_rows}\n- Filas con asset_path: ${summary.geometry_policy?.asset_path_rows}\n- Regla: ${summary.geometry_policy?.rule}\n\n## Chunks generados\n\n| Archivo | Tamaño | Statements | Riesgo remoto Free |\n|---|---:|---:|---|\n${chunkRowsMd}\n\n## Riesgos y recomendaciones\n\n${risksMd}\n\n## Conclusión\n\nLa migración local V11A queda preparada. La carga remota en D1 Free debe hacerse con chunks y monitoreo de filas escritas; no se recomienda ejecutar el seed completo en remoto de una sola vez.\n`;
fs.writeFileSync(rel('docs', 'V11A_MIGRATION_REPORT.md'), migrationMd, 'utf8');

const validationAppend = `\n\n---\n\n## Auditoría de límites D1 Free\n\n**Generado:** ${now}\n\n**Estado auditoría:** ${status}\n\n- Tamaño seed completo: ${(seedSize / 1024 / 1024).toFixed(3)} MB.\n- Límite D1 Free por base usado como referencia: ${(limits.free_database_size_bytes / 1024 / 1024).toFixed(0)} MB.\n- Filas totales estimadas: ${totalRows}.\n- Filas escritas remotas estimadas con índices: ${estimatedRemoteRowsWrittenWithIndexes}.\n- Mayor statement SQL: ${maxStatementBytes} bytes.\n\n${risksMd}\n`;
const validationPath = rel('docs', 'V11A_D1_VALIDATION.md');
const previousValidation = fs.existsSync(validationPath) ? fs.readFileSync(validationPath, 'utf8') : '# Mapa 2 — V11A D1 Validation\n';
const cleaned = previousValidation.split('\n---\n\n## Auditoría de límites D1 Free')[0];
fs.writeFileSync(validationPath, cleaned + validationAppend, 'utf8');

console.log(`[V11A] Auditoría D1: ${status}`);
if (status === 'BLOCKED') process.exit(1);
