import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  Plus,
  SquaresFour,
  Storefront,
  Trash,
  Wrench,
  type Icon,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/httpClient';
import { RAMOS_ATUACAO } from '../types';
import type { DespesaFixa, Oferta, Recorrencia, ViewPeriod } from '../types';
import { getCategoryTheme } from '../lib/categoryThemes';
import { formatCurrency, parseMoney, sanitizeMoneyInput } from '../lib/format';
import PasswordInput from '../components/PasswordInput';

const TOTAL_STEPS = 4;
const SENHA_REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

const OFERTAS: { valor: Oferta; label: string; Icon: Icon }[] = [
  { valor: 'ambos', label: 'Produtos e Serviços', Icon: SquaresFour },
  { valor: 'produtos', label: 'Apenas Produtos', Icon: Package },
  { valor: 'servicos', label: 'Apenas Serviços', Icon: Wrench },
];

export default function Onboarding() {
  const { setConfig, addDespesaFixa } = useAppData();
  const { register, status } = useAuth();
  const navigate = useNavigate();

  const contaJaCriada = status === 'authenticated';
  const [step, setStep] = useState(0);

  const [nome, setNome] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroConta, setErroConta] = useState<string | null>(null);

  const [categoria, setCategoria] = useState<string>(RAMOS_ATUACAO[0]);
  const [oferta, setOferta] = useState<Oferta>('ambos');
  const [controlaEstoque, setControlaEstoque] = useState(true);
  const [despesasFixas, setDespesasFixas] = useState<DespesaFixa[]>([]);
  const [novaDespesaNome, setNovaDespesaNome] = useState('');
  const [novaDespesaValor, setNovaDespesaValor] = useState('');
  const [novaDespesaRecorrencia, setNovaDespesaRecorrencia] = useState<Recorrencia>('mensal');
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('day');
  const [resumoSemanal, setResumoSemanal] = useState(true);
  const [fechamentoMensal, setFechamentoMensal] = useState(true);
  const [concluindo, setConcluindo] = useState(false);
  const [conclusaoErro, setConclusaoErro] = useState<string | null>(null);

  const selecionarOferta = (valor: Oferta) => {
    setOferta(valor);
    setControlaEstoque(valor !== 'servicos');
  };

  const adicionarDespesa = () => {
    const valor = parseMoney(novaDespesaValor);
    if (!novaDespesaNome.trim() || !valor || valor <= 0) return;
    setDespesasFixas((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}-${prev.length}`,
        nome: novaDespesaNome.trim(),
        valor,
        recorrencia: novaDespesaRecorrencia,
      },
    ]);
    setNovaDespesaNome('');
    setNovaDespesaValor('');
  };

  const passo0Valido =
    nome.trim().length > 0 &&
    (contaJaCriada ||
      (nomeResponsavel.trim().length > 0 &&
        /\S+@\S+\.\S+/.test(email) &&
        senha.length >= 8 &&
        SENHA_REGEX.test(senha)));

  const avancar = () => {
    if (step === 0 && !passo0Valido) return;
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const voltar = () => setStep((s) => Math.max(0, s - 1));

  const concluir = async () => {
    const frequencia =
      resumoSemanal && fechamentoMensal
        ? 'ambos'
        : resumoSemanal
          ? 'semanal'
          : fechamentoMensal
            ? 'mensal'
            : 'nenhum';

    setConcluindo(true);
    setConclusaoErro(null);
    setErroConta(null);
    try {
      if (!contaJaCriada) {
        await register({
          companyName: nome.trim(),
          name: nomeResponsavel.trim(),
          email: email.trim(),
          password: senha,
        });
      }

      await setConfig({
        nome: nome.trim(),
        categoria,
        oferta,
        controlaEstoque,
        relatorio: { frequencia, porEmail: false },
        viewPeriod,
        onboardingConcluido: true,
      });

      for (const despesa of despesasFixas) {
        await addDespesaFixa({
          nome: despesa.nome,
          valor: despesa.valor,
          recorrencia: despesa.recorrencia,
        });
      }

      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível concluir.';
      if (!contaJaCriada) setErroConta(message);
      setConclusaoErro(message);
    } finally {
      setConcluindo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-8 text-white">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-lg shadow-blue-900/50">
        <Storefront size={38} weight="fill" className="text-blue-600" />
      </div>
      <h1 className="mb-1 text-center text-2xl font-extrabold leading-tight tracking-tight">Meu Negócio no Bolso</h1>
      <p className="mb-6 text-center text-xs font-medium text-blue-200">
        Passo {step + 1} de {TOTAL_STEPS}
      </p>

      <div className="mb-6 h-1.5 w-full max-w-sm rounded-full bg-white/20">
        <div
          className="h-1.5 rounded-full bg-white transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="flex w-full max-w-sm flex-1 flex-col overflow-hidden rounded-[2rem] bg-white text-gray-800 shadow-2xl dark:bg-slate-800 dark:text-slate-100">
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="fade-in space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Sua empresa</h2>
              <Field label="Nome do negócio">
                <input
                  type="text"
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Mercadinho da Esquina"
                  className="w-full border-b-2 border-gray-200 bg-transparent py-2 text-lg font-semibold text-gray-800 placeholder-gray-300 transition-colors focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </Field>

              {!contaJaCriada && (
                <div className="space-y-3 rounded-2xl bg-gray-50 p-3 dark:bg-slate-700/50">
                  <Field label="Seu nome">
                    <input
                      type="text"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      placeholder="Ex: Maria Silva"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </Field>
                  <Field label="E-mail">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </Field>
                  <Field label="Senha">
                    <PasswordInput
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mín. 8 caracteres, com maiúscula, minúscula e número"
                      className="w-full rounded-lg border border-gray-300 p-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </Field>
                  {erroConta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{erroConta}</p>}
                </div>
              )}

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Categoria principal
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {RAMOS_ATUACAO.map((ramo) => {
                    const theme = getCategoryTheme(ramo);
                    const Icon = theme.icon;
                    const selecionado = categoria === ramo;
                    return (
                      <button
                        key={ramo}
                        type="button"
                        onClick={() => setCategoria(ramo)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-all duration-150 ${
                          selecionado
                            ? `${theme.ring} ${theme.tint} scale-105 shadow-md`
                            : 'border-gray-100 bg-white hover:border-gray-200 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${
                            selecionado ? `bg-gradient-to-br text-white ${theme.gradient}` : `${theme.tint} ${theme.text}`
                          }`}
                        >
                          <Icon size={22} weight={selecionado ? 'fill' : 'duotone'} />
                        </div>
                        <span className="text-xs font-medium leading-tight text-gray-700 dark:text-slate-300">
                          {ramo}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="fade-in space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Modelo de negócio</h2>
              <div className="space-y-2">
                {OFERTAS.map(({ valor, label, Icon }) => {
                  const selecionado = oferta === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => selecionarOferta(valor)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
                        selecionado
                          ? 'scale-[1.02] border-blue-600 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/40'
                          : 'border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <Icon size={20} weight={selecionado ? 'fill' : 'duotone'} />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
              <label className={`flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-slate-700/50 ${oferta === 'servicos' ? 'opacity-50' : ''}`}>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Gerenciar estoque?</span>
                <input
                  type="checkbox"
                  checked={controlaEstoque}
                  disabled={oferta === 'servicos'}
                  onChange={(e) => setControlaEstoque(e.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Despesas fixas</h2>
              <ul className="space-y-2">
                {despesasFixas.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm dark:bg-slate-700/50">
                    <span>{d.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(d.valor)}</span>
                      <button
                        type="button"
                        onClick={() => setDespesasFixas((prev) => prev.filter((item) => item.id !== d.id))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={novaDespesaNome}
                  onChange={(e) => setNovaDespesaNome(e.target.value)}
                  placeholder="Nome (ex: Aluguel)"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={novaDespesaValor}
                  onChange={(e) => setNovaDespesaValor(sanitizeMoneyInput(e.target.value))}
                  placeholder="Valor"
                  className="w-24 rounded-lg border border-gray-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
                <select
                  value={novaDespesaRecorrencia}
                  onChange={(e) => setNovaDespesaRecorrencia(e.target.value as Recorrencia)}
                  className="rounded-lg border border-gray-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                >
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                </select>
                <button
                  type="button"
                  onClick={adicionarDespesa}
                  className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Preferências</h2>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Painel inicial mostra números de:
                </label>
                <div className="flex gap-2">
                  {(['day', 'week'] as const).map((periodo) => (
                    <button
                      key={periodo}
                      type="button"
                      onClick={() => setViewPeriod(periodo)}
                      className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${
                        viewPeriod === periodo
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'border-gray-100 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {periodo === 'day' ? 'Dia atual' : 'Semana'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-slate-700/50">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Resumo semanal</span>
                <input
                  type="checkbox"
                  checked={resumoSemanal}
                  onChange={(e) => setResumoSemanal(e.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-slate-700/50">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Fechamento mensal</span>
                <input
                  type="checkbox"
                  checked={fechamentoMensal}
                  onChange={(e) => setFechamentoMensal(e.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
            </div>
          )}
        </div>

        {conclusaoErro && <p className="px-4 pt-3 text-center text-xs font-medium text-red-600">{conclusaoErro}</p>}
        <div className="flex items-center gap-3 border-t border-gray-100 p-4 dark:border-slate-700">
          {step > 0 && (
            <button
              type="button"
              onClick={voltar}
              className="flex items-center gap-1 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 transition hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <ArrowLeft size={16} weight="bold" /> Voltar
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={avancar}
              disabled={step === 0 && !passo0Valido}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Avançar <ArrowRight size={18} weight="bold" />
            </button>
          ) : (
            <button
              type="button"
              onClick={concluir}
              disabled={concluindo}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {concluindo ? 'Salvando...' : 'Concluir'} <Check size={18} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
