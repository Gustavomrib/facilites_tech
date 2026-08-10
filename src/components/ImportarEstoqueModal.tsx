import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { CheckCircle, DownloadSimple, UploadSimple, WarningCircle, XCircle } from '@phosphor-icons/react';
import Modal from './Modal';
import type { Produto } from '../types';

interface ImportarEstoqueModalProps {
  open: boolean;
  onClose: () => void;
  produtos: Produto[];
  onConfirmar: (
    itens: { produtoId: string; quantidade: number }[],
  ) => Promise<{ sucesso: number; falhas: { produtoId: string; erro: string }[] }>;
}

interface LinhaImportacao {
  linha: number;
  identificador: string;
  quantidadeBruta: string;
  status: 'ok' | 'erro';
  erro?: string;
  produtoId?: string;
  produtoNome?: string;
  quantidade?: number;
}

const MODELO_CSV = 'codigo,quantidade\nBEB-001,10\nSERV-001,5\n';

function baixarModelo() {
  const blob = new Blob([MODELO_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-importacao-estoque.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function lerPlanilha(file: File): Promise<Record<string, unknown>[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

function validarLinhas(linhasBrutas: Record<string, unknown>[], produtos: Produto[]): LinhaImportacao[] {
  // Dedup is keyed by the *resolved* product id (set below, after matching) — not
  // the raw typed identifier. A row identifying a product by SKU and another row
  // identifying the very same product by name would otherwise not be caught as a
  // duplicate (two different raw strings, same product), silently double-applying
  // the stock adjustment.
  const produtosVistos = new Set<string>();

  return linhasBrutas.map((linhaBruta, idx) => {
    const linha = idx + 2; // +1 (0-index -> 1-index), +1 (header row not counted in linhasBrutas)
    const porChaveNormalizada = Object.entries(linhaBruta).reduce<Record<string, unknown>>((acc, [k, v]) => {
      acc[k.trim().toLowerCase()] = v;
      return acc;
    }, {});

    const skuBruto = String(porChaveNormalizada['sku'] ?? porChaveNormalizada['codigo'] ?? '').trim();
    const nomeOuIdBruto = String(
      porChaveNormalizada['id'] ??
        porChaveNormalizada['produto'] ??
        porChaveNormalizada['nome'] ??
        porChaveNormalizada['identificador'] ??
        '',
    ).trim();
    // Whichever value was actually used to attempt a match — for display in the
    // preview table when nothing resolves.
    const identificador = skuBruto || nomeOuIdBruto;
    const quantidadeBruta = String(porChaveNormalizada['quantidade'] ?? porChaveNormalizada['qtd'] ?? '').trim();

    if (!skuBruto && !nomeOuIdBruto) {
      return { linha, identificador, quantidadeBruta, status: 'erro' as const, erro: 'Identificador do produto vazio' };
    }

    const quantidade = Number(quantidadeBruta.replace(',', '.'));
    if (!quantidadeBruta || !Number.isFinite(quantidade) || !Number.isInteger(quantidade) || quantidade <= 0) {
      return {
        linha,
        identificador,
        quantidadeBruta,
        status: 'erro' as const,
        erro: 'Quantidade inválida (precisa ser um número inteiro maior que zero)',
      };
    }

    // SKU, when given, is authoritative: match strictly by it and never fall back
    // to the name for that same row — mixing the two within one row is exactly the
    // ambiguity a unique code is meant to remove. Falling back to id-or-name only
    // happens when the row has no SKU value at all (older-template files, or
    // products that don't have a code registered yet).
    const produto = skuBruto
      ? produtos.find((p) => (p.codigo ?? '').trim().toUpperCase() === skuBruto.toUpperCase())
      : produtos.find((p) => p.id === nomeOuIdBruto || p.nome.trim().toLowerCase() === nomeOuIdBruto.toLowerCase());

    if (!produto) {
      return {
        linha,
        identificador,
        quantidadeBruta,
        status: 'erro' as const,
        erro: skuBruto ? 'SKU não encontrado' : 'Produto não encontrado',
      };
    }
    if (produto.tipo === 'servico') {
      return { linha, identificador, quantidadeBruta, status: 'erro' as const, erro: 'Serviços não têm estoque' };
    }
    if (produtosVistos.has(produto.id)) {
      return { linha, identificador, quantidadeBruta, status: 'erro' as const, erro: 'Produto duplicado nesta planilha' };
    }
    produtosVistos.add(produto.id);

    return {
      linha,
      identificador,
      quantidadeBruta,
      status: 'ok' as const,
      produtoId: produto.id,
      produtoNome: produto.nome,
      quantidade,
    };
  });
}

export default function ImportarEstoqueModal({ open, onClose, produtos, onConfirmar }: ImportarEstoqueModalProps) {
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ sucesso: number; falhas: { produtoId: string; erro: string }[] } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setLinhas([]);
    setNomeArquivo('');
    setErroArquivo(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const fechar = () => {
    reiniciar();
    onClose();
  };

  const handleArquivo = async (file: File) => {
    setErroArquivo(null);
    setResultado(null);
    setNomeArquivo(file.name);
    try {
      const linhasBrutas = await lerPlanilha(file);
      if (linhasBrutas.length === 0) {
        setErroArquivo('A planilha está vazia ou não foi possível ler nenhuma linha.');
        setLinhas([]);
        return;
      }
      setLinhas(validarLinhas(linhasBrutas, produtos));
    } catch {
      setErroArquivo('Não foi possível ler este arquivo. Confirme que é um .xlsx ou .csv válido.');
      setLinhas([]);
    }
  };

  const linhasValidas = linhas.filter((l) => l.status === 'ok');
  const linhasInvalidas = linhas.filter((l) => l.status === 'erro');

  const confirmar = async () => {
    if (linhasValidas.length === 0) return;
    setProcessando(true);
    try {
      const itens = linhasValidas.map((l) => ({ produtoId: l.produtoId!, quantidade: l.quantidade! }));
      const res = await onConfirmar(itens);
      setResultado(res);
      setLinhas([]);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Modal open={open} onClose={fechar} title="Importar Planilha de Estoque">
      <div className="space-y-4">
        {resultado ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle size={18} weight="fill" />
              {resultado.sucesso} produto(s) reabastecido(s) com sucesso.
            </div>
            {resultado.falhas.length > 0 && (
              <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <p className="font-medium">{resultado.falhas.length} falha(s) ao aplicar no servidor:</p>
                <ul className="list-inside list-disc text-xs">
                  {resultado.falhas.map((f, i) => (
                    <li key={i}>{f.erro}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={fechar}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-slate-700/50 dark:text-slate-300">
              <p className="mb-2">
                Envie uma planilha (.xlsx ou .csv) com as colunas <strong>código</strong> (SKU do produto) e{' '}
                <strong>quantidade</strong> (a quantidade a somar ao estoque atual). Se um produto ainda não tiver
                código cadastrado, use a coluna <strong>produto</strong> (nome exatamente como cadastrado) no lugar.
              </p>
              <button
                type="button"
                onClick={baixarModelo}
                className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400"
              >
                <DownloadSimple size={14} /> Baixar planilha modelo
              </button>
            </div>

            <label className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 hover:border-blue-400 dark:border-slate-600 dark:text-slate-400">
              <UploadSimple size={20} />
              {nomeArquivo || 'Selecionar arquivo .xlsx ou .csv'}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleArquivo(file);
                }}
              />
            </label>

            {erroArquivo && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{erroArquivo}</p>
            )}

            {linhas.length > 0 && (
              <>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                    <CheckCircle size={14} weight="fill" /> {linhasValidas.length} válida(s)
                  </span>
                  {linhasInvalidas.length > 0 && (
                    <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                      <WarningCircle size={14} weight="fill" /> {linhasInvalidas.length} com erro
                    </span>
                  )}
                </div>

                <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-600">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-slate-700 dark:text-slate-400">
                      <tr>
                        <th className="px-2 py-1.5">Linha</th>
                        <th className="px-2 py-1.5">Produto</th>
                        <th className="px-2 py-1.5">Qtd</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {linhas.map((l) => (
                        <tr key={l.linha}>
                          <td className="px-2 py-1.5 text-gray-500 dark:text-slate-400">{l.linha}</td>
                          <td className="px-2 py-1.5 text-gray-800 dark:text-slate-200">
                            {l.produtoNome ?? l.identificador}
                          </td>
                          <td className="px-2 py-1.5 text-gray-800 dark:text-slate-200">{l.quantidadeBruta}</td>
                          <td className="px-2 py-1.5">
                            {l.status === 'ok' ? (
                              <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                                <CheckCircle size={13} weight="fill" /> OK
                              </span>
                            ) : (
                              <span
                                className="flex items-center gap-1 text-red-600 dark:text-red-400"
                                title={l.erro}
                              >
                                <XCircle size={13} weight="fill" /> {l.erro}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <button
              onClick={confirmar}
              disabled={linhasValidas.length === 0 || processando}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processando
                ? 'Importando...'
                : `Confirmar Importação${linhasValidas.length > 0 ? ` (${linhasValidas.length})` : ''}`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
