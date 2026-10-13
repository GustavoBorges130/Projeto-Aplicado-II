// Créditos (RF09, RF10, RF11) e Compras (RF12)
const express = require('express');
const db = require('../db');
const { ErroNegocio, rota } = require('../util');
const { exigirFuncionario } = require('../auth');

const FORMAS_CREDITO = ['DINHEIRO', 'PIX', 'CARTAO'];

// -------------------------------- CRÉDITOS --------------------------------
const creditos = express.Router();

// RF09 - adicionar crédito (somente funcionário - RN03)
creditos.post('/', exigirFuncionario, rota(async (req, res) => {
  const { id_usuario, forma_pagamento, observacao } = req.body;
  const valor = Math.round(Number(req.body.valor) * 100) / 100;
  if (!id_usuario) throw new ErroNegocio('Informe o usuário.');
  if (!(valor > 0)) throw new ErroNegocio('O valor do crédito deve ser maior que zero.');
  if (!FORMAS_CREDITO.includes(forma_pagamento)) throw new ErroNegocio('Forma de pagamento inválida.');

  const resultado = await db.transacao(async (c) => {
    const u = await c.query('SELECT ativo FROM USUARIO WHERE id_usuario = $1 FOR UPDATE', [id_usuario]);
    if (!u.rows.length) throw new ErroNegocio('Usuário não encontrado.', 404);
    if (!u.rows[0].ativo) throw new ErroNegocio('Usuário inativo não pode receber créditos (RN01).');
    await c.query(
      `INSERT INTO CREDITO (id_usuario, id_funcionario, tipo, valor, forma_pagamento, observacao)
       VALUES ($1, $2, 'CREDITO', $3, $4, $5)`,
      [id_usuario, req.funcionario.id_funcionario, valor, forma_pagamento, (observacao || '').trim() || null],
    );
    const r = await c.query('UPDATE USUARIO SET saldo = saldo + $1 WHERE id_usuario = $2 RETURNING saldo', [valor, id_usuario]);
    return r.rows[0];
  });
  res.status(201).json(resultado);
}));

// RF10 - estornar um crédito lançado incorretamente
creditos.post('/:id/estorno', exigirFuncionario, rota(async (req, res) => {
  const motivo = String(req.body.motivo || '').trim();
  if (!motivo) throw new ErroNegocio('Informe o motivo do estorno.');

  const resultado = await db.transacao(async (c) => {
    const cr = await c.query(`SELECT * FROM CREDITO WHERE id_credito = $1 AND tipo = 'CREDITO'`, [req.params.id]);
    if (!cr.rows.length) throw new ErroNegocio('Crédito não encontrado.', 404);
    const credito = cr.rows[0];
    const ja = await c.query(
      `SELECT 1 FROM CREDITO WHERE tipo = 'ESTORNO' AND observacao LIKE $1`, [`Estorno do crédito #${credito.id_credito}:%`],
    );
    if (ja.rowCount) throw new ErroNegocio('Este crédito já foi estornado.');
    const u = await c.query('SELECT saldo FROM USUARIO WHERE id_usuario = $1 FOR UPDATE', [credito.id_usuario]);
    if (u.rows[0].saldo < credito.valor) {
      throw new ErroNegocio('Saldo do usuário insuficiente para o estorno; o saldo não pode ficar negativo (RN02).');
    }
    await c.query(
      `INSERT INTO CREDITO (id_usuario, id_funcionario, tipo, valor, forma_pagamento, observacao)
       VALUES ($1, $2, 'ESTORNO', $3, $4, $5)`,
      [credito.id_usuario, req.funcionario.id_funcionario, credito.valor, credito.forma_pagamento,
        `Estorno do crédito #${credito.id_credito}: ${motivo}`.slice(0, 200)],
    );
    const r = await c.query('UPDATE USUARIO SET saldo = saldo - $1 WHERE id_usuario = $2 RETURNING saldo', [credito.valor, credito.id_usuario]);
    return r.rows[0];
  });
  res.json(resultado);
}));

// RF11 - extrato do usuário (créditos, estornos e compras) com filtro de período
creditos.get('/extrato/:idUsuario', rota(async (req, res) => {
  const { de, ate } = req.query;
  const params = [req.params.idUsuario, de || '1900-01-01', ate || '2999-12-31'];
  const { rows } = await db.query(
    `SELECT * FROM (
        SELECT 'CREDITO' AS origem, c.id_credito AS id, c.tipo, c.valor, c.forma_pagamento,
               c.observacao AS descricao, c.data_hora, f.nome AS funcionario,
               EXISTS (SELECT 1 FROM CREDITO e WHERE e.tipo = 'ESTORNO'
                        AND e.observacao LIKE 'Estorno do crédito #' || c.id_credito || ':%') AS estornado
          FROM CREDITO c JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario
         WHERE c.id_usuario = $1
        UNION ALL
        SELECT 'VENDA', v.id_venda, 'COMPRA', v.valor_total, v.forma_pagamento,
               (SELECT STRING_AGG(i.quantidade || 'x ' || p.nome, ', ') FROM ITEM_VENDA i
                  JOIN PRODUTO p ON p.id_produto = i.id_produto WHERE i.id_venda = v.id_venda),
               v.data_hora, NULL, FALSE
          FROM VENDA v WHERE v.id_usuario = $1
     ) t
     WHERE t.data_hora::date BETWEEN $2 AND $3
     ORDER BY t.data_hora DESC`, params,
  );
  res.json(rows.map((r) => ({ ...r, data_hora: new Date(r.data_hora).toLocaleString('pt-BR') })));
}));

// --------------------------------- VENDAS ---------------------------------
const vendas = express.Router();

// RF12 - registrar compra de um ou mais produtos
vendas.post('/', rota(async (req, res) => {
  const { id_usuario, itens, forma_pagamento = 'SALDO' } = req.body;
  if (!id_usuario) throw new ErroNegocio('Selecione o usuário que está comprando.');
  if (!Array.isArray(itens) || !itens.length) throw new ErroNegocio('O carrinho está vazio.');
  if (!['SALDO', 'PIX'].includes(forma_pagamento)) throw new ErroNegocio('Forma de pagamento inválida.');

  const venda = await db.transacao(async (c) => {
    const u = await c.query('SELECT ativo, saldo FROM USUARIO WHERE id_usuario = $1 FOR UPDATE', [id_usuario]);
    if (!u.rows.length) throw new ErroNegocio('Usuário não encontrado.', 404);
    if (!u.rows[0].ativo) throw new ErroNegocio('Usuário inativo não pode realizar compras (RN01).');

    // RN08 - o preço vem do banco (preço vigente), nunca da tela
    const linhas = [];
    let total = 0;
    for (const it of itens) {
      const qtd = parseInt(it.quantidade, 10);
      if (!(qtd > 0)) throw new ErroNegocio('Quantidade inválida.');
      const p = await c.query(
        `SELECT p.id_produto, p.nome, p.preco_venda FROM PRODUTO p JOIN CATEGORIA c ON c.id_categoria = p.id_categoria
          WHERE p.id_produto = $1 AND p.ativo AND c.ativo`, [it.id_produto],
      );
      if (!p.rows.length) throw new ErroNegocio('Um dos produtos não está mais disponível (RN09).');
      const subtotal = Math.round(p.rows[0].preco_venda * qtd * 100) / 100;
      total += subtotal;
      linhas.push({ id_produto: p.rows[0].id_produto, qtd, preco: p.rows[0].preco_venda, subtotal });
    }
    total = Math.round(total * 100) / 100;

    if (forma_pagamento === 'SALDO' && u.rows[0].saldo < total) {                       // RN02
      const falta = (total - u.rows[0].saldo).toFixed(2).replace('.', ',');
      throw new ErroNegocio(`Saldo insuficiente. Faltam R$ ${falta} para concluir a compra.`);
    }

    const v = await c.query(
      `INSERT INTO VENDA (id_usuario, valor_total, valor_pago, forma_pagamento)
       VALUES ($1, $2, $2, $3) RETURNING id_venda`, [id_usuario, total, forma_pagamento],
    );
    for (const l of linhas) {
      await c.query(
        `INSERT INTO ITEM_VENDA (id_venda, id_produto, quantidade, preco_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
        [v.rows[0].id_venda, l.id_produto, l.qtd, l.preco, l.subtotal],
      );
    }
    let saldo = u.rows[0].saldo;
    if (forma_pagamento === 'SALDO') {
      saldo = (await c.query('UPDATE USUARIO SET saldo = saldo - $1 WHERE id_usuario = $2 RETURNING saldo', [total, id_usuario])).rows[0].saldo;
    }
    return { id_venda: v.rows[0].id_venda, valor_total: total, saldo };
  });
  res.status(201).json(venda);
}));

module.exports = { creditos, vendas };
