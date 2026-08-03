# Meu Negócio no Bolso — API

Backend real (NestJS + PostgreSQL + Prisma) para o app "Meu Negócio no Bolso", substituindo o
`localStorage` do frontend por persistência de verdade, autenticação e regras de negócio
centralizadas no servidor.

## Stack

- Node.js 20 + TypeScript + NestJS 10
- PostgreSQL 16 + Prisma ORM
- class-validator/class-transformer para validação de entrada
- JWT de acesso (curto) + refresh token opaco rotativo (httpOnly cookie)
- @nestjs/throttler (rate limiting), Helmet, CORS configurável
- nestjs-pino (logs estruturados), @nestjs/terminus (health checks)
- @nestjs/schedule (job de recorrência de despesas fixas)
- Swagger em `/docs` (apenas fora de produção)
- Jest + Supertest

## Arquitetura

Monólito modular. Cada módulo de negócio (`sales`, `products`, `accounts`, `fixed-expenses`,
`customers`, `companies`, `dashboard`, `reports`, `users`, `auth`, `audit-logs`) tem
controller + service + DTOs próprios. Regra de negócio vive no service, nunca no controller.
Multi-tenant por `companyId` em toda tabela de domínio: cada query de cada service recebe o
`companyId` extraído do JWT (`@CurrentUser()`) e o inclui explicitamente em todo `where` — não
existe query de domínio sem esse filtro.

```
src/
  auth/            registro, login, refresh rotativo, logout
  users/           usuários dentro da empresa (RBAC: OWNER/ADMIN/STAFF)
  companies/       configuração da empresa (equivalente ao CompanyConfig do frontend)
  customers/       clientes (usados pelo fiado)
  products/        produtos e serviços
  inventory/       consulta de estoque baixo + ajuste manual de estoque
  sales/           frente de caixa: baixa de estoque + geração de conta a receber (fiado)
  accounts/        contas a pagar/receber (payable e receivable controllers, 1 service)
  fixed-expenses/  despesas fixas recorrentes + job de geração da próxima ocorrência
  dashboard/       agregados server-side (saldo de caixa, resumo do período, alertas)
  reports/         endpoint honesto: "não implementado" (ver Pendências)
  audit-logs/      trilha de auditoria de ações críticas
  health/          liveness/readiness
  common/          guards, decorators, filtro de exceções, tipos compartilhados
  prisma/          PrismaService/PrismaModule
  config/          validação de env (class-validator) + configuração tipada
```

## Autenticação e autorização

- **Access token**: JWT assinado (HS256), expira em `JWT_ACCESS_EXPIRES_IN` (padrão 15 min),
  enviado no header `Authorization: Bearer <token>`.
- **Refresh token**: token opaco aleatório (não é JWT), armazenado com hash SHA-256 no banco,
  entregue como cookie `httpOnly`, `Secure` (em produção), `SameSite=Strict`, assinado
  (`cookie-parser` com `COOKIE_SECRET`), escopado ao path `/api/auth`.
- **Rotação com detecção de reuso**: a cada `POST /api/auth/refresh`, o token atual é revogado e
  um novo é emitido na mesma "família". Se um token já revogado for apresentado novamente
  (sinal de roubo/replay), a família inteira é revogada, derrubando a sessão.
- **RBAC**: papéis `OWNER`, `ADMIN`, `STAFF` via `@Roles(...)` + `RolesGuard` (global). Todo
  endpoint é protegido por padrão (`JwtAuthGuard` global); use `@Public()` para liberar.
- **Rate limiting**: `/auth/register` e `/auth/login` limitados a 5 req/min por IP.

Fluxo equivalente ao onboarding do frontend: `POST /api/auth/register` cria `Company` + `User`
(role `OWNER`) numa transação e já retorna tokens; o restante da configuração (ramo, oferta,
despesas fixas, etc.) é feito depois via `PATCH /api/companies/me`.

## Rodando localmente

```bash
cp .env.example .env      # edite os segredos
docker compose up -d postgres
npm install
npm run prisma:migrate    # cria o schema no banco (gera a primeira migration)
npm run prisma:seed       # opcional: cria uma empresa + usuário de demonstração
npm run start:dev
```

Swagger disponível em `http://localhost:3000/docs` (não exposto quando `NODE_ENV=production`).

### Com Docker completo

```bash
cp .env.example .env
docker compose up --build
```

O serviço `api` aguarda o Postgres ficar saudável, roda `prisma migrate deploy` e sobe o
servidor.

## Testes

```bash
npm test            # unitários (services mockando o Prisma)
npm run test:e2e     # fluxo de auth ponta a ponta — requer Postgres migrado (docker compose up -d postgres && npm run prisma:deploy)
npm run lint
```

Cobertura atual de testes unitários prioriza as regras de negócio de maior risco:
- `sales.service.spec.ts`: baixa de estoque atômica, rejeição por estoque insuficiente, serviço
  não baixa estoque, fiado gera conta a receber vinculada.
- `fixed-expenses.service.spec.ts`: a próxima ocorrência é ancorada no vencimento anterior
  (não na data de hoje/pagamento) — a correção do bug identificado no frontend original.
- `dashboard.service.spec.ts`: saldo de caixa não conta fiado em aberto, conta recebível só
  entra no caixa quando quitada, serviços nunca entram no alerta de estoque baixo.

## Variáveis de ambiente

Ver `.env.example`. Todas são validadas na inicialização (`src/config/env.validation.ts`) — a
aplicação recusa subir com configuração incompleta/inválida.

## Backup e exportação de dados

Não há uma rota de exportação dedicada ainda (ver Pendências). Enquanto isso, o backup real do
negócio é o backup do próprio Postgres:

```bash
docker compose exec postgres pg_dump -U mnb meu_negocio_no_bolso > backup.sql
```

Automatize esse comando (cron/rotina do provedor de hospedagem) até que exista exportação
self-service pela API.

## Decisões que valem registrar

- **Um `Account` para pagar e receber**: em vez de duas tabelas, existe uma tabela `accounts`
  com `type` (`PAYABLE`/`RECEIVABLE`), e dois controllers (`/accounts-payable`,
  `/accounts-receivable`) sobre o mesmo service — evita duplicar schema/lógica de "vencido",
  "vence em breve", "dar baixa" que é idêntica para os dois tipos.
- **`settings` não é um módulo separado**: as preferências (tema, período do painel, relatório)
  vivem em `Company`, exposto via `companies.controller`. Criar um módulo à parte duplicaria a
  mesma tabela sem necessidade.
- **Relatório por e-mail não foi implementado de verdade**: o frontend original simulava o
  envio (`alert()`). Esta API não repete isso — `POST /reports/send-now` responde
  `501 Not Implemented` honestamente em vez de fingir sucesso.
- **Valores monetários usam `Decimal` no Postgres** e chegam ao JSON como string (comportamento
  padrão do Prisma `Decimal`), evitando os erros de arredondamento de ponto flutuante que o
  frontend original tinha ao operar em `number` puro.

## Pendências (ver relatório técnico completo para a lista priorizada)

- Endpoint de exportação de dados (JSON/CSV) por empresa.
- Envio real de e-mail/relatório (fila + provedor de e-mail).
- Testes e2e cobrindo todos os módulos de negócio (hoje cobre auth + isolamento de tenant).
- Observabilidade externa (tracing/metrics — hoje há apenas logs estruturados + health checks).
