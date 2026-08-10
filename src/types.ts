export type Oferta = 'produtos' | 'servicos' | 'ambos';
export type Recorrencia = 'mensal' | 'semanal';
export type FrequenciaRelatorio = 'semanal' | 'mensal' | 'ambos' | 'nenhum';
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado';
export type TipoConta = 'pagar' | 'receber';
export type TipoLancamento = 'entrada' | 'saida';
export type TipoEntrada = 'produto' | 'servico' | 'gorjeta';
export type TipoDespesa =
  | 'mercadoria'
  | 'fornecedor'
  | 'aluguel'
  | 'energia'
  | 'agua'
  | 'internet'
  | 'funcionario'
  | 'combustivel'
  | 'impostos'
  | 'outros';
export type TipoMovimentoCaixa = 'regular' | 'suprimento' | 'sangria';
export type ViewPeriod = 'day' | 'week';

export interface DespesaFixa {
  id: string;
  nome: string;
  valor: number;
  recorrencia: Recorrencia;
  quitado?: boolean;
  pagoEm?: string;
  formaPagamento?: Exclude<FormaPagamento, 'fiado'>;
}

export interface CompanyConfig {
  nome: string;
  categoria: string; // ramo de atuacao; tambem define o tema visual em lib/categoryThemes.ts
  oferta: Oferta;
  controlaEstoque: boolean;
  metaDiariaVendas?: number;
  despesasFixas?: DespesaFixa[];
  relatorio: {
    frequencia: FrequenciaRelatorio;
    porEmail: boolean;
    email?: string;
  };
  viewPeriod: ViewPeriod;
  onboardingConcluido: boolean;
}

export interface Venda {
  id: string;
  caixaSessaoId?: string;
  data: string; // ISO date
  createdAt?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  formaPagamento: FormaPagamento;
  produtoId?: string;
  tipoItem?: 'product' | 'service';
}

export type OrigemTransacao = 'venda' | 'despesa_fixa' | 'despesa_avulsa' | 'ajuste' | 'pagamento_fiado';

export interface TransacaoFinanceira {
  id: string;
  caixaSessaoId?: string;
  tipo: TipoLancamento;
  origem: OrigemTransacao;
  descricao: string;
  valor: number;
  formaPagamento: Exclude<FormaPagamento, 'fiado'> | 'outro';
  ocorridoEm: string;
  clienteId?: string;
  clienteNome?: string;
}

export interface Produto {
  id: string;
  nome: string;
  codigo?: string; // SKU/codigo unico por empresa para produtos de estoque
  categoria?: string;
  tipo?: 'produto' | 'servico';
  type?: 'product' | 'service'; // compatibilidade com telas/relatorios vindos de origin/main
  quantidade: number;
  quantidadeMinima: number;
  precoVenda: number;
  custo?: number;
  duracao?: string;
}

export interface CategoriaProduto {
  id: string;
  nome: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
}

export interface Conta {
  id: string;
  tipo: TipoConta;
  descricao: string;
  valor: number;
  vencimento: string; // ISO date
  quitado: boolean;
  dataQuitacao?: string;
  quitadoEm?: string;
  origemVendaId?: string;
  clienteId?: string;
  despesaFixaId?: string;
}

export interface LancamentoManual {
  id: string;
  data: string;
  createdAt?: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  formaPagamento?: FormaPagamento;
  tipoEntrada?: TipoEntrada;
  tipoDespesa?: TipoDespesa;
  movimentoCaixa?: TipoMovimentoCaixa;
  identificacaoPendente?: boolean;
  caixaSessaoId?: string;
}

export interface SessaoCaixa {
  id: string;
  status: 'open' | 'closed';
  responsavel: string;
  abertoEm: string;
  fechadoEm?: string;
  valorInicial: number;
  vendasDinheiro: number;
  vendasPix: number;
  vendasCartao: number;
  vendasFiado: number;
  suprimentos: number;
  sangrias: number;
  saidasOutros: number;
  dinheiroEsperado: number;
  dinheiroContado?: number;
  diferenca?: number;
  pendenciasIdentificacao: number;
}

export interface AppData {
  config: CompanyConfig | null;
  vendas: Venda[];
  produtos: Produto[];
  categorias: CategoriaProduto[];
  contas: Conta[];
  lancamentosManuais: LancamentoManual[];
  clientes: Cliente[];
  despesasFixas: DespesaFixa[];
  transacoes: TransacaoFinanceira[];
  caixaAtual: SessaoCaixa | null;
  fechamentosCaixa: SessaoCaixa[];
}

export const RAMOS_ATUACAO = [
  'Alimentação (Mercado, Padaria...)',
  'Bar, Restaurante e Lanchonete',
  'Vestuário e Acessórios',
  'Beleza e Cosméticos',
  'Motorista de Aplicativo',
  'Entregas e Motofrete',
  'Manutenção e Reparos',
  'Saúde e Bem-estar',
  'Casa e Construção',
  'Tecnologia e Eletrônicos',
  'Educação e Aulas',
  'Artesanato e Presentes',
  'Serviços',
  'Outros',
] as const;

export const TIPOS_DESPESA: ReadonlyArray<{ valor: TipoDespesa; label: string }> = [
  { valor: 'mercadoria', label: 'Mercadoria' },
  { valor: 'fornecedor', label: 'Fornecedor' },
  { valor: 'aluguel', label: 'Aluguel' },
  { valor: 'energia', label: 'Energia' },
  { valor: 'agua', label: 'Água' },
  { valor: 'internet', label: 'Internet' },
  { valor: 'funcionario', label: 'Funcionário' },
  { valor: 'combustivel', label: 'Combustível' },
  { valor: 'impostos', label: 'Impostos' },
  { valor: 'outros', label: 'Outros' },
];
