import mysql from 'mysql2/promise';

async function runMigrations() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 2,
  });

  // Check if use_custom_margin exists
  const [columns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendors' AND COLUMN_NAME = 'use_custom_margin'`
  );
  if ((columns as any[]).length === 0) {
    await pool.execute(`ALTER TABLE vendors ADD COLUMN use_custom_margin BOOLEAN NOT NULL DEFAULT FALSE AFTER priority_ranking`);
    console.log('✅ Added use_custom_margin to vendors');
  } else {
    console.log('⏭️  use_custom_margin already exists');
  }

  // Check if customer_messaging_windows exists
  const [tables] = await pool.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_messaging_windows'`
  );
  if ((tables as any[]).length === 0) {
    await pool.execute(`CREATE TABLE customer_messaging_windows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact_id VARCHAR(128) NOT NULL,
      channel VARCHAR(32) NOT NULL,
      last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_contact_channel (contact_id, channel),
      INDEX idx_channel (channel),
      INDEX idx_last_message (last_message_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('✅ Created customer_messaging_windows table');
  } else {
    console.log('⏭️  customer_messaging_windows already exists');
  }

  // Check if authorized_person_name exists
  const [authPersonCols] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendors' AND COLUMN_NAME = 'authorized_person_name'`
  );
  if ((authPersonCols as any[]).length === 0) {
    await pool.execute(`ALTER TABLE vendors ADD COLUMN authorized_person_name VARCHAR(128) AFTER city`);
    console.log('✅ Added authorized_person_name to vendors');
  } else {
    console.log('⏭️  authorized_person_name already exists');
  }

  await pool.end();
  console.log('All migrations completed.');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
