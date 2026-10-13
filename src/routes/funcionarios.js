// Manter Funcionário - RF05 (somente o gerente altera - RN04)
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ErroNegocio, cpfValido, formatarCpf, emailValido, obrigatorio, rota } = require('../util');
const { exigirGerente } = require('../auth');

const CARGOS = ['GERENTE', 'OPERADOR'];
const CAMPOS = `id_funcionario, nome, cpf, email, login, cargo, ativo, TO_CHAR(data_cadastro, 'YYYY-MM-DD') AS data_cadastro`;

router.get('/', rota(async (req, res) => {
  res.json((await db.query(`SELECT ${CAMPOS} FROM FUNCIONARIO ORDER BY cargo, nome`)).rows);
}));

router.post('/', exigirGerente, rota(async (req, res) => {
  const d = req.body;
  obrigatorio(d, ['nome', 'cpf', 'email', 'login', 'senha', 'cargo']);
  if (!cpfValido(d.cpf)) throw new ErroNegocio('CPF inválido.');
  if (!emailValido(d.email)) throw new ErroNegocio('E-mail inválido.');
  if (!CARGOS.includes(d.cargo)) throw new ErroNegocio('Cargo deve ser GERENTE ou OPERADOR.');
  if (String(d.senha).length < 6) throw new ErroNegocio('A senha deve ter no mínimo 6 caracteres.');
  const { rows } = await db.query(
    `INSERT INTO FUNCIONARIO (nome, cpf, email, login, senha_hash, cargo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${CAMPOS}`,
    [d.nome.trim(), formatarCpf(d.cpf), d.email.trim().toLowerCase(), d.login.trim(), await bcrypt.hash(String(d.senha), 10), d.cargo],
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', exigirGerente, rota(async (req, res) => {
  const d = req.body;
  obrigatorio(d, ['nome', 'email', 'login', 'cargo']);
  if (!emailValido(d.email)) throw new ErroNegocio('E-mail inválido.');
  if (!CARGOS.includes(d.cargo)) throw new ErroNegocio('Cargo deve ser GERENTE ou OPERADOR.');
  const params = [d.nome.trim(), d.email.trim().toLowerCase(), d.login.trim(), d.cargo, req.params.id];
  let senhaSql = '';
  if (d.senha) {
    if (String(d.senha).length < 6) throw new ErroNegocio('A senha deve ter no mínimo 6 caracteres.');
    params.push(await bcrypt.hash(String(d.senha), 10));
    senhaSql = ', senha_hash = $6';
  }
  const { rows } = await db.query(
    `UPDATE FUNCIONARIO SET nome=$1, email=$2, login=$3, cargo=$4${senhaSql} WHERE id_funcionario=$5 RETURNING ${CAMPOS}`, params,
  );
  if (!rows.length) throw new ErroNegocio('Funcionário não encontrado.', 404);
  res.json(rows[0]);
}));

router.patch('/:id/status', exigirGerente, rota(async (req, res) => {
  if (Number(req.params.id) === req.funcionario.id_funcionario && !req.body.ativo) {
    throw new ErroNegocio('Você não pode inativar o seu próprio cadastro.');
  }
  const r = await db.query('UPDATE FUNCIONARIO SET ativo = $1 WHERE id_funcionario = $2', [!!req.body.ativo, req.params.id]);
  if (!r.rowCount) throw new ErroNegocio('Funcionário não encontrado.', 404);
  res.json({ ok: true });
}));

module.exports = router;
