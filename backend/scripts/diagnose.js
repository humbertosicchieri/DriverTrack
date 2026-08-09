#!/usr/bin/env node
// Diagnose why the dashboard shows stale/zero data.
// Prints DB contents, the exact monthly total the dashboard computes,
// and any duplicate expense groups.
//
// Usage:
//   node diagnose.js
// Uses DB_PATH when set (as in the container); otherwise defaults to
// ../data/database.sqlite relative to this file.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log('DB_PATH (env):', process.env.DB_PATH || '(nao definido)');
console.log('Banco:', path.resolve(dbPath));

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('Agora (servidor local):', new Date().toString());
console.log('Agora (UTC):', new Date().toISOString());

const now = new Date();
const d = new Date(now);
d.setDate(1);
d.setHours(0, 0, 0, 0);
const monthStart = d.toISOString().split('T')[0];
console.log('Limite do periodo "month":', monthStart);
console.log('=> despesas com date < ' + monthStart + ' NAO aparecem no card do mes');

const users = db.prepare('SELECT id, email FROM users ORDER BY email').all();
for (const u of users) {
  const nExp = db.prepare('SELECT COUNT(*) c FROM expenses WHERE user_id = ?').get(u.id).c;
  const nEarn = db.prepare('SELECT COUNT(*) c FROM earnings WHERE user_id = ?').get(u.id).c;
  const monthTotal = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) t FROM expenses WHERE user_id = ? AND date >= ?'
  ).get(u.id, monthStart).t;
  console.log(`\nUsuario: ${u.email} (${u.id})`);
  console.log(`  despesas: ${nExp} | ganhos: ${nEarn}`);
  console.log(`  total despesas no mes (igual ao card): R$ ${Number(monthTotal).toFixed(2)}`);
}

console.log('\nUltimas 10 despesas (todas, sem filtro de data):');
const rows = db.prepare(`
  SELECT e.date, e.category, e.amount, e.description, e.created_at, u.email
  FROM expenses e JOIN users u ON u.id = e.user_id
  ORDER BY e.created_at DESC LIMIT 10
`).all();
for (const r of rows) {
  console.log(`  ${r.date} | ${r.category} | R$ ${r.amount} | ${r.description || '-'} | criada em ${r.created_at} | ${r.email}`);
}

console.log('\nDespesas por mes:');
const byMonth = db.prepare(`
  SELECT strftime('%Y-%m', date) m, COUNT(*) c, SUM(amount) t
  FROM expenses GROUP BY m ORDER BY m DESC LIMIT 6
`).all();
for (const r of byMonth) {
  console.log(`  ${r.m}: ${r.c} registro(s), R$ ${Number(r.t).toFixed(2)}`);
}

console.log('\nGrupos duplicados de despesa (data|categoria|valor|descricao):');
const dups = db.prepare(`
  SELECT date, category, amount, COALESCE(description, '') d, COUNT(*) c
  FROM expenses
  GROUP BY date, category, amount, COALESCE(description, '')
  HAVING c > 1
  ORDER BY c DESC LIMIT 10
`).all();
if (dups.length === 0) {
  console.log('  nenhum duplicado no banco.');
} else {
  for (const r of dups) {
    console.log(`  ${r.c}x | ${r.date} | ${r.category} | R$ ${r.amount} | ${r.d || '-'}`);
  }
}

db.close();
