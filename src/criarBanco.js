// Cria as tabelas e os dados iniciais executando o script_banco.sql.
// Uso: npm run db:criar
//
//  - Com DATABASE_URL (ex.: banco Neon do Vercel): executa o script direto
//    no banco informado na URL (o banco já existe na nuvem).
//  - Sem DATABASE_URL (PostgreSQL local): cria o banco "canjicatech" se ainda
//    não existir e depois executa o script.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { configuracao } = require('./db');

const script = fs.readFileSync(path.join(__dirname, '..', 'script_banco.sql'), 'utf8');
const nuvem = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

(async () => {
  if (!nuvem) {
    const banco = process.env.PGDATABASE || 'canjicatech';
    const admin = new Client(configuracao({ database: 'postgres' }));
    await admin.connect();
    const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [banco]);
    if (!existe.rowCount) {
      await admin.query(`CREATE DATABASE "${banco.replace(/"/g, '')}"`);
      console.log(`Banco "${banco}" criado.`);
    }
    await admin.end();
  }

  const cli = new Client(configuracao());
  await cli.connect();
  await cli.query(script);
  await cli.end();
  console.log('Tabelas criadas e dados iniciais inseridos com sucesso.');
})().catch((e) => {
  console.error('Erro ao criar o banco:', e.message);
  process.exit(1);
});
