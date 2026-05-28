# Sistema de Gestão de Produção de Ervas Aromáticas

Sistema para gestão de lotes, planos de cultivo e automação baseada em medições ambientais (IoT).

## Pré-requisitos
* Node.js (v18 ou superior recomendado)
* MongoDB a correr (localmente ou cluster no MongoDB Atlas)

## 1. Instalação das Dependências
Na raiz do projeto, abre o terminal e executa:
```bash
npm install
```

## 2. Configuração de Variáveis de Ambiente
Copia o ficheiro de exemplo para criares as tuas variáveis:
```bash
cp .env.example .env
```
Edita o ficheiro `.env` e coloca os teus dados:
* `PORT`: O porto onde a API vai correr (ex: 3000)
* `MONGO_URI`: A tua connection string do MongoDB.
* `JWT_SECRET`: Uma chave aleatória para assinar os tokens de autenticação.

## 3. Arrancar a Aplicação
Para arrancar o servidor em ambiente de produção:
```bash
npm start
```
Para ambiente de desenvolvimento (com nodemon):
```bash
npm run dev
```

## Documentação da API
Aceder a `http://localhost:<PORT>/api/docs` após arrancar a aplicação para ver o Swagger UI.
