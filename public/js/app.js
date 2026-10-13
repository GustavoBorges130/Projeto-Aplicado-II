// =====================================================================
//  Canjicatech - interface ligada à API (banco PostgreSQL)
// =====================================================================

// ------------------------------ Utilitários ------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciais = (nome) => String(nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '--';
const ehUrl = (s) => /^(https?:)?\/\//.test(String(s || '')) || String(s || '').startsWith('/');

const estado = {
  funcionarios: [],
  usuarios: [],          // lista da aba Usuários (com filtro)
  clientes: [],          // todos os usuários (para os seletores)
  produtos: [],
  categorias: [],
  carrinho: [],
  extratoUsuario: null,
};

// Funcionário responsável pelas operações (guardado no navegador)
const idFuncionario = () => $('#sel-funcionario').value;
const idCliente = () => $('#sel-cliente').value;

async function api(caminho, { method = 'GET', body } = {}) {
  const resp = await fetch(`/api${caminho}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Funcionario-Id': idFuncionario() || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || `Erro ${resp.status}`);
  return dados;
}

function toast(msg, tipo = 'ok') {
  const cores = tipo === 'erro' ? 'bg-red-600' : 'bg-emerald-600';
  const el = document.createElement('div');
  el.className = `${cores} text-white text-sm px-4 py-3 rounded-lg shadow-lg transition-opacity duration-300`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ------------------------------ Modais ------------------------------
function abrirModal(id) {
  $$('.modal').forEach((m) => m.classList.add('hidden'));
  $('#modal-backdrop').classList.remove('hidden');
  const m = $(`#${id}`);
  m.classList.remove('hidden');
  const erro = $('.erro-form', m);
  if (erro) erro.classList.add('hidden');
  setTimeout(() => $('input:not([type=hidden]):not(:disabled), textarea, select', m)?.focus(), 50);
}
function fecharModais() {
  $$('.modal').forEach((m) => m.classList.add('hidden'));
  $('#modal-backdrop').classList.add('hidden');
}
function erroNoForm(form, msg) {
  const el = $('.erro-form', form);
  el.textContent = msg;
  el.classList.remove('hidden');
}
const dadosForm = (form) => Object.fromEntries(new FormData(form).entries());

document.addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) fecharModais(); });
$('#modal-backdrop').addEventListener('click', fecharModais);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModais(); });

// Máscara de CPF
document.addEventListener('input', (e) => {
  if (!e.target.classList.contains('input-cpf')) return;
  const n = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
});

// Envia o formulário desabilitando o botão para evitar clique duplo
async function enviar(form, acao) {
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  try {
    await acao();
  } catch (err) {
    erroNoForm(form, err.message);
  } finally {
    btn.disabled = false;
  }
}

// ------------------------------ Abas ------------------------------
$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab-content').forEach((t) => t.classList.replace('block', 'hidden'));
    $$('.tab-btn').forEach((b) => {
      b.classList.remove('bg-emerald-600', 'text-white');
      b.classList.add('bg-transparent', 'text-slate-500', 'hover:bg-slate-100');
    });
    $(`#${btn.dataset.target}`).classList.replace('hidden', 'block');
    btn.classList.remove('bg-transparent', 'text-slate-500', 'hover:bg-slate-100');
    btn.classList.add('bg-emerald-600', 'text-white');
  });
});

// ======================== CABEÇALHO (funcionário / cliente) ========================
async function carregarFuncionarios() {
  estado.funcionarios = await api('/funcionarios');
  const sel = $('#sel-funcionario');
  const salvo = localStorageGet('funcionario') || sel.value;
  sel.innerHTML = estado.funcionarios.filter((f) => f.ativo)
    .map((f) => `<option value="${f.id_funcionario}">${esc(f.nome)} (${f.cargo === 'GERENTE' ? 'Gerente' : 'Operador'})</option>`).join('');
  if ([...sel.options].some((o) => o.value === salvo)) sel.value = salvo;
  renderFuncionarios();
}
$('#sel-funcionario').addEventListener('change', (e) => localStorageSet('funcionario', e.target.value));

async function carregarClientes() {
  estado.clientes = await api('/usuarios');
  const sel = $('#sel-cliente');
  const atual = sel.value || localStorageGet('cliente');
  const ativos = estado.clientes.filter((u) => u.ativo);
  sel.innerHTML = ativos.length
    ? ativos.map((u) => `<option value="${u.id_usuario}">${esc(u.nome)}</option>`).join('')
    : '<option value="">Nenhum usuário ativo</option>';
  if ([...sel.options].some((o) => o.value === atual)) sel.value = atual;
  atualizarCabecalho();
}
$('#sel-cliente').addEventListener('change', (e) => { localStorageSet('cliente', e.target.value); atualizarCabecalho(); });

function atualizarCabecalho() {
  const u = estado.clientes.find((c) => String(c.id_usuario) === idCliente());
  $('#user-balance').textContent = `Saldo: ${moeda(u?.saldo)}`;
  $('#avatar').textContent = iniciais(u?.nome);
  $('#avatar').title = u?.nome || '';
  atualizarCarrinho();
}

function localStorageGet(k) { try { return localStorage.getItem(`canjicatech.${k}`); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(`canjicatech.${k}`, v); } catch { /* sem armazenamento */ } }

// ============================= CATÁLOGO / CARRINHO =============================
function imagemProduto(p, tamanho = 'text-3xl') {
  if (ehUrl(p.imagem)) return `<img src="${esc(p.imagem)}" alt="" class="w-full h-full object-cover rounded-full">`;
  return `<span class="${tamanho}">${esc(p.imagem || '🛒')}</span>`;
}

function renderCatalogo() {
  const disponiveis = estado.produtos.filter((p) => p.ativo && estado.categorias.find((c) => c.id_categoria === p.id_categoria)?.ativo);
  $('#catalogo').innerHTML = disponiveis.length ? disponiveis.map((p) => `
    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:border-emerald-200 transition-colors">
      <div class="w-16 h-16 bg-slate-50 rounded-full mb-3 flex items-center justify-center overflow-hidden">${imagemProduto(p)}</div>
      <h3 class="font-semibold text-slate-800 text-sm mb-0.5">${esc(p.nome)}</h3>
      <p class="text-slate-400 text-xs mb-1">${esc(p.categoria)}</p>
      <p class="text-emerald-600 font-bold mb-3 text-sm">${moeda(p.preco_venda)}</p>
      <button type="button" data-add="${p.id_produto}" class="w-full mt-auto bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-semibold py-2 rounded-full text-xs transition-all">+ Adicionar</button>
    </div>`).join('')
    : '<p class="col-span-full text-slate-400 text-sm">Nenhum produto disponível. Cadastre produtos na aba Gestão de Produtos.</p>';
}

$('#catalogo').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const p = estado.produtos.find((x) => x.id_produto === Number(btn.dataset.add));
  const item = estado.carrinho.find((i) => i.id_produto === p.id_produto);
  if (item) item.quantidade += 1;
  else estado.carrinho.push({ id_produto: p.id_produto, nome: p.nome, preco: p.preco_venda, quantidade: 1 });
  atualizarCarrinho();
});

function atualizarCarrinho() {
  const cont = $('#cart-items');
  // remove do carrinho itens que deixaram de estar disponíveis
  estado.carrinho = estado.carrinho.filter((i) => estado.produtos.some((p) => p.id_produto === i.id_produto && p.ativo));
  let total = 0;
  if (!estado.carrinho.length) {
    cont.innerHTML = '<p class="text-slate-400 text-sm text-center mt-10">O carrinho está vazio.</p>';
  } else {
    cont.innerHTML = estado.carrinho.map((i, idx) => {
      total += i.preco * i.quantidade;
      return `
        <div class="flex justify-between items-center gap-2 mb-3 pb-3 border-b border-slate-100 last:border-0">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">${esc(i.nome)}</p>
            <div class="flex items-center gap-1 mt-1">
              <button type="button" data-qtd="${idx}" data-delta="-1" class="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm leading-none">−</button>
              <span class="text-xs text-slate-500 w-14 text-center">${i.quantidade}x ${moeda(i.preco)}</span>
              <button type="button" data-qtd="${idx}" data-delta="1" class="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm leading-none">+</button>
            </div>
          </div>
          <div class="font-semibold text-emerald-600 text-sm">${moeda(i.preco * i.quantidade)}</div>
        </div>`;
    }).join('');
  }
  $('#cart-total').textContent = moeda(total);
  $('#btn-checkout').disabled = !estado.carrinho.length || !idCliente();
  $('#btn-clear-cart').disabled = !estado.carrinho.length;
}

$('#cart-items').addEventListener('click', (e) => {
  const b = e.target.closest('[data-qtd]');
  if (!b) return;
  const item = estado.carrinho[Number(b.dataset.qtd)];
  item.quantidade += Number(b.dataset.delta);
  if (item.quantidade <= 0) estado.carrinho.splice(Number(b.dataset.qtd), 1);
  atualizarCarrinho();
});

$('#btn-clear-cart').addEventListener('click', () => { estado.carrinho = []; atualizarCarrinho(); });

// RF12 - registrar compra
$('#btn-checkout').addEventListener('click', async () => {
  const btn = $('#btn-checkout');
  btn.disabled = true;
  try {
    const forma = $('input[name=forma-pgto]:checked').value;
    const r = await api('/vendas', {
      method: 'POST',
      body: { id_usuario: idCliente(), forma_pagamento: forma, itens: estado.carrinho.map((i) => ({ id_produto: i.id_produto, quantidade: i.quantidade })) },
    });
    estado.carrinho = [];
    toast(forma === 'SALDO'
      ? `Compra de ${moeda(r.valor_total)} finalizada! Saldo atual: ${moeda(r.saldo)}.`
      : `Compra de ${moeda(r.valor_total)} registrada (pagamento via PIX).`);
    await recarregarUsuarios();
  } catch (err) {
    toast(err.message, 'erro');
  } finally {
    atualizarCarrinho();
  }
});

// ============================== MANTER USUÁRIO ==============================
async function carregarUsuarios() {
  const busca = encodeURIComponent($('#busca-usuario').value);
  const status = $('#filtro-status').value;
  estado.usuarios = await api(`/usuarios?busca=${busca}&status=${status}`);
  renderUsuarios();
}
async function recarregarUsuarios() {
  await Promise.all([carregarUsuarios(), carregarClientes()]);
}

function renderUsuarios() {
  const tb = $('#tabela-usuarios');
  if (!estado.usuarios.length) {
    tb.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400 text-sm">Nenhum usuário encontrado.</td></tr>';
  } else {
    tb.innerHTML = estado.usuarios.map((u) => `
      <tr class="${u.ativo ? '' : 'bg-slate-50/60'}">
        <td class="p-4 font-medium">${esc(u.nome)}<div class="text-xs text-slate-400 font-normal">${esc(u.email)}</div></td>
        <td class="p-4 text-sm">${esc(u.matricula)}</td>
        <td class="p-4 text-sm whitespace-nowrap">${esc(u.cpf)}</td>
        <td class="p-4 text-sm">${u.perfil === 'ALUNO' ? 'Aluno' : 'Colaborador'}</td>
        <td class="p-4 text-sm text-right whitespace-nowrap font-semibold">${moeda(u.saldo)}</td>
        <td class="p-4">
          <span class="inline-block w-24 text-center ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs px-2 py-1 rounded-full font-semibold">${u.ativo ? 'Ativo' : 'Desativado'}</span>
        </td>
        <td class="p-4 text-right whitespace-nowrap">
          <button type="button" data-acao="status" data-id="${u.id_usuario}" class="relative inline-flex h-6 w-10 items-center rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-red-500'} transition-colors align-middle mr-3" title="${u.ativo ? 'Desativar' : 'Ativar'}">
            <span class="inline-block h-4 w-4 ${u.ativo ? 'translate-x-5' : 'translate-x-1'} transform rounded-full bg-white transition-transform"></span>
          </button>
          <button type="button" data-acao="editar" data-id="${u.id_usuario}" class="text-slate-400 hover:text-emerald-600 text-sm font-medium mr-3">Editar</button>
          <button type="button" data-acao="extrato" data-id="${u.id_usuario}" class="text-slate-400 hover:text-emerald-600 text-sm font-medium mr-3">Extrato</button>
          <button type="button" data-acao="historico" data-id="${u.id_usuario}" class="text-slate-400 hover:text-emerald-600 text-sm font-medium mr-3">Histórico</button>
          <button type="button" data-acao="excluir" data-id="${u.id_usuario}" class="text-slate-400 hover:text-red-500 text-sm font-medium">Excluir</button>
        </td>
      </tr>`).join('');
  }
  const ativos = estado.usuarios.filter((u) => u.ativo).length;
  $('#total-usuarios').textContent = `${estado.usuarios.length} usuário(s) listado(s) · ${ativos} ativo(s) · ${estado.usuarios.length - ativos} inativo(s)`;
}

let timerBusca;
$('#busca-usuario').addEventListener('input', () => { clearTimeout(timerBusca); timerBusca = setTimeout(() => carregarUsuarios().catch(falhaGeral), 250); });
$('#filtro-status').addEventListener('change', () => carregarUsuarios().catch(falhaGeral));

// Incluir
$('#btn-novo-usuario').addEventListener('click', () => {
  const f = $('#form-usuario');
  f.reset();
  f.id_usuario.value = '';
  f.cpf.disabled = false;
  $('#dica-cpf').classList.add('hidden');
  $('#label-senha-usuario').textContent = 'Senha *';
  f.senha.placeholder = 'Mínimo 6 caracteres';
  $('#titulo-modal-usuario').textContent = 'Cadastrar Novo Usuário';
  abrirModal('modal-usuario');
});

$('#tabela-usuarios').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const u = estado.usuarios.find((x) => x.id_usuario === Number(b.dataset.id));
  try {
    if (b.dataset.acao === 'editar') abrirEdicaoUsuario(u);
    if (b.dataset.acao === 'status') abrirStatus(u);
    if (b.dataset.acao === 'historico') await abrirHistorico(u);
    if (b.dataset.acao === 'extrato') await abrirExtrato(u);
    if (b.dataset.acao === 'excluir') await excluirUsuario(u);
  } catch (err) { toast(err.message, 'erro'); }
});

// Alterar
function abrirEdicaoUsuario(u) {
  const f = $('#form-usuario');
  f.reset();
  f.id_usuario.value = u.id_usuario;
  f.nome.value = u.nome;
  f.matricula.value = u.matricula;
  f.email.value = u.email;
  f.perfil.value = u.perfil;
  f.cpf.value = u.cpf;
  f.cpf.disabled = true;
  $('#dica-cpf').classList.remove('hidden');
  $('#label-senha-usuario').textContent = 'Nova senha';
  f.senha.placeholder = 'Deixe em branco para manter';
  $('#titulo-modal-usuario').textContent = 'Alterar Usuário';
  abrirModal('modal-usuario');
}

$('#form-usuario').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  enviar(f, async () => {
    const d = dadosForm(f);
    if (d.id_usuario) {
      await api(`/usuarios/${d.id_usuario}`, { method: 'PUT', body: d });
      toast('Usuário alterado com sucesso.');
    } else {
      await api('/usuarios', { method: 'POST', body: d });
      toast('Usuário cadastrado com sucesso.');
    }
    fecharModais();
    await recarregarUsuarios();
  });
});

// Inativar / reativar (com motivo)
function abrirStatus(u) {
  const f = $('#form-status');
  f.reset();
  f.id_usuario.value = u.id_usuario;
  f.ativo.value = String(!u.ativo);
  $('#titulo-modal-status').textContent = u.ativo ? 'Desativar Usuário' : 'Reativar Usuário';
  $('#texto-modal-status').innerHTML = u.ativo
    ? `<strong>${esc(u.nome)}</strong> ficará impedido de acessar o sistema e de realizar compras.`
    : `<strong>${esc(u.nome)}</strong> voltará a ter acesso ao sistema.`;
  const btn = $('#btn-confirmar-status');
  btn.textContent = u.ativo ? 'Desativar' : 'Reativar';
  btn.className = `px-4 py-2 ${u.ativo ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-lg font-medium transition-colors`;
  abrirModal('modal-status');
}

$('#form-status').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  enviar(f, async () => {
    const ativo = f.ativo.value === 'true';
    await api(`/usuarios/${f.id_usuario.value}/status`, { method: 'PATCH', body: { ativo, motivo: f.motivo.value } });
    toast(ativo ? 'Usuário reativado.' : 'Usuário desativado.');
    fecharModais();
    await recarregarUsuarios();
  });
});

async function abrirHistorico(u) {
  const lista = await api(`/usuarios/${u.id_usuario}/historico`);
  $('#titulo-modal-historico').textContent = `Histórico de Status · ${u.nome}`;
  $('#lista-historico').innerHTML = lista.length ? lista.map((h) => `
    <div class="border border-slate-100 rounded-lg p-3">
      <div class="flex justify-between text-sm">
        <span class="font-semibold ${h.status_novo ? 'text-green-700' : 'text-red-700'}">${h.status_novo ? 'Reativado' : 'Desativado'}</span>
        <span class="text-slate-400">${esc(h.data_hora)}</span>
      </div>
      <p class="text-sm text-slate-700 mt-1">${esc(h.motivo)}</p>
      <p class="text-xs text-slate-400 mt-1">Responsável: ${esc(h.funcionario)}</p>
    </div>`).join('') : '<p class="text-sm text-slate-400">Nenhuma alteração de status registrada.</p>';
  abrirModal('modal-historico');
}

// Excluir (o servidor só permite se o usuário não tiver movimentações - RN06)
async function excluirUsuario(u) {
  if (!confirm(`Excluir o usuário "${u.nome}"?\n\nUsuários com movimentações não podem ser excluídos, apenas desativados.`)) return;
  await api(`/usuarios/${u.id_usuario}`, { method: 'DELETE' });
  toast('Usuário excluído.');
  await recarregarUsuarios();
}

// ============================== CRÉDITOS / EXTRATO ==============================
function abrirCredito(idUsuario) {
  const f = $('#form-credito');
  f.reset();
  f.id_usuario.innerHTML = estado.clientes.filter((u) => u.ativo)
    .map((u) => `<option value="${u.id_usuario}">${esc(u.nome)} · saldo ${moeda(u.saldo)}</option>`).join('');
  if (idUsuario) f.id_usuario.value = idUsuario;
  abrirModal('modal-credito');
  setTimeout(() => f.valor.focus(), 60);
}
$('#btn-add-saldo').addEventListener('click', () => abrirCredito(idCliente()));

$('#form-credito').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  enviar(f, async () => {
    const r = await api('/creditos', { method: 'POST', body: dadosForm(f) });
    toast(`Crédito adicionado. Novo saldo: ${moeda(r.saldo)}.`);
    fecharModais();
    await recarregarUsuarios();
  });
});

async function abrirExtrato(u) {
  estado.extratoUsuario = u;
  $('#extrato-de').value = '';
  $('#extrato-ate').value = '';
  await carregarExtrato();
  abrirModal('modal-extrato');
}

async function carregarExtrato() {
  const u = estado.extratoUsuario;
  const de = $('#extrato-de').value;
  const ate = $('#extrato-ate').value;
  const [lista, atual] = await Promise.all([
    api(`/creditos/extrato/${u.id_usuario}?de=${de}&ate=${ate}`),
    api(`/usuarios/${u.id_usuario}`),
  ]);
  $('#titulo-modal-extrato').textContent = `Extrato · ${u.nome}`;
  $('#saldo-extrato').innerHTML = `Saldo atual: <strong class="text-slate-800">${moeda(atual.saldo)}</strong>
    ${atual.ativo ? `· <button type="button" id="btn-credito-extrato" class="text-emerald-600 hover:underline font-medium">+ Adicionar crédito</button>` : ''}`;
  $('#lista-extrato').innerHTML = lista.length ? lista.map((m) => {
    const entrada = m.tipo === 'CREDITO';
    const rotulo = { CREDITO: 'Crédito', ESTORNO: 'Estorno', COMPRA: 'Compra' }[m.tipo];
    const podeEstornar = entrada && !m.estornado;
    return `
      <div class="p-3 flex justify-between items-start gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800">${rotulo} <span class="font-normal text-slate-400">· ${esc(m.forma_pagamento)}</span>
            ${m.estornado ? '<span class="ml-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">estornado</span>' : ''}</p>
          <p class="text-xs text-slate-500 truncate">${esc(m.descricao || '')}</p>
          <p class="text-xs text-slate-400">${esc(m.data_hora)}${m.funcionario ? ` · ${esc(m.funcionario)}` : ''}</p>
        </div>
        <div class="text-right whitespace-nowrap">
          <p class="text-sm font-bold ${entrada ? 'text-emerald-600' : 'text-red-600'}">${entrada ? '+' : '−'} ${moeda(m.valor)}</p>
          ${podeEstornar ? `<button type="button" data-estornar="${m.id}" class="text-xs text-slate-400 hover:text-red-600">Estornar</button>` : ''}
        </div>
      </div>`;
  }).join('') : '<p class="p-4 text-sm text-slate-400">Nenhuma movimentação no período.</p>';
}

$('#btn-filtrar-extrato').addEventListener('click', () => carregarExtrato().catch((err) => toast(err.message, 'erro')));
$('#modal-extrato').addEventListener('click', async (e) => {
  if (e.target.id === 'btn-credito-extrato') return abrirCredito(estado.extratoUsuario.id_usuario);
  const b = e.target.closest('[data-estornar]');
  if (!b) return;
  const motivo = prompt('Motivo do estorno:');
  if (motivo === null) return;
  try {
    const r = await api(`/creditos/${b.dataset.estornar}/estorno`, { method: 'POST', body: { motivo } });
    toast(`Crédito estornado. Novo saldo: ${moeda(r.saldo)}.`);
    await Promise.all([carregarExtrato(), recarregarUsuarios()]);
  } catch (err) { toast(err.message, 'erro'); }
});

// ============================== PRODUTOS / CATEGORIAS ==============================
async function carregarProdutos() {
  [estado.produtos, estado.categorias] = await Promise.all([api('/produtos'), api('/categorias')]);
  renderProdutos();
  renderCategorias();
  renderCatalogo();
  atualizarCarrinho();
}

function renderProdutos() {
  $('#tabela-produtos').innerHTML = estado.produtos.length ? estado.produtos.map((p) => `
    <tr class="${p.ativo ? '' : 'bg-slate-50/60 text-slate-400'}">
      <td class="p-4 font-medium"><span class="inline-flex w-8 h-8 mr-2 align-middle items-center justify-center overflow-hidden rounded-full bg-slate-50">${imagemProduto(p, 'text-lg')}</span>${esc(p.nome)}</td>
      <td class="p-4 text-sm">${esc(p.categoria)}</td>
      <td class="p-4 text-sm">${moeda(p.preco_venda)}</td>
      <td class="p-4"><span class="inline-block w-20 text-center ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs px-2 py-1 rounded-full font-semibold">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="p-4 text-right whitespace-nowrap">
        <button type="button" data-acao="editar" data-id="${p.id_produto}" class="text-slate-400 hover:text-emerald-600 text-sm font-medium mr-3">Editar</button>
        <button type="button" data-acao="status" data-id="${p.id_produto}" class="text-slate-400 hover:text-amber-600 text-sm font-medium mr-3">${p.ativo ? 'Inativar' : 'Ativar'}</button>
        <button type="button" data-acao="excluir" data-id="${p.id_produto}" class="text-slate-400 hover:text-red-500 text-sm font-medium">Excluir</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="5" class="p-6 text-center text-slate-400 text-sm">Nenhum produto cadastrado.</td></tr>';
}

function renderCategorias() {
  $('#lista-categorias').innerHTML = estado.categorias.map((c) => `
    <div class="p-3 flex items-center justify-between gap-2 ${c.ativo ? '' : 'text-slate-400'}">
      <div>
        <p class="text-sm font-medium">${esc(c.nome)} ${c.ativo ? '' : '<span class="text-xs">(inativa)</span>'}</p>
        <p class="text-xs text-slate-400">${c.produtos} produto(s)</p>
      </div>
      <div class="whitespace-nowrap">
        <button type="button" data-acao="editar" data-id="${c.id_categoria}" class="text-slate-400 hover:text-emerald-600 text-xs font-medium mr-2">Editar</button>
        <button type="button" data-acao="status" data-id="${c.id_categoria}" class="text-slate-400 hover:text-amber-600 text-xs font-medium">${c.ativo ? 'Inativar' : 'Ativar'}</button>
      </div>
    </div>`).join('') || '<p class="p-4 text-sm text-slate-400">Nenhuma categoria.</p>';
}

function preencherCategorias(select, atual) {
  select.innerHTML = estado.categorias.filter((c) => c.ativo || c.id_categoria === atual)
    .map((c) => `<option value="${c.id_categoria}">${esc(c.nome)}</option>`).join('');
  if (atual) select.value = atual;
}

$('#btn-novo-produto').addEventListener('click', () => {
  const f = $('#form-produto');
  f.reset();
  f.id_produto.value = '';
  preencherCategorias(f.id_categoria);
  $('#titulo-modal-produto').textContent = 'Cadastrar Novo Produto';
  abrirModal('modal-produto');
});

$('#tabela-produtos').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const p = estado.produtos.find((x) => x.id_produto === Number(b.dataset.id));
  try {
    if (b.dataset.acao === 'editar') {
      const f = $('#form-produto');
      f.reset();
      f.id_produto.value = p.id_produto;
      f.nome.value = p.nome;
      f.preco_venda.value = p.preco_venda;
      f.imagem.value = p.imagem || '';
      preencherCategorias(f.id_categoria, p.id_categoria);
      $('#titulo-modal-produto').textContent = 'Alterar Produto';
      abrirModal('modal-produto');
    }
    if (b.dataset.acao === 'status') {
      await api(`/produtos/${p.id_produto}/status`, { method: 'PATCH', body: { ativo: !p.ativo } });
      toast(p.ativo ? 'Produto inativado.' : 'Produto ativado.');
      await carregarProdutos();
    }
    if (b.dataset.acao === 'excluir') {
      if (!confirm(`Excluir o produto "${p.nome}"?`)) return;
      await api(`/produtos/${p.id_produto}`, { method: 'DELETE' });
      toast('Produto excluído.');
      await carregarProdutos();
    }
  } catch (err) { toast(err.message, 'erro'); }
});

$('#form-produto').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  enviar(f, async () => {
    const d = dadosForm(f);
    if (d.id_produto) await api(`/produtos/${d.id_produto}`, { method: 'PUT', body: d });
    else await api('/produtos', { method: 'POST', body: d });
    toast(d.id_produto ? 'Produto alterado.' : 'Produto cadastrado.');
    fecharModais();
    await carregarProdutos();
  });
});

$('#btn-nova-categoria').addEventListener('click', () => {
  const f = $('#form-categoria');
  f.reset();
  f.id_categoria.value = '';
  $('#titulo-modal-categoria').textContent = 'Nova Categoria';
  abrirModal('modal-categoria');
});

$('#lista-categorias').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const c = estado.categorias.find((x) => x.id_categoria === Number(b.dataset.id));
  try {
    if (b.dataset.acao === 'editar') {
      const f = $('#form-categoria');
      f.id_categoria.value = c.id_categoria;
      f.nome.value = c.nome;
      $('#titulo-modal-categoria').textContent = 'Alterar Categoria';
      abrirModal('modal-categoria');
    } else {
      await api(`/categorias/${c.id_categoria}/status`, { method: 'PATCH', body: { ativo: !c.ativo } });
      toast(c.ativo ? 'Categoria inativada (seus produtos saem do catálogo).' : 'Categoria ativada.');
      await carregarProdutos();
    }
  } catch (err) { toast(err.message, 'erro'); }
});

$('#form-categoria').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  enviar(f, async () => {
    const d = dadosForm(f);
    if (d.id_categoria) await api(`/categorias/${d.id_categoria}`, { method: 'PUT', body: d });
    else await api('/categorias', { method: 'POST', body: d });
    toast(d.id_categoria ? 'Categoria alterada.' : 'Categoria cadastrada.');
    fecharModais();
    await carregarProdutos();
  });
});

// ============================== FUNCIONÁRIOS ==============================
function renderFuncionarios() {
  $('#tabela-funcionarios').innerHTML = estado.funcionarios.map((f) => `
    <tr class="${f.ativo ? '' : 'bg-slate-50/60 text-slate-400'}">
      <td class="p-4 font-medium">${esc(f.nome)}<div class="text-xs text-slate-400 font-normal">${esc(f.cpf)}</div></td>
      <td class="p-4 text-sm">${esc(f.login)}</td>
      <td class="p-4 text-sm">${esc(f.email)}</td>
      <td class="p-4 text-sm">${f.cargo === 'GERENTE' ? 'Gerente' : 'Operador'}</td>
      <td class="p-4"><span class="inline-block w-20 text-center ${f.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs px-2 py-1 rounded-full font-semibold">${f.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="p-4 text-right whitespace-nowrap">
        <button type="button" data-acao="editar" data-id="${f.id_funcionario}" class="text-slate-400 hover:text-emerald-600 text-sm font-medium mr-3">Editar</button>
        <button type="button" data-acao="status" data-id="${f.id_funcionario}" class="text-slate-400 hover:text-amber-600 text-sm font-medium">${f.ativo ? 'Inativar' : 'Ativar'}</button>
      </td>
    </tr>`).join('');
}

$('#btn-novo-funcionario').addEventListener('click', () => {
  const f = $('#form-funcionario');
  f.reset();
  f.id_funcionario.value = '';
  f.cpf.disabled = false;
  $('#label-senha-funcionario').textContent = 'Senha *';
  $('#titulo-modal-funcionario').textContent = 'Cadastrar Funcionário';
  abrirModal('modal-funcionario');
});

$('#tabela-funcionarios').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const fu = estado.funcionarios.find((x) => x.id_funcionario === Number(b.dataset.id));
  try {
    if (b.dataset.acao === 'editar') {
      const f = $('#form-funcionario');
      f.reset();
      f.id_funcionario.value = fu.id_funcionario;
      f.nome.value = fu.nome;
      f.cpf.value = fu.cpf;
      f.cpf.disabled = true;
      f.email.value = fu.email;
      f.login.value = fu.login;
      f.cargo.value = fu.cargo;
      $('#label-senha-funcionario').textContent = 'Nova senha';
      $('#titulo-modal-funcionario').textContent = 'Alterar Funcionário';
      abrirModal('modal-funcionario');
    } else {
      await api(`/funcionarios/${fu.id_funcionario}/status`, { method: 'PATCH', body: { ativo: !fu.ativo } });
      toast(fu.ativo ? 'Funcionário inativado.' : 'Funcionário ativado.');
      await carregarFuncionarios();
    }
  } catch (err) { toast(err.message, 'erro'); }
});

$('#form-funcionario').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  enviar(f, async () => {
    const d = dadosForm(f);
    if (d.id_funcionario) await api(`/funcionarios/${d.id_funcionario}`, { method: 'PUT', body: d });
    else await api('/funcionarios', { method: 'POST', body: d });
    toast(d.id_funcionario ? 'Funcionário alterado.' : 'Funcionário cadastrado.');
    fecharModais();
    await carregarFuncionarios();
  });
});

// ============================== INICIALIZAÇÃO ==============================
function falhaGeral(err) {
  const aviso = $('#aviso-banco');
  aviso.textContent = `${err.message} — confira se o servidor (npm start) e o PostgreSQL estão rodando.`;
  aviso.classList.remove('hidden');
}

(async function iniciar() {
  try {
    await carregarFuncionarios();
    await Promise.all([carregarClientes(), carregarUsuarios(), carregarProdutos()]);
  } catch (err) {
    falhaGeral(err);
  }
}());
