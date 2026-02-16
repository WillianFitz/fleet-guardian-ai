import { useState, useRef } from "react";
import { FileText, Download, Calendar, Truck } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle, FuelEntry, MaintenanceOrder, Expense, Tire, License, Insurance } from "@/types/fleet";
import { demoVehicles, demoFuelEntries, demoMaintenanceOrders, demoExpenses, demoTires, demoLicenses, demoInsurances } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// Estilos para evitar quebra de página dentro de elementos
const pageBreakStyle = {
  pageBreakInside: "avoid" as const,
  breakInside: "avoid" as const,
};

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
      const element = reportRef.current;
      if (!element) return;

      // Esperar um pouco para garantir que o conteúdo está renderizado
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        allowTaint: true,
        removeContainer: false,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Margens
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calcular escala para caber na largura
      const ratio = contentWidth / imgWidth;
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      
      // Calcular altura em pixels equivalente à altura do conteúdo do PDF
      const pageHeightInPixels = Math.ceil(contentHeight / ratio);
      
      // Calcular número de páginas necessárias
      const totalPages = Math.ceil(imgHeight / pageHeightInPixels);
      
      // Processar cada página
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }
        
        // Calcular a área da imagem original que será exibida nesta página
        const sourceY = page * pageHeightInPixels;
        const sourceHeight = Math.min(pageHeightInPixels, imgHeight - sourceY);
        
        // Criar canvas temporário para esta página
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
          throw new Error("Não foi possível criar contexto do canvas");
        }
        
        tempCanvas.width = imgWidth;
        tempCanvas.height = sourceHeight;
        
        // Preencher com fundo branco
        tempCtx.fillStyle = "#ffffff";
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Copiar apenas a parte relevante da imagem original
        tempCtx.drawImage(
          canvas,
          0, sourceY, imgWidth, sourceHeight,  // Área de origem
          0, 0, imgWidth, sourceHeight          // Área de destino
        );
        
        // Converter para imagem e adicionar ao PDF
        const pageImgData = tempCanvas.toDataURL("image/png", 1.0);
        const pageImgScaledHeight = sourceHeight * ratio;
        
        pdf.addImage(
          pageImgData,
          "PNG",
          margin,
          margin,
          imgScaledWidth,
          pageImgScaledHeight
        );
      }

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

      <div className="glass-card p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div 
          ref={reportRef} 
          className="bg-white text-gray-900 w-full max-w-[210mm] mx-auto" 
          style={{ 
            minHeight: "297mm",
            padding: "20mm", 
            fontFamily: "Arial, sans-serif",
            backgroundColor: "#ffffff",
            color: "#1f2937",
            boxSizing: "border-box"
          }}
        >
          {/* Cabeçalho */}
          <div className="mb-8 pb-6 border-b-4 border-blue-600">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-900 mb-1">RELATÓRIO DE VEÍCULO</h1>
                <p className="text-xs sm:text-sm text-gray-600">Fleet Guardian AI - Sistema de Gestão de Frotas</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded">
                  <p className="text-xs font-semibold uppercase">Placa</p>
                  <p className="text-xl sm:text-2xl font-bold">{selectedVehicle.placa}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-sm mt-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-600 uppercase mb-1">Modelo</p>
                <p className="font-bold text-base">{selectedVehicle.modelo}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-600 uppercase mb-1">Tipo / Ano</p>
                <p className="font-bold text-base">{selectedVehicle.tipo} - {selectedVehicle.ano}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-600 uppercase mb-1">KM Atual</p>
                <p className="font-bold text-base">{selectedVehicle.km.toLocaleString("pt-BR")} km</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="bg-blue-100 px-4 py-2 rounded">
                <p className="text-xs text-gray-700"><strong>Período:</strong> {new Date(dateStart).toLocaleDateString("pt-BR")} até {new Date(dateEnd).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className="text-xs text-gray-500">Gerado em: {new Date().toLocaleString("pt-BR")}</p>
            </div>
          </div>

          {/* Resumo de Custos */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-blue-900 pb-2 border-b-2 border-blue-600">RESUMO DE CUSTOS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border-2 border-yellow-400">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm text-gray-700 uppercase">Combustível</p>
                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded font-bold">{filteredFuel.length}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">R$ {totalFuel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-600 mt-1">abastecimentos registrados</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-400">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm text-gray-700 uppercase">Manutenção</p>
                  <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded font-bold">{filteredMaintenance.length}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">R$ {totalMaintenance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-600 mt-1">ordens de serviço</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-2 border-purple-400">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm text-gray-700 uppercase">Despesas</p>
                  <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded font-bold">{filteredExpenses.length}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-600 mt-1">despesas diversas</p>
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-lg border-2 border-blue-800 shadow-lg">
                <p className="font-bold text-sm text-blue-100 uppercase mb-2">Total Geral</p>
                <p className="text-3xl font-bold text-white">R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-blue-200 mt-1">custo total do período</p>
              </div>
            </div>
          </div>

          {/* Abastecimentos */}
          {filteredFuel.length > 0 && (
            <div className="mb-8" style={pageBreakStyle}>
              <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-900 pb-2 border-b-2 border-blue-600">ABASTECIMENTOS</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-blue-800 px-3 py-2 text-left font-bold">Data</th>
                    <th className="border border-blue-800 px-3 py-2 text-left font-bold">Litros</th>
                    <th className="border border-blue-800 px-3 py-2 text-left font-bold">Valor</th>
                    <th className="border border-blue-800 px-3 py-2 text-left font-bold">KM</th>
                    <th className="border border-blue-800 px-3 py-2 text-left font-bold">Consumo</th>
                    <th className="border border-blue-800 px-3 py-2 text-left font-bold">Posto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFuel.map((f, idx) => (
                    <tr key={f.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2 font-medium">{new Date(f.data).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-300 px-3 py-2">{f.litros.toFixed(2)}L</td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-green-700">R$ {f.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-300 px-3 py-2">{f.kmAtual.toLocaleString("pt-BR")}</td>
                      <td className="border border-gray-300 px-3 py-2">{f.consumo.toFixed(2)} km/L</td>
                      <td className="border border-gray-300 px-3 py-2">{f.posto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Manutenções */}
          {filteredMaintenance.length > 0 && (
            <div className="mb-8" style={pageBreakStyle}>
              <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-900 pb-2 border-b-2 border-blue-600">MANUTENÇÕES</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-orange-600 text-white">
                    <th className="border border-orange-800 px-3 py-2 text-left font-bold">OS</th>
                    <th className="border border-orange-800 px-3 py-2 text-left font-bold">Data</th>
                    <th className="border border-orange-800 px-3 py-2 text-left font-bold">Tipo</th>
                    <th className="border border-orange-800 px-3 py-2 text-left font-bold">Descrição</th>
                    <th className="border border-orange-800 px-3 py-2 text-left font-bold">Custo</th>
                    <th className="border border-orange-800 px-3 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaintenance.map((m, idx) => (
                    <tr key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2 font-mono font-bold text-blue-700">{m.numero}</td>
                      <td className="border border-gray-300 px-3 py-2">{new Date(m.data).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${m.tipo === "preventiva" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2">{m.descricao}</td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-red-700">R$ {m.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          m.status === "concluida" ? "bg-green-100 text-green-800" :
                          m.status === "em_andamento" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Despesas */}
          {filteredExpenses.length > 0 && (
            <div className="mb-8" style={pageBreakStyle}>
              <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-900 pb-2 border-b-2 border-blue-600">DESPESAS</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-purple-600 text-white">
                    <th className="border border-purple-800 px-3 py-2 text-left font-bold">Data</th>
                    <th className="border border-purple-800 px-3 py-2 text-left font-bold">Descrição</th>
                    <th className="border border-purple-800 px-3 py-2 text-left font-bold">Categoria</th>
                    <th className="border border-purple-800 px-3 py-2 text-left font-bold">Valor</th>
                    <th className="border border-purple-800 px-3 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e, idx) => (
                    <tr key={e.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2">{new Date(e.data).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-300 px-3 py-2">{e.descricao}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">{e.categoria}</span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-purple-700">R$ {e.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          e.status === "pago" ? "bg-green-100 text-green-800" :
                          e.status === "pendente" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Pneus */}
          {filteredTires.length > 0 && (
            <div className="mb-8" style={pageBreakStyle}>
              <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-900 pb-2 border-b-2 border-blue-600">PNEUS</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-teal-600 text-white">
                    <th className="border border-teal-800 px-3 py-2 text-left font-bold">Código</th>
                    <th className="border border-teal-800 px-3 py-2 text-left font-bold">Marca/Modelo</th>
                    <th className="border border-teal-800 px-3 py-2 text-left font-bold">Posição</th>
                    <th className="border border-teal-800 px-3 py-2 text-left font-bold">Sulco (mm)</th>
                    <th className="border border-teal-800 px-3 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTires.map((t, idx) => (
                    <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2 font-mono font-bold">{t.codigo}</td>
                      <td className="border border-gray-300 px-3 py-2">{t.marca} {t.modelo}</td>
                      <td className="border border-gray-300 px-3 py-2 font-bold">{t.posicao}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`font-bold ${
                          t.sulco <= 4 ? "text-red-600" :
                          t.sulco <= 8 ? "text-yellow-600" :
                          "text-green-600"
                        }`}>
                          {t.sulco}mm
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          t.status === "em_uso" ? "bg-blue-100 text-blue-800" :
                          t.status === "novo" ? "bg-green-100 text-green-800" :
                          t.status === "recapado" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Licenciamentos */}
          {filteredLicenses.length > 0 && (
            <div className="mb-8" style={pageBreakStyle}>
              <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-900 pb-2 border-b-2 border-blue-600">LICENCIAMENTOS</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="border border-indigo-800 px-3 py-2 text-left font-bold">Tipo</th>
                    <th className="border border-indigo-800 px-3 py-2 text-left font-bold">Ano Referência</th>
                    <th className="border border-indigo-800 px-3 py-2 text-left font-bold">Vencimento</th>
                    <th className="border border-indigo-800 px-3 py-2 text-left font-bold">Valor</th>
                    <th className="border border-indigo-800 px-3 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((l, idx) => (
                    <tr key={l.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2 font-bold uppercase">{l.tipo}</td>
                      <td className="border border-gray-300 px-3 py-2">{l.anoReferencia}</td>
                      <td className="border border-gray-300 px-3 py-2">{new Date(l.dataVencimento).toLocaleDateString("pt-BR")}</td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-indigo-700">R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          l.status === "pago" ? "bg-green-100 text-green-800" :
                          l.status === "vencido" ? "bg-red-100 text-red-800" :
                          l.status === "pendente" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Seguros */}
          {filteredInsurances.length > 0 && (
            <div className="mb-8" style={pageBreakStyle}>
              <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-900 pb-2 border-b-2 border-blue-600">SEGUROS</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-green-600 text-white">
                    <th className="border border-green-800 px-3 py-2 text-left font-bold">Apólice</th>
                    <th className="border border-green-800 px-3 py-2 text-left font-bold">Seguradora</th>
                    <th className="border border-green-800 px-3 py-2 text-left font-bold">Vigência</th>
                    <th className="border border-green-800 px-3 py-2 text-left font-bold">Prêmio</th>
                    <th className="border border-green-800 px-3 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInsurances.map((i, idx) => (
                    <tr key={i.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2 font-mono font-bold">{i.apolice}</td>
                      <td className="border border-gray-300 px-3 py-2">{i.seguradora}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        {new Date(i.vigenciaInicio).toLocaleDateString("pt-BR")} até {new Date(i.vigenciaFim).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-green-700">R$ {i.valorPremio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          i.status === "ativa" ? "bg-green-100 text-green-800" :
                          i.status === "vencida" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé */}
          <div className="mt-12 pt-6 border-t-2 border-blue-600 text-center">
            <p className="text-sm font-bold text-blue-900 mb-1">Fleet Guardian AI</p>
            <p className="text-xs text-gray-600">Sistema de Gestão de Frotas</p>
            <p className="text-xs text-gray-500 mt-2">Este relatório foi gerado automaticamente pelo sistema</p>
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
