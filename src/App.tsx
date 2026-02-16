import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Veiculos from "./pages/Veiculos";
import Manutencao from "./pages/Manutencao";
import Abastecimento from "./pages/Abastecimento";
import Motoristas from "./pages/Motoristas";
import Pneus from "./pages/Pneus";
import Estoque from "./pages/Estoque";
import Despesas from "./pages/Despesas";
import Licenciamento from "./pages/Licenciamento";
import Seguros from "./pages/Seguros";
import Ocorrencias from "./pages/Ocorrencias";
import Garagem from "./pages/Garagem";
import AiInsights from "./pages/AiInsights";
import Kpis from "./pages/Kpis";
import Relatorios from "./pages/Relatorios";
import Ctes from "./pages/Ctes";
import Receitas from "./pages/Receitas";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Rotas públicas (apenas login)
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Rotas autenticadas
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/veiculos" element={<Veiculos />} />
        <Route path="/manutencao" element={<Manutencao />} />
        <Route path="/abastecimento" element={<Abastecimento />} />
        <Route path="/motoristas" element={<Motoristas />} />
        <Route path="/pneus" element={<Pneus />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/licenciamento" element={<Licenciamento />} />
        <Route path="/seguros" element={<Seguros />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
        <Route path="/garagem" element={<Garagem />} />
        <Route path="/ai-insights" element={<AiInsights />} />
        <Route path="/kpis" element={<Kpis />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/ctes" element={<Ctes />} />
        <Route path="/receitas" element={<Receitas />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
