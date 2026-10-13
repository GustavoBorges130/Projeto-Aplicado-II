-- =====================================================================
--  Canjicatech - Cantina da Honestidade (SENAI Fraiburgo)
--  Script do banco de dados - PostgreSQL 16+
--  Versão 1.1 - conforme MER revisado (documentação v1.1)
--
--  Como executar (no terminal):
--      psql -U postgres -c "CREATE DATABASE canjicatech;"
--      psql -U postgres -d canjicatech -f script_banco.sql
--
--  ATENÇÃO: o script recria as tabelas (apaga os dados existentes).
-- =====================================================================

DROP TABLE IF EXISTS ITEM_VENDA       CASCADE;
DROP TABLE IF EXISTS VENDA            CASCADE;
DROP TABLE IF EXISTS CREDITO          CASCADE;
DROP TABLE IF EXISTS HISTORICO_STATUS CASCADE;
DROP TABLE IF EXISTS PRODUTO          CASCADE;
DROP TABLE IF EXISTS CATEGORIA        CASCADE;
DROP TABLE IF EXISTS FUNCIONARIO      CASCADE;
DROP TABLE IF EXISTS USUARIO          CASCADE;
DROP TABLE IF EXISTS RETIRADA         CASCADE;   -- tabela da versão 1.0, substituída por VENDA/ITEM_VENDA

-- ---------------------------------------------------------------------
-- CADASTROS
-- ---------------------------------------------------------------------

-- Clientes da cantina (alunos e colaboradores) - RF01 a RF04
CREATE TABLE USUARIO (
    id_usuario     SERIAL        PRIMARY KEY,
    nome           VARCHAR(100)  NOT NULL,
    matricula      VARCHAR(20)   NOT NULL UNIQUE,
    email          VARCHAR(120)  NOT NULL UNIQUE,
    cpf            VARCHAR(14)   NOT NULL UNIQUE,
    senha_hash     VARCHAR(255)  NOT NULL,
    perfil         VARCHAR(20)   NOT NULL DEFAULT 'ALUNO',
    saldo          DECIMAL(10,2) NOT NULL DEFAULT 0,
    ativo          BOOLEAN       NOT NULL DEFAULT TRUE,
    data_cadastro  DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_usuario_perfil CHECK (perfil IN ('ALUNO', 'COLABORADOR')),
    CONSTRAINT ck_usuario_saldo  CHECK (saldo >= 0)                      -- RN02
);

-- Gerente e operadores da cantina - RF05
CREATE TABLE FUNCIONARIO (
    id_funcionario SERIAL        PRIMARY KEY,
    nome           VARCHAR(100)  NOT NULL,
    cpf            VARCHAR(14)   NOT NULL UNIQUE,
    email          VARCHAR(120)  NOT NULL UNIQUE,
    login          VARCHAR(40)   NOT NULL UNIQUE,
    senha_hash     VARCHAR(255)  NOT NULL,
    cargo          VARCHAR(20)   NOT NULL DEFAULT 'OPERADOR',
    ativo          BOOLEAN       NOT NULL DEFAULT TRUE,
    data_cadastro  DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_funcionario_cargo CHECK (cargo IN ('GERENTE', 'OPERADOR'))
);

-- Categorias de produtos - RF08
CREATE TABLE CATEGORIA (
    id_categoria   SERIAL        PRIMARY KEY,
    nome           VARCHAR(50)   NOT NULL UNIQUE,
    ativo          BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Produtos da cantina - RF07
CREATE TABLE PRODUTO (
    id_produto     SERIAL        PRIMARY KEY,
    id_categoria   INT           NOT NULL REFERENCES CATEGORIA (id_categoria),
    nome           VARCHAR(80)   NOT NULL,
    preco_venda    DECIMAL(10,2) NOT NULL,
    imagem         VARCHAR(255),                       -- URL da imagem ou emoji
    ativo          BOOLEAN       NOT NULL DEFAULT TRUE,
    data_cadastro  DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT ck_produto_preco CHECK (preco_venda > 0)
);

-- ---------------------------------------------------------------------
-- MOVIMENTAÇÕES
-- ---------------------------------------------------------------------

-- Histórico de habilitação/desabilitação de usuários - RF04 / RN05
CREATE TABLE HISTORICO_STATUS (
    id_historico    SERIAL       PRIMARY KEY,
    id_usuario      INT          NOT NULL REFERENCES USUARIO (id_usuario),
    id_funcionario  INT          NOT NULL REFERENCES FUNCIONARIO (id_funcionario),
    status_anterior BOOLEAN      NOT NULL,
    status_novo     BOOLEAN      NOT NULL,
    motivo          VARCHAR(200) NOT NULL,
    data_hora       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Créditos adicionados e estornados - RF09 / RF10 / RN03
CREATE TABLE CREDITO (
    id_credito      SERIAL        PRIMARY KEY,
    id_usuario      INT           NOT NULL REFERENCES USUARIO (id_usuario),
    id_funcionario  INT           NOT NULL REFERENCES FUNCIONARIO (id_funcionario),
    tipo            VARCHAR(10)   NOT NULL DEFAULT 'CREDITO',
    valor           DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(20)   NOT NULL,
    observacao      VARCHAR(200),
    data_hora       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_credito_tipo  CHECK (tipo IN ('CREDITO', 'ESTORNO')),
    CONSTRAINT ck_credito_valor CHECK (valor > 0),
    CONSTRAINT ck_credito_forma CHECK (forma_pagamento IN ('DINHEIRO', 'PIX', 'CARTAO'))
);

-- Compras (cabeçalho) - RF12
CREATE TABLE VENDA (
    id_venda        SERIAL        PRIMARY KEY,
    id_usuario      INT           NOT NULL REFERENCES USUARIO (id_usuario),
    valor_total     DECIMAL(10,2) NOT NULL,
    valor_pago      DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(20)   NOT NULL DEFAULT 'SALDO',
    data_hora       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_venda_forma CHECK (forma_pagamento IN ('SALDO', 'PIX'))
);

-- Itens da compra - RF12 / RN08
CREATE TABLE ITEM_VENDA (
    id_item_venda   SERIAL        PRIMARY KEY,
    id_venda        INT           NOT NULL REFERENCES VENDA (id_venda) ON DELETE CASCADE,
    id_produto      INT           NOT NULL REFERENCES PRODUTO (id_produto),
    quantidade      INT           NOT NULL,
    preco_unitario  DECIMAL(10,2) NOT NULL,           -- preço vigente no momento da compra
    subtotal        DECIMAL(10,2) NOT NULL,
    CONSTRAINT ck_item_qtd CHECK (quantidade > 0)
);

-- Índices para pesquisas e relatórios (RNF04)
CREATE INDEX ix_usuario_nome        ON USUARIO (LOWER(nome));
CREATE INDEX ix_produto_categoria   ON PRODUTO (id_categoria);
CREATE INDEX ix_venda_usuario_data  ON VENDA (id_usuario, data_hora);
CREATE INDEX ix_venda_data          ON VENDA (data_hora);
CREATE INDEX ix_item_venda_venda    ON ITEM_VENDA (id_venda);
CREATE INDEX ix_item_venda_produto  ON ITEM_VENDA (id_produto);
CREATE INDEX ix_credito_usuario     ON CREDITO (id_usuario, data_hora);
CREATE INDEX ix_historico_usuario   ON HISTORICO_STATUS (id_usuario, data_hora);

-- =====================================================================
--  DADOS INICIAIS (para testes e apresentação)
--  Senhas: gerente "admin" = admin123 | demais = 123456  (hash bcrypt - RNF07)
-- =====================================================================

INSERT INTO FUNCIONARIO (nome, cpf, email, login, senha_hash, cargo) VALUES
('Gerente da Cantina', '526.018.159-06', 'gerente@cantina.senai.br', 'admin',
 '$2b$10$HR1xMh/Si0d77OasG2fcauv1VLP8IQeOMmMs/4eoPsX1jPn0m9xv6', 'GERENTE'),
('Operador da Cantina', '083.016.613-05', 'operador@cantina.senai.br', 'operador',
 '$2b$10$mr2506YiDkX04AI3en68AePGjPiZDNedHNBClWDOmdNzDyVNEtVDi', 'OPERADOR');

INSERT INTO USUARIO (nome, matricula, email, cpf, senha_hash, perfil) VALUES
('Marcos Patrick Costa Campos', '2024001', 'marcos@estudante.senai.br', '186.091.390-34',
 '$2b$10$mr2506YiDkX04AI3en68AePGjPiZDNedHNBClWDOmdNzDyVNEtVDi', 'ALUNO'),
('Jean Lucas Britez Vergara',   '2024002', 'jean@estudante.senai.br',   '996.030.824-30',
 '$2b$10$mr2506YiDkX04AI3en68AePGjPiZDNedHNBClWDOmdNzDyVNEtVDi', 'ALUNO'),
('Alisson Zanetti',             '2024003', 'alisson@estudante.senai.br','628.194.821-12',
 '$2b$10$mr2506YiDkX04AI3en68AePGjPiZDNedHNBClWDOmdNzDyVNEtVDi', 'ALUNO'),
('Gustavo Borges',              'C0001',   'gustavo@senai.br',          '993.518.190-19',
 '$2b$10$mr2506YiDkX04AI3en68AePGjPiZDNedHNBClWDOmdNzDyVNEtVDi', 'COLABORADOR');

INSERT INTO CATEGORIA (nome) VALUES ('Bebidas'), ('Doces'), ('Salgados'), ('Lanches');

INSERT INTO PRODUTO (id_categoria, nome, preco_venda, imagem) VALUES
(2, 'Brigadeiro',        2.50, '🧁'),
(4, 'Barra de Cereal',   3.00, '🍫'),
(1, 'Água Mineral',      2.00, '💧'),
(1, 'Refrigerante',      5.00, '🥤'),
(3, 'Salgado Assado',    6.00, '🥟'),
(2, 'Biscoito Recheado', 3.50, '🍪'),
(1, 'Suco Natural',      4.50, '🧃'),
(3, 'Pão de Queijo',     2.50, '🧀'),
(2, 'Bolo de Pote',      7.00, '🍰'),
(1, 'Energético',        8.00, '⚡');

-- Crédito inicial de R$ 25,00 para o primeiro usuário (lançado pelo gerente)
INSERT INTO CREDITO (id_usuario, id_funcionario, tipo, valor, forma_pagamento, observacao)
VALUES (1, 1, 'CREDITO', 25.00, 'PIX', 'Crédito inicial');
UPDATE USUARIO SET saldo = 25.00 WHERE id_usuario = 1;
