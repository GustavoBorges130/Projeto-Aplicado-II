// Conexão com o PostgreSQL (RNF03)
//
// Duas formas de configurar:
//  - Na nuvem (Vercel + Neon): variável DATABASE_URL, criada automaticamente
//    ao conectar o banco ao projeto no painel do Vercel. Usa SSL.
//  - Na máquina local: variáveis PGHOST, PGPORT, PGDATABASE, PGUSER e PGPASSWORD do .env.
const pg = require('pg');

// O PostgreSQL devolve DECIMAL como texto; converte para número no JavaScript
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

function configuracao({ database } = {}) {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const cfg = { connectionString: url, ssl: local ? false : { rejectUnauthorized: false } };
    if (database) {
      const u = new URL(url);
      u.pathname = `/${database}`;
      cfg.connectionString = u.toString();
    }
    return cfg;
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: database || process.env.PGDATABASE || 'canjicatech',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  };
}

// Poucas conexões por instância: no Vercel cada função abre o seu próprio pool
const pool = new pg.Pool({ ...configuracao(), max: process.env.VERCEL ? 3 : 10 });

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

module.exports = { pool, query: (sql, params) => pool.query(sql, params), transacao, configuracao };
