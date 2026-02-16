import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Truck, LayoutDashboard, Wrench, Fuel, DollarSign, Users, Package,
  ShieldCheck, FileText, CircleDot, AlertTriangle, ParkingCircle,
  ChevronLeft, ChevronRight, Settings, Brain, BarChart3, Car, FileBarChart, Menu, X, TrendingUp
} from "lucide-react";

const menuGroups = [
  {
    label: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Brain, label: "IA & Insights", path: "/ai-insights" },
      { icon: BarChart3, label: "KPIs", path: "/kpis" },
      { icon: FileBarChart, label: "Relatórios", path: "/relatorios" },
    ],
  },
  {
    label: "Operacional",
    items: [
      { icon: Truck, label: "Veículos", path: "/veiculos" },
      { icon: Wrench, label: "Manutenção", path: "/manutencao" },
      { icon: Fuel, label: "Abastecimento", path: "/abastecimento" },
      { icon: CircleDot, label: "Pneus", path: "/pneus" },
      { icon: Package, label: "Estoque", path: "/estoque" },
    ],
  },
  {
    label: "Administrativo",
    items: [
      { icon: Users, label: "Motoristas", path: "/motoristas" },
      { icon: FileText, label: "CT-e", path: "/ctes" },
      { icon: TrendingUp, label: "Receitas/Fretes", path: "/receitas" },
      { icon: DollarSign, label: "Despesas", path: "/despesas" },
      { icon: FileText, label: "Licenciamento", path: "/licenciamento" },
      { icon: ShieldCheck, label: "Seguros", path: "/seguros" },
      { icon: AlertTriangle, label: "Ocorrências", path: "/ocorrencias" },
      { icon: ParkingCircle, label: "Garagem", path: "/garagem" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
    ],
  },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[55]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } lg:flex`}
      >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-foreground tracking-tight">FleetCommand</h1>
            <p className="text-[10px] text-muted-foreground">Gestão Inteligente</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {menuGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all group ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
    </>
  );
};

export default AppSidebar;
