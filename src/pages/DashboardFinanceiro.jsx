import { useMemo } from "react";
import { hojeISO } from "../utils/dateUtils";
import {
  isFaturamentoConfirmado,
  isPagamentoPendente,
  valorCanonicoPagamento,
} from "../utils/financeUtils";

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MiniBar({ dados }) {
  const maxVal = Math.max(...dados.map((d) => d.valor), 0.01);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "60px" }}>
      {dados.map((d) => {
        const pct = (d.valor / maxVal) * 48;
        return (
          <div key={d.data} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
            <div
              title={`${d.label}: ${formatarMoeda(d.valor)}`}
              style={{
                width: "100%",
                height: `${Math.max(pct, d.valor > 0 ? 4 : 1)}px`,
                background: d.isHoje ? "#0f766e" : "rgba(15,118,110,0.2)",
                borderRadius: "3px 3px 0 0",
              }}
            />
            <span style={{ fontSize: "9px", color: d.isHoje ? "#0f766e" : "#94a3b8", fontWeight: d.isHoje ? 700 : 400 }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardFinanceiro({
  pagamentos = [],
  onIrParaFinanceiro,
  onIrParaPagamentos,
  onIrParaRelatorios,
}) {
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);

  const kpis = useMemo(() => {
    let receitaHoje = 0;
    let receitaMes = 0;
    let pendentesValor = 0;
    let pendentesQtd = 0;

    pagamentos.forEach((p) => {
      const dataPag = String(p.dataPagamento || p.data || "");
      const valor = valorCanonicoPagamento(p);

      if (isFaturamentoConfirmado(p)) {
        if (dataPag.startsWith(hoje)) receitaHoje += valor;
        if (dataPag.startsWith(mesAtual)) receitaMes += valor;
      }
      if (isPagamentoPendente(p)) {
        pendentesValor += valor;
        pendentesQtd++;
      }
    });

    return { receitaHoje, receitaMes, pendentesValor, pendentesQtd };
  }, [pagamentos, hoje, mesAtual]);

  const chartDados = useMemo(() => {
    const diasNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = i === 6 ? "Hoje" : diasNomes[d.getDay()];
      const valor = pagamentos
        .filter(
          (p) =>
            isFaturamentoConfirmado(p) &&
            String(p.dataPagamento || p.data || "").startsWith(iso)
        )
        .reduce((acc, p) => acc + valorCanonicoPagamento(p), 0);
      return { data: iso, label, valor, isHoje: i === 6 };
    });
  }, [pagamentos]);

  const ultimosPagamentos = useMemo(
    () => pagamentos.filter(isFaturamentoConfirmado).slice(0, 6),
    [pagamentos]
  );

  const pendentes = useMemo(
    () => pagamentos.filter(isPagamentoPendente).slice(0, 5),
    [pagamentos]
  );

  const acoes = [
    { label: "Financeiro",           desc: "Movimentações e saldo",        action: onIrParaFinanceiro, color: "#0f766e" },
    { label: "Pagamentos",           desc: "Receber e registrar pagamentos", action: onIrParaPagamentos, color: "#7c3aed" },
    { label: "Relatórios",           desc: "Exportar e analisar dados",      action: onIrParaRelatorios, color: "#2563eb" },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: "5px" }}>
          Central Financeira
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
          Visão Financeira
        </h1>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <div style={{ background: "#f0fdf9", borderRadius: "14px", padding: "18px 20px", border: "1px solid #6ee7b720" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Receita Hoje</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f766e", letterSpacing: "-0.02em" }}>{formatarMoeda(kpis.receitaHoje)}</div>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: "14px", padding: "18px 20px", border: "1px solid #86efac20" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Receita do Mês</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em" }}>{formatarMoeda(kpis.receitaMes)}</div>
        </div>
        <div style={{ background: "#fff7ed", borderRadius: "14px", padding: "18px 20px", border: "1px solid #fed7aa20" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Pendentes</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#c2410c", letterSpacing: "-0.02em" }}>{formatarMoeda(kpis.pendentesValor)}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>
            {kpis.pendentesQtd} pagamento{kpis.pendentesQtd !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Chart + Ações */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>Receita — Últimos 7 dias</div>
          <MiniBar dados={chartDados} />
        </div>

        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>Acesso Rápido</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {acoes.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "1px solid #e2e8f0", borderRadius: "10px",
                  padding: "10px 14px", cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = item.color + "44"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>{item.desc}</div>
                </div>
                <div style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "12px" }}>→</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pendentes + Últimos Recebimentos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Pendentes */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
              Pendentes
              {kpis.pendentesQtd > 0 && (
                <span style={{ marginLeft: "7px", background: "#fff7ed", color: "#c2410c", fontSize: "10px", fontWeight: 700, borderRadius: "999px", padding: "1px 7px", border: "1px solid #fed7aa" }}>
                  {kpis.pendentesQtd}
                </span>
              )}
            </span>
            <button onClick={onIrParaPagamentos} style={{ background: "none", border: "none", color: "#0f766e", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
              Ver todos →
            </button>
          </div>
          {pendentes.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>Sem pendências.</div>
          ) : (
            pendentes.map((p, idx) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px",
                borderBottom: idx < pendentes.length - 1 ? "1px solid #f8fafc" : "none",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.paciente || p.nomePaciente || "Paciente"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>{p.tipoAtendimento || p.descricao || "Consulta"}</div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#c2410c", flexShrink: 0 }}>{formatarMoeda(p.valor)}</span>
              </div>
            ))
          )}
        </div>

        {/* Últimos Recebimentos */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Últimos Recebimentos</span>
            <button onClick={onIrParaFinanceiro} style={{ background: "none", border: "none", color: "#0f766e", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
              Ver todos →
            </button>
          </div>
          {ultimosPagamentos.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>Nenhum recebimento registrado.</div>
          ) : (
            ultimosPagamentos.map((p, idx) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px",
                borderBottom: idx < ultimosPagamentos.length - 1 ? "1px solid #f8fafc" : "none",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.paciente || p.nomePaciente || "Paciente"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>{p.formaPagamento || p.tipoAtendimento || "—"}</div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a", flexShrink: 0 }}>{formatarMoeda(p.valor)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
