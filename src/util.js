// Funções auxiliares de validação e tratamento de erros

class ErroNegocio extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

// RN07 - validação dos dígitos verificadores do CPF
function cpfValido(cpf) {
  const n = String(cpf || '').replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(n[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(n[t])) return false;
  }
  return true;
}

function formatarCpf(cpf) {
  const n = String(cpf).replace(/\D/g, '');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function obrigatorio(obj, campos) {
  const faltando = campos.filter((c) => obj[c] === undefined || obj[c] === null || String(obj[c]).trim() === '');
  if (faltando.length) throw new ErroNegocio(`Campo(s) obrigatório(s): ${faltando.join(', ')}`);
}

// Envolve rotas async para que qualquer erro chegue ao tratador central
const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Traduz erros do PostgreSQL em mensagens amigáveis
function tratarErro(err, req, res, _next) {
  if (err instanceof ErroNegocio) return res.status(err.status).json({ erro: err.message });

  if (err.code === '23505') {
    const campo = (err.constraint || '').replace(/^\w+?_/, '').replace(/_key$/, '');
    const nomes = { matricula: 'esta matrícula', email: 'este e-mail', cpf: 'este CPF', login: 'este login', nome: 'este nome' };
    return res.status(409).json({ erro: `Já existe um cadastro com ${nomes[campo] || campo}.` });
  }
  if (err.code === '23503') return res.status(409).json({ erro: 'Registro vinculado a outros dados.' });
  if (err.code === '23514') return res.status(400).json({ erro: 'Valor inválido para um dos campos.' });
  if (err.code === 'ECONNREFUSED' || err.code === '3D000' || err.code === '28P01') {
    return res.status(503).json({ erro: 'Não foi possível conectar ao banco de dados. Verifique o PostgreSQL e o arquivo .env.' });
  }

  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
}

module.exports = { ErroNegocio, cpfValido, formatarCpf, emailValido, obrigatorio, rota, tratarErro };
