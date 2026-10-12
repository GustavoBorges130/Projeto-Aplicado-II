CREATE TABLE PRODUTO (
    id_produto SERIAL PRIMARY KEY,
    nome VARCHAR(80) NOT NULL,
    preco DECIMAL(10,2) NOT NULL
);

CREATE TABLE USUARIO (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    perfil VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL,
    data_cadastro DATE NOT NULL
);

CREATE TABLE RETIRADA (
    id_retirada SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_produto INT NOT NULL,
    quantidade INT NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    data_hora TIMESTAMP NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto)
);

CREATE TABLE HISTORICO_STATUS (
    id_historico SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_administrador INT NOT NULL,
    status_anterior BOOLEAN NOT NULL,
    status_novo BOOLEAN NOT NULL,
    data_hora TIMESTAMP NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    FOREIGN KEY (id_administrador) REFERENCES USUARIO(id_usuario)
);