import { useEffect, useMemo, useState } from "react";
import { hojeISO } from "../utils/dateUtils";
import AlertaBanner from "../components/AlertaBanner";
import api from "../services/api";
import {
  isFaturamentoConfirmado,
  isPagamentoPendente,
  valorCanonicoPagamento,
} from "../utils/financeUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizarTexto(v) {
  return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function obterNomePaciente(item) {
  return item?.paciente || item?.nomePaciente || item?.nome || item?.patientName || "Paciente";
}
function obterMedico(item) {
  return item?.medico || item?.nomeMedico || item?.profissional || "—";
}
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function statusOp(status) {
  const t = normalizarTexto(status);
  if (t.includes("aguard") || t === "espera" || t === "presente") return "aguardando";
  if (t === "agendado" || t === "agendada" || t === "confirmado" || t === "confirmada") return "agendado";
  if (t.includes("atend")) return "atendimento";
  if (t.includes("finaliz") || t.includes("conclui")) return "finalizado";
  if (t.includes("cancel") || t === "faltou") return "cancelado";
  return "agendado";
}
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

// ── Tokens roxo Vynor (alinhados ao sistema) ──────────────────────────────────

const P = "#7C3AED";
const PL = "#EDE9FE";
const PD = "#6D28D9";
const PBG = "#F5F3FF";

// ── SVG Area Chart (roxo) ─────────────────────────────────────────────────────

function AreaChart({ dados }) {
  const [hov, setHov] = useState(null);
  const W = 600, H = 190, pL = 34, pR = 14, pT = 14, pB = 36;
  const iW = W - pL - pR, iH = H - pT - pB;
  const maxVal = Math.max(...dados.map((d) => d.valor), 1);

  const pts = dados.map((d, i) => ({
    x: pL + (dados.length < 2 ? iW / 2 : (i / (dados.length - 1)) * iW),
    y: pT + (1 - d.valor / maxVal) * iH,
    ...d,
  }));

  const linePath = smoothPath(pts);
  const areaPath =
    pts.length > 1
      ? `${linePath} L${pts[pts.length - 1].x.toFixed(2)} ${(pT + iH).toFixed(2)} L${pts[0].x.toFixed(2)} ${(pT + iH).toFixed(2)} Z`
      : "";

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="dashAreaGradP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P} stopOpacity="0.18" />
            <stop offset="100%" stopColor={P} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((pct, i) => {
          const y = pT + pct * iH;
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={pL - 5} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">
                {Math.round(maxVal * (1 - pct))}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#dashAreaGradP)" />}
        {linePath && (
          <path d={linePath} fill="none" stroke={P} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {pts.map((pt, i) => {
          const isH = hov === i;
          const tipX = Math.max(pL, Math.min(pt.x - 36, W - pR - 72));
          return (
            <g key={i}>
              {isH && (
                <>
                  <line x1={pt.x} y1={pT} x2={pt.x} y2={pT + iH} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" />
                  <rect x={tipX} y={pt.y - 34} width="72" height="24" rx="8" fill="#1e1b4b" />
                  <text x={tipX + 36} y={pt.y - 17} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="600">
                    {pt.valor} consultas
                  </text>
                </>
              )}
              <circle
                cx={pt.x} cy={pt.y} r={isH ? 6 : 4}
                fill={isH ? P : "#fff"} stroke={P} strokeWidth="2.5"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              />
              <text x={pt.x} y={H - 4} fontSize="10" fill="#94a3b8" textAnchor="middle">{pt.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── SVG Donut Chart (tons de roxo) ────────────────────────────────────────────

function DonutChart({ segments, total }) {
  const R = 56, CX = 72, CY = 72;
  const circ = 2 * Math.PI * R;

  const segs = segments.map((s, i) => {
    const cumulativeBefore = segments
      .slice(0, i)
      .reduce((sum, ps) => sum + (total > 0 ? ps.valor / total : 0), 0);
    const pct = total > 0 ? s.valor / total : 0;
    return {
      ...s,
      dash: circ * pct,
      offset: circ * (0.25 - cumulativeBefore),
    };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
      <div style={{ flexShrink: 0 }}>
        <svg width="144" height="144" viewBox="0 0 144 144">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth="20" />
          {segs.map((s, i) => (
            <circle
              key={i} cx={CX} cy={CY} r={R}
              fill="none" stroke={s.color} strokeWidth="20"
              strokeDasharray={`${s.dash} ${circ}`}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ))}
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a">
            {total}
          </text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="11" fill="#64748b">Total</text>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {s.valor} ({total > 0 ? Math.round((s.valor / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Circular Gauge (roxo) ─────────────────────────────────────────────────────

function CircularGauge({ pct }) {
  const R = 26, circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? "#16a34a" : pct >= 60 ? "#f59e0b" : "#dc2626";
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={R} fill="none" stroke={PL} strokeWidth="6" />
      <circle
        cx="34" cy="34" r={R} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "34px 34px" }}
      />
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">{pct}%</text>
    </svg>
  );
}

// ── Calendar (roxo) ───────────────────────────────────────────────────────────

function CalendarWidget({ consultas, onSelectDate }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel, setSel] = useState(hojeISO());
  const todayISO = hojeISO();

  const daysWithAppt = useMemo(() => {
    const s = new Set();
    consultas.forEach((c) => {
      const d = c.data || "";
      if (d) s.add(String(d).slice(0, 10));
    });
    return s;
  }, [consultas]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  function prev() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function pick(d) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    setSel(iso);
    onSelectDate?.(iso);
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
          {monthLabel}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          {[["‹", prev], ["›", next]].map(([ch, fn]) => (
            <button
              key={ch} onClick={fn}
              style={{
                width: "26px", height: "26px", borderRadius: "6px",
                border: "1px solid #e2e8f0", background: "#fff",
                cursor: "pointer", color: "#64748b", fontSize: "15px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >{ch}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isSel = iso === sel;
          const isToday = iso === todayISO;
          const hasAppt = daysWithAppt.has(iso);
          return (
            <div
              key={i}
              onClick={() => pick(d)}
              style={{
                height: "32px", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                borderRadius: "7px", cursor: "pointer",
                background: isSel ? P : isToday ? PL : "transparent",
                color: isSel ? "#fff" : isToday ? PD : "#374151",
                fontWeight: isSel || isToday ? 700 : 400,
                fontSize: "12px", position: "relative",
                transition: "background 0.1s",
              }}
            >
              {d}
              {hasAppt && (
                <span style={{
                  position: "absolute", bottom: "3px",
                  width: "4px", height: "4px", borderRadius: "50%",
                  background: isSel ? "rgba(255,255,255,0.8)" : P,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const MAP = {
    finalizado:  { label: "Finalizado",    bg: "#dcfce7", color: "#16a34a" },
    agendado:    { label: "Agendado",      bg: "#f1f5f9", color: "#64748b" },
    confirmado:  { label: "Confirmado",    bg: "#dcfce7", color: "#16a34a" },
    aguardando:  { label: "Aguardando",    bg: "#fef9c3", color: "#854d0e" },
    atendimento: { label: "Em atend.",     bg: "#dbeafe", color: "#1d4ed8" },
    cancelado:   { label: "Cancelado",     bg: "#fee2e2", color: "#991b1b" },
  };
  const cfg = MAP[status] || MAP.agendado;
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, padding: "3px 8px",
      borderRadius: "999px", background: cfg.bg, color: cfg.color,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

// ── Trend arrow ───────────────────────────────────────────────────────────────

function Trend({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "11px", fontWeight: 700, color: up ? "#16a34a" : "#dc2626" }}>
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
      {Math.abs(pct)}%
    </span>
  );
}

// ── summaryCard helper (plain function, não componente) ───────────────────────

function summaryCard(label, value, sub, trend, icon, iconBg, gauge) {
  return (
    <div className="page-card" style={{ padding: "20px", transition: "box-shadow 0.15s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
        {gauge !== undefined ? (
          <CircularGauge pct={gauge} />
        ) : (
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: gauge !== undefined ? "22px" : "32px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "6px" }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {trend !== null && <Trend pct={trend} />}
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{sub}</span>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({
  consultas = [],
  pagamentos = [],
  pacientes = [],
  atendimentosOdonto = [],
  indicadores = {},
  userData,
  onNavigate,
  onIrParaFinanceiro,
  onIrParaRelatorios,
}) {
  const [selectedDate, setSelectedDate] = useState(hojeISO());
  const dataHoje = hojeISO();

  // ── KPIs e alertas do backend (uma única requisição) ─────────────────────
  const [alertasBackend, setAlertasBackend] = useState([]);
  const [kpisBackend, setKpisBackend] = useState(null);
  // KPIs financeiros UNIFICADOS — fonte de verdade do Resumo financeiro.
  // Usa `/financeiro/kpis-unificados` no MÊS CORRENTE (mesmo período do card principal).
  const [kpisFinUnificado, setKpisFinUnificado] = useState(null);
  const [kpisFinErro, setKpisFinErro] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.dashboard.kpis()
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res?.data?.alertas)) setAlertasBackend(res.data.alertas);
        if (res?.data?.kpis) setKpisBackend(res.data.kpis);
      })
      .catch(() => { /* falha silenciosa — KPIs locais ainda funcionam */ });

    // Resumo financeiro vem do endpoint unificado. Fallback: cálculo local.
    const hoje = new Date();
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
    const fimDate = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
    const fim = `${fimDate.getFullYear()}-${String(fimDate.getMonth()+1).padStart(2,'0')}-${String(fimDate.getDate()).padStart(2,'0')}`;
    api.financeiro.kpisUnificados({ inicio, fim })
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.totais) setKpisFinUnificado(res.data);
      })
      .catch(() => { if (!cancelled) setKpisFinErro(true); });

    return () => { cancelled = true; };
  }, []);

  const firstName =
    userData?.nome?.split(" ")[0] ||
    userData?.username ||
    userData?.login ||
    "Usuário";
  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  function nav(v) { onNavigate?.(v); }

  // ── KPI: Pacientes ativos
  const totalPacientes = useMemo(() => {
    if (kpisBackend?.pacientes_ativos != null) return kpisBackend.pacientes_ativos;
    if (pacientes.length > 0) return pacientes.filter((p) => p.ativo !== false).length;
    return indicadores.totalPacientes || 0;
  }, [pacientes, indicadores, kpisBackend]);

  // ── KPI: Consultas este mês
  const consultasMes = useMemo(() => {
    if (kpisBackend?.consultas_mes != null) return kpisBackend.consultas_mes + (kpisBackend.consultas_odonto_mes ?? 0);
    const d = new Date();
    const mes = d.getMonth(), ano = d.getFullYear();
    return [...consultas, ...atendimentosOdonto].filter((c) => {
      const dt = new Date((c.data || "") + "T00:00:00");
      return dt.getMonth() === mes && dt.getFullYear() === ano;
    }).length;
  }, [consultas, atendimentosOdonto, kpisBackend]);

  // ── KPI: Faturamento este mês (fonte de verdade unificada — prioriza endpoint unificado).
  // Critério: pagos + cortesia, no mês, usando valor canônico (valorFinal ?? valor-desconto).
  const faturamentoMes = useMemo(() => {
    // Prioridade 1: endpoint unificado (mesma fonte do Resumo financeiro).
    if (kpisFinUnificado?.totais?.receita_confirmada != null) {
      return Number(kpisFinUnificado.totais.receita_confirmada);
    }
    // Prioridade 2: Dashboard KPI (compat com backend antigo).
    if (kpisBackend?.faturamento_mes != null) return kpisBackend.faturamento_mes;
    // Prioridade 3: fallback local.
    const d = new Date();
    const mes = d.getMonth(), ano = d.getFullYear();
    return pagamentos
      .filter((p) => {
        if (!isFaturamentoConfirmado(p)) return false;
        const dt = new Date((p.dataPagamento || p.data || "") + "T00:00:00");
        return dt.getMonth() === mes && dt.getFullYear() === ano;
      })
      .reduce((t, p) => t + valorCanonicoPagamento(p), 0);
  }, [kpisFinUnificado, pagamentos, kpisBackend]);

  // ── KPI: Taxa de ocupação (finalizados / total hoje)
  const taxaOcupacao = useMemo(() => {
    const hoje = [...consultas, ...atendimentosOdonto].filter(
      (c) => (c.data || "").slice(0, 10) === dataHoje,
    );
    const fin = hoje.filter((c) => statusOp(c.status) === "finalizado").length;
    return hoje.length ? Math.min(Math.round((fin / hoje.length) * 100), 100) : 0;
  }, [consultas, atendimentosOdonto, dataHoje]);

  // ── Trend semanal (usando dataHoje para evitar Date.now impuro)
  const trendConsultas = useMemo(() => {
    const [y, m, d] = dataHoje.split("-").map(Number);
    function subDays(n) {
      const dt = new Date(y, m - 1, d - n);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }
    const last7start = subDays(7);
    const prev7start = subDays(14);
    const all = [...consultas, ...atendimentosOdonto];
    const ult = all.filter((c) => { const dt = (c.data || "").slice(0, 10); return dt >= last7start && dt <= dataHoje; }).length;
    const ant = all.filter((c) => { const dt = (c.data || "").slice(0, 10); return dt >= prev7start && dt < last7start; }).length;
    return ant > 0 ? Math.round((ult - ant) / ant * 100) : null;
  }, [consultas, atendimentosOdonto, dataHoje]);

  // ── Chart 7 dias
  const chartDados = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
      const valor =
        consultas.filter((c) => (c.data || "").slice(0, 10) === iso).length +
        atendimentosOdonto.filter((c) => (c.data || "").slice(0, 10) === iso).length;
      return { data: iso, label, valor };
    });
  }, [consultas, atendimentosOdonto]);

  // ── Donut por especialidade
  const specialtyData = useMemo(() => {
    const counts = {};
    consultas.forEach((c) => {
      const esp = (c.especialidade || c.tipoAtendimento || c.tipo || "Outros").slice(0, 22);
      counts[esp] = (counts[esp] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const COLORS = [P, "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"];
    const top = sorted.slice(0, 4).map(([label, valor], i) => ({ label, valor, color: COLORS[i] }));
    const outrosN = sorted.slice(4).reduce((s, [, n]) => s + n, 0);
    if (outrosN > 0) top.push({ label: "Outros", valor: outrosN, color: COLORS[4] });
    if (!top.length) return [{ label: "Sem dados", valor: 1, color: "#e2e8f0" }];
    return top;
  }, [consultas]);

  const totalEspecialidades = specialtyData.reduce((s, d) => s + d.valor, 0);

  // ── Próximos atendimentos (data selecionada)
  const proximosAtend = useMemo(() => {
    return [
      ...consultas.map((c) => ({
        id: `c-${c.id}`, hora: c.hora || c.horario || "—",
        nome: obterNomePaciente(c), medico: obterMedico(c),
        tipo: "Consulta", status: statusOp(c.status),
        data: (c.data || "").slice(0, 10),
      })),
      ...atendimentosOdonto.map((c) => ({
        id: `o-${c.id}`, hora: c.hora || c.horario || "—",
        nome: obterNomePaciente(c), medico: obterMedico(c),
        tipo: "Odonto", status: statusOp(c.status),
        data: (c.data || "").slice(0, 10),
      })),
    ]
      .filter((e) => e.data === selectedDate && e.status !== "cancelado")
      .sort((a, b) => (a.hora > b.hora ? 1 : -1))
      .slice(0, 6);
  }, [consultas, atendimentosOdonto, selectedDate]);

  // ── Resumo financeiro (mesma fonte de verdade do card principal: backend unificado)
  //
  // Prioridade:
  //   1) Endpoint /financeiro/kpis-unificados (mês corrente — fonte de verdade).
  //   2) Fallback: cálculo local sobre `pagamentos` carregados (limitado ao paginated).
  const resumoFin = useMemo(() => {
    if (kpisFinUnificado?.totais) {
      const t = kpisFinUnificado.totais;
      return {
        faturamento:  Number(t.receita_confirmada || 0),
        recebimentos: Number(t.receita_confirmada || 0),
        pendencias:   Number(t.pendente_total     || 0),
        // dados extras para legenda da UI
        receitaHoje:  Number(t.receita_hoje       || 0),
        periodo:      kpisFinUnificado.periodo,
        fonte:        'backend-unificado',
      };
    }
    const d = new Date();
    const mes = d.getMonth(), ano = d.getFullYear();
    const isMes = (p) => {
      const dt = new Date((p.dataPagamento || p.data || "") + "T00:00:00");
      return dt.getMonth() === mes && dt.getFullYear() === ano;
    };
    return {
      faturamento: pagamentos
        .filter((p) => isFaturamentoConfirmado(p) && isMes(p))
        .reduce((t, p) => t + valorCanonicoPagamento(p), 0),
      recebimentos: pagamentos
        .filter((p) => isFaturamentoConfirmado(p) && isMes(p))
        .reduce((t, p) => t + valorCanonicoPagamento(p), 0),
      pendencias: pagamentos
        .filter(isPagamentoPendente)
        .reduce((t, p) => t + valorCanonicoPagamento(p), 0),
      fonte: 'local-fallback',
    };
  }, [kpisFinUnificado, pagamentos]);

  // ── Variação financeira mês anterior vs atual (real, sem fake %)
  const variacaoFin = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth(), anoAtual = now.getFullYear();
    const mesAnt = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    const isMesAtual = (p) => { const d = new Date((p.dataPagamento || p.data || "") + "T00:00:00"); return d.getMonth() === mesAtual && d.getFullYear() === anoAtual; };
    const isMesAnt   = (p) => { const d = new Date((p.dataPagamento || p.data || "") + "T00:00:00"); return d.getMonth() === mesAnt   && d.getFullYear() === anoAnt; };
    const recAtual = pagamentos.filter((p) => isFaturamentoConfirmado(p) && isMesAtual(p)).reduce((t, p) => t + valorCanonicoPagamento(p), 0);
    const recAnt   = pagamentos.filter((p) => isFaturamentoConfirmado(p) && isMesAnt(p)).reduce((t, p) => t + valorCanonicoPagamento(p), 0);
    if (!recAnt) return null;
    return Math.round(((recAtual - recAnt) / recAnt) * 100);
  }, [pagamentos]);

  // ── IDs de atendimentos que já possuem registro de pagamento no módulo Pagamentos
  const idsPagos = useMemo(() => {
    return new Set(
      pagamentos.map((p) => String(p.atendimentoId || p.consultaId || "")).filter(Boolean)
    );
  }, [pagamentos]);

  // ── Alertas operacionais do dia (pacientes aguardando, sem pagamento, pendências)
  const alertasOperacionais = useMemo(() => {
    const alertas = [];
    const aguardando = [...consultas, ...atendimentosOdonto].filter((c) => {
      const s = normalizarTexto(c.status || "");
      return (s === "aguardando" || s === "presente") && (c.data || "").slice(0, 10) === dataHoje;
    });
    if (aguardando.length > 0) {
      alertas.push({
        tipo: "atencao",
        titulo: `${aguardando.length} paciente${aguardando.length > 1 ? "s" : ""} aguardando atendimento`,
        detalhe: aguardando.map((c) => obterNomePaciente(c)).slice(0, 3).join(", "),
      });
    }
    const semPagamento = [...consultas, ...atendimentosOdonto].filter((c) => {
      const s = normalizarTexto(c.status || "");
      const spago = (c.statusPagamento || c.status_pagamento || "").toLowerCase();
      return s === "finalizado"
        && spago !== "cortesia"
        && !idsPagos.has(String(c.id))
        && !(c.pagamentoId || c.pagamento_id)
        && (c.data || "").slice(0, 10) === dataHoje;
    });
    if (semPagamento.length > 0) {
      alertas.push({
        tipo: "urgente",
        titulo: `${semPagamento.length} atendimento${semPagamento.length > 1 ? "s" : ""} aguardando pagamento`,
        detalhe: "Acesse Pagamentos para registrar",
      });
    }
    const pendentes = pagamentos.filter(isPagamentoPendente);
    if (pendentes.length > 0) {
      alertas.push({
        tipo: "info",
        titulo: `${pendentes.length} pagamento${pendentes.length > 1 ? "s" : ""} pendente${pendentes.length > 1 ? "s" : ""}`,
        detalhe: `Total: ${formatarMoeda(pendentes.reduce((t, p) => t + valorCanonicoPagamento(p), 0))}`,
      });
    }
    return alertas;
  }, [consultas, atendimentosOdonto, idsPagos, dataHoje, pagamentos]);

  // ── Próxima ação recomendada
  const proximaAcao = useMemo(() => {
    const aguardando = [...consultas, ...atendimentosOdonto].filter((c) => {
      const s = normalizarTexto(c.status || "");
      return (s === "aguardando" || s === "presente") && (c.data || "").slice(0, 10) === dataHoje;
    });
    if (aguardando.length > 0) {
      return { texto: `Iniciar atendimento de ${obterNomePaciente(aguardando[0])}`, view: "medicos", urgencia: "alta" };
    }
    const semPag = [...consultas, ...atendimentosOdonto].filter((c) => {
      return normalizarTexto(c.status || "") === "finalizado" && !idsPagos.has(String(c.id)) && (c.data || "").slice(0, 10) === dataHoje;
    });
    if (semPag.length > 0) return { texto: "Registrar pagamento de atendimento finalizado", view: "pagamentos", urgencia: "media" };
    const agendadosHoje = [...consultas, ...atendimentosOdonto].filter((c) => {
      return normalizarTexto(c.status || "") === "agendado" && (c.data || "").slice(0, 10) === dataHoje;
    });
    if (agendadosHoje.length > 0) return { texto: `${agendadosHoje.length} agendamento${agendadosHoje.length > 1 ? "s" : ""} para hoje`, view: "agendamentos", urgencia: "baixa" };
    return null;
  }, [consultas, atendimentosOdonto, idsPagos, dataHoje]);

  // ── Atividades recentes
  const atividades = useMemo(() => {
    const ev = [];
    [...consultas].reverse().slice(0, 5).forEach((c) => {
      const s = statusOp(c.status);
      ev.push({
        id: `c-${c.id}`,
        tipo: "consulta",
        titulo: s === "finalizado" ? "Consulta finalizada" : s === "agendado" ? "Consulta agendada" : "Consulta em andamento",
        detalhe: `${obterNomePaciente(c)}${obterMedico(c) !== "—" ? ` · ${obterMedico(c)}` : ""}`,
        hora: c.hora || "—",
        iconBg: PL, iconColor: P,
      });
    });
    pagamentos
      .filter(isFaturamentoConfirmado)
      .slice(-4).reverse()
      .forEach((p) => {
        ev.push({
          id: `p-${p.id}`, tipo: "pagamento",
          titulo: "Pagamento recebido",
          detalhe: `${p.nomePaciente || "Paciente"} · ${formatarMoeda(valorCanonicoPagamento(p))}`,
          hora: (p.dataPagamento || "").slice(11, 16) || "—",
          iconBg: "#dcfce7", iconColor: "#16a34a",
        });
      });
    pacientes.slice(-3).reverse().forEach((p) => {
      ev.push({
        id: `pac-${p.id}`, tipo: "paciente",
        titulo: "Paciente cadastrado",
        detalhe: p.nome || "Novo paciente",
        hora: "—",
        iconBg: "#dbeafe", iconColor: "#2563eb",
      });
    });
    return ev.slice(0, 7);
  }, [consultas, pagamentos, pacientes]);

  // ── Ações rápidas
  const quickActions = [
    { label: "Nova Consulta",   view: "medicos",       iconBg: PL,        iconColor: P },
    { label: "Novo Paciente",   view: "pacientes",     iconBg: "#dbeafe", iconColor: "#2563eb" },
    { label: "Buscar Paciente", view: "pacientes",     iconBg: "#f1f5f9", iconColor: "#64748b" },
    { label: "Emitir Recibo",   view: "pagamentos",    iconBg: "#fef3c7", iconColor: "#f59e0b" },
    { label: "Relatórios",      view: "relatorios",    iconBg: "#fee2e2", iconColor: "#dc2626" },
    { label: "Agenda do Dia",   view: "agendamentos",  iconBg: "#e0f2fe", iconColor: "#0284c7" },
  ];

  const qaIcons = {
    "Nova Consulta": (c) => (
      <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" /><path d="M12 11v6M9 14h6" />
      </svg>
    ),
    "Novo Paciente": (c) => (
      <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" /><line x1="17" y1="11" x2="23" y2="11" />
      </svg>
    ),
    "Buscar Paciente": (c) => (
      <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
    "Emitir Recibo": (c) => (
      <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    "Relatórios": (c) => (
      <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    "Agenda do Dia": (c) => (
      <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  };

  const actIcons = {
    consulta: (bg, color) => (
      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      </div>
    ),
    pagamento: (bg, color) => (
      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
    ),
    paciente: (bg, color) => (
      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        </svg>
      </div>
    ),
  };

  const evDateLabel = (() => {
    try {
      return new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short",
      });
    } catch {
      return selectedDate;
    }
  })();

  // card base style reutilizável
  const card = {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
    padding: "20px",
  };

  return (
    /* Renderiza DENTRO da área de conteúdo do sistema — sem position fixed,
       sem sidebar própria, sem topbar própria. */
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>

      {/* ── Cabeçalho da página (NÃO é uma topbar global) ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px",
        background: `linear-gradient(135deg, #3B0764 0%, ${P} 55%, #8B5CF6 100%)`,
        borderRadius: "16px", color: "#fff",
        boxShadow: "0 8px 28px rgba(124,58,237,0.25)",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "21px", fontWeight: 800, letterSpacing: "-0.03em" }}>
            Dashboard
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.72)" }}>
            Bem-vindo, {firstName} · {dataFormatada}
          </p>
        </div>
        <div style={{
          padding: "8px 16px", borderRadius: "10px",
          background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)",
          fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em",
        }}>
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="dash-kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}>
        {summaryCard(
          "Pacientes Ativos",
          totalPacientes.toLocaleString("pt-BR"),
          "cadastros ativos",
          null,
          <svg width="20" height="20" fill="none" stroke={P} strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>,
          PL,
        )}
        {summaryCard(
          "Consultas no Mês",
          consultasMes.toLocaleString("pt-BR"),
          "vs semana anterior",
          trendConsultas,
          <svg width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>,
          "#dbeafe",
        )}
        {summaryCard(
          "Faturamento do Mês",
          formatarMoeda(faturamentoMes),
          variacaoFin !== null ? "vs mês anterior" : "pagamentos confirmados",
          variacaoFin,
          <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>,
          "#fef3c7",
        )}
        {summaryCard(
          "Taxa de Ocupação",
          `${taxaOcupacao}%`,
          taxaOcupacao >= 80 ? "Ótimo" : taxaOcupacao >= 60 ? "Bom" : "Regular",
          null,
          null,
          undefined,
          taxaOcupacao,
        )}
      </div>

      {/* ── Alertas operacionais (locais + backend) ── */}
      {(alertasOperacionais.length > 0 || alertasBackend.length > 0) && (
        <AlertaBanner alertas={[...alertasOperacionais, ...alertasBackend]} />
      )}

      {/* ── Próxima ação recomendada ── */}
      {proximaAcao && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
          borderRadius: "12px",
          background: proximaAcao.urgencia === "alta" ? "#fef2f2" : proximaAcao.urgencia === "media" ? "#fffbeb" : "#f0fdf4",
          border: `1px solid ${proximaAcao.urgencia === "alta" ? "#fca5a5" : proximaAcao.urgencia === "media" ? "#fcd34d" : "#86efac"}`,
        }}>
          <span style={{ fontSize: "18px" }}>
            {proximaAcao.urgencia === "alta" ? "🔴" : proximaAcao.urgencia === "media" ? "🟡" : "🟢"}
          </span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Próxima ação recomendada
            </span>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{proximaAcao.texto}</div>
          </div>
          <button
            onClick={() => nav(proximaAcao.view)}
            style={{
              padding: "6px 12px", borderRadius: "7px", border: "1px solid #e2e8f0",
              background: "#fff", fontSize: "12px", fontWeight: 600, color: "#374151", cursor: "pointer",
            }}
          >
            Ir →
          </button>
        </div>
      )}

      {/* ── Layout principal 2 colunas ── */}
      <div className="dash-two-col" style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(268px,1fr)", gap: "20px", alignItems: "start" }}>

        {/* ── Coluna esquerda ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* Gráfico de linha */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Consultas nos últimos 7 dias</h3>
                <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>Médico + Odonto</p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ padding: "4px 12px", borderRadius: "6px", background: PL, color: PD, fontSize: "11px", fontWeight: 700 }}>Semanal</span>
                {onIrParaRelatorios && (
                  <button
                    onClick={onIrParaRelatorios}
                    style={{ padding: "4px 10px", borderRadius: "6px", background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Relatório →
                  </button>
                )}
              </div>
            </div>
            <AreaChart dados={chartDados} />
          </div>

          {/* Gráfico donut */}
          <div style={card}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Consultas por Especialidade</h3>
              <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>Distribuição geral</p>
            </div>
            <DonutChart segments={specialtyData} total={totalEspecialidades} />
          </div>

          {/* Atividades + Ações rápidas */}
          <div className="dash-bottom-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>

            {/* Atividades recentes */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Atividades recentes</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {atividades.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", padding: "16px 0", margin: 0 }}>
                    Nenhuma atividade
                  </p>
                ) : atividades.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {actIcons[a.tipo]?.(a.iconBg, a.iconColor)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{a.titulo}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detalhe}</div>
                    </div>
                    <span style={{ fontSize: "10px", color: "#94a3b8", flexShrink: 0 }}>{a.hora}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações rápidas */}
            <div style={card}>
              <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Ações rápidas</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => nav(qa.view)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: "7px", padding: "14px 8px",
                      borderRadius: "11px", border: "1px solid #e5e7eb",
                      background: "#fff", cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = qa.iconBg;
                      e.currentTarget.style.borderColor = qa.iconColor + "44";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#fff";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.transform = "";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ width: "38px", height: "38px", borderRadius: "9px", background: qa.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {qaIcons[qa.label]?.(qa.iconColor)}
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#374151", textAlign: "center", lineHeight: 1.3 }}>
                      {qa.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Coluna direita (calendário + agenda + financeiro) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Calendário */}
          <div style={card}>
            <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Calendário</h3>
            <CalendarWidget
              consultas={[...consultas, ...atendimentosOdonto]}
              onSelectDate={setSelectedDate}
            />
          </div>

          {/* Próximos atendimentos */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Próximos atendimentos</h3>
              <button
                onClick={() => nav("agendamentos")}
                style={{ fontSize: "11px", color: PD, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Ver agenda →
              </button>
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>{evDateLabel}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {proximosAtend.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", padding: "14px 0", margin: 0 }}>
                  Sem atendimentos para este dia
                </p>
              ) : proximosAtend.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{
                    width: "42px", flexShrink: 0, background: PBG,
                    borderRadius: "8px", padding: "5px 3px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: PD }}>{e.hora}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nome}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.tipo} · {e.medico}
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              ))}
            </div>
            {proximosAtend.length > 0 && (
              <button
                onClick={() => nav("agendamentos")}
                style={{
                  width: "100%", marginTop: "12px", padding: "8px",
                  borderRadius: "8px", border: "1px solid #e5e7eb",
                  background: "#f8fafc", color: "#374151",
                  fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}
              >
                Ver todos os atendimentos
              </button>
            )}
          </div>

          {/* Resumo financeiro */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Resumo financeiro</h3>
              <button
                onClick={onIrParaFinanceiro}
                style={{ fontSize: "11px", color: PD, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Ver detalhes
              </button>
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>
                Período: mês corrente
                {resumoFin.periodo?.inicio && resumoFin.periodo?.fim
                  ? ` (${resumoFin.periodo.inicio} → ${resumoFin.periodo.fim})`
                  : ""}
              </span>
              {kpisFinErro && (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>· offline (mostrando cache local)</span>
              )}
            </div>
            {[
              { label: "Faturamento do mês", valor: resumoFin.faturamento  },
              { label: "Total recebido",      valor: resumoFin.recebimentos },
              { label: "Pendências",          valor: resumoFin.pendencias, alerta: resumoFin.pendencias > 0 },
            ].map((row) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 0", borderBottom: "1px solid #f1f5f9",
              }}>
                <span style={{ fontSize: "12px", color: "#374151" }}>{row.label}</span>
                <span style={{
                  fontSize: "12px", fontWeight: 700,
                  color: row.alerta ? "#dc2626" : "#0f172a",
                }}>
                  {formatarMoeda(row.valor)}
                </span>
              </div>
            ))}
            <button
              onClick={onIrParaRelatorios}
              style={{
                marginTop: "12px", padding: 0, border: "none", background: "none",
                fontSize: "12px", color: PD, fontWeight: 600, cursor: "pointer",
                display: "block",
              }}
            >
              Ver relatório financeiro completo ↗
            </button>
          </div>
        </div>
      </div>

      {/* ── Responsivo ── */}
      <style>{`
        @media (max-width: 1100px) {
          .dash-two-col { grid-template-columns: 1fr !important; }
          .dash-kpi-row { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 700px) {
          .dash-kpi-row { grid-template-columns: 1fr !important; }
          .dash-bottom-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
