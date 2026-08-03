import { useState, type FormEvent } from 'react';
import { Moon, PaperPlaneTilt, Plus, Sun, Trash } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/httpClient';
import * as reportsApi from '../api/reportsApi';
import { formatCurrency, parseMoney } from '../lib/format';
import { applyDarkPreference, getInitialDark } from '../lib/theme';
import { RAMOS_ATUACAO } from '../types';
import type { FrequenciaRelatorio, Oferta, Recorrencia, ViewPeriod } from '../types';

export default function Configuracoes() {
  const { data, setConfig, addDespesaFixa, removerDespesaFixa } = useAppData();
  const { logout } = useAuth();
  const config = data.config;

  const [novaDespesaNome, setNovaDespesaNome] = useState('');
  const [novaDespesaValor, setNovaDespesaValor] = useState('');
  const [novaDespesaRecorrencia, setNovaDespesaRecorrencia] = useState<Recorrencia>('mensal');
  const [darkMode, setDarkMode] = useState(getInitialDark());
  const [enviandoRelatorio, setEnviandoRelatorio] = useState(false);

  if (!config) return null;

  const salvarCampo = (patch: Partial<typeof config>) => {
    void setConfig(patch);
  };

  const adicionarDespesaFixa = async (e: FormEvent) => {
    e.preventDefault();
    const valor = parseMoney(novaDespesaValor);
    if (!novaDespesaNome.trim() || !valor || valor <= 0) return;

    try {
      await addDespesaFixa({ nome: novaDespesaNome.trim(), valor, recorrencia: novaDespesaRecorrencia });
      setNovaDespesaNome('');
      setNovaDespesaValor('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Não foi possível salvar a despesa fixa.');
    }
  };

  const enviarRelatorioAgora = async () => {
    setEnviandoRelatorio(true);
    try {
      await reportsApi.sendReportNow();
      alert(`Relatório enviado para ${config.relatorio.email || '(nenhum e-mail cadastrado)'}.`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Não foi possível enviar o relatório agora.');
    } finally {
      setEnviandoRelatorio(false);
    }
  };

  return (
    <div className="fade-in space-y-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Configurações</h2>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Negócio</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Nome do negócio</label>
            <input
              type="text"
              defaultValue={config.nome}
              onBlur={(e) => salvarCampo({ nome: e.target.value.trim() || config.nome })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Ramo de atuação</label>
            <select
              value={config.categoria}
              onChange={(e) => salvarCampo({ categoria: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {RAMOS_ATUACAO.map((ramo) => (
                <option key={ramo} value={ramo}>
                  {ramo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">O que você oferece?</label>
            <select
              value={config.oferta}
              onChange={(e) => {
                const oferta = e.target.value as Oferta;
                salvarCampo({ oferta, controlaEstoque: oferta !== 'servicos' });
              }}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="produtos">Produtos</option>
              <option value="servicos">Serviços</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">Controla estoque?</span>
            <input
              type="checkbox"
              checked={config.controlaEstoque}
              onChange={(e) => salvarCampo({ controlaEstoque: e.target.checked })}
              className="h-5 w-5 accent-blue-600"
            />
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Meta diária de vendas</label>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={config.metaDiariaVendas ?? ''}
              onBlur={(e) => salvarCampo({ metaDiariaVendas: e.target.value ? parseMoney(e.target.value) : undefined })}
              placeholder="Ex: 600,00"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Painel inicial mostra números de</label>
            <select
              value={config.viewPeriod ?? 'day'}
              onChange={(e) => salvarCampo({ viewPeriod: e.target.value as ViewPeriod })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="day">Dia atual</option>
              <option value="week">Semana (últimos 7 dias)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Aparência</h3>
        <label className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-slate-300">
            {darkMode ? <Moon size={16} /> : <Sun size={16} />} Modo escuro
          </span>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => {
              setDarkMode(e.target.checked);
              applyDarkPreference(e.target.checked);
            }}
            className="h-5 w-5 accent-blue-600"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Despesas fixas</h3>
        <ul className="mb-3 space-y-2">
          {data.despesasFixas.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-slate-500">Nenhuma despesa fixa cadastrada.</p>
          )}
          {data.despesasFixas.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm dark:bg-slate-700/50">
              <span className="text-gray-800 dark:text-slate-200">
                {d.nome} <span className="text-gray-400 dark:text-slate-500">({d.recorrencia})</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-800 dark:text-slate-200">{formatCurrency(d.valor)}</span>
                <button
                  onClick={() => {
                    void removerDespesaFixa(d.id);
                  }}
                  className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                >
                  <Trash size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionarDespesaFixa} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={novaDespesaNome}
            onChange={(e) => setNovaDespesaNome(e.target.value)}
            placeholder="Nome (ex: Aluguel)"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <input
            type="text"
            inputMode="decimal"
            value={novaDespesaValor}
            onChange={(e) => setNovaDespesaValor(e.target.value)}
            placeholder="Valor"
            className="w-24 rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <select
            value={novaDespesaRecorrencia}
            onChange={(e) => setNovaDespesaRecorrencia(e.target.value as Recorrencia)}
            className="rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="mensal">Mensal</option>
            <option value="semanal">Semanal</option>
          </select>
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Plus size={16} /> Add
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Relatórios</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Frequência</label>
            <select
              value={config.relatorio.frequencia}
              onChange={(e) =>
                salvarCampo({
                  relatorio: { ...config.relatorio, frequencia: e.target.value as FrequenciaRelatorio },
                })
              }
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="nenhum">Nenhum</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="ambos">Semanal e mensal</option>
            </select>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">Receber por e-mail</span>
            <input
              type="checkbox"
              checked={config.relatorio.porEmail}
              onChange={(e) => salvarCampo({ relatorio: { ...config.relatorio, porEmail: e.target.checked } })}
              className="h-5 w-5 accent-blue-600"
            />
          </label>
          {config.relatorio.porEmail && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">E-mail</label>
              <input
                type="email"
                defaultValue={config.relatorio.email}
                onBlur={(e) => salvarCampo({ relatorio: { ...config.relatorio, email: e.target.value } })}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          )}
          <button
            onClick={enviarRelatorioAgora}
            disabled={enviandoRelatorio}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            <PaperPlaneTilt size={18} /> {enviandoRelatorio ? 'Enviando...' : 'Enviar relatório agora'}
          </button>
        </div>
      </section>

      <button
        onClick={() => {
          if (confirm('Deseja sair da sua conta?')) {
            void logout();
          }
        }}
        className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400"
      >
        Sair da conta
      </button>
    </div>
  );
}
