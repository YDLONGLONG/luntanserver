const pool = require('../src/config/db');

async function migrate() {
  try {
    // 检查字段是否已存在
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
      AND TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME IN ('security_question', 'security_answer')
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);

    if (!existingColumns.includes('security_question')) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN security_question VARCHAR(255) DEFAULT ''
      `);
      console.log('✓ Added security_question column');
    } else {
      console.log('✓ security_question column already exists');
    }

    if (!existingColumns.includes('security_answer')) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN security_answer VARCHAR(255) DEFAULT ''
      `);
      console.log('✓ Added security_answer column');
    } else {
      console.log('✓ security_answer column already exists');
    }

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
