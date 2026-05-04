import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileDown,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  BarChart2,
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────

function normalizarData(valor) {
  if (!valor) return null;
  if (valor?.toDate) return valor.toDate();
  if (typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return new Date(valor + "T00:00:00");
    return new Date(valor);
  }
  if (valor instanceof Date) return valor;
  return null;
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataBr(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function pct(num, den) {
  if (!den) return "0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

function getDataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── PDF helpers ────────────────────────────────────────────────────────────────

function cabecalhoPDF(doc, titulo, labelPeriodo) {
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("NexusCare Healthcare System", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(titulo, 14, 21);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(
    `Período: ${labelPeriodo}   |   Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
    14,
    35
  );
  return 42;
}

function rodapePDF(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `NexusCare Healthcare System — Documento gerado automaticamente — Pág. ${i} / ${total}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }
}

function gerarPDFPacientes({ total, novosPeriodo, lista, labelPeriodo }) {
  const doc = new jsPDF();
  let y = cabecalhoPDF(doc, "Relatório de Pacientes", labelPeriodo);

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de pacientes cadastrados", String(total)],
      ["Novos pacientes no período", String(novosPeriodo)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 249] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  if (lista.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Pacientes cadastrados no período", 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["#", "Nome", "Telefone", "Data de cadastro"]],
      body: lista.map((p, i) => [
        i + 1,
        p.nome || p.name || "—",
        p.telefone || p.phone || "—",
        p.createdAt ? normalizarData(p.createdAt)?.toLocaleDateString("pt-BR") || "—" : "—",
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
  }

  rodapePDF(doc);
  doc.save("relatorio-pacientes.pdf");
}

function gerarPDFConsultas({ lista, realizadas, canceladas, labelPeriodo }) {
  const doc = new jsPDF();
  let y = cabecalhoPDF(doc, "Relatório de Consultas", labelPeriodo);
  const total = lista.length;

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de consultas", String(total)],
      ["Realizadas / Finalizadas", String(realizadas)],
      ["Canceladas", String(canceladas)],
      ["Agendadas (pendentes)", String(Math.max(0, total - realizadas - canceladas))],
      ["Taxa de comparecimento", pct(realizadas, total)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 249] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Detalhamento das consultas", 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Paciente", "Médico", "Especialidade", "Data", "Hora", "Status"]],
    body: lista.map((c) => [
      c.paciente || c.nomePaciente || "—",
      c.medico || "—",
      c.especialidade || "—",
      c.data || "—",
      c.hora || "—",
      c.status || "—",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

  rodapePDF(doc);
  doc.save("relatorio-consultas.pdf");
}

function gerarPDFFinanceiro({ pagamentos, receita, pendente, labelPeriodo }) {
  const doc = new jsPDF();
  let y = cabecalhoPDF(doc, "Relatório Financeiro", labelPeriodo);

  const pago = pagamentos.filter((p) => ["pago", "paga"].includes(String(p.status || "").toLowerCase()));
  const pendentes = pagamentos.filter((p) => ["pendente", "aguardando"].includes(String(p.status || "").toLowerCase()));

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de registros", String(pagamentos.length)],
      ["Receita confirmada", formatarMoeda(receita)],
      ["Pendente", formatarMoeda(pendente)],
      ["Qtd. pagamentos confirmados", String(pago.length)],
      ["Qtd. pagamentos pendentes", String(pendentes.length)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 249] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Detalhamento financeiro", 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Paciente", "Descrição", "Valor", "Status", "Data"]],
    body: pagamentos.map((p) => [
      p.paciente || p.nomePaciente || p.pacienteNome || "—",
      p.descricao || p.servico || p.tipo || "—",
      formatarMoeda(p.valor),
      p.status || "—",
      (() => {
        const d = normalizarData(p.data || p.createdAt);
        return d ? d.toLocaleDateString("pt-BR") : "—";
      })(),
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

  rodapePDF(doc);
  doc.save("relatorio-financeiro.pdf");
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, cor }) {
  return (
    <div className="rel-kpi">
      <div className="rel-kpi-icon" style={{ background: cor + "18", color: cor }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="rel-kpi-label">{label}</div>
        <div className="rel-kpi-value">{value}</div>
        {sub && <div className="rel-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function FiltroBtn({ ativo, onClick, children }) {
  return (
    <button className={`rel-filtro-btn ${ativo ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Relatorios({
  consultas = [],
  pagamentos = [],
  pacientes = [],
  users = [],
}) {
  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const hoje = getDataHoje();

  const { dataInicioEfetiva, dataFimEfetiva } = useMemo(() => {
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);

    if (periodo === "hoje") {
      const i = new Date();
      i.setHours(0, 0, 0, 0);
      return { dataInicioEfetiva: i, dataFimEfetiva: fim };
    }
    if (periodo === "7") {
      const i = new Date(fim);
      i.setDate(i.getDate() - 7);
      i.setHours(0, 0, 0, 0);
      return { dataInicioEfetiva: i, dataFimEfetiva: fim };
    }
    if (periodo === "personalizado" && dataInicio && dataFim) {
      return {
        dataInicioEfetiva: new Date(dataInicio + "T00:00:00"),
        dataFimEfetiva: new Date(dataFim + "T23:59:59"),
      };
    }
    // padrão: 30 dias
    const i = new Date(fim);
    i.setDate(i.getDate() - 30);
    i.setHours(0, 0, 0, 0);
    return { dataInicioEfetiva: i, dataFimEfetiva: fim };
  }, [periodo, dataInicio, dataFim]);

  const labelPeriodo = useMemo(() => {
    if (periodo === "hoje") return "Hoje — " + formatarDataBr(hoje);
    if (periodo === "7") return "Últimos 7 dias";
    if (periodo === "personalizado" && dataInicio && dataFim)
      return `${formatarDataBr(dataInicio)} a ${formatarDataBr(dataFim)}`;
    return "Últimos 30 dias";
  }, [periodo, dataInicio, dataFim, hoje]);

  function dentroJanela(dataRef) {
    const d = normalizarData(dataRef);
    if (!d) return false;
    return d >= dataInicioEfetiva && d <= dataFimEfetiva;
  }

  const consultasFiltradas = useMemo(
    () => consultas.filter((c) => dentroJanela(c.data || c.createdAt)),
    [consultas, dataInicioEfetiva, dataFimEfetiva]
  );

  const pagamentosFiltrados = useMemo(
    () => pagamentos.filter((p) => dentroJanela(p.dataPagamento || p.data || p.createdAt)),
    [pagamentos, dataInicioEfetiva, dataFimEfetiva]
  );

  const pacientesNovos = useMemo(
    () => pacientes.filter((p) => dentroJanela(p.createdAt)),
    [pacientes, dataInicioEfetiva, dataFimEfetiva]
  );

  const realizadas = useMemo(
    () =>
      consultasFiltradas.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "finalizado" || s === "finalizada";
      }).length,
    [consultasFiltradas]
  );

  const canceladas = useMemo(
    () =>
      consultasFiltradas.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "cancelado" || s === "cancelada";
      }).length,
    [consultasFiltradas]
  );

  const receitaConfirmada = useMemo(
    () =>
      pagamentosFiltrados
        .filter((p) => ["pago", "paga"].includes(String(p.status || "").toLowerCase()))
        .reduce((acc, p) => acc + Number(p.valor || 0), 0),
    [pagamentosFiltrados]
  );

  const receitaPendente = useMemo(
    () =>
      pagamentosFiltrados
        .filter((p) => ["pendente", "aguardando"].includes(String(p.status || "").toLowerCase()))
        .reduce((acc, p) => acc + Number(p.valor || 0), 0),
    [pagamentosFiltrados]
  );

  const porEspecialidade = useMemo(() => {
    const mapa = {};
    consultasFiltradas.forEach((c) => {
      const esp = c.especialidade || c.tipoAtendimento || "Geral";
      if (!mapa[esp]) mapa[esp] = { total: 0, realizadas: 0, canceladas: 0 };
      mapa[esp].total++;
      const s = String(c.status || "").toLowerCase();
      if (s === "finalizado" || s === "finalizada") mapa[esp].realizadas++;
      if (s === "cancelado" || s === "cancelada") mapa[esp].canceladas++;
    });
    return Object.entries(mapa)
      .map(([esp, v]) => ({ especialidade: esp, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [consultasFiltradas]);

  return (
    <div className="rel-page">

      {/* Filtro */}
      <div className="page-card rel-filtro-card">
        <div className="rel-filtro-row">
          <div className="rel-filtro-group">
            <FiltroBtn ativo={periodo === "hoje"} onClick={() => setPeriodo("hoje")}>Hoje</FiltroBtn>
            <FiltroBtn ativo={periodo === "7"} onClick={() => setPeriodo("7")}>7 dias</FiltroBtn>
            <FiltroBtn ativo={periodo === "30"} onClick={() => setPeriodo("30")}>30 dias</FiltroBtn>
            <FiltroBtn ativo={periodo === "personalizado"} onClick={() => setPeriodo("personalizado")}>
              Personalizado
            </FiltroBtn>
          </div>

          {periodo === "personalizado" && (
            <div className="rel-filtro-datas">
              <input className="input" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              <span style={{ color: "#64748b", fontWeight: 600, fontSize: "13px" }}>até</span>
              <input className="input" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          )}

          <div className="rel-filtro-label">
            <Clock size={14} /> Período: <strong>{labelPeriodo}</strong>
          </div>
        </div>
      </div>

      {/* KPIs globais */}
      <div className="rel-kpis-grid">
        <KpiCard icon={Users} label="Total de pacientes" value={pacientes.length} sub={`+${pacientesNovos.length} novos no período`} cor="#0f766e" />
        <KpiCard icon={Calendar} label="Consultas no período" value={consultasFiltradas.length} sub={`Taxa: ${pct(realizadas, consultasFiltradas.length)}`} cor="#2563eb" />
        <KpiCard icon={CheckCircle} label="Realizadas" value={realizadas} sub={`${canceladas} canceladas`} cor="#16a34a" />
        <KpiCard icon={DollarSign} label="Receita confirmada" value={formatarMoeda(receitaConfirmada)} sub={`${formatarMoeda(receitaPendente)} pendente`} cor="#0f766e" />
      </div>

      {/* Cards de relatório */}
      <div className="rel-cards-grid">

        {/* Pacientes */}
        <div className="page-card rel-report-card">
          <div className="rel-report-header">
            <div className="rel-report-icon" style={{ background: "#f0fdf9", color: "#0f766e" }}>
              <Users size={22} />
            </div>
            <div>
              <h3 className="rel-report-title">Relatório de Pacientes</h3>
              <p className="rel-report-sub">Cadastros e novos pacientes</p>
            </div>
          </div>
          <div className="rel-stat-list">
            <div className="rel-stat-row"><span>Total cadastrados</span><strong>{pacientes.length}</strong></div>
            <div className="rel-stat-row"><span>Novos no período</span><strong style={{ color: "#0f766e" }}>{pacientesNovos.length}</strong></div>
            <div className="rel-stat-row"><span>Usuários do sistema</span><strong>{users.length}</strong></div>
          </div>
          <button
            className="primary-btn rel-pdf-btn"
            onClick={() => gerarPDFPacientes({ total: pacientes.length, novosPeriodo: pacientesNovos.length, lista: pacientesNovos, labelPeriodo })}
          >
            <FileDown size={15} /> Gerar PDF
          </button>
        </div>

        {/* Consultas */}
        <div className="page-card rel-report-card">
          <div className="rel-report-header">
            <div className="rel-report-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="rel-report-title">Relatório de Consultas</h3>
              <p className="rel-report-sub">Atendimentos e agendamentos</p>
            </div>
          </div>
          <div className="rel-stat-list">
            <div className="rel-stat-row"><span>Total no período</span><strong>{consultasFiltradas.length}</strong></div>
            <div className="rel-stat-row"><span>Realizadas</span><strong style={{ color: "#16a34a" }}>{realizadas}</strong></div>
            <div className="rel-stat-row"><span>Canceladas</span><strong style={{ color: "#dc2626" }}>{canceladas}</strong></div>
            <div className="rel-stat-row"><span>Taxa de comparecimento</span><strong style={{ color: "#2563eb" }}>{pct(realizadas, consultasFiltradas.length)}</strong></div>
          </div>
          <button
            className="primary-btn rel-pdf-btn"
            style={{ background: "#2563eb" }}
            onClick={() => gerarPDFConsultas({ lista: consultasFiltradas, realizadas, canceladas, labelPeriodo })}
          >
            <FileDown size={15} /> Gerar PDF
          </button>
        </div>

        {/* Financeiro */}
        <div className="page-card rel-report-card">
          <div className="rel-report-header">
            <div className="rel-report-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
              <DollarSign size={22} />
            </div>
            <div>
              <h3 className="rel-report-title">Relatório Financeiro</h3>
              <p className="rel-report-sub">Receitas e pagamentos</p>
            </div>
          </div>
          <div className="rel-stat-list">
            <div className="rel-stat-row"><span>Receita confirmada</span><strong style={{ color: "#16a34a" }}>{formatarMoeda(receitaConfirmada)}</strong></div>
            <div className="rel-stat-row"><span>Pendente</span><strong style={{ color: "#f59e0b" }}>{formatarMoeda(receitaPendente)}</strong></div>
            <div className="rel-stat-row"><span>Total de registros</span><strong>{pagamentosFiltrados.length}</strong></div>
          </div>
          <button
            className="primary-btn rel-pdf-btn"
            style={{ background: "#16a34a" }}
            onClick={() => gerarPDFFinanceiro({ pagamentos: pagamentosFiltrados, receita: receitaConfirmada, pendente: receitaPendente, labelPeriodo })}
          >
            <FileDown size={15} /> Gerar PDF
          </button>
        </div>
      </div>

      {/* Tabela por especialidade */}
      <div className="page-card">
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart2 size={18} color="#0f766e" />
            <h3 style={{ margin: 0 }}>Resumo por Especialidade / Tipo</h3>
          </div>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            {consultasFiltradas.length} consulta(s) · {labelPeriodo}
          </span>
        </div>

        {porEspecialidade.length === 0 ? (
          <div className="muted-box" style={{ textAlign: "center", color: "#94a3b8", padding: "32px" }}>
            Nenhuma consulta no período selecionado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Especialidade / Tipo</th>
                  <th>Total</th>
                  <th>Realizadas</th>
                  <th>Canceladas</th>
                  <th>Pendentes</th>
                  <th>Taxa (%)</th>
                </tr>
              </thead>
              <tbody>
                {porEspecialidade.map((row) => (
                  <tr key={row.especialidade}>
                    <td><strong>{row.especialidade}</strong></td>
                    <td>{row.total}</td>
                    <td><span style={{ color: "#16a34a", fontWeight: 600 }}>{row.realizadas}</span></td>
                    <td><span style={{ color: "#dc2626", fontWeight: 600 }}>{row.canceladas}</span></td>
                    <td>{Math.max(0, row.total - row.realizadas - row.canceladas)}</td>
                    <td>
                      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                        {pct(row.realizadas, row.total)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Clock({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
