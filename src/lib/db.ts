import mysql, { Pool } from 'mysql2/promise';

let pool: Pool;

declare global {
  // eslint-disable-next-line no-var
  var dbPoolV2: Pool | undefined;
}

if (process.env.NODE_ENV === 'production') {
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'bulk_mailer',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
  });
} else {
  if (!globalThis.dbPoolV2) {
    globalThis.dbPoolV2 = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'bulk_mailer',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: 'Z',
    });
  }
  pool = globalThis.dbPoolV2;
}

export default pool;
