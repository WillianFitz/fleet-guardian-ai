import { useState, useRef } from "react";
import { FileText, Download, Calendar, Truck } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle, FuelEntry, MaintenanceOrder, Expense, Tire, License, Insurance } from "@/types/fleet";
import { demoVehicles, demoFuelEntries, demoMaintenanceOrders, demoExpenses, demoTires, demoLicenses, demoInsurances } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const Relatorios = () => {
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: fuel } = useStore<FuelEntry>("fuel", demoFuelEntries);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", demoMaintenanceOrders);
  const { items: expenses } = useStore<Expense>("expenses", demoExpenses);
  const { items: tires } = useStore<Tire>("tires", demoTires);
  const { items: licenses } = useStore<License>("licenses", demoLicenses);
  const { items: insurances } = useStore<Insurance>("insurances", demoInsurances);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [dateStart, setDateStart] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [dateEnd, setDateEnd] = useState<string>(new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Filtrar dados do veículo selecionado no período
  const filteredFuel = fuel.filter(f => 
    f.veiculoPlaca === selectedVehicle?.placa && 
    f.data >= dateStart && 
    f.data <= dateEnd
  );

  const filteredMaintenance = maintenance.filter(m => 
    m.veiculoId === selectedVehicleId && 
    m.data >= dateStart && 
    m.data <= dateEnd
  );

  const filteredExpenses = expenses.filter(e => 
    e.veiculoPlaca === selectedVehicle?.placa && 
    e.data >= dateStart && 
    e.data <= dateEnd
  );

  const filteredTires = tires.filter(t => 
    t.veiculoPlaca === selectedVehicle?.placa
  );

  const filteredLicenses = licenses.filter(l => 
    l.veiculoPlaca === selectedVehicle?.placa
  );

  const filteredInsurances = insurances.filter(i => 
    i.veiculoPlaca === selectedVehicle?.placa
  );

  // Calcular totais
  const totalFuel = filteredFuel.reduce((sum, f) => sum + f.valor, 0);
  const totalMaintenance = filteredMaintenance.reduce((sum, m) => sum + m.custo, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.valor, 0);
  const totalCost = totalFuel + totalMaintenance + totalExpenses;

  const generatePDF = async () => {
    if (!selectedVehicle) {
      toast({ title: "Selecione um veículo", variant: "destructive" });
      return;
    }

    if (!reportRef.current) {
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const marginX = (pdfWidth - imgScaledWidth) / 2;
      const marginY = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, "PNG", marginX, marginY, imgScaledWidth, imgScaledHeight);

      const fileName = `Relatorio_${selectedVehicle.placa}_${dateStart}_${dateEnd}.pdf`;
      pdf.save(fileName);
      toast({ title: "Relatório gerado com sucesso!" });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gere relatórios em PDF dos custos e informações dos veículos</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Selecionar Veículo
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">Selecione um veículo...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.modelo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data Inicial
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data Final
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>

        <button
          onClick={generatePDF}
          disabled={!selectedVehicle || generating}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {generating ? "Gerando PDF..." : "Gerar Relatório em PDF"}
        </button>
      </div>

      {selectedVehicle && (
        <div ref={reportRef} className="glass-card p-8 bg-white text-black" style={{ minHeight: "297mm", width: "210mm", margin: "0 auto" }}>
          {/* Cabeçalho */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-3xl font-bold mb-2">Relatório de Veículo</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Placa:</strong> {selectedVehicle.placa}</p>
                <p><strong>Modelo:</strong> {selectedVehicle.modelo}</p>
                <p><strong>Tipo:</strong> {selectedVehicle.tipo}</p>
              </div>
              <div>
                <p><strong>Ano:</strong> {selectedVehicle.ano}</p>
                <p><strong>KM Atual:</strong> {selectedVehicle.km.toLocaleString("pt-BR")}</p>
                <p><strong>Status:</strong> {selectedVehicle.status}</p>
              </div>
            </div>
            <p className="mt-2 text-sm"><strong>Período:</strong> {new Date(dateStart).toLocaleDateString("pt-BR")} até {new Date(dateEnd).toLocaleDateString("pt-BR")}</p>
            <p className="text-xs text-gray-600 mt-2">Gerado em: {new Date().toLocaleString("pt-BR")}</p>
          </div>

          {/* Resumo de Custos */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Resumo de Custos</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-100 p-3 rounded">
                <p className="font-semibold">Combustível</p>
                <p className="text-lg font-bold">R$ {totalFuel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-600">{filteredFuel.length} abastecimentos</p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="font-semibold">Manutenção</p>
                <p className="text-lg font-bold">R$ {totalMaintenance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-600">{filteredMaintenance.length} ordens de serviço</p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="font-semibold">Despesas</p>
                <p className="text-lg font-bold">R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-600">{filteredExpenses.length} despesas</p>
              </div>
              <div className="bg-blue-100 p-3 rounded border-2 border-blue-500">
                <p className="font-semibold">Total Geral</p>
                <p className="text-xl font-bold">R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Abastecimentos */}
          {filteredFuel.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Abastecimentos</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1 text-left">Data</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Litros</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Valor</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">KM</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Consumo</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Posto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFuel.map((f) => (
                    <tr key={f.id}>
                      <td className="border border-gray-400 px-2 py-1">{new Date(f.data).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-400 px-2 py-1">{f.litros.toFixed(2)}L</td>
                      <td className="border border-gray-400 px-2 py-1">R$ {f.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-400 px-2 py-1">{f.kmAtual.toLocaleString("pt-BR")}</td>
                      <td className="border border-gray-400 px-2 py-1">{f.consumo.toFixed(2)} km/L</td>
                      <td className="border border-gray-400 px-2 py-1">{f.posto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Manutenções */}
          {filteredMaintenance.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Manutenções</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1 text-left">OS</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Data</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Tipo</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Descrição</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Custo</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaintenance.map((m) => (
                    <tr key={m.id}>
                      <td className="border border-gray-400 px-2 py-1">{m.numero}</td>
                      <td className="border border-gray-400 px-2 py-1">{new Date(m.data).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-400 px-2 py-1">{m.tipo}</td>
                      <td className="border border-gray-400 px-2 py-1">{m.descricao}</td>
                      <td className="border border-gray-400 px-2 py-1">R$ {m.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-400 px-2 py-1">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Despesas */}
          {filteredExpenses.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Despesas</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1 text-left">Data</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Descrição</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Categoria</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Valor</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id}>
                      <td className="border border-gray-400 px-2 py-1">{new Date(e.data).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-400 px-2 py-1">{e.descricao}</td>
                      <td className="border border-gray-400 px-2 py-1">{e.categoria}</td>
                      <td className="border border-gray-400 px-2 py-1">R$ {e.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-400 px-2 py-1">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pneus */}
          {filteredTires.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Pneus</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1 text-left">Código</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Marca/Modelo</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Posição</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Sulco (mm)</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTires.map((t) => (
                    <tr key={t.id}>
                      <td className="border border-gray-400 px-2 py-1">{t.codigo}</td>
                      <td className="border border-gray-400 px-2 py-1">{t.marca} {t.modelo}</td>
                      <td className="border border-gray-400 px-2 py-1">{t.posicao}</td>
                      <td className="border border-gray-400 px-2 py-1">{t.sulco}mm</td>
                      <td className="border border-gray-400 px-2 py-1">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Licenciamentos */}
          {filteredLicenses.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Licenciamentos</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1 text-left">Tipo</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Ano Referência</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Vencimento</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Valor</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((l) => (
                    <tr key={l.id}>
                      <td className="border border-gray-400 px-2 py-1">{l.tipo}</td>
                      <td className="border border-gray-400 px-2 py-1">{l.anoReferencia}</td>
                      <td className="border border-gray-400 px-2 py-1">{new Date(l.dataVencimento).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-400 px-2 py-1">R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-400 px-2 py-1">{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Seguros */}
          {filteredInsurances.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-2">Seguros</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1 text-left">Apólice</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Seguradora</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Vigência</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Prêmio</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInsurances.map((i) => (
                    <tr key={i.id}>
                      <td className="border border-gray-400 px-2 py-1">{i.apolice}</td>
                      <td className="border border-gray-400 px-2 py-1">{i.seguradora}</td>
                      <td className="border border-gray-400 px-2 py-1">
                        {new Date(i.vigenciaInicio).toLocaleDateString("pt-BR")} até {new Date(i.vigenciaFim).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="border border-gray-400 px-2 py-1">R$ {i.valorPremio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-400 px-2 py-1">{i.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-center text-gray-600">
            <p>Fleet Guardian AI - Sistema de Gestão de Frotas</p>
          </div>
        </div>
      )}

      {!selectedVehicle && (
        <div className="glass-card p-12 text-center">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Selecione um veículo e um período para gerar o relatório</p>
        </div>
      )}
    </div>
  );
};

export default Relatorios;
