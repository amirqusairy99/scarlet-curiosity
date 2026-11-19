const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const newPassword = process.argv[2] || 'amir';

(async () => {
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'it_ticketing'
    });

    const [result] = await conn.query('UPDATE users SET password = ? WHERE username = ?', [hash, 'administrator']);
    if (result.affectedRows > 0) {
      console.log(`Password for administrator successfully updated to: ${newPassword}`);
    } else {
      console.log('Administrator user not found. Creating user...');
      await conn.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['administrator', hash, 'admin']);
      console.log(`Administrator user created with password: ${newPassword}`);
    }
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Error updating password:', err);
    process.exit(1);
  }
})();
