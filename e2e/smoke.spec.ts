import { test, expect } from './fixtures';

/**
 * Core-flow smoke tests against the real backend. All tests here share one
 * pre-onboarded company per worker (see e2e/fixtures.ts `sharedOnboardedPage`)
 * to stay under the backend's auth rate limit — none of them log out or
 * otherwise invalidate that session.
 */

test('dashboard loads with its core widgets after authentication', async ({ page, sharedOnboardedPage }) => {
  void sharedOnboardedPage;

  await expect(page.getByText('Caixa Disponível')).toBeVisible();
  await expect(page.getByText('Últimos 7 Dias')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Início' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Caixa' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Finanças' })).toBeVisible();
});

test('creates and then edits a product in Estoque', async ({ page, sharedOnboardedPage }) => {
  void sharedOnboardedPage;
  const productName = `Produto E2E ${Date.now()}`;

  // A real in-app click (client-side route change via react-router) rather than
  // page.goto(path): goto() is a full browser navigation that remounts the app
  // and re-triggers AuthContext's bootstrap silent-refresh — unnecessary here,
  // and it's what was pushing this suite over its auth-throttle budget.
  await page.getByRole('link', { name: 'Estoque' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByPlaceholder('Ex: Coca-Cola 2L').fill(productName);
  await page.getByPlaceholder('Ex: BEB-001').fill(`SKU-${Date.now()}`);
  await page.getByPlaceholder('Ex: 9,90').fill('12,50');
  await page.getByRole('button', { name: 'Salvar Produto' }).click();

  // The product card is <div card><div><h3>name</h3>...</div><div>...<button>Atualizar</button></div></div>
  // (Estoque.tsx) — walking up two levels from the (unique, timestamped) name
  // heading reaches the card itself, scoping later assertions/clicks to just
  // this product regardless of how many others the shared company has.
  const productHeading = page.getByRole('heading', { name: productName, exact: true });
  const productCard = productHeading.locator('xpath=../..');
  await expect(productCard).toBeVisible();
  await expect(productCard.getByText(/12,50/)).toBeVisible();

  // Edit: bump the price and confirm the card reflects the update.
  await productCard.getByRole('button', { name: 'Atualizar' }).click();
  await expect(page.getByRole('heading', { name: 'Atualizar Produto' })).toBeVisible();
  // Estoque's price/name labels aren't wired to their inputs via htmlFor, so
  // an accessible-name locator would not resolve here — the `name` attribute
  // is the stable, semantic hook available instead.
  await page.locator('input[name="precoVenda"]').fill('19,90');
  await page.getByRole('button', { name: 'Salvar Produto' }).click();

  await expect(productCard.getByText(/19,90/)).toBeVisible();
});

test('finds a product in Caixa by typing its SKU, not just its name', async ({ page, sharedOnboardedPage }) => {
  void sharedOnboardedPage;
  const productName = `Busca SKU ${Date.now()}`;
  const sku = `SKU-${Date.now()}`;

  await page.getByRole('link', { name: 'Estoque' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByPlaceholder('Ex: Coca-Cola 2L').fill(productName);
  await page.getByPlaceholder('Ex: BEB-001').fill(sku);
  await page.getByPlaceholder('Ex: 9,90').fill('7,00');
  await page.getByRole('button', { name: 'Salvar Produto' }).click();
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Caixa' }).click();
  // Typing the SKU (not the name) must still surface this product in the search results.
  await page.getByPlaceholder('Buscar produto cadastrado...').fill(sku);
  await expect(page.getByRole('button', { name: new RegExp(productName) })).toBeVisible();
});

test('registers a cash sale for a manually entered amount in Caixa', async ({ page, sharedOnboardedPage }) => {
  void sharedOnboardedPage;

  await page.getByRole('link', { name: 'Caixa' }).click();
  await page.getByPlaceholder('Ou digite um valor avulso (ex: 12,50)').fill('25,00');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Diversos')).toBeVisible();

  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();

  // click() and waitForEvent() must race via Promise.all, not run sequentially:
  // finalizarVenda's alert() blocks the page's JS thread, so an `await click()`
  // issued before the dialog listener is armed can hang waiting for a click
  // that never "settles" while the modal dialog is up.
  const [dialog] = await Promise.all([
    page.waitForEvent('dialog'),
    page.getByRole('button', { name: 'Cobrar' }).click(),
  ]);
  expect(dialog.message()).toContain('Venda registrada com sucesso');
  await dialog.accept();

  // Cart resets to its empty state once the sale is confirmed by the server.
  await expect(page.getByText('Adicione produtos ou')).toBeVisible();
});

test('registers a fiado (store-credit) sale tied to a new customer', async ({ page, sharedOnboardedPage }) => {
  void sharedOnboardedPage;
  const clienteNome = `Cliente E2E ${Date.now()}`;

  await page.getByRole('link', { name: 'Caixa' }).click();
  await page.getByPlaceholder('Ou digite um valor avulso (ex: 12,50)').fill('30,00');
  await page.getByRole('button', { name: 'Adicionar' }).click();

  await page.getByRole('button', { name: 'Fiado', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar novo cliente' }).click();
  await page.getByPlaceholder('Nome do cliente').fill(clienteNome);
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(page.getByText(clienteNome)).toBeVisible();

  const [dialog] = await Promise.all([
    page.waitForEvent('dialog'),
    page.getByRole('button', { name: 'Cobrar' }).click(),
  ]);
  expect(dialog.message()).toContain('Venda registrada com sucesso');
  await dialog.accept();

  // The sale creates a receivable ("A Receber") tied to the new customer.
  // Financas defaults to the "pagar" tab; switch tabs is a plain client-side
  // state change (Financas.tsx's setAba), no navigation involved.
  await page.getByRole('link', { name: 'Finanças' }).click();
  await page.getByRole('button', { name: 'A Receber (Fiado)' }).click();
  await expect(page.getByText(clienteNome).first()).toBeVisible();
});

test('registers a multi-quantity cash sale and decrements stock by the full amount', async ({
  page,
  sharedOnboardedPage,
}) => {
  void sharedOnboardedPage;
  const productName = `Estoque Multi ${Date.now()}`;

  await page.getByRole('link', { name: 'Estoque' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByPlaceholder('Ex: Coca-Cola 2L').fill(productName);
  await page.getByPlaceholder('Ex: BEB-001').fill(`SKU-${Date.now()}`);
  await page.getByPlaceholder('Ex: 9,90').fill('10,00');
  await page.locator('input[name="quantidade"]').fill('20');
  await page.getByRole('button', { name: 'Salvar Produto' }).click();
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Caixa' }).click();
  await page.getByPlaceholder('Buscar produto cadastrado...').fill(productName);
  await page.getByRole('button', { name: new RegExp(productName) }).click();

  // Bump the single unit added above to 3 via the quantity stepper (Task 2) —
  // one cart line with quantity=3, not three separate re-adds.
  const aumentarQtd = page.getByRole('button', { name: `Aumentar quantidade de ${productName}` });
  await aumentarQtd.click();
  await aumentarQtd.click();
  await expect(page.getByRole('spinbutton', { name: `Quantidade de ${productName}` })).toHaveValue('3');
  // Total reflects 3 x R$10,00 = R$30,00 (regex, not the literal "R$ " string:
  // Intl.NumberFormat can render a non-breaking space there).
  await expect(page.getByText(/30,00/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  const [dialog] = await Promise.all([
    page.waitForEvent('dialog'),
    page.getByRole('button', { name: 'Cobrar' }).click(),
  ]);
  expect(dialog.message()).toContain('Venda registrada com sucesso');
  await dialog.accept();

  // Backend decrements stock atomically by dto.quantity (sales.service.ts) —
  // 20 - 3 = 17, confirming the UI actually sent quantity=3 in one line, not
  // three quantity=1 sales.
  await page.getByRole('link', { name: 'Estoque' }).click();
  const card = page.getByRole('heading', { name: productName, exact: true }).locator('xpath=../..');
  await expect(card.getByText('17 un')).toBeVisible();
});

test('registers a multi-quantity fiado sale with the correct receivable total', async ({
  page,
  sharedOnboardedPage,
}) => {
  void sharedOnboardedPage;
  const productName = `Fiado Multi ${Date.now()}`;
  const clienteNome = `Cliente Multi ${Date.now()}`;

  await page.getByRole('link', { name: 'Estoque' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByPlaceholder('Ex: Coca-Cola 2L').fill(productName);
  await page.getByPlaceholder('Ex: BEB-001').fill(`SKU-${Date.now()}`);
  await page.getByPlaceholder('Ex: 9,90').fill('15,00');
  await page.locator('input[name="quantidade"]').fill('10');
  await page.getByRole('button', { name: 'Salvar Produto' }).click();
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Caixa' }).click();
  await page.getByPlaceholder('Buscar produto cadastrado...').fill(productName);
  await page.getByRole('button', { name: new RegExp(productName) }).click();
  await page.getByRole('button', { name: `Aumentar quantidade de ${productName}` }).click();
  // quantity is now 2 x R$15,00 = R$30,00

  await page.getByRole('button', { name: 'Fiado', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar novo cliente' }).click();
  await page.getByPlaceholder('Nome do cliente').fill(clienteNome);
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(page.getByText(clienteNome)).toBeVisible();

  const [dialog] = await Promise.all([
    page.waitForEvent('dialog'),
    page.getByRole('button', { name: 'Cobrar' }).click(),
  ]);
  expect(dialog.message()).toContain('Venda registrada com sucesso');
  await dialog.accept();

  // Receivable amount must be quantity x unitPrice (2 x R$15,00), not just
  // unitPrice — confirming the backend received quantity=2 for this fiado sale.
  await page.getByRole('link', { name: 'Finanças' }).click();
  await page.getByRole('button', { name: 'A Receber (Fiado)' }).click();
  // clienteNome renders in two possible places (Financas.tsx): the "Por
  // Cliente" summary (a plain <li><span>name</span><span>amount</span></li>)
  // and/or the detailed account list (name nested a few levels inside a <li>
  // that also holds the amount). ancestor::li[1] finds the nearest enclosing
  // <li> either way instead of hard-coding a specific nesting depth.
  const linhaCliente = page.getByText(clienteNome).first().locator('xpath=ancestor::li[1]');
  await expect(linhaCliente.getByText(/30,00/)).toBeVisible();
});

test('imports a stock spreadsheet, applying valid rows and rejecting invalid ones', async ({
  page,
  sharedOnboardedPage,
}) => {
  void sharedOnboardedPage;
  const produtoValido = `Import OK ${Date.now()}`;
  const skuValido = `SKU-${Date.now()}`;
  const produtoServico = `Import Servico ${Date.now()}`;

  // A trackable product (gets restocked) and a service (has no stock, must be
  // rejected by the import even though it's a valid product name).
  await page.getByRole('link', { name: 'Estoque' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByPlaceholder('Ex: Coca-Cola 2L').fill(produtoValido);
  await page.getByPlaceholder('Ex: BEB-001').fill(skuValido);
  await page.getByPlaceholder('Ex: 9,90').fill('5,00');
  await page.locator('input[name="quantidade"]').fill('8');
  await page.getByRole('button', { name: 'Salvar Produto' }).click();
  await expect(page.getByRole('heading', { name: produtoValido, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByRole('button', { name: 'Serviço', exact: true }).click();
  await page.getByPlaceholder('Ex: Corte de Cabelo').fill(produtoServico);
  await page.getByPlaceholder('Ex: 9,90').fill('20,00');
  await page.getByRole('button', { name: 'Salvar Serviço' }).click();
  await expect(page.getByRole('heading', { name: produtoServico, exact: true })).toBeVisible();

  // Mixes sku-column and produto(name)-column rows on purpose: row 1 matches
  // produtoValido by its real SKU; row 2 matches the *same* product by name —
  // this must be caught as a cross-column duplicate (the exact bug fixed by
  // deduping on the resolved product id instead of the raw typed identifier).
  const csv = [
    'codigo,produto,quantidade',
    `${skuValido},,12`, // valid: matched strictly by SKU
    `,${produtoValido},5`, // same product, matched by name this time -> duplicate
    `,${produtoServico},4`, // service — has no stock to restock
    ',Produto Que Nao Existe,3', // unknown product (matched by name)
    'SKU-NAO-EXISTE,,3', // unknown SKU — must not silently fall back to name matching
    ',X,-2', // negative quantity
    ',Y,abc', // non-numeric quantity
  ].join('\n');

  await page.getByRole('button', { name: 'Importar' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'restock.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });

  await expect(page.getByText('1 válida(s)')).toBeVisible();
  await expect(page.getByText('6 com erro')).toBeVisible();
  await expect(page.getByText('Produto duplicado nesta planilha')).toBeVisible();
  await expect(page.getByText('Serviços não têm estoque')).toBeVisible();
  await expect(page.getByText('Produto não encontrado')).toBeVisible();
  await expect(page.getByText('SKU não encontrado')).toBeVisible();
  await expect(page.getByText(/Quantidade inválida/).first()).toBeVisible();

  await page.getByRole('button', { name: /Confirmar Importação/ }).click();
  await expect(page.getByText('1 produto(s) reabastecido(s) com sucesso.')).toBeVisible();
  // Two elements share the accessible name "Fechar" here: Modal.tsx's own
  // header close icon (aria-label="Fechar") and this result view's own
  // "Fechar" button — .last() is the latter (it's later in document order,
  // inside the modal body rather than its header).
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  // 8 (initial) + 12 (imported via the SKU-matched row) = 20 — the
  // cross-column-duplicate/invalid rows must not have applied on top of it.
  const card = page.getByRole('heading', { name: produtoValido, exact: true }).locator('xpath=../..');
  await expect(card.getByText('20 un')).toBeVisible();
});

test('reports "send now" honestly surfaces the 501 Not Implemented from the backend', async ({
  page,
  sharedOnboardedPage,
}) => {
  void sharedOnboardedPage;

  await page.getByRole('button', { name: 'Configurações' }).click();
  const [dialog] = await Promise.all([
    page.waitForEvent('dialog'),
    page.getByRole('button', { name: 'Enviar Relatório Agora' }).click(),
  ]);
  expect(dialog.message()).toContain('Report delivery is not implemented yet');
  await dialog.accept();
});
