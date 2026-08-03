import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignIn, Storefront } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/httpClient';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-8 text-white">
      <Link to="/" className="mb-4 text-sm font-medium text-blue-100 hover:text-white">
        CaixaFácil
      </Link>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-lg shadow-blue-900/50">
        <Storefront size={38} weight="fill" className="text-blue-600" />
      </div>
      <h1 className="mb-1 text-center text-2xl font-extrabold leading-tight tracking-tight">
        Meu Negócio no Bolso
      </h1>
      <p className="mb-6 text-center text-xs font-medium text-blue-200">Entre para continuar</p>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[2rem] bg-white p-6 text-gray-800 shadow-2xl dark:bg-slate-800 dark:text-slate-100"
      >
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            E-mail
          </label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seuemail@exemplo.com"
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            Senha
          </label>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-300 p-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>

        {erro && <p className="text-xs font-medium text-red-600 dark:text-red-400">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className={`mt-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition active:scale-95 ${
            enviando ? 'cursor-not-allowed bg-blue-300 dark:bg-blue-900' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <SignIn size={18} weight="bold" /> {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="text-center text-xs font-medium text-blue-600 dark:text-blue-400"
        >
          Não tem conta? Criar agora
        </button>
      </form>
    </div>
  );
}
