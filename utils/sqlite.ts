import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async () => {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('expensegauge_local.db');
  await initializeDatabase();
  return db;
};

const initializeDatabase = async () => {
  if (!db) return;

  // Create expenses table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT UNIQUE,
      remoteId TEXT,
      details TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('credit', 'debit', 'assign')),
      category TEXT,
      date TEXT NOT NULL,
      sourceId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);

  // Check if existing accounts table has old enum constraints and migrate
  try {
    const tableInfo = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='accounts'"
    );
    if (tableInfo?.sql && (tableInfo.sql.includes('digital_wallet') || tableInfo.sql.includes("'other'"))) {
      await db.execAsync(`
        CREATE TABLE accounts_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          remoteId TEXT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('bank', 'cash', 'wallet', 'credit_card', 'business')),
          balance REAL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        INSERT INTO accounts_migration (id, remoteId, name, type, balance, createdAt, updatedAt, synced)
        SELECT id, remoteId, name,
          CASE
            WHEN type = 'digital_wallet' THEN 'wallet'
            WHEN type = 'other' THEN 'business'
            ELSE type
          END,
          balance, createdAt, updatedAt, synced
        FROM accounts;
        DROP TABLE accounts;
        ALTER TABLE accounts_migration RENAME TO accounts;
      `);
    }
  } catch (err) {
    console.error('Failed to migrate accounts table schema:', err);
  }

  // Create accounts table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remoteId TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bank', 'cash', 'wallet', 'credit_card', 'business')),
      balance REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);

  // Create settings table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert default settings if not exists
  await db.execAsync(`
    INSERT OR IGNORE INTO settings (key, value) 
    VALUES ('onboarding_completed', '0');
  `);
};

export const closeDatabase = async () => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};