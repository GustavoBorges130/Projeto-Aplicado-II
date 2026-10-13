// Identifica o funcionário que está operando o sistema.
// Nesta etapa (Projeto Aplicado II) o funcionário é escolhido na tela e enviado
// no cabeçalho "X-Funcionario-Id". O login com senha (RF06) entra na próxima etapa.
const db = require('./db');
const { ErroNegocio } = require('./util');

async function carregar(req) {
  const id = Number(req.get('X-Funcionario-Id'));
  if (!id) throw new ErroNegocio('Selecione o funcionário responsável pela operação.', 401);
  const { rows } = await db.query(
    'SELECT id_funcionario, nome, cargo, ativo FROM FUNCIONARIO WHERE id_funcionario = $1', [id],
  );
  if (!rows.length || !rows[0].ativo) throw new ErroNegocio('Funcionário inválido ou inativo (RN01).', 401);
  req.funcionario = rows[0];
}

const exigirFuncionario = (req, res, next) => carregar(req).then(() => next()).catch(next);

const exigirGerente = (req, res, next) =>
  carregar(req)
    .then(() => {
      if (req.funcionario.cargo !== 'GERENTE') throw new ErroNegocio('Operação permitida somente para o gerente (RN04).', 403);
      next();
    })
    .catch(next);

module.exports = { exigirFuncionario, exigirGerente };
