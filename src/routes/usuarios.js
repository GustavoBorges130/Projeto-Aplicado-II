// Manter Usuário - RF01 (incluir), RF02 (alterar), RF03 (listar), RF04 (inativar/reativar)
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ErroNegocio, cpfValido, formatarCpf, emailValido, obrigatorio, rota } = require('../util');
const { exigirFuncionario, exigirGerente } = require('../auth');

const PERFIS = ['ALUNO', 'COLABORADOR'];
const CAMPOS = `id_usuario, nome, matricula, email, cpf, perfil, saldo, ativo,
                TO_CHAR(data_cadastro, 'YYYY-MM-DD') AS data_cadastro`;

function validarDados(d, { novo }) {
  obrigatorio(d, novo ? ['nome', 'matricula', 'email', 'cpf', 'senha', 'perfil'] : ['nome', 'matricula', 'email', 'perfil']);
  if (!emailValido(d.email)) throw new ErroNegocio('E-mail inválido.');
  if (!PERFIS.includes(d.perfil)) throw new ErroNegocio('Perfil deve ser ALUNO ou COLABORADOR.');
  if (novo && !cpfValido(d.cpf)) throw new ErroNegocio('CPF inválido.');                 // RN07
  if (novo && String(d.senha).length < 6) throw new ErroNegocio('A senha deve ter no mínimo 6 caracteres.');
}

// RF03 - listar com pesquisa por nome, matrícula ou CPF e filtro de status
router.get('/', rota(async (req, res) => {
  const { busca = '', status = 'todos' } = req.query;
  const params = [];
  const where = [];
  if (busca.trim()) {
    params.push(`%${busca.trim().toLowerCase()}%`);
    params.push(`%${busca.replace(/\D/g, '') || '#'}%`);
    where.push(`(LOWER(nome) LIKE $1 OR LOWER(matricula) LIKE $1 OR REPLACE(REPLACE(cpf,'.',''),'-','') LIKE $2)`);
  }
  if (status === 'ativos') where.push('ativo = TRUE');
  if (status === 'inativos') where.push('ativo = FALSE');
  const sql = `SELECT ${CAMPOS} FROM USUARIO ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY nome`;
  res.json((await db.query(sql, params)).rows);
}));

router.get('/:id', rota(async (req, res) => {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM USUARIO WHERE id_usuario = $1`, [req.params.id]);
  if (!rows.length) throw new ErroNegocio('Usuário não encontrado.', 404);
  res.json(rows[0]);
}));

// RF01 - incluir (saldo zero e status ativo)
router.post('/', exigirFuncionario, rota(async (req, res) => {
  const d = req.body;
  validarDados(d, { novo: true });
  const hash = await bcrypt.hash(String(d.senha), 10);                                    // RNF07
  const { rows } = await db.query(
    `INSERT INTO USUARIO (nome, matricula, email, cpf, senha_hash, perfil)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CAMPOS}`,
    [d.nome.trim(), d.matricula.trim(), d.email.trim().toLowerCase(), formatarCpf(d.cpf), hash, d.perfil],
  );
  res.status(201).json(rows[0]);
}));

// RF02 - alterar dados (CPF não pode ser alterado; senha só se informada)
router.put('/:id', exigirFuncionario, rota(async (req, res) => {
  const d = req.body;
  validarDados(d, { novo: false });
  const params = [d.nome.trim(), d.matricula.trim(), d.email.trim().toLowerCase(), d.perfil, req.params.id];
  let senhaSql = '';
  if (d.senha) {
    if (String(d.senha).length < 6) throw new ErroNegocio('A senha deve ter no mínimo 6 caracteres.');
    params.push(await bcrypt.hash(String(d.senha), 10));
    senhaSql = ', senha_hash = $6';
  }
  const { rows } = await db.query(
    `UPDATE USUARIO SET nome = $1, matricula = $2, email = $3, perfil = $4${senhaSql}
     WHERE id_usuario = $5 RETURNING ${CAMPOS}`, params,
  );
  if (!rows.length) throw new ErroNegocio('Usuário não encontrado.', 404);
  res.json(rows[0]);
}));

// RF04 - habilitar/desabilitar (somente gerente - RN04) com histórico (RN05)
router.patch('/:id/status', exigirGerente, rota(async (req, res) => {
  const { ativo, motivo } = req.body;
  if (typeof ativo !== 'boolean') throw new ErroNegocio('Informe o novo status (ativo: true/false).');
  if (!motivo || !String(motivo).trim()) throw new ErroNegocio('Informe o motivo da alteração.');

  const usuario = await db.transacao(async (c) => {
    const atual = await c.query('SELECT ativo FROM USUARIO WHERE id_usuario = $1 FOR UPDATE', [req.params.id]);
    if (!atual.rows.length) throw new ErroNegocio('Usuário não encontrado.', 404);
    if (atual.rows[0].ativo === ativo) throw new ErroNegocio(`O usuário já está ${ativo ? 'ativo' : 'inativo'}.`);
    await c.query(
      `INSERT INTO HISTORICO_STATUS (id_usuario, id_funcionario, status_anterior, status_novo, motivo)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, req.funcionario.id_funcionario, atual.rows[0].ativo, ativo, String(motivo).trim()],
    );
    const r = await c.query(`UPDATE USUARIO SET ativo = $1 WHERE id_usuario = $2 RETURNING ${CAMPOS}`, [ativo, req.params.id]);
    return r.rows[0];
  });
  res.json(usuario);
}));

// Histórico de alterações de status do usuário
router.get('/:id/historico', rota(async (req, res) => {
  const { rows } = await db.query(
    `SELECT h.id_historico, h.status_anterior, h.status_novo, h.motivo,
            TO_CHAR(h.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora, f.nome AS funcionario
       FROM HISTORICO_STATUS h JOIN FUNCIONARIO f ON f.id_funcionario = h.id_funcionario
      WHERE h.id_usuario = $1 ORDER BY h.data_hora DESC, h.id_historico DESC`, [req.params.id],
  );
  res.json(rows);
}));

// Excluir: só é permitido se o usuário não tiver movimentações (RN06); caso contrário, inativar
router.delete('/:id', exigirGerente, rota(async (req, res) => {
  const { rows } = await db.query(
    `SELECT (SELECT COUNT(*) FROM VENDA WHERE id_usuario = $1)
          + (SELECT COUNT(*) FROM CREDITO WHERE id_usuario = $1)
          + (SELECT COUNT(*) FROM HISTORICO_STATUS WHERE id_usuario = $1) AS mov`, [req.params.id],
  );
  if (Number(rows[0].mov) > 0) {
    throw new ErroNegocio('Este usuário possui movimentações e não pode ser excluído. Utilize a inativação (RN06).', 409);
  }
  const r = await db.query('DELETE FROM USUARIO WHERE id_usuario = $1', [req.params.id]);
  if (!r.rowCount) throw new ErroNegocio('Usuário não encontrado.', 404);
  res.status(204).end();
}));

module.exports = router;
