// Manter Produto (RF07) e Manter Categoria (RF08)
const express = require('express');
const db = require('../db');
const { ErroNegocio, obrigatorio, rota } = require('../util');
const { exigirFuncionario } = require('../auth');

// ------------------------------- PRODUTOS -------------------------------
const produtos = express.Router();
const CAMPOS_P = `p.id_produto, p.id_categoria, c.nome AS categoria, p.nome, p.preco_venda, p.imagem, p.ativo,
                  TO_CHAR(p.data_cadastro, 'YYYY-MM-DD') AS data_cadastro`;

function validarProduto(d) {
  obrigatorio(d, ['nome', 'id_categoria', 'preco_venda']);
  const preco = Number(d.preco_venda);
  if (!(preco > 0)) throw new ErroNegocio('O preço de venda deve ser maior que zero.');
  return preco;
}

// ?catalogo=1 traz apenas produtos e categorias ativos (RN09)
produtos.get('/', rota(async (req, res) => {
  const where = req.query.catalogo ? 'WHERE p.ativo AND c.ativo' : '';
  const { rows } = await db.query(
    `SELECT ${CAMPOS_P} FROM PRODUTO p JOIN CATEGORIA c ON c.id_categoria = p.id_categoria ${where}
     ORDER BY c.nome, p.nome`,
  );
  res.json(rows);
}));

produtos.post('/', exigirFuncionario, rota(async (req, res) => {
  const d = req.body;
  const preco = validarProduto(d);
  const { rows } = await db.query(
    `INSERT INTO PRODUTO (id_categoria, nome, preco_venda, imagem) VALUES ($1, $2, $3, $4) RETURNING id_produto`,
    [d.id_categoria, d.nome.trim(), preco, (d.imagem || '').trim() || null],
  );
  res.status(201).json(rows[0]);
}));

produtos.put('/:id', exigirFuncionario, rota(async (req, res) => {
  const d = req.body;
  const preco = validarProduto(d);
  const r = await db.query(
    `UPDATE PRODUTO SET id_categoria = $1, nome = $2, preco_venda = $3, imagem = $4 WHERE id_produto = $5`,
    [d.id_categoria, d.nome.trim(), preco, (d.imagem || '').trim() || null, req.params.id],
  );
  if (!r.rowCount) throw new ErroNegocio('Produto não encontrado.', 404);
  res.json({ ok: true });
}));

produtos.patch('/:id/status', exigirFuncionario, rota(async (req, res) => {
  const r = await db.query('UPDATE PRODUTO SET ativo = $1 WHERE id_produto = $2', [!!req.body.ativo, req.params.id]);
  if (!r.rowCount) throw new ErroNegocio('Produto não encontrado.', 404);
  res.json({ ok: true });
}));

// Excluir somente se nunca foi vendido (RN06)
produtos.delete('/:id', exigirFuncionario, rota(async (req, res) => {
  const v = await db.query('SELECT 1 FROM ITEM_VENDA WHERE id_produto = $1 LIMIT 1', [req.params.id]);
  if (v.rowCount) throw new ErroNegocio('Este produto já foi vendido e não pode ser excluído. Utilize a inativação (RN06).', 409);
  const r = await db.query('DELETE FROM PRODUTO WHERE id_produto = $1', [req.params.id]);
  if (!r.rowCount) throw new ErroNegocio('Produto não encontrado.', 404);
  res.status(204).end();
}));

// ------------------------------ CATEGORIAS ------------------------------
const categorias = express.Router();

categorias.get('/', rota(async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id_categoria, c.nome, c.ativo, COUNT(p.id_produto)::int AS produtos
       FROM CATEGORIA c LEFT JOIN PRODUTO p ON p.id_categoria = c.id_categoria
      GROUP BY c.id_categoria ORDER BY c.nome`,
  );
  res.json(rows);
}));

categorias.post('/', exigirFuncionario, rota(async (req, res) => {
  obrigatorio(req.body, ['nome']);
  const { rows } = await db.query('INSERT INTO CATEGORIA (nome) VALUES ($1) RETURNING *', [req.body.nome.trim()]);
  res.status(201).json(rows[0]);
}));

categorias.put('/:id', exigirFuncionario, rota(async (req, res) => {
  obrigatorio(req.body, ['nome']);
  const r = await db.query('UPDATE CATEGORIA SET nome = $1 WHERE id_categoria = $2', [req.body.nome.trim(), req.params.id]);
  if (!r.rowCount) throw new ErroNegocio('Categoria não encontrada.', 404);
  res.json({ ok: true });
}));

categorias.patch('/:id/status', exigirFuncionario, rota(async (req, res) => {
  const r = await db.query('UPDATE CATEGORIA SET ativo = $1 WHERE id_categoria = $2', [!!req.body.ativo, req.params.id]);
  if (!r.rowCount) throw new ErroNegocio('Categoria não encontrada.', 404);
  res.json({ ok: true });
}));

module.exports = { produtos, categorias };
