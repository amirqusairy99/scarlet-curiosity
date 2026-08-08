const mysql = require('mysql2/promise');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const createTables = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'it_ticketing'}\`;`);
    await connection.query(`USE \`${process.env.DB_NAME || 'it_ticketing'}\`;`);

    // Drop tables for a full reset
    console.log('Dropping existing tables for reset...');
    await connection.query('DROP TABLE IF EXISTS tickets;');
    await connection.query('DROP TABLE IF EXISTS users;');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        department VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
        status ENUM('Open', 'In Progress', 'Resolved') DEFAULT 'Open',
        attachment_path VARCHAR(255) DEFAULT NULL,
        token VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Create default admin user
    const adminUser = 'administrator';
    const adminPass = 'misdashboard9090';
    const hash = await bcrypt.hash(adminPass, 10);

    const [existing] = await connection.query('SELECT * FROM users WHERE username = ?', [adminUser]);
    if (existing.length === 0) {
      await connection.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [adminUser, hash, 'admin']);
      console.log('Default admin user created.');
    } else {
      console.log('Admin user already exists.');
    }

    console.log('Database and tables created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up the database:', error);
    process.exit(1);
  }
};

createTables();
