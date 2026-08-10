# Meu Negocio no Bolso

## Banco PostgreSQL

O backend atual fica em [`backend`](backend) e usa NestJS + Prisma.
Configure `DATABASE_URL` a partir de [`backend/.env.example`](backend/.env.example).

Antes de iniciar a aplicacao pela primeira vez, aplique as migrations:

```bash
cd backend
npm run prisma:deploy
cd ..
npm run dev
```

O `npm run dev` da raiz inicia API e front-end juntos, informa as URLs no
terminal e encerra os dois processos com um unico `Ctrl+C`. Para executar apenas
um servico, use `npm run dev:web` ou `npm run dev:api`. As mensagens recebem os
prefixos `[FRONT]` e `[BACK]`; as portas `5173` e `3000` sao estritas, então uma
segunda execucao mostra qual processo ja esta ativo em vez de escolher outra
porta silenciosamente.

Por padrao, o Vite encaminha `/api` para `http://localhost:3000`, a mesma porta
definida no exemplo de `backend/.env`.

Em producao, execute `npm run prisma:deploy` no backend como etapa de release
antes de iniciar a API.

### Dados de demonstracao

Com `DATABASE_URL` configurada, a seed cria duas contas com produtos, servicos,
clientes, despesas, sessoes de caixa e vendas a vista/fiado:

```bash
cd backend
npm run seed
```

- `thalles@gmail.com` / `123456`
- `gustavo@gmail.com` / `123456`
- `marco@gmail.com` / `123456`

A seed e nao destrutiva: cria e popula somente contas ausentes. Se um dos
e-mails ja existir, seus dados e sua senha sao preservados. A senha curta existe
apenas para demonstracao e deve ser trocada fora do ambiente de desenvolvimento.

Para reiniciar integralmente o banco configurado e recriar os dados de
demonstracao com o schema atual, use o modo explicito `--reset`:

```bash
cd backend
npm run seed -- --reset
```

Esse comando remove todas as contas e dados de negocio do banco apontado por
`DATABASE_URL`; use apenas em desenvolvimento.

No Neon, use a connection string do banco em `DATABASE_URL` e segredos reais
para JWT/cookies em ambientes publicados.
