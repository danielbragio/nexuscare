import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { hojeISO, formatarData } from "../utils/dateUtils";
import {
  isFaturamentoConfirmado,
  isPagamentoPendente,
  valorCanonicoPagamento,
} from "../utils/financeUtils";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Print recibo ───────────────────────────────────────────────────────────────

function imprimirRecibo(atendimento, pagamento) {
  const numero = `RC-${String(pagamento.id || Date.now()).padStart(8, "0")}`;
  const stLower = (pagamento.statusPagamento || "").toLowerCase();
  const badgeBg = stLower === "pago" ? "#dcfce7" : stLower === "pendente" ? "#fef9c3" : "#f3f4f6";
  const badgeClr = stLower === "pago" ? "#166534" : stLower === "pendente" ? "#854d0e" : "#374151";
  const valorFmt = Number(pagamento.valorFinal || pagamento.valor || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const w = window.open("", "_blank", "width=580,height=740");
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recibo ${numero}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8f6ff;padding:32px;color:#1e1b4b}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(124,58,237,.15);max-width:480px;margin:0 auto;overflow:hidden}
  .hdr{background:linear-gradient(135deg,#7C3AED 0%,#6D28D9 100%);color:#fff;padding:24px 28px}
  .hdr h1{font-size:20px;font-weight:700;letter-spacing:.5px}
  .hdr .num{font-size:12px;opacity:.85;margin-top:4px;letter-spacing:1px}
  .body{padding:24px 28px}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
  .row:last-child{border-bottom:none}
  .lbl{color:#6b7280;font-weight:500}
  .val{color:#111827;font-weight:600;text-align:right;max-width:60%}
  .total-row{display:flex;justify-content:space-between;padding:14px 0;margin-top:8px;border-top:2px solid #7C3AED}
  .total-lbl{font-size:15px;font-weight:700;color:#374151}
  .total-val{font-size:22px;font-weight:800;color:#7C3AED}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${badgeBg};color:${badgeClr}}
  .ftr{background:#f5f3ff;padding:14px 28px;font-size:11px;color:#7C3AED;border-top:1px solid #ede9fe;text-align:center}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none}}
</style></head>
<body>
  <div class="card">
    <div class="hdr">
      <h1>Recibo de Pagamento</h1>
      <div class="num">${numero}</div>
    </div>
    <div class="body">
      <div class="row"><span class="lbl">Paciente</span><span class="val">${pagamento.nomePaciente || atendimento?.paciente || "—"}</span></div>
      <div class="row"><span class="lbl">Serviço</span><span class="val">${pagamento.descricao || pagamento.tipoAtendimento || "—"}</span></div>
      <div class="row"><span class="lbl">Forma de pagamento</span><span class="val">${pagamento.formaPagamento || "—"}</span></div>
      <div class="row"><span class="lbl">Data</span><span class="val">${formatarData(pagamento.dataPagamento || pagamento.data)}</span></div>
      <div class="row"><span class="lbl">Status</span><span class="val"><span class="badge">${(pagamento.statusPagamento || "—").charAt(0).toUpperCase() + (pagamento.statusPagamento || "").slice(1)}</span></span></div>
      ${pagamento.observacoes ? `<div class="row"><span class="lbl">Observações</span><span class="val">${pagamento.observacoes}</span></div>` : ""}
      <div class="total-row"><span class="total-lbl">Total pago</span><span class="total-val">${valorFmt}</span></div>
    </div>
    <div class="ftr">Emitido em ${new Date().toLocaleString("pt-BR")} &nbsp;·&nbsp; Vynor Clinic &nbsp;·&nbsp; Documento não fiscal</div>
  </div>
  <script>window.onload=()=>{ setTimeout(()=>window.print(),300); }</script>
</body></html>`);
  w.document.close();
}

// ── Modal Novo Pagamento ───────────────────────────────────────────────────────

// ── Principal ──────────────────────────────────────────────────────────────────

export default function Faturamento({ pagamentosApp = [], atendimentosOdonto = [], onNavegar }) {
  const toast = useToast();

  const [atendimentos, setAtendimentos]   = useState([]);
  const [pagamentos, setPagamentos]       = useState([]);
  const [carregando, setCarregando]       = useState(true);
  const [filtroInicio, setFiltroInicio]   = useState(inicioMes());
  const [filtroFim, setFiltroFim]         = useState(hojeISO());
  const [filtroBusca, setFiltroBusca]     = useState("");
  const [filtroStatus, setFiltroStatus]   = useState("todos");
  const [abaPrincipal, setAbaPrincipal]       = useState("pendentes");
  const [filtroProfissional, setFiltroProfissional] = useState("");
  const [paginaPendentes, setPaginaPendentes] = useState(1);
  const ITENS_PENDENTES = 10;

  // KPIs vindos do endpoint unificado — fonte de verdade do período (Fase 2).
  const [kpisUnif, setKpisUnif] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [resAt, resPag, resKpis] = await Promise.all([
        api.atendimentos.listar({ data_inicio: filtroInicio, data_fim: filtroFim }),
        api.pagamentos.listar({ data_inicio: filtroInicio, data_fim: filtroFim }),
        api.financeiro.kpisUnificados({ inicio: filtroInicio, fim: filtroFim }).catch(() => null),
      ]);
      setAtendimentos(resAt?.data || []);
      setPagamentos(resPag?.data || []);
      setKpisUnif(resKpis?.data || null);
    } catch {
      toast.error("Não foi possível carregar os dados de faturamento.");
    } finally {
      setCarregando(false);
    }
  }, [filtroInicio, filtroFim, toast]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setPaginaPendentes(1); }, [filtroInicio, filtroFim, filtroProfissional]);

  // Une `pagamentosApp` (estado global, módulos cruzados) com `pagamentos` local
  // (carregado para o período da tela). pagamentosApp pode estar stale; pagamentos
  // local reflete o que o backend retorna agora para este período.
  const todosPagamentos = useMemo(() => {
    const seen = new Set();
    const out = [];
    [...pagamentos, ...pagamentosApp].forEach((p) => {
      const key = String(p.id || '');
      if (key && !seen.has(key)) { seen.add(key); out.push(p); }
    });
    return out;
  }, [pagamentos, pagamentosApp]);

  // Critério: pagamento que TIRA o atendimento da lista (já cobrado).
  // Pendente/parcial não tira — atendimento continua "devendo".
  const STATUS_QUITADO = new Set(['pago', 'cortesia']);

  // Helper: existe pagamento quitado (pago/cortesia) referenciando o atendimento?
  const temPagamentoQuitado = (refField, refValue) =>
    todosPagamentos.some((p) => {
      if (String(p[refField] ?? '') !== String(refValue ?? '')) return false;
      const st = (p.statusPagamento || p.status || '').toLowerCase();
      return STATUS_QUITADO.has(st);
    });

  const atendimentosPendentes = useMemo(() => {
    // Regra: aparece em "sem pagamento" se atendimento ATIVO + sem pagamento quitado.
    // Pagamento pendente/parcial mantém na lista (continua devendo cobrança).
    const clinicos = atendimentos.filter((a) => {
      const status = (a.status || "").toLowerCase();
      if (["cancelado", "faltou"].includes(status)) return false;
      const statusCobravel = ["aguardando", "em_atendimento", "finalizado"].includes(status);
      if (!statusCobravel) return false;
      // Atendimento já marcado como pago/cortesia → fora.
      const statusPag = (a.statusPagamento || "").toLowerCase();
      if (STATUS_QUITADO.has(statusPag)) return false;
      // pagamento_id vinculado com status pago/cortesia → fora.
      if (a.pagamentoId) {
        const pag = todosPagamentos.find((p) => String(p.id) === String(a.pagamentoId));
        const st = (pag?.statusPagamento || pag?.status || "").toLowerCase();
        if (STATUS_QUITADO.has(st)) return false;
      }
      // Qualquer pagamento QUITADO referenciando o atendimento → fora.
      if (
        temPagamentoQuitado('atendimentoId', a.id) ||
        temPagamentoQuitado('atendimento_id', a.id)
      ) return false;
      const nomeFiltro = !filtroBusca || (a.paciente || "").toLowerCase().includes(filtroBusca.toLowerCase());
      return nomeFiltro;
    }).map((a) => ({
      ...a,
      origem: "Clínico",
      pacienteNome: a.paciente || a.nomePaciente,
      profissionalNome: a.medico,
    }));

    const odontologicos = atendimentosOdonto.filter((a) => {
      const status = (a.status || "").toLowerCase();
      if (["cancelado", "faltou"].includes(status)) return false;
      const statusCobravel = ["aguardando", "em_atendimento", "finalizado"].includes(status);
      if (!statusCobravel) return false;
      const statusPag = (a.statusPagamento || a.status_pagamento || "").toLowerCase();
      if (STATUS_QUITADO.has(statusPag)) return false;
      if (a.pagamentoId) {
        const pag = todosPagamentos.find((p) => String(p.id) === String(a.pagamentoId));
        const st = (pag?.statusPagamento || pag?.status || "").toLowerCase();
        if (STATUS_QUITADO.has(st)) return false;
      }
      if (
        temPagamentoQuitado('atendimentoOdontoId', a.id) ||
        temPagamentoQuitado('atendimento_odonto_id', a.id)
      ) return false;
      const nome = a.pacienteNome || a.paciente || "";
      const nomeFiltro = !filtroBusca || nome.toLowerCase().includes(filtroBusca.toLowerCase());
      return nomeFiltro;
    }).map((a) => ({
      ...a,
      origem: "Odontologia",
      pacienteNome: a.pacienteNome || a.paciente,
      profissionalNome: a.profissionalNome || a.medico,
    }));

    return [...clinicos, ...odontologicos];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentos, atendimentosOdonto, todosPagamentos, filtroBusca]);

  const pagamentosFiltrados = useMemo(() => {
    return pagamentos.filter((p) => {
      const nomeFiltro = !filtroBusca || (p.nomePaciente || "").toLowerCase().includes(filtroBusca.toLowerCase());
      const statusFiltro = filtroStatus === "todos" || (p.statusPagamento || "").toLowerCase() === filtroStatus;
      const profFiltro = !filtroProfissional || (p.profissional || p.medico || "").toLowerCase().includes(filtroProfissional.toLowerCase());
      return nomeFiltro && statusFiltro && profFiltro;
    });
  }, [pagamentos, filtroBusca, filtroStatus, filtroProfissional]);

  const contagemStatus = useMemo(() => {
    const c = { todos: pagamentos.length, pago: 0, pendente: 0, parcial: 0, cancelado: 0 };
    pagamentos.forEach((p) => {
      const s = (p.statusPagamento || "").toLowerCase();
      if (s in c) c[s]++;
    });
    return c;
  }, [pagamentos]);

  const profissionaisList = useMemo(() => {
    const s = new Set();
    pagamentos.forEach((p) => { if (p.profissional || p.medico) s.add(p.profissional || p.medico); });
    return Array.from(s).sort();
  }, [pagamentos]);

  const kpis = useMemo(() => {
    // Fase 2 — fonte de verdade vinda do backend para o mesmo período.
    // "Recebido no período" usa data_pagamento (caixa); "Receita confirmada" usa data.
    if (kpisUnif?.totais) {
      return {
        totalRecebido:    Number(kpisUnif.totais.recebido_periodo   || 0),
        receitaConfirmada: Number(kpisUnif.totais.receita_confirmada || 0),
        totalPendente:    Number(kpisUnif.totais.pendente_total     || 0),
        atsPendentes:     atendimentosPendentes.length,
        totalPagamentos:  pagamentos.length,
      };
    }
    return {
      totalRecebido: pagamentos
        .filter(isFaturamentoConfirmado)
        .reduce((s, p) => s + valorCanonicoPagamento(p), 0),
      receitaConfirmada: pagamentos
        .filter(isFaturamentoConfirmado)
        .reduce((s, p) => s + valorCanonicoPagamento(p), 0),
      totalPendente: pagamentos
        .filter(isPagamentoPendente)
        .reduce((s, p) => s + valorCanonicoPagamento(p), 0),
      atsPendentes:  atendimentosPendentes.length,
      totalPagamentos: pagamentos.length,
    };
  }, [pagamentos, atendimentosPendentes, kpisUnif]);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Faturamento</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
          Gestão de cobranças e recebimentos
        </p>
      </div>

      {/* KPIs */}
      {/* Período explícito (Fase 2) */}
      <div style={{ marginBottom: 8, fontSize: 11, color: "#94a3b8" }}>
        Período: {filtroInicio} → {filtroFim}
        {kpisUnif?.totais && (
          <span style={{ marginLeft: 8, fontStyle: "italic" }}>
            · "Recebido" filtra por data de pagamento (caixa) · "Receita confirmada" filtra por data do atendimento
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Recebido no período", valor: formatarMoeda(kpis.totalRecebido), cor: "#16a34a", bg: "#f0fdf4" },
          { label: "A receber",           valor: formatarMoeda(kpis.totalPendente), cor: "#f59e0b", bg: "#fffbeb" },
          { label: "Sem pagamento criado", valor: kpis.atsPendentes,                cor: "#dc2626", bg: "#fef2f2" },
          { label: "Pagamentos no período",valor: kpis.totalPagamentos,            cor: "#6366f1", bg: "#eef2ff" },
        ].map((k) => (
          <div key={k.label} style={{
            background: k.bg, borderRadius: 10, padding: "14px 18px", borderLeft: `4px solid ${k.cor}`,
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: k.cor }}>{k.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#111827" }}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtros de período */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>De</label>
          <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>até</label>
          <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
        </div>
        <input
          type="text" value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)}
          placeholder="Buscar paciente..."
          style={{
            flex: 1, minWidth: 160, padding: "8px 12px",
            border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none",
          }}
        />
        {profissionaisList.length > 0 && (
          <select
            value={filtroProfissional}
            onChange={(e) => setFiltroProfissional(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, color: "#374151", background: "#fff" }}
          >
            <option value="">Todos os profissionais</option>
            {profissionaisList.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        )}
        <button onClick={carregar} style={{
          padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db",
          background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151",
        }}>
          ↻ Atualizar
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          { valor: "pendentes", label: `Atendimentos sem pagamento (${kpis.atsPendentes})` },
          { valor: "pagamentos", label: `Pagamentos (${pagamentos.length})` },
        ].map((a) => (
          <button key={a.valor} onClick={() => setAbaPrincipal(a.valor)} style={{
            padding: "9px 18px", border: "none", background: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600,
            color: abaPrincipal === a.valor ? "#2563eb" : "#6b7280",
            borderBottom: abaPrincipal === a.valor ? "2px solid #2563eb" : "2px solid transparent",
            marginBottom: -2,
          }}>
            {a.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Carregando...</div>
      ) : abaPrincipal === "pendentes" ? (
        /* ── Atendimentos sem pagamento ── */
        atendimentosPendentes.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 15,
            background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db",
          }}>
            Nenhum atendimento pendente de cobrança no período.
          </div>
        ) : (() => {
          const totalPagPendentes = Math.max(1, Math.ceil(atendimentosPendentes.length / ITENS_PENDENTES));
          const pendentesExibidos = atendimentosPendentes.slice((paginaPendentes - 1) * ITENS_PENDENTES, paginaPendentes * ITENS_PENDENTES);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendentesExibidos.map((at) => (
                <div key={`${at.origem || "clinico"}-${at.id}`} style={{
                  background: "#fff", borderRadius: 10, padding: "14px 18px",
                  border: "1px solid #fca5a5", borderLeft: "4px solid #dc2626",
                  display: "flex", alignItems: "center", gap: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>
                      {at.paciente || at.nomePaciente || "—"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                      {at.origem || "Clínico"} · {at.tipoAtendimento || "Consulta"} · {formatarData(at.data)}
                      {at.medico || at.profissionalNome ? ` · Dr(a). ${at.medico || at.profissionalNome}` : ""}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: "#dc2626",
                    background: "#fef2f2", padding: "2px 8px", borderRadius: 4,
                  }}>
                    Sem pagamento
                  </span>
                  <button
                    onClick={() => onNavegar?.("pagamentos")}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                    }}
                  >
                    → Ir para Pagamentos
                  </button>
                </div>
              ))}
              {totalPagPendentes > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6", marginTop: 4 }}>
                  <button
                    onClick={() => setPaginaPendentes(p => Math.max(1, p - 1))}
                    disabled={paginaPendentes === 1}
                    style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", cursor: paginaPendentes === 1 ? "not-allowed" : "pointer", color: paginaPendentes === 1 ? "#d1d5db" : "#374151", fontSize: 13 }}
                  >
                    ← Anterior
                  </button>
                  <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
                    Página {paginaPendentes} de {totalPagPendentes}
                  </span>
                  <button
                    onClick={() => setPaginaPendentes(p => Math.min(totalPagPendentes, p + 1))}
                    disabled={paginaPendentes >= totalPagPendentes}
                    style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", cursor: paginaPendentes >= totalPagPendentes ? "not-allowed" : "pointer", color: paginaPendentes >= totalPagPendentes ? "#d1d5db" : "#374151", fontSize: 13 }}
                  >
                    Próxima →
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* ── Pagamentos registrados ── */
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { valor: "todos",     label: "Todos",      cor: "#374151", bg: "#f3f4f6", bgAtivo: "#e5e7eb" },
              { valor: "pago",      label: "Pagos",      cor: "#16a34a", bg: "#dcfce7", bgAtivo: "#bbf7d0" },
              { valor: "pendente",  label: "Pendentes",  cor: "#d97706", bg: "#fef3c7", bgAtivo: "#fde68a" },
              { valor: "parcial",   label: "Parcial",    cor: "#6366f1", bg: "#eef2ff", bgAtivo: "#e0e7ff" },
              { valor: "cancelado", label: "Cancelados", cor: "#dc2626", bg: "#fee2e2", bgAtivo: "#fecaca" },
            ].map((s) => {
              const ativo = filtroStatus === s.valor;
              return (
                <button key={s.valor} onClick={() => setFiltroStatus(s.valor)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: ativo ? `2px solid ${s.cor}` : "1px solid #d1d5db",
                  background: ativo ? s.bg : "#fff",
                  color: ativo ? s.cor : "#374151",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {s.label}
                  <span style={{
                    background: ativo ? s.cor : "#e5e7eb",
                    color: ativo ? "#fff" : "#6b7280",
                    borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                  }}>
                    {contagemStatus[s.valor] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          {pagamentosFiltrados.length === 0 ? (
            <div style={{
              textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 15,
              background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db",
            }}>
              Nenhum pagamento encontrado.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pagamentosFiltrados.map((p) => {
                const statusColor = {
                  pago: "#16a34a", pendente: "#f59e0b", parcial: "#6366f1",
                }[(p.statusPagamento || "").toLowerCase()] || "#6b7280";
                const statusBg = {
                  pago: "#f0fdf4", pendente: "#fffbeb", parcial: "#eef2ff",
                }[(p.statusPagamento || "").toLowerCase()] || "#f3f4f6";

                return (
                  <div key={p.id} style={{
                    background: "#fff", borderRadius: 10, padding: "14px 18px",
                    border: "1px solid #e5e7eb", borderLeft: `4px solid ${statusColor}`,
                    display: "flex", alignItems: "center", gap: 16,
                    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>
                        {p.nomePaciente || p.paciente || "—"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                        {p.descricao || p.tipoAtendimento || "—"} · {formatarData(p.dataPagamento || p.data)}
                        {p.formaPagamento ? ` · ${p.formaPagamento}` : ""}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#111827" }}>
                        {formatarMoeda(p.valorFinal || p.valor)}
                      </p>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: statusColor,
                        background: statusBg, padding: "2px 8px", borderRadius: 4,
                      }}>
                        {(p.statusPagamento || "—").charAt(0).toUpperCase() + (p.statusPagamento || "").slice(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => imprimirRecibo(null, p)}
                      title="Imprimir recibo"
                      style={{
                        padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db",
                        background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151",
                      }}
                    >
                      🖨 Recibo
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
