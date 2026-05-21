import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../services/api";
import { hojeISO, formatarData } from "../utils/dateUtils";
import {
  isFaturamentoConfirmado,
  isPagamentoPendente,
  valorCanonicoPagamento,
} from "../utils/financeUtils";
import {
  FileDown,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  BarChart2,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────

function normalizarData(valor) {
  if (!valor) return null;
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

function pct(num, den) {
  if (!den) return "0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

// ── PDF helpers ────────────────────────────────────────────────────────────────

function cabecalhoPDF(doc, titulo, labelPeriodo) {
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFillColor(109, 40, 217);
  doc.rect(0, 24, 210, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Vynor Clinic", 14, 12);
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
      `Vynor Clinic — Documento gerado automaticamente — Pág. ${i} / ${total}`,
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
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 243, 255] },
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
      headStyles: { fillColor: [30, 27, 75], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
  }

  rodapePDF(doc);
  doc.save("relatorio-pacientes.pdf");
}

function gerarPDFConsultas({ lista, realizadas, canceladas, faltou, labelPeriodo }) {
  const doc = new jsPDF();
  let y = cabecalhoPDF(doc, "Relatório de Consultas", labelPeriodo);
  const total = lista.length;
  const pendentes = Math.max(0, total - realizadas - canceladas - faltou);

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de consultas", String(total)],
      ["Realizadas / Finalizadas", String(realizadas)],
      ["Canceladas", String(canceladas)],
      ["Faltaram / Ausentes", String(faltou)],
      ["Pendentes / Em aberto", String(pendentes)],
      ["Taxa de comparecimento", pct(realizadas, realizadas + faltou)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 243, 255] },
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

  const pago = pagamentos.filter(isFaturamentoConfirmado);
  const pendentes = pagamentos.filter(isPagamentoPendente);

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
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 243, 255] },
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
      formatarMoeda(valorCanonicoPagamento(p)),
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

// ── CSV export ────────────────────────────────────────────────────────────────

function exportarCSV(colunas, linhas, nomeArquivo) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [colunas.map(esc).join(","), ...linhas.map((l) => l.map(esc).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo; a.click();
  URL.revokeObjectURL(url);
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Relatorios({
  consultas = [],
  pagamentos = [],
  pacientes = [],
  users = [],
  onIrParaFinanceiro,
  onIrParaPagamentos,
}) {
  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const hoje = hojeISO();

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
    const i = new Date(fim);
    i.setDate(i.getDate() - 30);
    i.setHours(0, 0, 0, 0);
    return { dataInicioEfetiva: i, dataFimEfetiva: fim };
  }, [periodo, dataInicio, dataFim]);

  const labelPeriodo = useMemo(() => {
    if (periodo === "hoje") return "Hoje — " + formatarData(hoje);
    if (periodo === "7") return "Últimos 7 dias";
    if (periodo === "personalizado" && dataInicio && dataFim)
      return `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
    return "Últimos 30 dias";
  }, [periodo, dataInicio, dataFim, hoje]);

  const dentroJanela = useCallback((dataRef) => {
    const d = normalizarData(dataRef);
    if (!d) return false;
    return d >= dataInicioEfetiva && d <= dataFimEfetiva;
  }, [dataInicioEfetiva, dataFimEfetiva]);

  const consultasFiltradas = useMemo(
    () => consultas.filter((c) => dentroJanela(c.data || c.createdAt)),
    [consultas, dentroJanela]
  );

  const pagamentosFiltrados = useMemo(
    () => pagamentos.filter((p) => dentroJanela(p.dataPagamento || p.data || p.createdAt)),
    [pagamentos, dentroJanela]
  );

  const pacientesNovos = useMemo(
    () => pacientes.filter((p) => dentroJanela(p.createdAt)),
    [pacientes, dentroJanela]
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

  const faltou = useMemo(
    () =>
      consultasFiltradas.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "faltou";
      }).length,
    [consultasFiltradas]
  );

  // Fonte unificada (Fase 2): puxa /financeiro/kpis-unificados para o mesmo período.
  const [kpisUnif, setKpisUnif] = useState(null);
  useEffect(() => {
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let cancel = false;
    api.financeiro.kpisUnificados({ inicio: fmt(dataInicioEfetiva), fim: fmt(dataFimEfetiva) })
      .then(r => { if (!cancel && r?.data?.totais) setKpisUnif(r.data); })
      .catch(() => { if (!cancel) setKpisUnif(null); });
    return () => { cancel = true; };
  }, [dataInicioEfetiva, dataFimEfetiva]);

  const receitaConfirmada = useMemo(() => {
    if (kpisUnif?.totais?.receita_confirmada != null) {
      return Number(kpisUnif.totais.receita_confirmada);
    }
    return pagamentosFiltrados
      .filter(isFaturamentoConfirmado)
      .reduce((acc, p) => acc + valorCanonicoPagamento(p), 0);
  }, [pagamentosFiltrados, kpisUnif]);

  const receitaPendente = useMemo(
    () =>
      pagamentosFiltrados
        .filter(isPagamentoPendente)
        .reduce((acc, p) => acc + valorCanonicoPagamento(p), 0),
    [pagamentosFiltrados]
  );

  const porEspecialidade = useMemo(() => {
    const mapa = {};
    consultasFiltradas.forEach((c) => {
      const esp = c.especialidade || c.tipoAtendimento || "Geral";
      if (!mapa[esp]) mapa[esp] = { total: 0, realizadas: 0, canceladas: 0, faltou: 0 };
      mapa[esp].total++;
      const s = String(c.status || "").toLowerCase();
      if (s === "finalizado" || s === "finalizada") mapa[esp].realizadas++;
      if (s === "cancelado" || s === "cancelada") mapa[esp].canceladas++;
      if (s === "faltou") mapa[esp].faltou++;
    });
    return Object.entries(mapa)
      .map(([esp, v]) => ({ especialidade: esp, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [consultasFiltradas]);

  const porProfissional = useMemo(() => {
    const mapa = {};
    consultasFiltradas.forEach((c) => {
      const nome = c.medico || c.profissional || "Não informado";
      if (!mapa[nome]) mapa[nome] = { total: 0, realizadas: 0, canceladas: 0, receita: 0 };
      mapa[nome].total++;
      const s = String(c.status || "").toLowerCase();
      if (s === "finalizado" || s === "finalizada") mapa[nome].realizadas++;
      if (s === "cancelado" || s === "cancelada") mapa[nome].canceladas++;
    });
    pagamentosFiltrados
      .filter(isFaturamentoConfirmado)
      .forEach((p) => {
        const nome = p.profissional || p.medico || "Não informado";
        if (mapa[nome]) mapa[nome].receita += valorCanonicoPagamento(p);
      });
    return Object.entries(mapa)
      .map(([profissional, v]) => ({ profissional, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [consultasFiltradas, pagamentosFiltrados]);

  // ── render ──────────────────────────────────────────────────────────────────

  // Attendance rate = realized / (realized + absent) — only among resolved outcomes, not pending
  const taxaComparecimento = pct(realizadas, realizadas + faltou);

  const ticketMedio = realizadas > 0 ? receitaConfirmada / realizadas : 0;
  const pendentesContagem = pagamentosFiltrados.filter((p) =>
    ["pendente", "aguardando"].includes(String(p.statusPagamento || p.status || "").toLowerCase())
  ).length;
  const topProfissionalProdutividade = porProfissional.length > 0
    ? [...porProfissional].sort((a, b) => b.realizadas - a.realizadas)[0]
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Barra de filtro ── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
          <Clock size={14} />
          Período:
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { key: "hoje", label: "Hoje" },
            { key: "7", label: "7 dias" },
            { key: "30", label: "30 dias" },
            { key: "personalizado", label: "Personalizado" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              style={{
                padding: "5px 14px",
                borderRadius: "20px",
                border: "1px solid",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: periodo === p.key ? "#0f766e" : "transparent",
                color: periodo === p.key ? "#fff" : "#64748b",
                borderColor: periodo === p.key ? "#0f766e" : "#e2e8f0",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodo === "personalizado" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              className="input"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={{ width: "130px" }}
            />
            <span style={{ color: "#94a3b8", fontSize: "12px" }}>até</span>
            <input
              className="input"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              style={{ width: "130px" }}
            />
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {onIrParaPagamentos && (
            <button onClick={onIrParaPagamentos} style={{
              padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
              border: "1.5px solid #0f766e", background: "transparent", color: "#0f766e", cursor: "pointer",
            }}>
              Pagamentos
            </button>
          )}
          {onIrParaFinanceiro && (
            <button onClick={onIrParaFinanceiro} style={{
              padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
              border: "1.5px solid #6366f1", background: "transparent", color: "#6366f1", cursor: "pointer",
            }}>
              Financeiro
            </button>
          )}
          <div style={{
            fontSize: "12px",
            color: "#475569",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "4px 12px",
            fontWeight: 500,
          }}>
            {labelPeriodo}
          </div>
        </div>
      </div>

      {/* ── Cards de relatório ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >

        {/* Pacientes */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "10px",
                  background: "#f0fdf9",
                  color: "#0f766e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  Relatório de Pacientes
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Cadastros e novos pacientes
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="primary-btn"
                onClick={() => gerarPDFPacientes({ total: pacientes.length, novosPeriodo: pacientesNovos.length, lista: pacientesNovos, labelPeriodo })}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <FileDown size={13} /> PDF
              </button>
              <button
                onClick={() => exportarCSV(
                  ["Nome", "Telefone", "Data de cadastro"],
                  pacientesNovos.map((p) => [p.nome || p.name || "—", p.telefone || p.phone || "—", p.createdAt ? normalizarData(p.createdAt)?.toLocaleDateString("pt-BR") || "—" : "—"]),
                  "pacientes.csv"
                )}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                <FileDown size={13} /> CSV
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div
              style={{
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #f0f4f8",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Total cadastrados
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a" }}>
                {pacientes.length}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#f0fdf9",
                borderRadius: "8px",
                border: "1px solid #d1fae5",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Novos no período
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f766e" }}>
                {pacientesNovos.length}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #f0f4f8",
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "#64748b" }}>Usuários do sistema</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                {users.length}
              </span>
            </div>
          </div>
        </div>

        {/* Consultas */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "10px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  Relatório de Consultas
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Atendimentos e agendamentos
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="primary-btn"
                onClick={() => gerarPDFConsultas({ lista: consultasFiltradas, realizadas, canceladas, faltou, labelPeriodo })}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", background: "#2563eb" }}
              >
                <FileDown size={13} /> PDF
              </button>
              <button
                onClick={() => exportarCSV(
                  ["Paciente", "Médico", "Especialidade", "Data", "Hora", "Status"],
                  consultasFiltradas.map((c) => [c.paciente || c.nomePaciente || "—", c.medico || "—", c.especialidade || "—", c.data || "—", c.hora || "—", c.status || "—"]),
                  "consultas.csv"
                )}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                <FileDown size={13} /> CSV
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div
              style={{
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #f0f4f8",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Total no período
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a" }}>
                {consultasFiltradas.length}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #d1fae5",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Realizadas
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#16a34a" }}>
                {realizadas}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#fef2f2",
                borderRadius: "8px",
                border: "1px solid #fecaca",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Canceladas
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#dc2626" }}>
                {canceladas}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#fff7ed",
                borderRadius: "8px",
                border: "1px solid #fed7aa",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Faltaram / Ausentes
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#ea580c" }}>
                {faltou}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#eff6ff",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "#64748b" }}>Taxa de comparecimento <span style={{ fontSize: "10px", color: "#94a3b8" }}>(realizadas ÷ realizadas+faltou)</span></span>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "#2563eb" }}>
                {taxaComparecimento}
              </span>
            </div>
          </div>
        </div>

        {/* Financeiro */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "10px",
                  background: "#f0fdf4",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <DollarSign size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  Relatório Financeiro
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Receitas e pagamentos
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="primary-btn"
                onClick={() => gerarPDFFinanceiro({ pagamentos: pagamentosFiltrados, receita: receitaConfirmada, pendente: receitaPendente, labelPeriodo })}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", background: "#16a34a" }}
              >
                <FileDown size={13} /> PDF
              </button>
              <button
                onClick={() => exportarCSV(
                  ["Paciente", "Descrição", "Valor", "Status", "Forma de Pagamento", "Data"],
                  pagamentosFiltrados.map((p) => [
                    p.paciente || p.nomePaciente || "—",
                    p.descricao || p.servico || "—",
                    valorCanonicoPagamento(p).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                    p.statusPagamento || p.status || "—",
                    p.formaPagamento || "—",
                    (() => { const d = normalizarData(p.dataPagamento || p.data || p.createdAt); return d ? d.toLocaleDateString("pt-BR") : "—"; })(),
                  ]),
                  "financeiro.csv"
                )}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                <FileDown size={13} /> CSV
              </button>
            </div>
          </div>

          {/* Receita confirmada em destaque */}
          <div
            style={{
              padding: "16px",
              background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
              borderRadius: "10px",
              border: "1px solid #bbf7d0",
              marginBottom: "10px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Receita confirmada
            </div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>
              {formatarMoeda(receitaConfirmada)}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div
              style={{
                padding: "14px",
                background: "#fffbeb",
                borderRadius: "8px",
                border: "1px solid #fde68a",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                <AlertCircle size={11} /> Pendente
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#d97706" }}>
                {formatarMoeda(receitaPendente)}
              </div>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #f0f4f8",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Total de registros
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                {pagamentosFiltrados.length}
              </div>
            </div>
          </div>
        </div>

        {/* ── Indicadores de Gestão ── */}
        <div style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px 24px",
          gridColumn: "1 / -1",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "8px", background: "#f5f3ff", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Indicadores de Gestão</h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>KPIs executivos para tomada de decisão no período</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={{ padding: "16px", background: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Taxa de Comparecimento
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#1d4ed8" }}>{taxaComparecimento}</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                {realizadas} realizadas · {faltou} faltou
              </div>
            </div>
            <div style={{ padding: "16px", background: "#f0fdf9", borderRadius: "10px", border: "1px solid #99f6e4" }}>
              <div style={{ fontSize: "11px", color: "#0f766e", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Ticket Médio
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f766e" }}>{formatarMoeda(ticketMedio)}</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                {realizadas > 0 ? "por consulta realizada" : "sem consultas realizadas"}
              </div>
            </div>
            <div style={{ padding: "16px", background: "#fffbeb", borderRadius: "10px", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "11px", color: "#d97706", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Receita Pendente
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#d97706" }}>{formatarMoeda(receitaPendente)}</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                {pendentesContagem} pagamento{pendentesContagem !== 1 ? "s" : ""} em aberto
              </div>
            </div>
            <div style={{ padding: "16px", background: "#f5f3ff", borderRadius: "10px", border: "1px solid #ddd6fe" }}>
              <div style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Maior Produtividade
              </div>
              {topProfissionalProdutividade ? (
                <>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#6D28D9", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {topProfissionalProdutividade.profissional}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    {topProfissionalProdutividade.realizadas} realizadas · {formatarMoeda(topProfissionalProdutividade.receita)}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "13px", color: "#94a3b8" }}>Sem dados no período</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabela por especialidade ── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "8px",
                background: "#f0fdf9",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BarChart2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Resumo por Especialidade / Tipo
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                Distribuição das consultas no período
              </p>
            </div>
          </div>
          <span
            style={{
              fontSize: "12px",
              color: "#64748b",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              padding: "4px 12px",
            }}
          >
            {consultasFiltradas.length} consulta(s) · {labelPeriodo}
          </span>
        </div>

        {porEspecialidade.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#94a3b8",
              padding: "32px",
              background: "#f8fafc",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          >
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
                  <th>Faltaram</th>
                  <th>Pendentes</th>
                  <th>Taxa (%)</th>
                </tr>
              </thead>
              <tbody>
                {porEspecialidade.map((row) => (
                  <tr key={row.especialidade}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#0f766e",
                            flexShrink: 0,
                          }}
                        />
                        <strong>{row.especialidade}</strong>
                      </div>
                    </td>
                    <td>
                      <strong style={{ fontSize: "14px" }}>{row.total}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          color: "#16a34a",
                          fontWeight: 700,
                          background: "#f0fdf4",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {row.realizadas}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: "#dc2626",
                          fontWeight: 700,
                          background: "#fef2f2",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {row.canceladas}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: "#ea580c",
                          fontWeight: 700,
                          background: "#fff7ed",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {row.faltou}
                      </span>
                    </td>
                    <td style={{ color: "#64748b" }}>
                      {Math.max(0, row.total - row.realizadas - row.canceladas - row.faltou)}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            flex: 1,
                            height: 5,
                            background: "#e2e8f0",
                            borderRadius: "3px",
                            overflow: "hidden",
                            minWidth: "40px",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(row.realizadas + row.faltou) ? (row.realizadas / (row.realizadas + row.faltou)) * 100 : 0}%`,
                              background: "#0f766e",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#0f766e",
                            minWidth: "36px",
                          }}
                        >
                          {pct(row.realizadas, row.realizadas + row.faltou)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabela por profissional ── */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "8px", background: "#f5f3ff", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Desempenho por Profissional</h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>Consultas e receita por médico/profissional no período</p>
            </div>
          </div>
          {porProfissional.length > 0 && (
            <button
              onClick={() => exportarCSV(
                ["Profissional", "Total", "Realizadas", "Canceladas", "Receita"],
                porProfissional.map((r) => [r.profissional, r.total, r.realizadas, r.canceladas, r.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]),
                "profissionais.csv"
              )}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
            >
              <FileDown size={13} /> CSV
            </button>
          )}
        </div>
        {porProfissional.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "32px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
            Nenhuma consulta no período selecionado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Total</th>
                  <th>Realizadas</th>
                  <th>Canceladas</th>
                  <th>Taxa</th>
                  <th>Receita</th>
                </tr>
              </thead>
              <tbody>
                {porProfissional.map((row) => (
                  <tr key={row.profissional}>
                    <td><strong>{row.profissional}</strong></td>
                    <td><strong>{row.total}</strong></td>
                    <td><span style={{ color: "#16a34a", fontWeight: 700, background: "#f0fdf4", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{row.realizadas}</span></td>
                    <td><span style={{ color: "#dc2626", fontWeight: 700, background: "#fef2f2", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{row.canceladas}</span></td>
                    <td style={{ fontWeight: 700, color: "#7C3AED" }}>{pct(row.realizadas, row.realizadas + row.canceladas)}</td>
                    <td style={{ fontWeight: 700, color: "#15803d" }}>{row.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "middle" }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
