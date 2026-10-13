// Conexão com o PostgreSQL (RNF03). As configurações vêm do arquivo .env
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'canjicatech',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

// O PostgreSQL devolve DECIMAL como texto; converte para número no JavaScript
require('pg').types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

// Executa várias operações numa única transação (tudo ou nada)
async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (sql, params) => pool.query(sql, params), transacao };
