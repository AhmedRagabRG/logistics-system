#!/usr/bin/env node
/**
 * Database Push Script
 *
 * Reads a SQL file and executes it against the MySQL database.
 * Usage:
 *   npm run db:push              # Runs database.sql
 *   npm run db:seed              # Runs seed.sql
 *   npx tsx scripts/db-push.ts  # Default: database.sql
 *   npx tsx scripts/db-push.ts path/to/file.sql
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const DEFAULT_SQL_FILE = 'database.sql';
const sqlFile = process.argv[2] || DEFAULT_SQL_FILE;
const sqlPath = path.resolve(process.cwd(), sqlFile);

if (!fs.existsSync(sqlPath)) {
  console.error(`\x1b[31mError: SQL file not found: ${sqlPath}\x1b[0m`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('\x1b[31mError: DATABASE_URL environment variable is not set.\x1b[0m');
  console.error('Make sure you have a .env file with DATABASE_URL defined.');
  process.exit(1);
}

async function pushDb() {
  console.log(`\x1b[36m📦 DB Push: ${sqlFile}\x1b[0m`);
  console.log(`   File: ${sqlPath}`);
  console.log(`   Database: ${databaseUrl!.replace(/\/\/.+@/, '//***@')}\n`);

  let connection: mysql.Connection | null = null;

  try {
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`   Statements: ${statements.length}\n`);

    connection = await mysql.createConnection({
      uri: databaseUrl!,
      multipleStatements: true,
    });

    // Execute the entire SQL file as a single multi-statement query
    // This preserves comments and complex statements better than splitting
    console.log('\x1b[33m   Executing SQL...\x1b[0m');
    await connection.query(sql);

    console.log('\x1b[32m\n✅ Database push completed successfully.\x1b[0m\n');
  } catch (error: any) {
    console.error('\x1b[31m\n❌ Database push failed:\x1b[0m');
    console.error(`   ${error.message}`);
    if (error.sql) {
      console.error(`   SQL: ${error.sql.substring(0, 200)}...`);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

pushDb();
