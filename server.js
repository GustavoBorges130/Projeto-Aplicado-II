// Canjicatech - servidor da aplicação
// Serve a interface (pasta public) e a API REST ligada ao PostgreSQL.
require('dotenv').config();
const path = require('path');
const express = require('express');
const db = require('./src/db');
const { tratarErro } = require('./src/util');
const { produtos, categorias } = require('./src/routes/produtos');
const { creditos, vendas } = require('./src/routes/movimentacoes');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Garante que as tabelas existam antes de qualquer chamada à API
app.use('/api', (req, res, next) => db.inicializar().then(() => next()).catch(next));

app.get('/api/status', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ banco: 'conectado' });
  } catch (e) {
    res.status(503).json({ banco: 'desconectado', erro: e.message });
  }
});

app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/funcionarios', require('./src/routes/funcionarios'));
app.use('/api/produtos', produtos);
app.use('/api/categorias', categorias);
app.use('/api/creditos', creditos);
app.use('/api/vendas', vendas);

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use(tratarErro);

// No Vercel o app é exportado e executado como função; localmente sobe na porta 3000
if (require.main === module && !process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => {
    console.log(`Canjicatech rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
