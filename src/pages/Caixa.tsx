import { useMemo, useState } from 'react';
import {
  BookBookmark,
  Camera,
  Check,
  CheckCircle,
  CreditCard,
  MagnifyingGlass,
  Minus,
  Money,
  Plus,
  QrCode,
  ShoppingCartSimple,
  Trash,
  UserCirclePlus,
  type Icon,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { ApiError } from '../api/httpClient';
import { formatCurrency, parseMoney, todayISO } from '../lib/format';
import type { Cliente, FormaPagamento } from '../types';

interface ItemCarrinho {
  key: string;
  produtoId?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

const FORMAS: { forma: FormaPagamento; label: string; Icon: Icon; classes: string }[] = [
  { forma: 'dinheiro', label: 'Dinheiro', Icon: Money, classes: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300' },
  { forma: 'pix', label: 'Pix', Icon: QrCode, classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { forma: 'cartao_credito', label: 'Cartão', Icon: CreditCard, classes: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300' },
  { forma: 'fiado', label: 'Fiado', Icon: BookBookmark, classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
];

export default function Caixa() {
  const { data, addVenda, addCliente } = useAppData();
  const controlaEstoque = data.config?.controlaEstoque ?? true;
  const [busca, setBusca] = useState('');
  const [valorAvulso, setValorAvulso] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState<FormaPagamento | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.trim().toLowerCase();
    return data.produtos
      .filter((p) => p.nome.toLowerCase().includes(termo) || (p.codigo ?? '').toLowerCase().includes(termo))
      .slice(0, 6);
  }, [busca, data.produtos]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return data.clientes.slice(0, 6);
    return data.clientes.filter((c) => c.nome.toLowerCase().includes(termo)).slice(0, 6);
  }, [buscaCliente, data.clientes]);

  const total = carrinho.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);

  const adicionarProduto = (produtoId: string) => {
    const produto = data.produtos.find((p) => p.id === produtoId);
    if (!produto) return;

    const rastreiaEstoque = controlaEstoque && produto.tipo !== 'servico';
    if (rastreiaEstoque) {
      const jaNoCarrinho = carrinho.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;
      if (jaNoCarrinho + 1 > produto.quantidade) {
        alert(`Estoque insuficiente: só há ${produto.quantidade} unidade(s) de "${produto.nome}" disponível.`);
        return;
      }
    }

    setCarrinho((prev) => {
      const existente = prev.find((i) => i.produtoId === produtoId);
      if (existente) {
        return prev.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          key: produto.id,
          produtoId: produto.id,
          descricao: produto.nome,
          quantidade: 1,
          valorUnitario: produto.precoVenda,
        },
      ];
    });
    setBusca('');
  };

  const adicionarAvulso = () => {
    const valor = parseMoney(valorAvulso);
    if (!valor || valor <= 0) return;
    setCarrinho((prev) => [
      ...prev,
      { key: `avulso-${Date.now()}-${prev.length}`, descricao: 'Diversos', quantidade: 1, valorUnitario: valor },
    ]);
    setValorAvulso('');
  };

  const definirQuantidade = (key: string, quantidadeDesejada: number) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        let nova = Number.isFinite(quantidadeDesejada) ? Math.floor(quantidadeDesejada) : item.quantidade;
        nova = Math.max(1, nova);
        if (item.produtoId) {
          const produto = data.produtos.find((p) => p.id === item.produtoId);
          const rastreiaEstoque = controlaEstoque && produto?.tipo !== 'servico';
          if (rastreiaEstoque && produto && nova > produto.quantidade) {
            alert(`Estoque insuficiente: só há ${produto.quantidade} unidade(s) de "${item.descricao}" disponível.`);
            nova = Math.max(1, produto.quantidade);
          }
        }
        return { ...item, quantidade: nova };
      }),
    );
  };

  const selecionarForma = (forma: FormaPagamento) => {
    setFormaSelecionada(forma);
    if (forma !== 'fiado') {
      setClienteSelecionado(null);
      setCadastrandoCliente(false);
    }
  };

  const cadastrarCliente = async () => {
    if (!novoClienteNome.trim()) return;
    try {
      const cliente = await addCliente({
        nome: novoClienteNome.trim(),
        telefone: novoClienteTelefone.trim() || undefined,
      });
      setClienteSelecionado(cliente);
      setCadastrandoCliente(false);
      setNovoClienteNome('');
      setNovoClienteTelefone('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Não foi possível cadastrar o cliente.');
    }
  };

  const finalizarVenda = async () => {
    if (!podeFinalizar) return;

    for (const item of carrinho) {
      if (item.quantidade <= 0 || item.valorUnitario <= 0) {
        alert('Item de venda inválido: quantidade e valor precisam ser maiores que zero.');
        return;
      }
      if (item.produtoId) {
        const produtoAtual = data.produtos.find((p) => p.id === item.produtoId);
        const rastreiaEstoque = controlaEstoque && produtoAtual?.tipo !== 'servico';
        if (rastreiaEstoque && (!produtoAtual || produtoAtual.quantidade < item.quantidade)) {
          alert(
            `Estoque insuficiente: só há ${produtoAtual?.quantidade ?? 0} unidade(s) de "${item.descricao}" disponível.`,
          );
          return;
        }
      }
    }

    const hoje = todayISO();
    setFinalizando(true);
    try {
      for (const item of carrinho) {
        await addVenda(
          {
            data: hoje,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            formaPagamento: formaSelecionada!,
            produtoId: item.produtoId,
          },
          formaSelecionada === 'fiado' && clienteSelecionado ? { clienteId: clienteSelecionado.id } : undefined,
        );
      }
      setCarrinho([]);
      setFormaSelecionada(null);
      setClienteSelecionado(null);
      alert('Venda registrada com sucesso!');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Não foi possível registrar a venda.');
    } finally {
      setFinalizando(false);
    }
  };

  const precisaCliente = formaSelecionada === 'fiado';
  const podeFinalizar =
    !finalizando &&
    carrinho.length > 0 &&
    formaSelecionada !== null &&
    (!precisaCliente || clienteSelecionado !== null);

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Frente de Caixa</h2>
        <button
          onClick={() => alert('Leitura de código de barras simulada — nenhum scanner real conectado.')}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400"
        >
          <Camera size={18} /> Ler Código
        </button>
      </div>

      <div className="flex h-[60vh] flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="relative mb-2">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto por nome ou SKU..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {resultados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-100 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => adicionarProduto(p.id)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  <span>{p.nome}</span>
                  <span className="text-gray-500 dark:text-slate-400">{formatCurrency(p.precoVenda)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-2 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={valorAvulso}
            onChange={(e) => setValorAvulso(e.target.value)}
            placeholder="Ou digite um valor avulso"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <button
            onClick={adicionarAvulso}
            className="whitespace-nowrap rounded-xl bg-blue-50 px-3 text-sm font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          >
            Adicionar
          </button>
        </div>

        <div className="mb-2 flex-1 overflow-y-auto border-b border-gray-100 pb-2 dark:border-slate-700">
          {carrinho.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-slate-500">
              <ShoppingCartSimple size={40} className="mb-2 text-gray-300 dark:text-slate-600" />
              <p className="text-center text-sm">Adicione produtos ou digite um valor avulso.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-700">
              {carrinho.map((item) => {
                const produto = item.produtoId ? data.produtos.find((p) => p.id === item.produtoId) : undefined;
                const rastreiaEstoque = controlaEstoque && produto?.tipo !== 'servico';
                const noLimite = rastreiaEstoque && !!produto && item.quantidade >= produto.quantidade;
                return (
                  <li key={item.key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.descricao}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${item.descricao}`}
                          onClick={() => definirQuantidade(item.key, item.quantidade - 1)}
                          disabled={item.quantidade <= 1}
                          className="flex h-5 w-5 items-center justify-center rounded border border-gray-200 text-gray-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-400"
                        >
                          <Minus size={10} weight="bold" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          aria-label={`Quantidade de ${item.descricao}`}
                          value={item.quantidade}
                          onChange={(e) => definirQuantidade(item.key, Number(e.target.value))}
                          className="w-10 rounded border border-gray-200 bg-transparent px-1 text-center text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-slate-300"
                        />
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${item.descricao}`}
                          onClick={() => definirQuantidade(item.key, item.quantidade + 1)}
                          disabled={noLimite}
                          className="flex h-5 w-5 items-center justify-center rounded border border-gray-200 text-gray-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-400"
                        >
                          <Plus size={10} weight="bold" />
                        </button>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          x {formatCurrency(item.valorUnitario)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-800 dark:text-slate-100">
                        {formatCurrency(item.quantidade * item.valorUnitario)}
                      </span>
                      <button
                        onClick={() => setCarrinho((prev) => prev.filter((i) => i.key !== item.key))}
                        className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-auto">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-medium text-gray-600 dark:text-slate-300">Total a Pagar</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(total)}</span>
          </div>

          <div className={`grid grid-cols-4 gap-2 ${carrinho.length === 0 ? 'pointer-events-none opacity-50' : ''}`}>
            {FORMAS.map(({ forma, label, Icon, classes }) => (
              <button
                key={forma}
                onClick={() => selecionarForma(forma)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium ${classes} ${
                  formaSelecionada === forma ? 'ring-2 ring-blue-600' : ''
                }`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>

          {precisaCliente && (
            <div className="fade-in mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/50 dark:bg-orange-900/20">
              {clienteSelecionado ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-300">
                    <Check size={16} weight="bold" /> {clienteSelecionado.nome}
                  </div>
                  <button
                    onClick={() => setClienteSelecionado(null)}
                    className="text-xs font-medium text-orange-700 underline dark:text-orange-300"
                  >
                    Trocar
                  </button>
                </div>
              ) : cadastrandoCliente ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={novoClienteNome}
                    onChange={(e) => setNovoClienteNome(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={novoClienteTelefone}
                    onChange={(e) => setNovoClienteTelefone(e.target.value)}
                    placeholder="Telefone (opcional)"
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCadastrandoCliente(false)}
                      className="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button onClick={cadastrarCliente} className="flex-1 rounded-lg bg-orange-600 py-2 text-xs font-bold text-white">
                      Cadastrar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                    Quem é o cliente?
                  </p>
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar cliente cadastrado..."
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  {clientesFiltrados.length > 0 && (
                    <ul className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-700">
                      {clientesFiltrados.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => setClienteSelecionado(c)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:text-slate-100 dark:hover:bg-slate-600"
                          >
                            {c.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setCadastrandoCliente(true)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-orange-300 py-2 text-xs font-medium text-orange-700 dark:border-orange-900/50 dark:text-orange-300"
                  >
                    <UserCirclePlus size={16} /> Cadastrar novo cliente
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={finalizarVenda}
            disabled={!podeFinalizar}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-white shadow-md transition ${
              podeFinalizar ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-blue-600 opacity-50'
            }`}
          >
            <CheckCircle size={20} /> {finalizando ? 'Registrando...' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
