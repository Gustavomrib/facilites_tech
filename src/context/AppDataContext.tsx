import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type {
  AppData,
  CategoriaProduto,
  Cliente,
  CompanyConfig,
  Conta,
  DespesaFixa,
  FormaPagamento,
  LancamentoManual,
  Produto,
  TipoDespesa,
  TipoEntrada,
  TipoMovimentoCaixa,
  Venda,
} from '../types';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/httpClient';
import SplashLoading from '../components/SplashLoading';
import { todayISO } from '../lib/format';
import * as accountsApi from '../api/accountsApi';
import * as companiesApi from '../api/companiesApi';
import * as customersApi from '../api/customersApi';
import * as dashboardApi from '../api/dashboardApi';
import * as fixedExpensesApi from '../api/fixedExpensesApi';
import * as inventoryApi from '../api/inventoryApi';
import * as productsApi from '../api/productsApi';
import * as salesApi from '../api/salesApi';
import {
  accountToConta,
  accountTypeToBackend,
  clienteToBackendPayload,
  companyToConfig,
  configPatchToBackend,
  customerToCliente,
  despesaFixaToBackendPayload,
  fixedExpenseToDespesaFixa,
  productToProduto,
  produtoToBackendPayload,
  saleToVenda,
  vendaToBackendPayload,
} from '../api/mappers';

const emptyData: AppData = {
  config: null,
  vendas: [],
  produtos: [],
  categorias: [],
  contas: [],
  lancamentosManuais: [],
  clientes: [],
  despesasFixas: [],
  transacoes: [],
  caixaAtual: null,
  fechamentosCaixa: [],
};

interface ResumoPeriodo {
  vendas: number;
  despesas: number;
}

interface SaleItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface AppDataContextValue {
  data: AppData;
  setConfig: (patch: Partial<CompanyConfig>) => Promise<void>;
  addVenda: (venda: Omit<Venda, 'id'>, opts?: { clienteId?: string }) => Promise<void>;
  editarVenda: (id: string, patch: Partial<Omit<Venda, 'id'>>) => boolean;
  removerVenda: (id: string) => boolean;
  addProduto: (produto: Omit<Produto, 'id'>) => Promise<void>;
  atualizarProduto: (id: string, patch: Partial<Omit<Produto, 'id'>>) => Promise<void>;
  removerProduto: (id: string) => Promise<void>;
  addCategoria: (nome: string) => boolean;
  editarCategoria: (id: string, nome: string) => boolean;
  removerCategoria: (id: string) => void;
  addConta: (conta: Omit<Conta, 'id' | 'quitado'>) => Promise<void>;
  editarConta: (id: string, patch: Partial<Omit<Conta, 'id'>>) => void;
  removerConta: (id: string) => void;
  marcarContaQuitada: (id: string, dataPagamento?: string) => Promise<void>;
  addCliente: (cliente: Omit<Cliente, 'id'>) => Promise<Cliente>;
  editarCliente: (id: string, patch: Partial<Omit<Cliente, 'id'>>) => void;
  addDespesaFixa: (despesa: Omit<DespesaFixa, 'id'>) => Promise<void>;
  removerDespesaFixa: (id: string) => Promise<void>;
  addLancamentoManual: (lancamento: Omit<LancamentoManual, 'id'>) => void;
  editarLancamentoManual: (id: string, patch: Partial<Omit<LancamentoManual, 'id'>>) => void;
  removerLancamentoManual: (id: string) => void;
  registrarVendaNoBanco: (items: SaleItemInput[], forma: FormaPagamento, clienteId?: string) => Promise<void>;
  registrarLancamentoNoBanco: (input: {
    tipo: 'entrada' | 'saida';
    descricao: string;
    valor: number;
    formaPagamento: Exclude<FormaPagamento, 'fiado'>;
    tipoEntrada?: TipoEntrada;
    tipoDespesa?: TipoDespesa;
    movimentoCaixa?: TipoMovimentoCaixa;
  }) => Promise<void>;
  resolverPendenciaNoBanco: (id: string, classificacao: TipoEntrada | TipoDespesa) => Promise<void>;
  cadastrarClienteNoBanco: (cliente: Omit<Cliente, 'id'>) => Promise<Cliente>;
  baixarFiado: (id: string, forma: Exclude<FormaPagamento, 'fiado'>) => Promise<void>;
  baixarDespesaFixa: (id: string, forma: Exclude<FormaPagamento, 'fiado'>) => Promise<void>;
  cadastrarDespesaFixaNoBanco: (input: {
    nome: string;
    valor: number;
    recorrencia: 'semanal' | 'mensal';
  }) => Promise<void>;
  removerDespesaFixaNoBanco: (id: string) => Promise<void>;
  abrirCaixa: (valorInicial: number, responsavel?: string) => Promise<void>;
  fecharCaixa: (dinheiroContado: number, permitirPendencias?: boolean) => Promise<void>;
  resetData: () => void;
  restockFromImport: (
    itens: { produtoId: string; quantidade: number }[],
  ) => Promise<{ sucesso: number; falhas: { produtoId: string; erro: string }[] }>;
  saldoCaixa: number;
  vendasHoje: number;
  despesasHoje: number;
  lucroEstimadoHoje: number;
  resumoPeriodo: ResumoPeriodo;
  vendasUltimos7Dias: { data: string; total: number }[];
  contasAPagarHoje: Conta[];
  contasAReceberEmAberto: Conta[];
  contasVencendoEmBreve: Conta[];
  contasVencidas: Conta[];
  contasQuitadasHoje: Conta[];
  produtosEstoqueBaixo: Produto[];
  totalNotificacoes: number;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function categoriasFromProducts(produtos: Produto[]): CategoriaProduto[] {
  return Array.from(new Set(produtos.map((produto) => produto.categoria).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((nome) => ({ id: `categoria-${nome.toLocaleLowerCase('pt-BR')}`, nome }));
}

function unsupported(message: string): Promise<never> {
  return Promise.reject(new Error(message));
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const [data, setData] = useState<AppData>(emptyData);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof dashboardApi.getDashboardSummary>> | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [overdueAndDueSoon, setOverdueAndDueSoon] = useState<{
    vencidas: Conta[];
    vencendoEmBreve: Conta[];
  }>({ vencidas: [], vencendoEmBreve: [] });

  const reloadAll = useCallback(async () => {
    const [company, customers, products, payable, receivable, overdue, dueSoon, fixedExpenses, sales, dashboardSummary] =
      await Promise.all([
        companiesApi.getMyCompany(),
        customersApi.listCustomers(),
        productsApi.listProducts(),
        accountsApi.listAccounts('PAYABLE'),
        accountsApi.listAccounts('RECEIVABLE'),
        accountsApi.listOverdue('PAYABLE'),
        accountsApi.listDueSoon('PAYABLE'),
        fixedExpensesApi.listFixedExpenses(),
        salesApi.listSales(),
        dashboardApi.getDashboardSummary(),
      ]);

    const produtos = products.map(productToProduto);
    const despesasFixas = fixedExpenses.map(fixedExpenseToDespesaFixa);
    const config = { ...companyToConfig(company), despesasFixas };

    setData({
      config,
      clientes: customers.map(customerToCliente),
      produtos,
      categorias: categoriasFromProducts(produtos),
      contas: [...payable, ...receivable].map(accountToConta),
      vendas: sales.map(saleToVenda),
      despesasFixas,
      lancamentosManuais: [],
      transacoes: [],
      caixaAtual: null,
      fechamentosCaixa: [],
    });
    setSummary(dashboardSummary);
    setOverdueAndDueSoon({
      vencidas: overdue.map(accountToConta),
      vencendoEmBreve: dueSoon.map(accountToConta),
    });
    setReady(true);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      setReady(false);
      reloadAll().catch(() => {
        setReady(true);
      });
    } else if (status === 'unauthenticated') {
      setData(emptyData);
      setSummary(null);
      setOverdueAndDueSoon({ vencidas: [], vencendoEmBreve: [] });
      setReady(true);
    }
  }, [status, reloadAll]);

  const setConfig = async (patch: Partial<CompanyConfig>) => {
    await companiesApi.updateMyCompany(configPatchToBackend(patch));
    await reloadAll();
  };

  const addVenda = async (venda: Omit<Venda, 'id'>, opts?: { clienteId?: string }) => {
    await salesApi.createSale(vendaToBackendPayload(venda, opts?.clienteId));
    await reloadAll();
  };

  const registrarVendaNoBanco = async (items: SaleItemInput[], forma: FormaPagamento, clienteId?: string) => {
    const hoje = todayISO();
    for (const item of items) {
      await addVenda(
        {
          data: hoje,
          descricao: item.description,
          quantidade: item.quantity,
          valorUnitario: item.unitPrice,
          formaPagamento: forma,
          produtoId: item.productId,
        },
        forma === 'fiado' ? { clienteId } : undefined,
      );
    }
  };

  const editarVenda = (_id: string, _patch: Partial<Omit<Venda, 'id'>>): boolean => {
    return false;
  };

  const removerVenda = (_id: string): boolean => {
    return false;
  };

  const addProduto = async (produto: Omit<Produto, 'id'>) => {
    await productsApi.createProduct(produtoToBackendPayload(produto) as Parameters<typeof productsApi.createProduct>[0]);
    await reloadAll();
  };

  const atualizarProduto = async (id: string, patch: Partial<Omit<Produto, 'id'>>) => {
    await productsApi.updateProduct(id, produtoToBackendPayload(patch));
    await reloadAll();
  };

  const removerProduto = async (_id: string) => {
    await unsupported('Remoção de produtos ainda não existe no backend Nest/Prisma.');
  };

  const addCategoria = (nome: string): boolean => {
    const nomeNormalizado = nome.trim();
    if (!nomeNormalizado) return false;
    const existe = data.categorias.some(
      (categoria) => categoria.nome.toLocaleLowerCase('pt-BR') === nomeNormalizado.toLocaleLowerCase('pt-BR'),
    );
    if (existe) return false;
    setData((prev) => ({
      ...prev,
      categorias: [...prev.categorias, { id: `categoria-${Date.now()}`, nome: nomeNormalizado }],
    }));
    return true;
  };

  const editarCategoria = (id: string, nome: string): boolean => {
    const nomeNormalizado = nome.trim();
    if (!nomeNormalizado) return false;
    const atual = data.categorias.find((categoria) => categoria.id === id);
    if (!atual) return false;
    const repetida = data.categorias.some(
      (categoria) =>
        categoria.id !== id &&
        categoria.nome.toLocaleLowerCase('pt-BR') === nomeNormalizado.toLocaleLowerCase('pt-BR'),
    );
    if (repetida) return false;
    setData((prev) => ({
      ...prev,
      categorias: prev.categorias.map((categoria) =>
        categoria.id === id ? { ...categoria, nome: nomeNormalizado } : categoria,
      ),
      produtos: prev.produtos.map((produto) =>
        produto.categoria === atual.nome ? { ...produto, categoria: nomeNormalizado } : produto,
      ),
    }));
    return true;
  };

  const removerCategoria = (id: string) => {
    const atual = data.categorias.find((categoria) => categoria.id === id);
    if (!atual) return;
    setData((prev) => ({
      ...prev,
      categorias: prev.categorias.filter((categoria) => categoria.id !== id),
      produtos: prev.produtos.map((produto) =>
        produto.categoria === atual.nome ? { ...produto, categoria: undefined } : produto,
      ),
    }));
  };

  const addConta = async (conta: Omit<Conta, 'id' | 'quitado'>) => {
    await accountsApi.createPayable({
      description: conta.descricao,
      amount: conta.valor,
      dueDate: conta.vencimento,
    });
    await reloadAll();
  };

  const editarConta = (_id: string, _patch: Partial<Omit<Conta, 'id'>>) => {
    // Sem endpoint PATCH de contas no backend novo.
  };

  const removerConta = (_id: string) => {
    // Sem endpoint DELETE de contas no backend novo.
  };

  const marcarContaQuitada = async (id: string, dataPagamento?: string) => {
    const conta = data.contas.find((c) => c.id === id);
    if (!conta) return;
    await accountsApi.settleAccount(accountTypeToBackend(conta.tipo), id, dataPagamento);
    await reloadAll();
  };

  const addCliente = async (cliente: Omit<Cliente, 'id'>): Promise<Cliente> => {
    const created = await customersApi.createCustomer(clienteToBackendPayload(cliente));
    await reloadAll();
    return customerToCliente(created);
  };

  const editarCliente = (_id: string, _patch: Partial<Omit<Cliente, 'id'>>) => {
    // Sem endpoint PATCH de clientes no backend novo.
  };

  const addDespesaFixa = async (despesa: Omit<DespesaFixa, 'id'>) => {
    await fixedExpensesApi.createFixedExpense(despesaFixaToBackendPayload(despesa));
    await reloadAll();
  };

  const removerDespesaFixa = async (id: string) => {
    await fixedExpensesApi.deactivateFixedExpense(id);
    await reloadAll();
  };

  const addLancamentoManual = (_lancamento: Omit<LancamentoManual, 'id'>) => {
    // O backend novo ainda não persiste lançamentos manuais livres.
  };

  const editarLancamentoManual = (_id: string, _patch: Partial<Omit<LancamentoManual, 'id'>>) => {
    // Mantido apenas para compatibilidade de tipos com telas antigas.
  };

  const removerLancamentoManual = (_id: string) => {
    // Mantido apenas para compatibilidade de tipos com telas antigas.
  };

  const registrarLancamentoNoBanco = async () => {
    await unsupported('Lançamentos manuais e movimentos de caixa ainda não existem no backend Nest/Prisma.');
  };

  const resolverPendenciaNoBanco = async () => {
    await unsupported('Pendências de identificação dependem do fluxo antigo /business e não existem no backend Nest/Prisma.');
  };

  const cadastrarClienteNoBanco = addCliente;

  const baixarFiado = async (id: string) => {
    await marcarContaQuitada(id);
  };

  const baixarDespesaFixa = async (id: string) => {
    const conta = data.contas.find((c) => !c.quitado && (c.id === id || c.despesaFixaId === id));
    if (!conta) return;
    await marcarContaQuitada(conta.id);
  };

  const cadastrarDespesaFixaNoBanco: AppDataContextValue['cadastrarDespesaFixaNoBanco'] = async (input) => {
    await addDespesaFixa({ nome: input.nome, valor: input.valor, recorrencia: input.recorrencia });
  };

  const removerDespesaFixaNoBanco = removerDespesaFixa;

  const abrirCaixa = async () => {
    await unsupported('Sessões de caixa ainda não existem no backend Nest/Prisma.');
  };

  const fecharCaixa = async () => {
    await unsupported('Fechamento de caixa ainda não existe no backend Nest/Prisma.');
  };

  const resetData = () => {
    setData(emptyData);
    setSummary(null);
  };

  const restockFromImport = async (itens: { produtoId: string; quantidade: number }[]) => {
    const falhas: { produtoId: string; erro: string }[] = [];
    let sucesso = 0;
    for (const item of itens) {
      try {
        await inventoryApi.adjustStock(item.produtoId, item.quantidade, 'Importação de planilha');
        sucesso += 1;
      } catch (err) {
        falhas.push({ produtoId: item.produtoId, erro: err instanceof ApiError ? err.message : 'Falha desconhecida' });
      }
    }
    await reloadAll();
    return { sucesso, falhas };
  };

  const hoje = todayISO();
  const contasQuitadasHoje = useMemo(
    () => data.contas.filter((c) => c.quitado && c.dataQuitacao === hoje),
    [data.contas, hoje],
  );
  const despesasHoje = useMemo(
    () =>
      contasQuitadasHoje
        .filter((c) => c.tipo === 'pagar')
        .reduce((sum, c) => sum + c.valor, 0),
    [contasQuitadasHoje],
  );
  const contasAPagarHoje = useMemo(
    () => data.contas.filter((c) => c.tipo === 'pagar' && !c.quitado && c.vencimento === hoje),
    [data.contas, hoje],
  );
  const contasAReceberEmAberto = useMemo(
    () => data.contas.filter((c) => c.tipo === 'receber' && !c.quitado),
    [data.contas],
  );

  const produtosEstoqueBaixo = useLowStock(status, data.produtos, ready);

  const value: AppDataContextValue = {
    data,
    setConfig,
    addVenda,
    editarVenda,
    removerVenda,
    addProduto,
    atualizarProduto,
    removerProduto,
    addCategoria,
    editarCategoria,
    removerCategoria,
    addConta,
    editarConta,
    removerConta,
    marcarContaQuitada,
    addCliente,
    editarCliente,
    addDespesaFixa,
    removerDespesaFixa,
    addLancamentoManual,
    editarLancamentoManual,
    removerLancamentoManual,
    registrarVendaNoBanco,
    registrarLancamentoNoBanco,
    resolverPendenciaNoBanco,
    cadastrarClienteNoBanco,
    baixarFiado,
    baixarDespesaFixa,
    cadastrarDespesaFixaNoBanco,
    removerDespesaFixaNoBanco,
    abrirCaixa,
    fecharCaixa,
    resetData,
    restockFromImport,
    saldoCaixa: summary?.cashBalance ?? 0,
    vendasHoje: summary?.todaySales ?? 0,
    despesasHoje,
    lucroEstimadoHoje: summary?.estimatedProfitToday ?? 0,
    resumoPeriodo: { vendas: summary?.periodSales ?? 0, despesas: summary?.periodExpenses ?? 0 },
    vendasUltimos7Dias: summary?.last7Days.map((d) => ({ data: d.date, total: d.total })) ?? [],
    contasAPagarHoje,
    contasAReceberEmAberto,
    contasVencendoEmBreve: overdueAndDueSoon.vencendoEmBreve,
    contasVencidas: overdueAndDueSoon.vencidas,
    contasQuitadasHoje,
    produtosEstoqueBaixo,
    totalNotificacoes: summary?.totalNotifications ?? 0,
  };

  const blocking = status === 'authenticated' && !ready && !location.pathname.startsWith('/onboarding');

  return (
    <AppDataContext.Provider value={value}>{blocking ? <SplashLoading /> : children}</AppDataContext.Provider>
  );
}

function useLowStock(status: string, produtos: Produto[], ready: boolean): Produto[] {
  const [lowStock, setLowStock] = useState<Produto[]>([]);

  useEffect(() => {
    if (status !== 'authenticated' || !ready) {
      setLowStock([]);
      return;
    }
    let cancelled = false;
    inventoryApi.getLowStock().then((products) => {
      if (!cancelled) setLowStock(products.map(productToProduto));
    });
    return () => {
      cancelled = true;
    };
  }, [status, ready, produtos]);

  return lowStock;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider');
  return ctx;
}
