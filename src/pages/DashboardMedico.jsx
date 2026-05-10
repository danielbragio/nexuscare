import { useMemo } from "react";

function hojeISO() {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
}

const STATUS_CFG = {
  agendado:       { label: "Aguardando",     dot: "#f59e0b", bg: "#fffbeb", chip: "#fbbf24" },
  aguardando:     { label: "Aguardando",     dot: "#f59e0b", bg: "#fffbeb", chip: "#fbbf24" },
  em_atendimento: { label: "Em Atendimento", dot: "#0f766e", bg: "#f0fdf9", chip: "#0f766e" },
  finalizado:     { label: "Finalizado",     dot: "#16a34a", bg: "#f0fdf4", chip: "#16a34a" },
  cancelado:      { label: "Cancelado",      dot: "#94a3b8", bg: "#f8fafc", chip: "#94a3b8" },
};

export default function DashboardMedico({
  consultas = [],
  consultorioAtual,
  userData,
  onIrParaConsultas,
}) {
  const hoje = hojeISO();

  const consultasHoje = useMemo(
    () => consultas.filter((c) => c.data === hoje),
    [consultas, hoje]
  );

  const aguardando = useMemo(
    () => consultasHoje.filter((c) => c.status === "agendado" || c.status === "aguardando"),
    [consultasHoje]
  );
  const emAtendimento = useMemo(
    () => consultasHoje.filter((c) => c.status === "em_atendimento"),
    [consultasHoje]
  );
  const finalizados = useMemo(
    () => consultasHoje.filter((c) => c.status === "finalizado"),
    [consultasHoje]
  );

  const proximoPaciente = aguardando[0] || null;
  const nomeMedico = userData?.nome || userData?.name || "";
  const primeiroNome = nomeMedico.split(" ")[0] || "Doutor(a)";
  const sala = consultorioAtual?.nome || null;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div style={{ padding: "28px 32px", maxWidth: "860px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "#94a3b8", marginBottom: "6px",
        }}>
          Central do Médico
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          {saudacao}, {primeiroNome}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "#64748b", flexWrap: "wrap" }}>
          {sala && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", display: "inline-block", flexShrink: 0 }} />
              {sala} — ativo
            </span>
          )}
          <span>
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Aguardando",      value: aguardando.length,     color: "#f59e0b", bg: "#fffbeb", accent: "#fbbf2420" },
          { label: "Em Atendimento",  value: emAtendimento.length,  color: "#0f766e", bg: "#f0fdf9", accent: "#6ee7b720" },
          { label: "Finalizados Hoje",value: finalizados.length,    color: "#16a34a", bg: "#f0fdf4", accent: "#86efac20" },
        ].map((card) => (
          <div key={card.label} style={{
            background: card.bg, borderRadius: "14px", padding: "18px 20px",
            border: `1px solid ${card.accent}`,
          }}>
            <div style={{ fontSize: "34px", fontWeight: 800, color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "5px", fontWeight: 500 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Próximo Paciente CTA */}
      {proximoPaciente ? (
        <div style={{
          background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
          borderRadius: "16px", padding: "20px 24px", marginBottom: "24px",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px",
          boxShadow: "0 4px 20px rgba(15,118,110,0.22)",
        }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.65)", marginBottom: "5px" }}>
              Próximo na fila
            </div>
            <div style={{ fontSize: "19px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
              {proximoPaciente.paciente || proximoPaciente.nomePaciente || "Paciente"}
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              {[proximoPaciente.hora, proximoPaciente.especialidade || proximoPaciente.tipoAtendimento].filter(Boolean).join(" · ") || "Consulta"}
            </div>
          </div>
          <button
            onClick={onIrParaConsultas}
            style={{
              background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)",
              color: "#fff", borderRadius: "10px", padding: "10px 22px",
              fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Atender agora →
          </button>
        </div>
      ) : aguardando.length === 0 && (
        <div style={{
          background: "#f0fdf4", border: "1px dashed #86efac",
          borderRadius: "14px", padding: "22px 24px", textAlign: "center",
          color: "#15803d", marginBottom: "24px",
        }}>
          <div style={{ fontSize: "26px", marginBottom: "6px" }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: "14px" }}>Fila vazia</div>
          <div style={{ fontSize: "12px", marginTop: "3px", opacity: 0.75 }}>
            Nenhum paciente aguardando no momento.
          </div>
        </div>
      )}

      {/* Lista de Consultas do Dia */}
      <div style={{
        background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0",
        overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      }}>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid #f1f5f9",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
            Consultas de Hoje
            <span style={{
              marginLeft: "8px", fontSize: "11px", fontWeight: 600,
              background: "#f1f5f9", color: "#64748b",
              borderRadius: "999px", padding: "1px 8px",
            }}>
              {consultasHoje.length}
            </span>
          </div>
          <button
            onClick={onIrParaConsultas}
            style={{ background: "none", border: "none", color: "#0f766e", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            Painel completo →
          </button>
        </div>

        {consultasHoje.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
            Nenhuma consulta agendada para hoje.
          </div>
        ) : (
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {consultasHoje.map((c, idx) => {
              const cfg = STATUS_CFG[c.status] || STATUS_CFG.agendado;
              return (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "11px 18px",
                  borderBottom: idx < consultasHoje.length - 1 ? "1px solid #f8fafc" : "none",
                  background: emAtendimento.some((e) => e.id === c.id) ? "#f0fdf9" : "transparent",
                }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.paciente || c.nomePaciente || "Paciente"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                      {[c.hora, c.especialidade || c.tipoAtendimento].filter(Boolean).join(" · ") || "Consulta"}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, borderRadius: "6px",
                    padding: "3px 8px", background: cfg.bg, color: cfg.chip,
                    border: `1px solid ${cfg.chip}22`, flexShrink: 0, whiteSpace: "nowrap",
                  }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ padding: "10px 18px", borderTop: "1px solid #f1f5f9" }}>
          <button
            onClick={onIrParaConsultas}
            style={{
              width: "100%", padding: "9px", background: "#f8fafc",
              border: "1px solid #e2e8f0", borderRadius: "9px",
              color: "#64748b", fontSize: "12px", fontWeight: 500, cursor: "pointer",
            }}
          >
            Abrir painel de consultas completo →
          </button>
        </div>
      </div>
    </div>
  );
}
