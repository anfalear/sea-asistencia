// ============================================================
//  SEA · Backup de la base de datos de Supabase
//
//  Descarga todas las tablas a backups/<fecha-hora>/ en JSON
//  (fiel, para restaurar) y CSV (legible, para abrir en Excel).
//
//  Uso (PowerShell):
//    $env:SUPABASE_SERVICE_KEY = '<service_role key>'
//    node tools/backup_supabase.js
//
//  La service_role key está en Supabase → Settings → API. SALTA el
//  RLS: nunca commitearla, nunca ponerla en la app, solo usarla
//  aquí, localmente. La anon key no sirve: el RLS le devuelve
//  tablas vacías sin sesión de un profesor.
// ============================================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fqbsyywbjgasscnnsmvu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;

const TABLAS = [
  'estudiantes',
  'asistencias',
  'detalle_asistencias',
  'informes_estudiante',
  'email_whitelist',
];

const PAGINA = 1000; // PostgREST corta en 1000 filas por defecto

if (!KEY) {
  console.error('Falta la variable SUPABASE_SERVICE_KEY. Uso:');
  console.error("  $env:SUPABASE_SERVICE_KEY = '<service_role key>'");
  console.error('  node tools/backup_supabase.js');
  process.exit(1);
}

async function descargarTabla(tabla) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${desde}-${desde + PAGINA - 1}`,
      },
    });
    if (!res.ok) {
      throw new Error(`${tabla}: HTTP ${res.status} — ${await res.text()}`);
    }
    const lote = await res.json();
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return filas;
}

function aCSV(filas) {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  const celda = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [
    cols.join(','),
    ...filas.map(f => cols.map(c => celda(f[c])).join(',')),
  ].join('\n');
}

(async () => {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const dir = path.join(__dirname, '..', 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  let total = 0;
  for (const tabla of TABLAS) {
    const filas = await descargarTabla(tabla);
    fs.writeFileSync(path.join(dir, `${tabla}.json`), JSON.stringify(filas, null, 1));
    fs.writeFileSync(path.join(dir, `${tabla}.csv`), '﻿' + aCSV(filas)); // BOM: tildes en Excel
    console.log(`${tabla.padEnd(22)} ${String(filas.length).padStart(5)} filas`);
    total += filas.length;
  }

  console.log(`\n${total} filas en ${dir}`);
  if (total === 0) {
    console.warn('ADVERTENCIA: 0 filas en todas las tablas. ¿Estás usando la anon key en vez de la service_role key?');
    process.exitCode = 1;
  }
})().catch(e => { console.error('Error:', e.message); process.exitCode = 1; });
