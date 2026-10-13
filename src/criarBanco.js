// Cria o banco "canjicatech" (se não existir) e executa o script_banco.sql.
// Uso: npm run db:criar
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const config = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};
const banco = process.env.PGDATABASE || 'canjicatech';

(async () => {
  const admin = new Client({ ...config, database: 'postgres' });
  await admin.connect();
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [banco]);
  if (!existe.rowCount) {
    await admin.query(`CREATE DATABASE "${banco}"`);
    console.log(`Banco "${banco}" criado.`);
  }
  await admin.end();

  const cli = new Client({ ...config, database: banco });
  await cli.connect();
  await cli.query(fs.readFileSync(path.join(__dirname, '..', 'script_banco.sql'), 'utf8'));
  await cli.end();
  console.log('Tabelas criadas e dados iniciais inseridos com sucesso.');
})().catch((e) => {
  console.error('Erro ao criar o banco:', e.message);
  process.exit(1);
});
