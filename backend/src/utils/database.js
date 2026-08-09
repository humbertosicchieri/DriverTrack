const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

let db;

function generateRandomPassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let dbFile;
    try {
      db = new Database(dbPath);
      dbFile = dbPath;
    } catch (err) {
      const fallbackPath = path.join(__dirname, '../../data/database.sqlite');
      console.error('===========================================');
      console.error('ERRO GRAVE: nao foi possivel abrir o banco de dados configurado:');
      console.error(`  ${dbPath}`);
      console.error(`  ${err.message}`);
      console.error('Usando arquivo TEMPORARIO. Os dados serao PERDIDOS no restart.');
      console.error('Verifique se o volume/pasta do banco esta montado no container.');
      console.error('===========================================');
      const fallbackDir = path.dirname(fallbackPath);
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      db = new Database(fallbackPath);
      dbFile = fallbackPath;
    }
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log(`Banco de dados em uso: ${dbFile}`);
  }
  return db;
}

async function initDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS earnings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('uber', '99')),
      date DATE NOT NULL,
      gross_amount REAL NOT NULL,
      trips INTEGER DEFAULT 0,
      bonus REAL DEFAULT 0,
      tips REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      recurring INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_earnings_user_date ON earnings(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
  `);

  // Migration: add active column if missing
  try {
    database.prepare('SELECT active FROM users LIMIT 1').get();
  } catch {
    database.exec("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1");
  }

  // Migration: add 2FA columns if missing
  try {
    database.prepare('SELECT totp_secret FROM users LIMIT 1').get();
  } catch {
    database.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT DEFAULT NULL");
    database.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0");
  }

  // Create default admin user if not exists
  const adminEmail = 'admin@drivertrack.com';
  const existingAdmin = database.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

  if (!existingAdmin) {
    const adminId = uuidv4();
    const adminPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    database.prepare(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)'
    ).run(adminId, 'Administrador', adminEmail, hashedPassword, 'admin');
    console.log('===========================================');
    console.log('USUARIO ADMIN CRIADO - GUARDE ESTA SENHA:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Senha: ${adminPassword}`);
    console.log('===========================================');
  }

  console.log('Banco de dados inicializado com sucesso');
}

module.exports = { getDb, initDatabase };
