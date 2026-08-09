#!/usr/bin/env node
// Remove duplicate expenses created by repeated form submissions.
// Keeps the earliest row of each duplicate group.
//
// Usage:
//   node dedupe.js           # dry-run: lists duplicates, changes nothing
//   node dedupe.js --apply   # actually deletes the duplicates
//
// Uses DB_PATH when set (as in the container); otherwise defaults to
// ../data/database.sqlite relative to this file.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite');
const apply = process.argv.includes('--apply');

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log('DB_PATH (env):', process.env.DB_PATH || '(nao definido)');
console.log('Banco:', path.resolve(dbPath));

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

const expenseGroups = db.prepare(`
  SELECT user_id, date, category, COALESCE(description, '') AS description, amount, recurring, COUNT(*) AS cnt
  FROM expenses
  GROUP BY user_id, date, category, COALESCE(description, ''), amount, recurring
  HAVING cnt > 1
  ORDER BY cnt DESC, date DESC
`).all();

let deleted = 0;

if (expenseGroups.length === 0) {
  console.log('Nenhuma despesa duplicada encontrada.');
} else {
  console.log(`Encontrados ${expenseGroups.length} grupo(s) de despesas duplicadas:`);
  const deleteStmt = db.prepare('DELETE FROM expenses WHERE id = ?');

  const processGroups = db.transaction(() => {
    for (const g of expenseGroups) {
      const rows = db.prepare(`
        SELECT id, created_at
        FROM expenses
        WHERE user_id = ? AND date = ? AND category = ?
          AND COALESCE(description, '') = ? AND amount = ? AND recurring = ?
        ORDER BY created_at ASC, id ASC
      `).all(g.user_id, g.date, g.category, g.description, g.amount, g.recurring);

      const keep = rows[0];
      const duplicates = rows.slice(1);

      console.log(`- ${g.cnt}x | ${g.date} | ${g.category} | ${g.description || '-'} | R$ ${g.amount}`);
      console.log(`    manter:   ${keep.id} (${keep.created_at})`);
      for (const d of duplicates) {
        console.log(`    deletar:  ${d.id} (${d.created_at})`);
        if (apply) deleteStmt.run(d.id);
      }
      deleted += duplicates.length;
    }
  });

  processGroups();

  if (apply) {
    console.log(`\n${deleted} despesa(s) duplicada(s) removida(s).`);
  } else {
    console.log(`\n${deleted} despesa(s) duplicada(s) encontrada(s). (dry-run: nada alterado. Rode com --apply para remover.)`);
  }
}

const earningGroups = db.prepare(`
  SELECT user_id, platform, date, gross_amount, trips, bonus, tips, notes, COUNT(*) AS cnt
  FROM earnings
  GROUP BY user_id, platform, date, gross_amount, trips, bonus, tips, notes
  HAVING cnt > 1
  ORDER BY cnt DESC, date DESC
`).all();

if (earningGroups.length > 0) {
  console.log(`\nATENCAO: ${earningGroups.length} grupo(s) de ganhos duplicados detectados. NAO foram removidos automaticamente (podem ser registros legitimos do mesmo dia):`);
  for (const g of earningGroups) {
    console.log(`- ${g.cnt}x | ${g.platform} | ${g.date} | bruto=${g.gross_amount} | trips=${g.trips} | bonus=${g.bonus} | tips=${g.tips} | notas="${g.notes || ''}"`);
  }
}

db.close();
