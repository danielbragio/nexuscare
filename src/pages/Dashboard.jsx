import { useEffect, useMemo, useState } from "react";

// ── Pure helpers ──────────────────────────────────────────────────────────────

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function obterNomePaciente(item) {
  return item?.paciente || item?.nomePaciente || item?.nome || item?.patientName || "Paciente não informado";
}
function obterMedico(item) {
  return item?.medico || item?.nomeMedico || item?.profissional || item?.doctorName || "Sem médico definido";
}
function obterConsultorio(item) {
  const valor = item?.consultorio || item?.sala || item?.consultorioNumero || item?.room || "";
  const numero = String(valor).replace(/\D/g, "");
  return numero ? Number(numero) : null;
}
function hojeISO() {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
}
function calcularMinutos(data, hora) {
  if (!data || !hora) return 0;
  const chegada = new Date(`${data}T${hora}`);
  const agora = new Date();
  if (Number.isNaN(chegada.getTime())) return 0;
  const diff = Math.floor((agora - chegada) / 60000);
  return diff > 0 ? diff : 0;
}
function formatarTempo(minutos) {
  const total = Number(minutos || 0);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function statusOperacional(status) {
  const t = normalizarTexto(status);
  if (!t || t === "cadastro" || t === "chegada" || t === "recepcionado" || t === "recepcao") return "chegada";
  if (t === "agendada" || t === "agendado" || t === "aguardando" || t === "aguardando atendimento" || t === "aguardando medico" || t === "espera") return "aguardando";
  if (t === "em atendimento" || t === "atendimento" || t === "atendendo") return "atendimento";
  if (t === "finalizado" || t === "finalizada" || t === "concluido" || t === "concluida" || t === "encerrado") return "finalizado";
  return "chegada";
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconUser({ color = "#64748b", size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}
function IconActivity({ color = "#64748b", size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconClock({ color = "#64748b", size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  );
}
function IconDollar({ color = "#64748b", size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function IconCheck({ color = "#16a34a", size = 14 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconWarning({ color = "#dc2626", size = 15 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconTooth({ color = "#0f766e", size = 15 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2c-4 0-7 3-7 6.5 0 2.5.5 4 1.5 6C8 18 9.5 22 12 22s4-4 4.5-7.5C17.5 12.5 18 11 18 8.5 18 5 15 2 12 2z" />
    </svg>
  );
}

// ── Mini bar chart (7-day receita) ────────────────────────────────────────────

function MiniBarChart({ dados, hoje }) {
  const maxVal = Math.max(...dados.map((d) => d.valor), 0.01);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "60px", padding: "0 2px" }}>
      {dados.map((d) => {
        const pct = (d.valor / maxVal) * 50;
        const isHoje = d.data === hoje;
        return (
          <div key={d.data} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
            <div
              title={`${d.label}: ${formatarMoeda(d.valor)}`}
              style={{
                width: "100%",
                height: `${Math.max(pct, d.valor > 0 ? 4 : 1)}px`,
                background: isHoje ? "#0f766e" : "rgba(15,118,110,0.25)",
                borderRadius: "3px 3px 0 0",
              }}
            />
            <span style={{
              fontSize: "9px",
              color: isHoje ? "#0f766e" : "#cbd5e1",
              fontWeight: isHoje ? 700 : 400,
              whiteSpace: "nowrap",
            }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Kanban patient card ───────────────────────────────────────────────────────

function PatientCard({ item }) {
  const alerta = item.tempoEspera >= 60;
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${alerta ? "#fed7aa" : "#e5e7eb"}`,
      borderLeft: `3px solid ${alerta ? "#f97316" : "#e2e8f0"}`,
      borderRadius: "10px",
      padding: "9px 11px",
      boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4px", marginBottom: "5px" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.nomePaciente}
        </span>
        {item.tempoEspera > 0 && (
          <span style={{
            fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "999px",
            background: alerta ? "#fff7ed" : "#f1f5f9",
            color: alerta ? "#c2410c" : "#64748b",
            flexShrink: 0,
          }}>
            {formatarTempo(item.tempoEspera)}
          </span>
        )}
      </div>
      <div style={{ fontSize: "11px", color: "#64748b" }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.medico !== "Sem médico definido" ? item.medico : "—"}
        </div>
        {item.tipoAtendimento && (
          <div style={{ color: "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.tipoAtendimento}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

const COLUNA_CFG = {
  chegada:     { label: "Recepção",       accent: "#6366f1", headerBg: "#f5f3ff", dot: "#a5b4fc" },
  aguardando:  { label: "Aguardando",     accent: "#f59e0b", headerBg: "#fffbeb", dot: "#fcd34d" },
  atendimento: { label: "Em atendimento", accent: "#0f766e", headerBg: "#f0fdf9", dot: "#6ee7b7" },
  finalizado:  { label: "Finalizados",    accent: "#16a34a", headerBg: "#f0fdf4", dot: "#86efac" },
};

function ColunaKanban({ tipo, lista }) {
  const cfg = COLUNA_CFG[tipo];
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px",
        background: cfg.headerBg,
        borderRadius: "9px 9px 0 0",
        borderBottom: `2px solid ${cfg.accent}22`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: cfg.accent }}>{cfg.label}</span>
        </div>
        <span style={{
          minWidth: "20px", height: "20px", padding: "0 5px",
          borderRadius: "999px", background: cfg.accent, color: "#fff",
          fontSize: "10px", fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {lista.length}
        </span>
      </div>
      <div style={{
        flex: 1, overflowY: "auto", padding: "7px",
        display: "flex", flexDirection: "column", gap: "5px",
        background: "#fafafa",
        borderRadius: "0 0 9px 9px",
        border: "1px solid #e5e7eb", borderTop: "none",
        minHeight: "110px", maxHeight: "340px",
      }}>
        {lista.length === 0 ? (
          <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: "11px", padding: "16px 0", userSelect: "none" }}>
            Sem pacientes
          </div>
        ) : lista.map((item, i) => (
          <PatientCard key={item.id || i} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard({
  consultas = [],
  pagamentos = [],
  atendimentosOdonto = [],
  estoque = [],
  onIrParaEstoque,
  onIrParaFinanceiro,
  onIrParaPagamentos,
  onIrParaRelatorios,
}) {
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dataHoje = hojeISO();

  // ── consultas tratadas
  const consultasTratadas = useMemo(() => {
    return consultas.map((item) => ({
      ...item,
      statusOperacional: statusOperacional(item.status),
      nomePaciente: obterNomePaciente(item),
      medico: obterMedico(item),
      consultorio: obterConsultorio(item),
      tipoAtendimento: item.tipoAtendimento || item.tipo || item.servico || item.especialidade || "Atendimento",
      tempoEspera: calcularMinutos(item.data, item.hora),
    }));
  }, [consultas, agora]);

  const chegada = consultasTratadas.filter((i) => i.statusOperacional === "chegada");
  const aguardando = consultasTratadas.filter((i) => i.statusOperacional === "aguardando");
  const emAtendimento = consultasTratadas.filter((i) => i.statusOperacional === "atendimento");
  const finalizados = consultasTratadas.filter((i) => i.statusOperacional === "finalizado");
  const finalizadosHoje = finalizados.filter((i) => !i.data || i.data === dataHoje);

  // ── KPI: tempo médio
  const tempoMedioAtendimento = useMemo(() => {
    const ativos = [...emAtendimento, ...finalizadosHoje].filter((i) => i.tempoEspera > 0);
    if (!ativos.length) return 0;
    return Math.round(ativos.reduce((t, i) => t + i.tempoEspera, 0) / ativos.length);
  }, [emAtendimento, finalizadosHoje]);

  // ── KPI: receita do dia
  const receitaHoje = useMemo(() => {
    return pagamentos
      .filter((p) => {
        const status = normalizarTexto(p.statusPagamento || p.status || "");
        const data = p.dataPagamento || p.data || p.createdAt;
        return (status === "pago" || status === "paga") && (!data || String(data).slice(0, 10) === dataHoje);
      })
      .reduce((t, p) => t + Number(p.valor || 0), 0);
  }, [pagamentos, dataHoje]);

  // ── Receita 7 dias (chart)
  const chartDados = useMemo(() => {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dias.push({
        data: iso,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3),
        valor: pagamentos
          .filter((p) => {
            const s = normalizarTexto(p.statusPagamento || p.status || "");
            return (s === "pago" || s === "paga") && (p.dataPagamento || p.data || "").slice(0, 10) === iso;
          })
          .reduce((t, p) => t + Number(p.valor || 0), 0),
      });
    }
    return dias;
  }, [pagamentos]);

  // ── Resumo financeiro do mês
  const resumoFinanceiro = useMemo(() => {
    const hoje = new Date();
    const mes = hoje.getMonth(), ano = hoje.getFullYear();
    const isPago = (p) => ["pago", "paga"].includes((p.statusPagamento || p.status || "").toLowerCase());
    const isPend = (p) => ["pendente", "aguardando"].includes((p.statusPagamento || p.status || "").toLowerCase());
    const receitaMes = pagamentos
      .filter((p) => {
        const d = new Date(`${(p.dataPagamento || p.data || "").slice(0, 10)}T00:00:00`);
        return isPago(p) && d.getMonth() === mes && d.getFullYear() === ano;
      })
      .reduce((t, p) => t + Number(p.valor || 0), 0);
    const totalPendente = pagamentos.filter(isPend).reduce((t, p) => t + Number(p.valor || 0), 0);
    const qtdPendente = pagamentos.filter(isPend).length;
    return { receitaMes, totalPendente, qtdPendente };
  }, [pagamentos]);

  // ── Odonto
  const odontoAguardando = atendimentosOdonto.filter((a) => a.status === "aguardando").length;
  const odontoEmAtendimento = atendimentosOdonto.filter((a) => a.status === "em_atendimento").length;
  const odontoFinalizados = atendimentosOdonto.filter((a) => a.status === "finalizado").length;
  const receitaOdonto = useMemo(() => {
    return (
      pagamentos
        .filter((p) => {
          const o = normalizarTexto(p.origem || p.tipo || "");
          const s = normalizarTexto(p.statusPagamento || p.status || "");
          return o === "odonto" && (s === "pago" || s === "paga");
        })
        .reduce((t, p) => t + Number(p.valor || p.valorFinal || 0), 0) +
      atendimentosOdonto
        .filter((a) => {
          if (a.pagamentoId) return false;
          const st = normalizarTexto(a.statusPagamento || a.financeiro?.statusFinanceiro || "");
          return st === "pago" || st === "paga";
        })
        .reduce((t, a) => t + Number(a.valorFinal || 0), 0)
    );
  }, [pagamentos, atendimentosOdonto]);

  // ── Consultórios
  const consultorios = useMemo(() => {
    const salas = Array.from({ length: 7 }, (_, i) => ({
      numero: i + 1, medico: "Sem médico", pacienteAtual: null, tempo: 0, atendidosHoje: 0, status: "livre",
    }));
    consultasTratadas.forEach((c) => {
      const n = c.consultorio;
      if (n && n >= 1 && n <= 7) {
        const sala = salas[n - 1];
        if (c.medico && c.medico !== "Sem médico definido") sala.medico = c.medico;
        if (c.statusOperacional === "atendimento") {
          sala.pacienteAtual = c; sala.tempo = c.tempoEspera; sala.status = "ocupado";
        }
        if (c.statusOperacional === "finalizado" && (!c.data || c.data === dataHoje)) sala.atendidosHoje++;
      }
    });
    return salas;
  }, [consultasTratadas, dataHoje]);

  // ── Alertas
  const alertas = useMemo(() => {
    const lista = [];
    aguardando.filter((i) => i.tempoEspera >= 60).forEach((i) => {
      lista.push({ nivel: "alto", icone: "⏰", msg: `${i.nomePaciente} aguarda há ${formatarTempo(i.tempoEspera)}` });
    });
    consultorios.filter((s) => s.status === "ocupado" && s.medico === "Sem médico").forEach((s) => {
      lista.push({ nivel: "alto", icone: "🏥", msg: `Consultório ${s.numero} ocupado sem médico` });
    });
    if (resumoFinanceiro.qtdPendente > 0) {
      lista.push({
        nivel: "aviso", icone: "💳",
        msg: `${resumoFinanceiro.qtdPendente} pagamento${resumoFinanceiro.qtdPendente > 1 ? "s" : ""} pendente${resumoFinanceiro.qtdPendente > 1 ? "s" : ""} — ${formatarMoeda(resumoFinanceiro.totalPendente)}`,
      });
    }
    estoque
      .filter((i) => { const q = Number(i.quantidade ?? 0), m = Number(i.minimo ?? 0); return m > 0 && q <= m; })
      .slice(0, 2)
      .forEach((i) => {
        lista.push({ nivel: "estoque", icone: "📦", msg: `Estoque baixo: ${i.nome} (${i.quantidade} ${i.unidade || "un"})` });
      });
    if (!lista.length) lista.push({ nivel: "ok", icone: "✓", msg: "Operação estável — nenhum alerta" });
    return lista;
  }, [aguardando, consultorios, resumoFinanceiro, estoque]);

  const ultimosFinalizados = finalizadosHoje.slice(0, 5);

  // ── Alert level color map
  const alertColor = {
    alto:    { bg: "#fff7ed", border: "#fed7aa" },
    aviso:   { bg: "#fffbeb", border: "#fde68a" },
    estoque: { bg: "#fef2f2", border: "#fecaca" },
    ok:      { bg: "#f0fdf4", border: "#bbf7d0" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>

      {/* ── 1. HEADER ────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px", borderRadius: "16px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
        color: "#fff", boxShadow: "0 8px 28px rgba(15,23,42,0.18)",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>
            Central de Operação
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.55)", fontWeight: 400 }}>
            {agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 16px", borderRadius: "999px",
          background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.14)",
          fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)",
        }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 4px rgba(34,197,94,0.2)", flexShrink: 0 }} />
          {agora.toLocaleTimeString("pt-BR")}
        </div>
      </div>

      {/* ── 2. KPI CARDS ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
        {[
          {
            label: "Pacientes aguardando",
            value: aguardando.length,
            sub: `${chegada.length} na recepção`,
            accent: "#f59e0b", bg: "#fffbeb", border: "#fde68a",
            Icon: () => <IconUser color="#f59e0b" size={17} />,
          },
          {
            label: "Em atendimento",
            value: emAtendimento.length,
            sub: `${finalizadosHoje.length} finalizados hoje`,
            accent: "#0f766e", bg: "#f0fdf9", border: "#99f6e4",
            Icon: () => <IconActivity color="#0f766e" size={17} />,
          },
          {
            label: "Tempo médio",
            value: tempoMedioAtendimento === 0 ? "0 min" : formatarTempo(tempoMedioAtendimento),
            sub: "de atendimento",
            accent: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff",
            isText: true,
            Icon: () => <IconClock color="#7c3aed" size={17} />,
          },
          {
            label: "Receita do dia",
            value: formatarMoeda(receitaHoje),
            sub: `${formatarMoeda(resumoFinanceiro.receitaMes)} este mês`,
            accent: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0",
            isText: true,
            onClick: onIrParaFinanceiro,
            Icon: () => <IconDollar color="#16a34a" size={17} />,
          },
        ].map((card) => (
          <div
            key={card.label}
            onClick={card.onClick}
            style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: "14px",
              padding: "18px 20px",
              cursor: card.onClick ? "pointer" : "default",
              boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1.3 }}>
                {card.label}
              </span>
              <div style={{
                width: "30px", height: "30px", borderRadius: "8px",
                background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                flexShrink: 0,
              }}>
                <card.Icon />
              </div>
            </div>
            <div style={{
              fontSize: card.isText ? "21px" : "36px",
              fontWeight: 800, color: card.accent,
              letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "5px",
            }}>
              {card.value}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 3. ODONTOLOGIA (conditional) ─────────────────────────────────── */}
      {atendimentosOdonto.length > 0 && (
        <div style={{
          background: "#f0fdf9", border: "1px solid #99f6e4",
          borderRadius: "14px", padding: "14px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "12px" }}>
            <IconTooth color="#0f766e" size={15} />
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#0f766e" }}>Odontologia</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
            {[
              { label: "Aguardando",    value: odontoAguardando,           color: "#f59e0b" },
              { label: "Em atendimento", value: odontoEmAtendimento,        color: "#0f766e" },
              { label: "Finalizados",   value: odontoFinalizados,           color: "#16a34a" },
              { label: "Receita",       value: formatarMoeda(receitaOdonto), color: "#0f766e", isText: true },
            ].map((k) => (
              <div key={k.label} style={{ background: "#fff", borderRadius: "10px", padding: "10px 12px", border: "1px solid #d1fae5" }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>{k.label}</div>
                <div style={{ fontSize: k.isText ? "14px" : "22px", fontWeight: 800, color: k.color, letterSpacing: "-0.02em" }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. STOCK ALERT (conditional) ─────────────────────────────────── */}
      {estoque.some((i) => { const q = Number(i.quantidade ?? 0), m = Number(i.minimo ?? 0); return m > 0 && q <= m; }) && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: "12px", padding: "12px 16px",
          display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
        }}>
          <IconWarning color="#dc2626" size={16} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>Estoque crítico:</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", flex: 1 }}>
            {estoque
              .filter((i) => { const q = Number(i.quantidade ?? 0), m = Number(i.minimo ?? 0); return m > 0 && q <= m; })
              .map((i) => (
                <span key={i.id} style={{
                  padding: "2px 9px", borderRadius: "999px",
                  background: "#fff", border: "1px solid #fca5a5",
                  fontSize: "11px", fontWeight: 600, color: "#dc2626",
                }}>
                  {i.nome} ({i.quantidade} {i.unidade || "un"})
                </span>
              ))}
          </div>
          {onIrParaEstoque && (
            <button onClick={onIrParaEstoque} style={{
              padding: "6px 14px", borderRadius: "8px", border: "none",
              background: "#dc2626", color: "#fff",
              fontWeight: 700, fontSize: "12px", cursor: "pointer", flexShrink: 0,
            }}>
              Ver estoque
            </button>
          )}
        </div>
      )}

      {/* ── 5. MAIN 2-COL: kanban + sidebar ──────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.7fr) minmax(270px,1fr)",
        gap: "14px",
        alignItems: "start",
      }}>

        {/* ── Patient kanban ── */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "16px", boxShadow: "0 2px 10px rgba(15,23,42,0.05)", overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #f1f5f9",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Fluxo de pacientes</h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>Controle por etapa do atendimento</p>
            </div>
            <span style={{
              fontSize: "12px", color: "#475569", background: "#f1f5f9",
              padding: "4px 12px", borderRadius: "999px", fontWeight: 600,
            }}>
              {chegada.length + aguardando.length + emAtendimento.length} na unidade
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", padding: "14px" }}>
            <ColunaKanban tipo="chegada"     lista={chegada} />
            <ColunaKanban tipo="aguardando"  lista={aguardando} />
            <ColunaKanban tipo="atendimento" lista={emAtendimento} />
            <ColunaKanban tipo="finalizado"  lista={finalizadosHoje} />
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* ── Financial chart ── */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "14px", padding: "16px 18px",
            boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Receita — 7 dias</h3>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>Pagamentos confirmados por dia</p>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {onIrParaPagamentos && (
                  <button onClick={onIrParaPagamentos} style={{
                    fontSize: "11px", color: "#64748b", background: "#f8fafc",
                    border: "1px solid #e2e8f0", borderRadius: "6px",
                    cursor: "pointer", padding: "4px 9px", fontWeight: 600,
                  }}>
                    Pagamentos
                  </button>
                )}
                {onIrParaFinanceiro && (
                  <button onClick={onIrParaFinanceiro} style={{
                    fontSize: "11px", color: "#0f766e", background: "transparent",
                    border: "none", cursor: "pointer", fontWeight: 700, padding: "4px 0",
                  }}>
                    Financeiro →
                  </button>
                )}
              </div>
            </div>
            <MiniBarChart dados={chartDados} hoje={dataHoje} />
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginTop: "12px", paddingTop: "12px",
              borderTop: "1px solid #f1f5f9",
            }}>
              <div>
                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>Mês atual</div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f766e", letterSpacing: "-0.03em" }}>{formatarMoeda(resumoFinanceiro.receitaMes)}</div>
              </div>
              {resumoFinanceiro.qtdPendente > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>Pendências</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.03em" }}>{formatarMoeda(resumoFinanceiro.totalPendente)}</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Consultórios ── */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "14px", boxShadow: "0 2px 10px rgba(15,23,42,0.05)", overflow: "hidden",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Consultórios</h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>Status em tempo real</p>
            </div>
            <div style={{ maxHeight: "320px", overflowY: "auto", padding: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                {consultorios.map((sala) => (
                  <div key={sala.numero} style={{
                    borderRadius: "10px", padding: "10px 11px",
                    background: sala.status === "ocupado" ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${sala.status === "ocupado" ? "#bfdbfe" : "#e5e7eb"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Sala {sala.numero}</span>
                      <span style={{
                        fontSize: "9px", fontWeight: 800, padding: "2px 7px", borderRadius: "999px",
                        background: sala.status === "ocupado" ? "#dbeafe" : "#e2e8f0",
                        color: sala.status === "ocupado" ? "#1d4ed8" : "#64748b",
                      }}>
                        {sala.status === "ocupado" ? "Ocupado" : "Livre"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#475569" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sala.medico}
                      </div>
                      {sala.pacienteAtual && (
                        <div style={{ color: "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sala.pacienteAtual.nomePaciente} · {formatarTempo(sala.tempo)}
                        </div>
                      )}
                      {sala.atendidosHoje > 0 && (
                        <div style={{ color: "#16a34a", marginTop: "2px", fontSize: "10px", fontWeight: 600 }}>
                          {sala.atendidosHoje} atendido{sala.atendidosHoje > 1 ? "s" : ""} hoje
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. BOTTOM: alerts + recent ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

        {/* ── Alertas rápidos ── */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "14px", boxShadow: "0 1px 6px rgba(15,23,42,0.04)", overflow: "hidden",
        }}>
          <div style={{
            padding: "13px 16px", borderBottom: "1px solid #f1f5f9",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Alertas rápidos</h3>
            {alertas.some((a) => a.nivel === "alto") && (
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444" }} />
            )}
          </div>
          <div style={{ padding: "8px" }}>
            {alertas.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "9px",
                padding: "9px 10px", borderRadius: "8px", marginBottom: "4px",
                background: alertColor[a.nivel]?.bg || "#f8fafc",
                border: `1px solid ${alertColor[a.nivel]?.border || "#e5e7eb"}`,
              }}>
                <span style={{ fontSize: "14px", flexShrink: 0, lineHeight: 1 }}>{a.icone}</span>
                <span style={{ fontSize: "12px", color: "#374151", lineHeight: 1.4 }}>{a.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Últimos atendimentos ── */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "14px", boxShadow: "0 1px 6px rgba(15,23,42,0.04)", overflow: "hidden",
        }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Últimos atendimentos</h3>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>Finalizados hoje</p>
          </div>
          <div style={{ padding: "8px" }}>
            {ultimosFinalizados.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                Nenhum atendimento finalizado hoje
              </div>
            ) : ultimosFinalizados.map((item, i) => (
              <div key={item.id || i} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 10px", borderRadius: "8px", marginBottom: "4px",
                background: "#f8fafc", border: "1px solid #f1f5f9",
              }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "50%",
                  background: "#ecfdf5", border: "1px solid #bbf7d0",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <IconCheck />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.nomePaciente}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.medico !== "Sem médico definido" ? item.medico : ""}
                    {item.hora ? ` · ${item.hora}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: "10px", color: "#94a3b8", flexShrink: 0, maxWidth: "80px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.tipoAtendimento}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Responsive styles ─────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 1100px) {
          .dash-main-grid { grid-template-columns: 1fr !important; }
          .dash-kpi-grid  { grid-template-columns: repeat(2,1fr) !important; }
          .dash-bottom    { grid-template-columns: 1fr !important; }
          .dash-kanban    { grid-template-columns: repeat(2,1fr) !important; }
          .dash-consult   { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 680px) {
          .dash-kpi-grid  { grid-template-columns: 1fr 1fr !important; }
          .dash-kanban    { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
