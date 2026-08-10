// Converts between the backend's English/enum contract and the frontend's own
// Portuguese domain vocabulary (src/types.ts), so pages never have to know the two
// don't speak the same language.
import type {
  BackendAccount,
  BackendCompany,
  BackendCustomer,
  BackendFixedExpense,
  BackendOffering,
  BackendPaymentMethod,
  BackendProduct,
  BackendProductType,
  BackendRecurrence,
  BackendReportFrequency,
  BackendSale,
} from './backendTypes';
import type {
  Cliente,
  Conta,
  CompanyConfig,
  DespesaFixa,
  FormaPagamento,
  FrequenciaRelatorio,
  Oferta,
  Produto,
  Recorrencia,
  TipoConta,
  Venda,
  ViewPeriod,
} from '../types';

const OFERTA_TO_BACKEND: Record<Oferta, BackendOffering> = {
  produtos: 'PRODUCTS',
  servicos: 'SERVICES',
  ambos: 'BOTH',
};
const OFERTA_FROM_BACKEND: Record<BackendOffering, Oferta> = {
  PRODUCTS: 'produtos',
  SERVICES: 'servicos',
  BOTH: 'ambos',
};

const VIEW_PERIOD_TO_BACKEND: Record<ViewPeriod, 'DAY' | 'WEEK'> = { day: 'DAY', week: 'WEEK' };
const VIEW_PERIOD_FROM_BACKEND: Record<'DAY' | 'WEEK', ViewPeriod> = { DAY: 'day', WEEK: 'week' };

const REPORT_FREQ_TO_BACKEND: Record<FrequenciaRelatorio, BackendReportFrequency> = {
  nenhum: 'NONE',
  semanal: 'WEEKLY',
  mensal: 'MONTHLY',
  ambos: 'BOTH',
};
const REPORT_FREQ_FROM_BACKEND: Record<BackendReportFrequency, FrequenciaRelatorio> = {
  NONE: 'nenhum',
  WEEKLY: 'semanal',
  MONTHLY: 'mensal',
  BOTH: 'ambos',
};

const PRODUCT_TYPE_TO_BACKEND: Record<'produto' | 'servico', BackendProductType> = {
  produto: 'PRODUCT',
  servico: 'SERVICE',
};
const PRODUCT_TYPE_FROM_BACKEND: Record<BackendProductType, 'produto' | 'servico'> = {
  PRODUCT: 'produto',
  SERVICE: 'servico',
};
const LEGACY_PRODUCT_TYPE_TO_BACKEND: Record<'product' | 'service', BackendProductType> = {
  product: 'PRODUCT',
  service: 'SERVICE',
};
const LEGACY_PRODUCT_TYPE_FROM_BACKEND: Record<BackendProductType, 'product' | 'service'> = {
  PRODUCT: 'product',
  SERVICE: 'service',
};

const PAYMENT_TO_BACKEND: Record<FormaPagamento, BackendPaymentMethod> = {
  dinheiro: 'CASH',
  pix: 'PIX',
  cartao_credito: 'CREDIT_CARD',
  cartao_debito: 'DEBIT_CARD',
  fiado: 'STORE_CREDIT',
};
const PAYMENT_FROM_BACKEND: Record<BackendPaymentMethod, FormaPagamento> = {
  CASH: 'dinheiro',
  PIX: 'pix',
  CREDIT_CARD: 'cartao_credito',
  DEBIT_CARD: 'cartao_debito',
  STORE_CREDIT: 'fiado',
};

const RECURRENCE_TO_BACKEND: Record<Recorrencia, BackendRecurrence> = {
  semanal: 'WEEKLY',
  mensal: 'MONTHLY',
};
const RECURRENCE_FROM_BACKEND: Record<BackendRecurrence, Recorrencia> = {
  WEEKLY: 'semanal',
  MONTHLY: 'mensal',
};

const isoDateOnly = (value: string): string => value.slice(0, 10);

// ---- Company -----------------------------------------------------------------

export function companyToConfig(company: BackendCompany): CompanyConfig {
  return {
    nome: company.name,
    categoria: company.sector ?? '',
    oferta: OFERTA_FROM_BACKEND[company.offering],
    controlaEstoque: company.tracksInventory,
    metaDiariaVendas: company.dailySalesGoal ? Number(company.dailySalesGoal) : undefined,
    relatorio: {
      frequencia: REPORT_FREQ_FROM_BACKEND[company.reportFrequency],
      porEmail: company.reportByEmail,
      email: company.reportEmail ?? undefined,
    },
    viewPeriod: VIEW_PERIOD_FROM_BACKEND[company.dashboardPeriod],
    onboardingConcluido: company.onboardingCompleted,
  };
}

/** Partial patch in frontend vocabulary -> partial PATCH /companies/me body. */
export function configPatchToBackend(patch: Partial<CompanyConfig>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.nome !== undefined) body.name = patch.nome;
  if (patch.categoria !== undefined) body.sector = patch.categoria;
  if (patch.oferta !== undefined) body.offering = OFERTA_TO_BACKEND[patch.oferta];
  if (patch.controlaEstoque !== undefined) body.tracksInventory = patch.controlaEstoque;
  if (patch.metaDiariaVendas !== undefined) body.dailySalesGoal = patch.metaDiariaVendas;
  if (patch.viewPeriod !== undefined) body.dashboardPeriod = VIEW_PERIOD_TO_BACKEND[patch.viewPeriod];
  if (patch.onboardingConcluido !== undefined) body.onboardingCompleted = patch.onboardingConcluido;
  if (patch.relatorio !== undefined) {
    body.reportFrequency = REPORT_FREQ_TO_BACKEND[patch.relatorio.frequencia];
    body.reportByEmail = patch.relatorio.porEmail;
    if (patch.relatorio.email !== undefined) body.reportEmail = patch.relatorio.email;
  }
  return body;
}

// ---- Customer -----------------------------------------------------------------

export function customerToCliente(customer: BackendCustomer): Cliente {
  return { id: customer.id, nome: customer.name, telefone: customer.phone ?? undefined };
}

export function clienteToBackendPayload(cliente: Omit<Cliente, 'id'>) {
  return { name: cliente.nome, phone: cliente.telefone };
}

// ---- Product --------------------------------------------------------------

export function productToProduto(product: BackendProduct): Produto {
  return {
    id: product.id,
    nome: product.name,
    codigo: product.sku ?? undefined,
    categoria: product.category ?? undefined,
    tipo: PRODUCT_TYPE_FROM_BACKEND[product.type],
    type: LEGACY_PRODUCT_TYPE_FROM_BACKEND[product.type],
    quantidade: product.quantity,
    quantidadeMinima: product.minQuantity,
    precoVenda: Number(product.salePrice),
    custo: product.cost ? Number(product.cost) : undefined,
  };
}

export function produtoToBackendPayload(produto: Partial<Omit<Produto, 'id'>>) {
  const type = produto.tipo
    ? PRODUCT_TYPE_TO_BACKEND[produto.tipo]
    : produto.type
      ? LEGACY_PRODUCT_TYPE_TO_BACKEND[produto.type]
      : undefined;
  return {
    name: produto.nome,
    sku: produto.codigo,
    category: produto.categoria,
    type,
    quantity: produto.quantidade,
    minQuantity: produto.quantidadeMinima,
    salePrice: produto.precoVenda,
    cost: produto.custo,
  };
}

// ---- Sale -------------------------------------------------------------------

export function saleToVenda(sale: BackendSale): Venda {
  return {
    id: sale.id,
    data: isoDateOnly(sale.date),
    createdAt: sale.date,
    descricao: sale.description,
    quantidade: sale.quantity,
    valorUnitario: Number(sale.unitPrice),
    formaPagamento: PAYMENT_FROM_BACKEND[sale.paymentMethod],
    produtoId: sale.productId ?? undefined,
    tipoItem: sale.product ? LEGACY_PRODUCT_TYPE_FROM_BACKEND[sale.product.type] : undefined,
  };
}

export function vendaToBackendPayload(venda: Omit<Venda, 'id'>, customerId?: string) {
  return {
    date: venda.data,
    description: venda.descricao,
    quantity: venda.quantidade,
    unitPrice: venda.valorUnitario,
    paymentMethod: PAYMENT_TO_BACKEND[venda.formaPagamento],
    productId: venda.produtoId,
    customerId,
  };
}

// ---- Account (Conta) ----------------------------------------------------------

const ACCOUNT_TYPE_TO_BACKEND: Record<TipoConta, 'PAYABLE' | 'RECEIVABLE'> = {
  pagar: 'PAYABLE',
  receber: 'RECEIVABLE',
};

export function accountTypeToBackend(tipo: TipoConta) {
  return ACCOUNT_TYPE_TO_BACKEND[tipo];
}

export function accountToConta(account: BackendAccount): Conta {
  return {
    id: account.id,
    tipo: account.type === 'PAYABLE' ? 'pagar' : 'receber',
    descricao: account.description,
    valor: Number(account.amount),
    vencimento: isoDateOnly(account.dueDate),
    quitado: account.paid,
    dataQuitacao: account.paidAt ? isoDateOnly(account.paidAt) : undefined,
    origemVendaId: account.originSaleId ?? undefined,
    clienteId: account.customerId ?? undefined,
    despesaFixaId: account.fixedExpenseId ?? undefined,
  };
}

// ---- Fixed expense --------------------------------------------------------

export function fixedExpenseToDespesaFixa(expense: BackendFixedExpense): DespesaFixa {
  return {
    id: expense.id,
    nome: expense.name,
    valor: Number(expense.amount),
    recorrencia: RECURRENCE_FROM_BACKEND[expense.recurrence],
  };
}

export function despesaFixaToBackendPayload(despesa: Omit<DespesaFixa, 'id'>) {
  return {
    name: despesa.nome,
    amount: despesa.valor,
    recurrence: RECURRENCE_TO_BACKEND[despesa.recorrencia],
  };
}
