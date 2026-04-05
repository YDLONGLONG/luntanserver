const mysql = require('mysql2/promise');
require('dotenv').config();

const useSSL = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
