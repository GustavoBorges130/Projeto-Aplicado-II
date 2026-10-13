# Canjicatech – Cantina da Honestidade

Projeto Aplicado II · Análise e Desenvolvimento de Sistemas · Centro Universitário SENAI/SC · Grupo 1

Sistema para controle de usuários, créditos e compras da Cantina da Honestidade do SENAI Fraiburgo.
A interface web (HTML + Tailwind) é integrada a um banco **PostgreSQL** por meio de uma API em **Node.js (Express)**.

## Funcionalidades

| Tela | O que faz | Requisitos |
|---|---|---|
| **Usuários** | Incluir, alterar, listar/pesquisar, desativar/reativar (com motivo e histórico) e excluir (só sem movimentações) | RF01–RF04, RN04–RN07 |
| **Créditos** | Adicionar crédito (botão **+** do cabeçalho ou no extrato), estornar e consultar extrato por período | RF09–RF11, RN02, RN03 |
| **Catálogo** | Compra de vários produtos com pagamento por saldo ou PIX, abatendo do saldo | RF12, RN01, RN02, RN08, RN09 |
| **Gestão de Produtos** | Manter produtos (nome, categoria, preço, imagem) e categorias | RF07, RF08 |
| **Funcionários** | Manter gerente e operadores | RF05 |

O seletor **"Operando como"** no topo define o funcionário responsável pelas operações (gravado no histórico e nos créditos). Somente o **gerente** pode desativar usuários e manter funcionários.

## Como executar localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org) 18 ou superior
- [PostgreSQL](https://www.postgresql.org/download/) 16 ou superior

### 2. Configurar a conexão
Copie o arquivo `.env.example` para `.env` e ajuste usuário e senha do seu PostgreSQL
(ou preencha `DATABASE_URL` para usar o banco da nuvem):

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=canjicatech
PGUSER=postgres
PGPASSWORD=sua_senha
```

### 3. Instalar, criar o banco e iniciar

```bash
npm install
npm run db:criar     # cria o banco "canjicatech", as tabelas e os dados iniciais
npm start
```

Acesse **http://localhost:3000**.

> Também é possível criar o banco manualmente pelo pgAdmin ou pelo terminal:
> `psql -U postgres -c "CREATE DATABASE canjicatech;"` e depois `psql -U postgres -d canjicatech -f script_banco.sql`.
> **Atenção:** o script recria as tabelas e apaga os dados existentes.

### Dados iniciais
- Funcionários: **Gerente da Cantina** (login `admin`, senha `admin123`) e **Operador da Cantina** (login `operador`, senha `123456`)
- 4 usuários (Marcos começa com R$ 25,00 de saldo), 4 categorias e 10 produtos

## Publicar online (Vercel + Neon)

Assim qualquer pessoa acessa pelo link, sem depender de um computador ligado.

1. **Importar o projeto:** em [vercel.com/new](https://vercel.com/new), entre com o GitHub, escolha o repositório **Projeto-Aplicado-II** e clique em **Deploy** (não precisa mudar nenhuma configuração).
2. **Criar o banco:** no projeto criado, abra a aba **Storage → Create Database → Neon (Serverless Postgres)**, escolha a região **São Paulo (sa-east-1)** e conecte ao projeto. O Vercel cria sozinho a variável `DATABASE_URL`.
3. **Criar as tabelas:** no painel do Neon (botão **Open in Neon** na aba Storage), abra o **SQL Editor**, cole todo o conteúdo do `script_banco.sql` e clique em **Run**.
   *(Alternativa: copie a `DATABASE_URL` para o seu `.env` e rode `npm run db:criar`.)*
4. **Atualizar o deploy:** na aba **Deployments**, clique nos três pontos do último deploy → **Redeploy**.
5. Abra o link do projeto (`https://<nome-do-projeto>.vercel.app`). Para testar se o banco conectou: `https://<nome-do-projeto>.vercel.app/api/status` deve mostrar `{"banco":"conectado"}`.

A cada `git push` na branch `main`, o Vercel publica a nova versão automaticamente.

> **Atenção:** o sistema ainda não tem tela de login (prevista no RF06 para a próxima etapa), então qualquer pessoa com o link pode cadastrar e alterar dados. Compartilhe o link apenas com o grupo e a professora.

## Estrutura

```
├── script_banco.sql          # Tabelas (MER v1.1) + dados iniciais
├── server.js                 # Servidor Express (interface + API)
├── src/
│   ├── db.js                 # Conexão com o PostgreSQL
│   ├── auth.js               # Funcionário responsável / permissão de gerente
│   ├── util.js               # Validações (CPF, e-mail) e tratamento de erros
│   ├── criarBanco.js         # npm run db:criar
│   └── routes/               # usuarios, funcionarios, produtos, movimentacoes
├── public/
│   ├── index.html            # Interface
│   └── js/app.js             # Lógica da tela (chamadas à API)
└── docs/                     # Documentação do sistema
```

## API (resumo)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/usuarios?busca=&status=todos\|ativos\|inativos` | Listar/pesquisar usuários |
| POST | `/api/usuarios` | Incluir usuário |
| PUT | `/api/usuarios/:id` | Alterar usuário |
| PATCH | `/api/usuarios/:id/status` | Desativar/reativar (`{ ativo, motivo }`) |
| DELETE | `/api/usuarios/:id` | Excluir (somente sem movimentações) |
| GET | `/api/usuarios/:id/historico` | Histórico de status |
| POST | `/api/creditos` | Adicionar crédito |
| POST | `/api/creditos/:id/estorno` | Estornar crédito |
| GET | `/api/creditos/extrato/:idUsuario?de=&ate=` | Extrato |
| POST | `/api/vendas` | Registrar compra |
| GET/POST/PUT/PATCH/DELETE | `/api/produtos`, `/api/categorias`, `/api/funcionarios` | Demais cadastros |

As rotas que alteram dados exigem o cabeçalho `X-Funcionario-Id` (enviado automaticamente pela tela).

## Integrantes
Gustavo Borges · Jean Lucas Britez Vergara · Marcos Patrick Costa Campos · Alisson Zanetti
