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

// Cria as tabelas automaticamente na primeira execução, quando o banco ainda está vazio
// (ex.: banco recém-criado no Vercel/Neon). Se as tabelas já existem, não faz nada.
let inicializacao = null;
function inicializar() {
  if (!inicializacao) {
    inicializacao = (async () => {
      const client = await pool.connect();
      try {
        await client.query('SELECT pg_advisory_lock(424242)');   // evita duas instâncias criando ao mesmo tempo
        const r = await client.query(`SELECT to_regclass('public.usuario') IS NOT NULL AS existe`);
        if (!r.rows[0].existe) {
          const fs = require('fs');
          const path = require('path');
          const script = fs.readFileSync(path.join(__dirname, '..', 'script_banco.sql'), 'utf8');
          await client.query(script);
          console.log('Banco vazio: tabelas e dados iniciais criados automaticamente.');
        }
      } finally {
        await client.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
        client.release();
      }
    })().catch((err) => {
      inicializacao = null;   // tenta de novo na próxima requisição
      throw err;
    });
  }
  return inicializacao;
}

module.exports = { pool, query: (sql, params) => pool.query(sql, params), transacao, configuracao, inicializar };
