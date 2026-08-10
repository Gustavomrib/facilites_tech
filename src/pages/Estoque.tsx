import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { Package, Plus, Wrench, WarningCircle, FileArrowUp } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { ApiError } from '../api/httpClient';
import { formatCurrency, parseMoney } from '../lib/format';
import Modal from '../components/Modal';
import type { Produto } from '../types';

// Code-split: the xlsx parsing library it depends on is large (~400KB) and only
// needed by the small minority of visits that actually open this modal — no
// reason to add that to everyone's initial bundle.
const ImportarEstoqueModal = lazy(() => import('../components/ImportarEstoqueModal'));

type Filtro = 'todos' | 'baixo' | string;

export default function Estoque() {
  const { data, addProduto, atualizarProduto, restockFromImport } = useAppData();
  const controlaEstoque = data.config?.controlaEstoque ?? true;
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<'produto' | 'servico'>(
    controlaEstoque ? 'produto' : 'servico',
  );

  const tituloPagina = controlaEstoque ? 'Estoque' : 'Serviços';

  const categorias = useMemo(() => {
    const set = new Set<string>();
    data.produtos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set);
  }, [data.produtos]);

  const produtosFiltrados = useMemo(() => {
    if (filtro === 'todos') return data.produtos;
    if (filtro === 'baixo') return data.produtos.filter((p) => rastreiaItem(p, controlaEstoque) && p.quantidade <= p.quantidadeMinima);
    return data.produtos.filter((p) => p.categoria === filtro);
  }, [data.produtos, filtro, controlaEstoque]);

  const abrirNovo = () => {
    setProdutoEditando(null);
    setTipoSelecionado(controlaEstoque ? 'produto' : 'servico');
    setModalAberto(true);
  };

  const abrirEdicao = (produto: Produto) => {
    setProdutoEditando(produto);
    setTipoSelecionado(produto.tipo === 'servico' ? 'servico' : 'produto');
    setModalAberto(true);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nome = String(form.get('nome') ?? '').trim();
    const precoVenda = parseMoney(String(form.get('precoVenda') ?? '0'));
    const custoRaw = String(form.get('custo') ?? '').trim();
    const custo = custoRaw ? parseMoney(custoRaw) : undefined;
    const tipo: 'produto' | 'servico' = controlaEstoque ? tipoSelecionado : 'servico';
    const rastreado = tipo === 'produto';
    const quantidade = rastreado ? Math.max(0, Number(form.get('quantidade') ?? 0)) : 0;
    const quantidadeMinima = rastreado ? Math.max(0, Number(form.get('quantidadeMinima') ?? 0)) : 0;
    const categoriaRaw = String(form.get('categoria') ?? '').trim();
    const categoria = categoriaRaw || undefined;
    // SKU only applies to trackable products — meaningless (and not collected) for services.
    const codigoRaw = String(form.get('codigo') ?? '').trim();
    const codigo = rastreado ? codigoRaw || undefined : undefined;

    if (!nome || precoVenda <= 0 || (rastreado && !codigo)) return;

    try {
      if (produtoEditando) {
        await atualizarProduto(produtoEditando.id, {
          nome,
          codigo,
          precoVenda,
          custo,
          quantidade,
          quantidadeMinima,
          categoria,
          tipo,
        });
      } else {
        await addProduto({ nome, codigo, precoVenda, custo, quantidade, quantidadeMinima, categoria, tipo });
      }
      setModalAberto(false);
      setProdutoEditando(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto.');
    }
  };

  const mostrarToggleTipo = controlaEstoque;

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">{tituloPagina}</h2>
        <div className="flex items-center gap-2">
          {controlaEstoque && (
            <button
              onClick={() => setModalImportarAberto(true)}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-300"
            >
              <FileArrowUp size={16} /> Importar
            </button>
          )}
          <button
            onClick={abrirNovo}
            className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Plus size={16} /> {controlaEstoque ? 'Novo' : 'Novo Serviço'}
          </button>
        </div>
      </div>

      <div className="scrollbar-hide mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button
          onClick={() => setFiltro('todos')}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
            filtro === 'todos'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Todos
        </button>
        {controlaEstoque && (
          <button
            onClick={() => setFiltro('baixo')}
            className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
              filtro === 'baixo'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <div className="h-2 w-2 rounded-full bg-red-500" /> Baixo
          </button>
        )}
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
              filtro === cat
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {produtosFiltrados.length === 0 &&
          (data.produtos.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 py-10 text-center dark:border-slate-700">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
                {controlaEstoque ? <Package size={24} /> : <Wrench size={24} />}
              </div>
              <p className="mb-1 text-sm font-medium text-gray-600 dark:text-slate-300">
                {controlaEstoque ? 'Nenhum produto cadastrado ainda' : 'Nenhum serviço cadastrado ainda'}
              </p>
              <p className="mb-4 text-xs text-gray-400 dark:text-slate-500">
                {controlaEstoque
                  ? 'Cadastre seu primeiro produto para controlar o estoque.'
                  : 'Cadastre um serviço (ex: Corte de Cabelo) para vender mais rápido na Frente de Caixa.'}
              </p>
              <button
                onClick={abrirNovo}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> {controlaEstoque ? 'Cadastrar Produto' : 'Cadastrar Serviço'}
              </button>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">Nenhum item encontrado com esse filtro.</p>
          ))}
        {produtosFiltrados.map((produto) => {
          const rastreado = rastreiaItem(produto, controlaEstoque);
          const baixo = rastreado && produto.quantidade <= produto.quantidadeMinima;
          return (
            <div
              key={produto.id}
              className={`flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-800 ${
                baixo ? 'border-red-200 dark:border-red-900/50' : 'border-gray-100 dark:border-slate-700'
              }`}
            >
              <div>
                <h3 className="font-medium text-gray-800 dark:text-slate-100">{produto.nome}</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Preço: {formatCurrency(produto.precoVenda)}
                </p>
              </div>
              <div className="flex flex-col items-end text-right">
                {rastreado ? (
                  <div
                    className={`mb-1 flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${
                      baixo
                        ? 'border-red-200 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400'
                        : 'border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {baixo && <WarningCircle size={14} weight="fill" />}
                    {produto.quantidade} un
                  </div>
                ) : (
                  <div className="mb-1 flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-400">
                    <Wrench size={12} /> Serviço
                  </div>
                )}
                <button
                  onClick={() => abrirEdicao(produto)}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Atualizar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={
          produtoEditando
            ? tipoSelecionado === 'servico'
              ? 'Atualizar Serviço'
              : 'Atualizar Produto'
            : tipoSelecionado === 'servico'
            ? 'Novo Serviço'
            : 'Novo Produto'
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mostrarToggleTipo && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoSelecionado('produto')}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition ${
                  tipoSelecionado === 'produto'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                Produto
              </button>
              <button
                type="button"
                onClick={() => setTipoSelecionado('servico')}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition ${
                  tipoSelecionado === 'servico'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                Serviço
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
              Nome do {tipoSelecionado === 'servico' ? 'Serviço' : 'Produto'}
            </label>
            <input
              name="nome"
              type="text"
              required
              defaultValue={produtoEditando?.nome}
              placeholder={tipoSelecionado === 'servico' ? 'Ex: Corte de Cabelo' : 'Ex: Coca-Cola 2L'}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Categoria (opcional)</label>
            <input
              name="categoria"
              type="text"
              defaultValue={produtoEditando?.categoria}
              placeholder={tipoSelecionado === 'servico' ? 'Ex: Cabelo' : 'Ex: Bebidas'}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Preço</label>
              <input
                name="precoVenda"
                type="text"
                inputMode="decimal"
                required
                defaultValue={produtoEditando?.precoVenda}
                placeholder="Ex: 9,90"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Custo (Opcional)</label>
              <input
                name="custo"
                type="text"
                inputMode="decimal"
                defaultValue={produtoEditando?.custo}
                placeholder="Ex: 5,00"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              />
            </div>
          </div>
          {tipoSelecionado === 'produto' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Código (SKU)</label>
                <input
                  name="codigo"
                  type="text"
                  required
                  defaultValue={produtoEditando?.codigo}
                  placeholder="Ex: BEB-001"
                  className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Qtd Atual</label>
                  <input
                    name="quantidade"
                    type="number"
                    defaultValue={produtoEditando?.quantidade ?? 0}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Estoque Mín.</label>
                  <input
                    name="quantidadeMinima"
                    type="number"
                    defaultValue={produtoEditando?.quantidadeMinima ?? 0}
                    placeholder="Avisar em..."
                    className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  />
                </div>
              </div>
            </>
          )}
          <button type="submit" className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 font-bold text-white">
            {tipoSelecionado === 'servico' ? 'Salvar Serviço' : 'Salvar Produto'}
          </button>
        </form>
      </Modal>

      {modalImportarAberto && (
        <Suspense fallback={null}>
          <ImportarEstoqueModal
            open={modalImportarAberto}
            onClose={() => setModalImportarAberto(false)}
            produtos={data.produtos}
            onConfirmar={restockFromImport}
          />
        </Suspense>
      )}
    </div>
  );
}

function rastreiaItem(produto: Produto, controlaEstoque: boolean): boolean {
  return controlaEstoque && produto.tipo !== 'servico';
}
