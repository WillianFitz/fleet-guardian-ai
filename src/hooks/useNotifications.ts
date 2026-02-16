import { useState, useEffect, useCallback } from "react";
import useStore from "./useStore";
import { Vehicle, Driver, MaintenanceOrder, License, Insurance } from "@/types/fleet";

export interface Notification {
  id: string;
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  timestamp: Date;
  link?: string;
}

export function useNotifications() {
  const { items: vehicles } = useStore<Vehicle>("vehicles", []);
  const { items: drivers } = useStore<Driver>("drivers", []);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", []);
  const { items: licenses } = useStore<License>("licenses", []);
  const { items: insurances } = useStore<Insurance>("insurances", []);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const checkNotifications = useCallback(() => {
    const newNotifications: Notification[] = [];
    const now = new Date();

    // Verifica CNH vencendo
    drivers.forEach((driver) => {
      if (driver.vencimentoCnh) {
        const vencimento = new Date(driver.vencimentoCnh);
        const diffDays = Math.ceil((vencimento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 30) {
          newNotifications.push({
            id: `cnh-${driver.id}`,
            type: diffDays <= 7 ? "error" : "warning",
            title: "CNH Próxima do Vencimento",
            message: `${driver.nome} - CNH vence em ${diffDays} dia(s)`,
            timestamp: now,
            link: "/motoristas",
          });
        }
      }
    });

    // Verifica OS em aberto há muito tempo
    const osAbertas = maintenance.filter((os) => os.status === "aberta");
    if (osAbertas.length > 5) {
      newNotifications.push({
        id: "os-abertas",
        type: "warning",
        title: "Muitas OS Abertas",
        message: `${osAbertas.length} ordens de serviço em aberto`,
        timestamp: now,
        link: "/manutencao",
      });
    }

    // Verifica licenças vencendo
    licenses.forEach((license) => {
      if (license.dataVencimento && license.status !== "pago") {
        const vencimento = new Date(license.dataVencimento);
        const diffDays = Math.ceil((vencimento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= 0) {
          newNotifications.push({
            id: `license-${license.id}`,
            type: diffDays <= 7 ? "error" : "warning",
            title: "Licença Vencendo",
            message: `${license.tipo} do veículo ${license.veiculoPlaca} vence em ${diffDays} dia(s)`,
            timestamp: now,
            link: "/licenciamento",
          });
        }
      }
    });

    // Verifica seguros vencendo
    insurances.forEach((insurance) => {
      if (insurance.vigenciaFim) {
        const vencimento = new Date(insurance.vigenciaFim);
        const diffDays = Math.ceil((vencimento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= 0) {
          newNotifications.push({
            id: `insurance-${insurance.id}`,
            type: diffDays <= 7 ? "error" : "warning",
            title: "Seguro Vencendo",
            message: `Apólice ${insurance.apolice} vence em ${diffDays} dia(s)`,
            timestamp: now,
            link: "/seguros",
          });
        }
      }
    });

    // Verifica veículos sem motorista
    const veiculosSemMotorista = vehicles.filter((v) => !v.motorista || v.motorista === "");
    if (veiculosSemMotorista.length > 0) {
      newNotifications.push({
        id: "veiculos-sem-motorista",
        type: "info",
        title: "Veículos Sem Motorista",
        message: `${veiculosSemMotorista.length} veículo(s) sem motorista atribuído`,
        timestamp: now,
        link: "/veiculos",
      });
    }

    setNotifications(newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, [vehicles, drivers, maintenance, licenses, insurances]);

  useEffect(() => {
    checkNotifications();
    // Atualiza notificações a cada 5 minutos
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  return {
    notifications,
    unreadCount: notifications.length,
    refresh: checkNotifications,
  };
}
