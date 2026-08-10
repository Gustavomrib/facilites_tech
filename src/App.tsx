import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppData } from './context/AppDataContext';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import SplashLoading from './components/SplashLoading';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Caixa from './pages/Caixa';
import Estoque from './pages/Estoque';
import Financas from './pages/Financas';
import Configuracoes from './pages/Configuracoes';
import Movimentacoes from './pages/Movimentacoes';
import RelatoriosCaixa from './pages/RelatoriosCaixa';
import RelatorioPeriodo from './pages/RelatorioPeriodo';
import Relatorios from './pages/Relatorios';
import Fechamentos from './pages/Fechamentos';

export default function App() {
  const { status } = useAuth();
  const { data } = useAppData();

  if (status === 'loading') return <SplashLoading />;

  const autenticado = status === 'authenticated';
  const onboardingConcluido = autenticado && (data.config?.onboardingConcluido ?? false);

  if (!autenticado) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/cadastro" element={<Navigate to="/onboarding" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!onboardingConcluido) {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/onboarding" replace />} />
        <Route path="/cadastro" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/cadastro" element={<Navigate to="/" replace />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/caixa" element={<Caixa />} />
        <Route path="/catalogo" element={<Navigate to="/estoque" replace />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/financas" element={<Financas />} />
        <Route path="/movimentacoes" element={<Movimentacoes modo="todas" />} />
        <Route path="/entradas" element={<Movimentacoes modo="vendas" />} />
        <Route path="/vendas" element={<Navigate to="/entradas" replace />} />
        <Route path="/despesas" element={<Movimentacoes modo="saidas" />} />
        <Route path="/fechamentos" element={<Fechamentos />} />
        <Route path="/fechamentos/semanal/:periodo" element={<RelatorioPeriodo tipo="semanal" />} />
        <Route path="/fechamentos/mensal/:periodo" element={<RelatorioPeriodo tipo="mensal" />} />
        <Route path="/fechamentos/:dataRelatorio" element={<RelatoriosCaixa />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/relatorios/diario/:dataRelatorio" element={<RelatoriosCaixa />} />
        <Route path="/relatorios/semanal/:periodo" element={<RelatorioPeriodo tipo="semanal" />} />
        <Route path="/relatorios/mensal/:periodo" element={<RelatorioPeriodo tipo="mensal" />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
