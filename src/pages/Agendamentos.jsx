import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hojeISO, formatarData } from "../utils/dateUtils";
import { CalendarDays } from "lucide-react";
import EmptyState from "../components/EmptyState";

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizarTexto(valor) {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function obterDataISO(valor) {
  if (!valor) return "";
  if (typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
      const [dia, mes, ano] = valor.split("/");
      return `${ano}-${mes}-${dia}`;
    }
    return valor;
  }
  return "";
}

function normalizarStatus(status) {
  const t = normalizarTexto(status);
  if (t === "finalizado" || t === "finalizada") return "finalizado";
  if (t === "em_atendimento" || t === "em atendimento") return "em_atendimento";
  if (t === "confirmado" || t === "confirmada") return "confirmado";
  if (t === "aguardando" || t === "aguardando atendimento") return "aguardando";
  if (t === "presente" || t === "chegou") return "presente";
  if (t === "faltou" || t === "nao compareceu" || t === "ausente") return "faltou";
  if (t === "remarcado" || t === "remarcada") return "remarcado";
  if (t === "cancelado" || t === "cancelada") return "cancelado";
  return "agendado";
}

const BADGE_BG = {
  agendado: "#eff6ff", confirmado: "#ecfdf5", aguardando: "#fffbeb",
  presente: "#fff7ed", em_atendimento: "#f0fdf4",
  finalizado: "#f3f4f6", cancelado: "#fef2f2", faltou: "#fef2f2", remarcado: "#f5f3ff",
};
const BADGE_COLOR = {
  agendado: "#2563eb", confirmado: "#059669", aguardando: "#d97706",
  presente: "#ea580c", em_atendimento: "#16a34a",
  finalizado: "#6b7280", cancelado: "#dc2626", faltou: "#dc2626", remarcado: "#7c3aed",
};
const LABEL_STATUS = {
  agendado: "Agendado", confirmado: "Confirmado", aguardando: "Aguardando",
  presente: "Presente", em_atendimento: "Em Atendimento",
  finalizado: "Finalizado", cancelado: "Cancelado", faltou: "Faltou", remarcado: "Remarcado",
};
function labelStatus(status) {
  return LABEL_STATUS[normalizarStatus(status)] || status || "Agendado";
}

function corEventoCalendario(item) {
  const s = normalizarStatus(item.status);
  if (item.tipoConsulta === "odonto")      return "#0f766e";
  if (item.tipoConsulta === "enfermagem")  return "#7c3aed";
  if (s === "em_atendimento") return "#2563eb";
  if (s === "confirmado")     return "#059669";
  if (s === "aguardando" || s === "presente") return "#d97706";
  return "#16a34a";
}

function obterMesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function gerarDiasDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return Array.from({ length: ultimo }, (_, i) => {
    const dia = String(i + 1).padStart(2, "0");
    return `${ano}-${String(m).padStart(2, "0")}-${dia}`;
  });
}

function nomeDoDia(dataISO) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { weekday: "short" });
}

function nomeDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function abrirWhatsApp(telefone, nome, data, hora, medico) {
  const digits = (telefone || "").replace(/\D/g, "");
  if (!digits || digits.length < 8) return;
  const ddi = digits.startsWith("55") ? digits : `55${digits}`;
  const dataFmt = formatarData(data);
  const horaFmt = hora && hora !== "—" ? ` às ${hora}` : "";
  const medFmt = medico && medico !== "—" ? ` com ${medico}` : "";
  const msg = encodeURIComponent(
    `Olá, ${nome}! Confirmamos sua consulta agendada para ${dataFmt}${horaFmt}${medFmt}. Confirme sua presença respondendo esta mensagem. Obrigado!`
  );
  window.open(`https://wa.me/${ddi}?text=${msg}`, "_blank", "noopener");
}

// ── Modal reagendar ────────────────────────────────────────────────────────────

function ModalReagendar({ item, onFechar, onSalvar }) {
  const hoje = hojeISO();
  const [data, setData] = useState(item.dataNormalizada || "");
  const [hora, setHora] = useState(item.horaNormalizada !== "—" ? item.horaNormalizada : "");
  const [salvando, setSalvando] = useState(false);
  const [erroData, setErroData] = useState("");

  function validarData(v) {
    if (!v) { setErroData("A data é obrigatória."); return false; }
    if (v < hoje) { setErroData("Não é possível agendar para uma data passada."); return false; }
    setErroData("");
    return true;
  }

  async function salvar() {
    if (!validarData(data)) return;
    setSalvando(true);
    try { await onSalvar(item, { data, hora }); onFechar(); }
    finally { setSalvando(false); }
  }

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "min(420px,95vw)", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>Remarcar consulta</h2>
          <button onClick={onFechar} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>{item.pacienteNormalizado}</p>
          <p style={{ margin: "2px 0 0", color: "#6b7280" }}>{item.especialidadeNormalizada} · {item.medicoNormalizado}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: erroData ? "#dc2626" : "#374151", marginBottom: 4 }}>
              Nova data <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input type="date" value={data} min={hoje}
              onChange={(e) => { setData(e.target.value); validarData(e.target.value); }}
              onBlur={(e) => validarData(e.target.value)}
              style={{ ...inp, border: erroData ? "1.5px solid #dc2626" : "1px solid #d1d5db", background: erroData ? "#fff5f5" : "#fff" }}
            />
            {erroData && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#dc2626" }}>{erroData}</p>}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Novo horário</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...inp, border: "1px solid #d1d5db" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onFechar} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.7 : 1, fontSize: 14, fontWeight: 600 }}>
            {salvando ? "Salvando…" : "Confirmar remarcação"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Painel lateral de ações ────────────────────────────────────────────────────

function PainelDetalhes({ item, onFechar, onAcao, onEncaminhar, onRemarcar }) {
  const [loading, setLoading] = useState(null);
  const sNorm = normalizarStatus(item.status);
  const podeAgir = !["finalizado", "cancelado", "faltou", "em_atendimento"].includes(sNorm);
  const telefone = (item.telefoneNormalizado || "").replace(/\D/g, "");
  const temFone = telefone.length >= 8;

  async function executar(acao, statusNovo) {
    setLoading(acao);
    try { await onAcao(item, statusNovo); }
    finally { setLoading(null); }
  }

  async function encaminhar(status = "aguardando") {
    setLoading("encaminhar");
    try { await onEncaminhar(item, status); }
    finally { setLoading(null); }
  }

  const Btn = ({ children, onClick, bg, color, disabled }) => (
    <button
      onClick={onClick}
      disabled={!!loading || disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", padding: "11px 14px", borderRadius: 10, border: "none",
        background: (!!loading || disabled) ? "#f1f5f9" : bg,
        color: (!!loading || disabled) ? "#94a3b8" : color,
        fontSize: 13, fontWeight: 600,
        cursor: (!!loading || disabled) ? "not-allowed" : "pointer",
        transition: "opacity .15s",
      }}
    >
      {children}
    </button>
  );

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onFechar}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 9998 }}
      />

      {/* Painel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(380px, 100vw)",
        background: "#fff",
        zIndex: 9999,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(15,23,42,0.18)",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          background: item.tipoConsulta === "odonto"
            ? "linear-gradient(135deg,#0f766e,#0d9488)"
            : item.tipoConsulta === "enfermagem"
            ? "linear-gradient(135deg,#7c3aed,#8b5cf6)"
            : "linear-gradient(135deg,#1d4ed8,#2563eb)",
          padding: "20px 20px 18px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
                {item.tipoConsulta === "odonto" ? "Odontologia" : item.tipoConsulta === "enfermagem" ? "Procedimento de Enfermagem" : "Consulta Médica"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.3, wordBreak: "break-word" }}>
                {item.pacienteNormalizado}
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 20,
                  fontSize: 11, fontWeight: 700,
                  background: "rgba(255,255,255,0.18)", color: "#fff",
                }}>
                  {labelStatus(item.status)}
                </span>
              </div>
            </div>
            <button
              onClick={onFechar}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 18, flexShrink: 0, marginLeft: 12 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Detalhes */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
          {[
            { label: "Data", valor: formatarData(item.dataNormalizada) },
            { label: "Horário", valor: item.horaNormalizada !== "—" ? item.horaNormalizada : "—" },
            { label: "Profissional", valor: item.medicoNormalizado },
            { label: "Especialidade", valor: item.especialidadeNormalizada },
            { label: "Telefone", valor: item.telefoneNormalizado },
          ].map(({ label, valor }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f8fafc" }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, textAlign: "right" }}>{valor || "—"}</span>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>

          {/* Confirmar e encaminhar — único botão de check-in */}
          {(sNorm === "agendado" || sNorm === "confirmado") && (
            <Btn
              bg="#1d4ed8" color="#fff"
              onClick={() => encaminhar("aguardando")}
            >
              {loading === "encaminhar" ? "Confirmando…" : "✓  Confirmar e encaminhar"}
            </Btn>
          )}

          {/* WhatsApp */}
          {temFone && podeAgir && (
            <Btn
              bg="#f0fdf4" color="#16a34a"
              onClick={() => abrirWhatsApp(item.telefoneNormalizado, item.pacienteNormalizado, item.dataNormalizada, item.horaNormalizada, item.medicoNormalizado)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Confirmar por WhatsApp
            </Btn>
          )}

          {/* Separador se houver ações destrutivas abaixo */}
          {podeAgir && (
            <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />
          )}

          {/* Remarcar */}
          {podeAgir && (
            <Btn
              bg="#f8fafc" color="#475569"
              onClick={() => { onFechar(); onRemarcar(item); }}
            >
              ↻  Remarcar data / horário
            </Btn>
          )}

          {/* Faltou */}
          {podeAgir && (
            <Btn
              bg="#fff7ed" color="#ea580c"
              onClick={() => executar("faltou", "faltou")}
            >
              {loading === "faltou" ? "Registrando…" : "✗  Registrar falta"}
            </Btn>
          )}

          {/* Cancelar */}
          {podeAgir && (
            <Btn
              bg="#fef2f2" color="#dc2626"
              onClick={() => executar("cancelar", "cancelado")}
            >
              {loading === "cancelar" ? "Cancelando…" : "✕  Cancelar agendamento"}
            </Btn>
          )}

          {/* Estado final — apenas informativo */}
          {!podeAgir && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>
              {sNorm === "em_atendimento" && "Paciente em atendimento no momento."}
              {sNorm === "finalizado" && "Consulta finalizada."}
              {sNorm === "cancelado" && "Agendamento cancelado."}
              {sNorm === "faltou" && "Paciente registrado como falta."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────

const LABEL_ROLE = {
  medico: "Médico", enfermagem: "Enfermagem", odonto: "Odontologia",
  admin: "Administrador", recepcao: "Recepção", financeiro: "Financeiro",
};

export default function Agendamentos({
  consultas = [],
  agendamentosOdonto = [],
  users = [],
  onAtualizarConsulta,
  onAtualizarAgendamentoOdonto,
  onCriarAtendimentoOdonto,
  onEncaminharParaPagamento,
}) {
  const { userData } = useAuth();
  const toast = useToast();

  const [mesSelecionado, setMesSelecionado] = useState(obterMesAtual());
  const [itemReagendar, setItemReagendar] = useState(null);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [profissionalSelecionado, setProfissionalSelecionado] = useState(null);
  const [buscaProfissional, setBuscaProfissional] = useState("");

  const role = userData?.role || "";
  const podeVerTodos =
    role === "admin" || role === "recepcao" || role === "financeiro" ||
    role === "estoque" || role === "enfermagem" ||
    (Array.isArray(userData?.permissions) && (userData.permissions.includes("administracao") || userData.permissions.includes("configuracoes")));
  const isMedico = !podeVerTodos;

  const identificadoresUsuario = useMemo(() => {
    return [userData?.nome, userData?.name, userData?.username, userData?.usuario, userData?.login, userData?.email]
      .filter(Boolean).map(normalizarTexto);
  }, [userData]);

  const consultasMedNorm = useMemo(() => consultas.map((c) => {
    const tipoAtend = (c.tipoAtendimento || "").toLowerCase();
    const tipoConsulta = tipoAtend.startsWith("procedimento") ? "enfermagem" : "medico";
    return {
      ...c,
      dataNormalizada:          obterDataISO(c.data || c.dataAgendamento || c.createdAt),
      pacienteNormalizado:      c.paciente || c.nomePaciente || c.nome || "Paciente",
      medicoNormalizado:        c.medico || c.profissional || c.nomeMedico || c.profissionalNome || "—",
      especialidadeNormalizada: c.especialidade || c.servico || "—",
      telefoneNormalizado:      c.telefone || c.paciente_telefone || c.celular || "—",
      horaNormalizada:          c.hora || c.horario || c.horaAgendamento || "—",
      tipoConsulta,
    };
  }), [consultas]);

  const consultasOdontoNorm = useMemo(() => agendamentosOdonto.map((a) => ({
    ...a,
    dataNormalizada:      obterDataISO(a.data || a.createdAt),
    pacienteNormalizado:  a.pacienteNome || a.paciente || "Paciente",
    medicoNormalizado:    a.profissionalNome || a.profissional || "—",
    especialidadeNormalizada: "Odontologia",
    telefoneNormalizado:  a.telefone || "—",
    horaNormalizada:      a.hora || "—",
    tipoConsulta: "odonto",
  })), [agendamentosOdonto]);

  const pertenceAoProfissionalLogado = useCallback((consulta) => {
    const r = userData?.role || "";
    const pode = r === "admin" || r === "recepcao" || r === "financeiro" || r === "estoque" || r === "enfermagem" ||
      (Array.isArray(userData?.permissions) && (userData.permissions.includes("administracao") || userData.permissions.includes("configuracoes")));
    if (pode) return true;
    const meuId = String(userData?.id || "");
    if (!meuId) return false;
    const idC = consulta.usuarioId != null ? String(consulta.usuarioId) : String(consulta.profissionalId || "").trim();
    if (idC) return idC === meuId;
    const nomes = [consulta.medico, consulta.profissional, consulta.profissionalNome, consulta.medicoNome]
      .filter(Boolean).map(normalizarTexto);
    return nomes.some((v) => identificadoresUsuario.some((u) => v === u));
  }, [userData, identificadoresUsuario]);

  const todasConsultas = useMemo(() => {
    return [...consultasMedNorm, ...consultasOdontoNorm].filter(pertenceAoProfissionalLogado);
  }, [consultasMedNorm, consultasOdontoNorm, pertenceAoProfissionalLogado]);

  const consultasAtivas = useMemo(() => todasConsultas.filter((c) => {
    const s = normalizarStatus(c.status);
    return s !== "finalizado" && s !== "cancelado" && s !== "faltou";
  }), [todasConsultas]);

  const amanha = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const chegadaAntecipada = useMemo(() =>
    consultasAtivas.filter((c) =>
      c.dataNormalizada === amanha &&
      ["agendado", "confirmado"].includes(normalizarStatus(c.status))
    ),
  [consultasAtivas, amanha]);

  const consultasOrdenadas = useMemo(() => [...consultasAtivas].sort(
    (a, b) => (a.dataNormalizada || "").localeCompare(b.dataNormalizada || "") ||
              (a.horaNormalizada || "").localeCompare(b.horaNormalizada || "")
  ), [consultasAtivas]);

  const diasDoMes = useMemo(() => gerarDiasDoMes(mesSelecionado), [mesSelecionado]);

  const consultasDoMes = useMemo(() =>
    consultasOrdenadas.filter((c) => String(c.dataNormalizada || "").startsWith(mesSelecionado)),
    [consultasOrdenadas, mesSelecionado]
  );

  const consultasFiltradasDoMes = useMemo(() => consultasDoMes.filter((c) => {
    const termo = normalizarTexto(busca);
    if (filtroTipo !== "todos" && c.tipoConsulta !== filtroTipo) return false;
    if (!termo) return true;
    return (
      normalizarTexto(c.pacienteNormalizado).includes(termo) ||
      normalizarTexto(c.medicoNormalizado).includes(termo) ||
      normalizarTexto(c.especialidadeNormalizada).includes(termo) ||
      normalizarTexto(c.telefoneNormalizado).includes(termo)
    );
  }), [consultasDoMes, busca, filtroTipo]);

  const consultasDoDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return [];
    return consultasFiltradasDoMes.filter((c) => c.dataNormalizada === diaSelecionado);
  }, [consultasFiltradasDoMes, diaSelecionado]);

  const conflitosHora = useMemo(() => {
    const contagem = {};
    consultasDoDiaSelecionado.forEach((c) => {
      if (!c.hora || !c.medico) return;
      const chave = `${c.hora.slice(0, 5)}|${(c.medico || "").toLowerCase()}`;
      contagem[chave] = (contagem[chave] || 0) + 1;
    });
    const conflitos = new Set();
    Object.entries(contagem).forEach(([chave, n]) => { if (n > 1) conflitos.add(chave); });
    return conflitos;
  }, [consultasDoDiaSelecionado]);

  const agrupadasPorDia = useMemo(() => consultasFiltradasDoMes.reduce((acc, c) => {
    const d = c.dataNormalizada;
    if (!d) return acc;
    if (!acc[d]) acc[d] = [];
    acc[d].push(c);
    return acc;
  }, {}), [consultasFiltradasDoMes]);

  // ── Agenda por profissional ────────────────────────────────────────────────
  const profissionaisAtivos = useMemo(() => {
    if (users.length > 0) {
      return users.filter((u) => {
        if (u.ativo === false || Number(u.ativo) === 0) return false;
        return u.atendePacientes || ["medico", "enfermagem", "odonto"].includes(u.role || "");
      });
    }
    // fallback: extrai dos agendamentos quando users não é passado
    const seen = new Set();
    return todasConsultas
      .filter((c) => c.medicoNormalizado && c.medicoNormalizado !== "—")
      .map((c) => ({ id: c.usuarioId || null, nome: c.medicoNormalizado, role: "" }))
      .filter((p) => !seen.has(p.nome) && seen.add(p.nome));
  }, [users, todasConsultas]);

  const profissionaisFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaProfissional);
    if (!termo) return profissionaisAtivos;
    return profissionaisAtivos.filter((p) =>
      normalizarTexto(p.nome || "").includes(termo) ||
      normalizarTexto(p.especialidade || "").includes(termo) ||
      normalizarTexto(LABEL_ROLE[p.role] || p.role || "").includes(termo)
    );
  }, [profissionaisAtivos, buscaProfissional]);

  const agendaProfissional = useMemo(() => {
    if (!profissionalSelecionado) return [];
    const profId = String(profissionalSelecionado.id || "");
    const profNome = normalizarTexto(profissionalSelecionado.nome || "");
    return todasConsultas
      .filter((c) => {
        const idC = c.usuarioId != null ? String(c.usuarioId) : String(c.profissionalId || "");
        if (profId && idC && idC === profId) return true;
        const nomesC = [c.medicoNormalizado].filter(Boolean).map(normalizarTexto);
        return profNome && nomesC.some((n) => n === profNome);
      })
      .sort(
        (a, b) =>
          (a.dataNormalizada || "").localeCompare(b.dataNormalizada || "") ||
          (a.horaNormalizada || "").localeCompare(b.horaNormalizada || "")
      );
  }, [profissionalSelecionado, todasConsultas]);

  const agendaProfissionalDoMes = useMemo(
    () => agendaProfissional.filter((c) => String(c.dataNormalizada || "").startsWith(mesSelecionado)),
    [agendaProfissional, mesSelecionado]
  );

  function voltarMes() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const d = new Date(ano, mes - 2, 1);
    setMesSelecionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDiaSelecionado("");
  }

  function avancarMes() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const d = new Date(ano, mes, 1);
    setMesSelecionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDiaSelecionado("");
  }

  async function encaminharParaAtendimento(item, status = "aguardando") {
    try {
      const hoje = hojeISO();
      const dataAgendamento = item.dataNormalizada || "";
      const isFuturo = dataAgendamento > hoje;
      const extra = (isFuturo && status === "aguardando")
        ? { antecipado_em: new Date().toISOString() }
        : {};

      if (item.tipoConsulta === "odonto" && onAtualizarAgendamentoOdonto) {
        if (status === "aguardando") {
          await onCriarAtendimentoOdonto?.(item);
        } else {
          await onAtualizarAgendamentoOdonto(item.id, { status, ...extra });
        }
      } else if (onAtualizarConsulta) {
        await onAtualizarConsulta(item.id, { status, ...extra });
      }
      const msg = status === "confirmado"
        ? `Presença de ${item.pacienteNormalizado} confirmada.`
        : isFuturo
          ? `${item.pacienteNormalizado} chegou antes do horário — encaminhado para atendimento.`
          : `${item.pacienteNormalizado} encaminhado para atendimento.`;
      toast.success(msg);
      setItemSelecionado(null);
    } catch (e) {
      console.error("encaminharParaAtendimento:", e);
      const dados = e?.data?.errors;
      if (dados?.action === "redirect_to_pagamentos" && item.tipoConsulta === "odonto") {
        onEncaminharParaPagamento?.({
          pacienteId: dados.paciente_id || item.pacienteId || "",
          paciente: dados.paciente_nome || item.pacienteNormalizado || "",
          profissional: item.medicoNormalizado || "",
          atendimentoId: "",
          agendamentoOdontoId: dados.agendamento_id || item.id,
          tipoAtendimento: dados.descricao || item.tipoAtendimento || "Atendimento odontológico",
          valor: dados.valor_estimado ? String(dados.valor_estimado) : "",
        });
        toast.warn(e?.data?.message || "Registre o pagamento antes de encaminhar.");
        setItemSelecionado(null);
        return;
      }
      toast.error(e?.data?.message || "Não foi possível atualizar o agendamento.");
    }
  }

  async function executarAcao(item, statusNovo) {
    const LABELS = {
      confirmado: "Agendamento confirmado.",
      aguardando: "Paciente encaminhado para atendimento.",
      faltou: "Falta registrada.",
      cancelado: "Agendamento cancelado.",
    };
    const CONFIRMS = {
      faltou:   `Registrar falta de ${item.pacienteNormalizado}?`,
      cancelado: `Cancelar agendamento de ${item.pacienteNormalizado}?`,
    };
    if (CONFIRMS[statusNovo]) {
      const ok = await toast.confirm(CONFIRMS[statusNovo]);
      if (!ok) return;
    }
    try {
      if (item.tipoConsulta === "odonto" && onAtualizarAgendamentoOdonto) {
        await onAtualizarAgendamentoOdonto(item.id, { status: statusNovo });
      } else if (onAtualizarConsulta) {
        await onAtualizarConsulta(item.id, { status: statusNovo });
      }
      toast.success(LABELS[statusNovo] || "Atualizado.");
      setItemSelecionado(null);
    } catch {
      toast.error("Não foi possível atualizar o agendamento.");
    }
  }

  async function reagendarAgendamento(item, { data, hora }) {
    try {
      if (item.tipoConsulta === "odonto" && onAtualizarAgendamentoOdonto) {
        await onAtualizarAgendamentoOdonto(item.id, { data, hora: hora || null, status: "agendado" });
      } else if (onAtualizarConsulta) {
        await onAtualizarConsulta(item.id, { data, hora: hora || null, status: "agendado" });
      }
      toast.success("Agendamento remarcado.");
    } catch {
      toast.error("Não foi possível remarcar o agendamento.");
      throw new Error("falha");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Agendamentos</h1>
        <p className="page-subtitle">Calendário integrado — consultas médicas e odontológicas.</p>
      </div>

      <div className="page-card" style={{ marginTop: "20px" }}>
        <div className="card-title-row">
          <div>
            <h3 style={{ marginBottom: 0 }}>Calendário de agendamentos</h3>
            <p className="page-subtitle" style={{ marginTop: "4px" }}>
              {isMedico
                ? "Mostrando apenas os agendamentos vinculados ao profissional logado."
                : "Clique em qualquer paciente para ver detalhes e ações."}
            </p>
          </div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="secondary-btn" onClick={voltarMes}>‹</button>
            <strong style={{ textTransform: "capitalize" }}>{nomeDoMes(mesSelecionado)}</strong>
            <button className="secondary-btn" onClick={avancarMes}>›</button>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: "16px", flexWrap: "wrap" }}>
          <input
            className="input" type="month" value={mesSelecionado}
            onChange={(e) => { setMesSelecionado(e.target.value); setDiaSelecionado(""); }}
          />
          <input
            className="input search-input"
            placeholder="Buscar paciente, profissional, especialidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="select" value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ width: "auto", minWidth: "160px" }}
          >
            <option value="todos">Todos os setores</option>
            <option value="medico">Médico / Clínica</option>
            <option value="odonto">Odontologia</option>
            <option value="enfermagem">Enfermagem</option>
          </select>
        </div>

        {/* Legenda */}
        <div style={{ display: "flex", gap: "14px", marginTop: "12px", fontSize: "12px", flexWrap: "wrap" }}>
          {[
            { cor: "#16a34a", label: "Agendado" },
            { cor: "#059669", label: "Confirmado" },
            { cor: "#d97706", label: "Aguardando" },
            { cor: "#2563eb", label: "Em atendimento" },
            { cor: "#0f766e", label: "Odontologia" },
          ].map(({ cor, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>

        {/* Calendário */}
        <div style={{ marginTop: "20px", overflowX: "auto", paddingBottom: "8px" }}>
          <div style={{ minWidth: "980px", border: "1px solid #d8e2ef", borderRadius: "14px", overflow: "hidden", background: "#fff" }}>
            {/* Cabeçalho dias da semana */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#f8fafc", borderBottom: "1px solid #d8e2ef" }}>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => (
                <div key={dia} style={{ padding: "10px", fontWeight: 700, fontSize: "12px", color: "#334155", borderRight: "1px solid #e2e8f0" }}>
                  {dia}
                </div>
              ))}
            </div>

            {/* Grade */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {/* Espaços vazios do início do mês */}
              {Array.from({
                length: new Date(Number(mesSelecionado.split("-")[0]), Number(mesSelecionado.split("-")[1]) - 1, 1).getDay(),
              }).map((_, i) => (
                <div key={`empty-${i}`} style={{ minHeight: "125px", padding: "8px", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }} />
              ))}

              {diasDoMes.map((data) => {
                const consultasDia = agrupadasPorDia[data] || [];
                const ativo = diaSelecionado === data;
                const hoje = hojeISO();
                const ehHoje = data === hoje;

                return (
                  <button
                    key={data}
                    onClick={() => setDiaSelecionado(ativo ? "" : data)}
                    style={{
                      minHeight: "125px", padding: "8px", border: "none",
                      borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0",
                      background: ativo ? "#eef6ff" : consultasDia.length > 0 ? "#f0fdf4" : "#fff",
                      textAlign: "left", cursor: "pointer",
                      outline: ehHoje ? "2px solid #2563eb" : "none",
                      outlineOffset: "-2px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13px", color: ehHoje ? "#2563eb" : "#0f172a" }}>
                        {String(Number(data.split("-")[2])).padStart(2, "0")}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{nomeDoDia(data)}</span>
                    </div>

                    {consultasDia.length === 0 && (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", height: "80px", gap: "5px",
                        opacity: 0.18, pointerEvents: "none",
                      }}>
                        <CalendarDays size={20} color="#94a3b8" />
                      </div>
                    )}

                    {consultasDia.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => { e.stopPropagation(); setItemSelecionado(item); }}
                        style={{
                          background: corEventoCalendario(item),
                          color: "#fff",
                          borderRadius: "7px",
                          padding: "5px 6px",
                          marginBottom: "5px",
                          fontSize: "11px",
                          lineHeight: "1.25",
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "filter .1s",
                        }}
                        title={`${item.horaNormalizada} — ${item.pacienteNormalizado}${item.tipoConsulta === "odonto" ? " (Odonto)" : ""} · ${labelStatus(item.status)}`}
                      >
                        <strong>{item.horaNormalizada || "—"}</strong>{" "}
                        {item.pacienteNormalizado}
                        {item.tipoConsulta === "odonto" && (
                          <span style={{
                            display: "inline-block", background: "rgba(255,255,255,0.25)",
                            borderRadius: "4px", padding: "0 4px", marginLeft: 4,
                            fontSize: "9px", fontWeight: 700, letterSpacing: "0.3px",
                          }}>ODT</span>
                        )}
                      </div>
                    ))}

                    {consultasDia.length > 4 && (
                      <small style={{ color: "#64748b" }}>+ {consultasDia.length - 4} mais</small>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Banner: agendamentos de amanhã — chegada antecipada */}
        {chegadaAntecipada.length > 0 && (
          <div style={{
            margin: "16px 0 0",
            padding: "12px 16px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderLeft: "4px solid #f59e0b",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#92400e" }}>
                ⚡ {chegadaAntecipada.length} paciente{chegadaAntecipada.length > 1 ? "s" : ""} de amanhã podem ser atendidos hoje
              </div>
              <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>
                {chegadaAntecipada.map((c) => c.pacienteNormalizado).join(", ")} —
                clique no dia <strong>{formatarData(amanha)}</strong> no calendário para confirmar a chegada antecipada
              </div>
            </div>
            <button
              onClick={() => setDiaSelecionado(amanha)}
              style={{
                padding: "7px 14px", borderRadius: "8px", border: "none",
                background: "#f59e0b", color: "#fff",
                fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0,
              }}
            >
              Ver agendamentos de amanhã →
            </button>
          </div>
        )}

        {/* Lista do dia selecionado */}
        {diaSelecionado && (
          <div style={{ marginTop: "20px" }}>
            <div className="muted-box" style={{ marginBottom: "12px" }}>
              <strong>{formatarData(diaSelecionado)}</strong>
              <div>{consultasDoDiaSelecionado.length} consulta(s) neste dia — clique em uma linha para ações</div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Setor</th>
                  <th>Paciente</th>
                  <th>Telefone</th>
                  <th>Especialidade</th>
                  <th>Profissional</th>
                  <th>Hora</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {consultasDoDiaSelecionado.map((item) => {
                  const sNorm = normalizarStatus(item.status);
                  const chaveConflito = item.hora && item.medico ? `${item.hora.slice(0, 5)}|${(item.medico || "").toLowerCase()}` : null;
                  const temConflito = chaveConflito && conflitosHora.has(chaveConflito);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setItemSelecionado(item)}
                      style={{ cursor: "pointer", background: temConflito ? "#fffbeb" : undefined }}
                      title={temConflito ? "⚠ Conflito de horário detectado" : "Clique para ver ações"}
                    >
                      <td>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: "6px",
                          fontSize: "11px", fontWeight: 700,
                          background: item.tipoConsulta === "odonto" ? "#f0fdf9" : "#eff6ff",
                          color: item.tipoConsulta === "odonto" ? "#0f766e" : "#2563eb",
                        }}>
                          {item.tipoConsulta === "odonto" ? "Odonto" : "Médico"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.pacienteNormalizado}</td>
                      <td>{item.telefoneNormalizado}</td>
                      <td>{item.especialidadeNormalizada}</td>
                      <td>{item.medicoNormalizado}</td>
                      <td>
                        {temConflito && <span title="Conflito de horário" style={{ color: "#d97706", marginRight: 4 }}>⚠</span>}
                        {item.horaNormalizada}
                      </td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 20,
                          fontSize: 11, fontWeight: 700,
                          background: BADGE_BG[sNorm] || "#f3f4f6",
                          color: BADGE_COLOR[sNorm] || "#374151",
                        }}>
                          {labelStatus(item.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {consultasDoDiaSelecionado.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={<CalendarDays size={28} />}
                        titulo="Dia livre"
                        descricao="Nenhuma consulta agendada para este dia."
                        cor="#7C3AED"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!diaSelecionado && consultasFiltradasDoMes.length === 0 && (
          <EmptyState
            icon={<CalendarDays size={32} />}
            titulo="Nenhum agendamento neste mês"
            descricao="Clique em um dia no calendário para ver consultas, ou vá até a Recepção para criar um novo agendamento."
            cor="#7C3AED"
          />
        )}
      </div>

      {/* ── Agenda por profissional ──────────────────────────────────────────── */}
      {podeVerTodos && (
        <div className="page-card" style={{ marginTop: 20 }}>
          <div className="card-title-row">
            <div>
              <h3 style={{ marginBottom: 0 }}>Agenda por profissional</h3>
              <p className="page-subtitle" style={{ marginTop: 4 }}>
                Consulte a agenda de qualquer profissional cadastrado no sistema.
              </p>
            </div>
            {profissionalSelecionado && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 20,
                  background: "#eff6ff", border: "1px solid #bfdbfe",
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1d4ed8" }}>
                    {profissionalSelecionado.nome}
                  </span>
                  {(profissionalSelecionado.especialidade || profissionalSelecionado.role) && (
                    <span style={{ fontSize: 11, color: "#3b82f6" }}>
                      · {profissionalSelecionado.especialidade || LABEL_ROLE[profissionalSelecionado.role] || profissionalSelecionado.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setProfissionalSelecionado(null); setBuscaProfissional(""); }}
                  style={{
                    padding: "5px 12px", borderRadius: 8, border: "1px solid #d1d5db",
                    background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151",
                  }}
                >
                  ✕ Limpar
                </button>
              </div>
            )}
          </div>

          {/* Campo de busca */}
          <div className="toolbar" style={{ marginTop: 14 }}>
            <input
              className="input search-input"
              placeholder="Pesquisar profissional pelo nome ou especialidade..."
              value={buscaProfissional}
              onChange={(e) => setBuscaProfissional(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>

          {/* Lista de profissionais (oculta quando um está selecionado e não há busca ativa) */}
          {(!profissionalSelecionado || buscaProfissional) && (
            <div style={{ marginTop: 12 }}>
              {profissionaisFiltrados.length === 0 && buscaProfissional && (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                  Nenhum profissional encontrado para "{buscaProfissional}".
                </p>
              )}
              {profissionaisFiltrados.length === 0 && !buscaProfissional && (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                  Nenhum profissional ativo cadastrado.
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profissionaisFiltrados.map((p) => {
                  const isAtual = profissionalSelecionado?.id === p.id;
                  return (
                    <button
                      key={p.id || p.nome}
                      onClick={() => { setProfissionalSelecionado(p); setBuscaProfissional(""); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start",
                        padding: "8px 14px", borderRadius: 10,
                        border: isAtual ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: isAtual ? "#eff6ff" : "#f8fafc",
                        cursor: "pointer", transition: "all .15s",
                        minWidth: 130,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{p.nome}</span>
                      {(p.especialidade || p.role) && (
                        <span style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {p.especialidade || LABEL_ROLE[p.role] || p.role}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agenda do profissional selecionado */}
          {profissionalSelecionado && !buscaProfissional && (
            <div style={{ marginTop: 16 }}>
              {/* Cabeçalho da agenda */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: 10,
                background: "#f0f9ff", border: "1px solid #bae6fd",
                marginBottom: 14, flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#0369a1" }}>
                    {profissionalSelecionado.nome}
                  </span>
                  {(profissionalSelecionado.especialidade || profissionalSelecionado.role) && (
                    <span style={{ fontSize: 12, color: "#0284c7", marginLeft: 8 }}>
                      {profissionalSelecionado.especialidade || LABEL_ROLE[profissionalSelecionado.role] || profissionalSelecionado.role}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "#0369a1", fontWeight: 600 }}>
                  {agendaProfissionalDoMes.length} agendamento{agendaProfissionalDoMes.length !== 1 ? "s" : ""} em{" "}
                  <span style={{ textTransform: "capitalize" }}>{nomeDoMes(mesSelecionado)}</span>
                </span>
              </div>

              {agendaProfissionalDoMes.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays size={28} />}
                  titulo="Nenhum agendamento encontrado"
                  descricao={`Não há agendamentos para ${profissionalSelecionado.nome} em ${nomeDoMes(mesSelecionado)}.`}
                  cor="#0369a1"
                />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Paciente</th>
                      <th>Especialidade</th>
                      <th>Setor</th>
                      <th>Status</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendaProfissionalDoMes.map((item) => {
                      const sNorm = normalizarStatus(item.status);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setItemSelecionado(item)}
                          style={{ cursor: "pointer" }}
                          title="Clique para ver detalhes e ações"
                        >
                          <td style={{ whiteSpace: "nowrap" }}>{formatarData(item.dataNormalizada)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{item.horaNormalizada}</td>
                          <td style={{ fontWeight: 600 }}>{item.pacienteNormalizado}</td>
                          <td>{item.especialidadeNormalizada}</td>
                          <td>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 6,
                              fontSize: 11, fontWeight: 700,
                              background: item.tipoConsulta === "odonto" ? "#f0fdf9" : item.tipoConsulta === "enfermagem" ? "#f5f3ff" : "#eff6ff",
                              color: item.tipoConsulta === "odonto" ? "#0f766e" : item.tipoConsulta === "enfermagem" ? "#7c3aed" : "#2563eb",
                            }}>
                              {item.tipoConsulta === "odonto" ? "Odonto" : item.tipoConsulta === "enfermagem" ? "Enfermagem" : "Médico"}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display: "inline-block", padding: "2px 10px", borderRadius: 20,
                              fontSize: 11, fontWeight: 700,
                              background: BADGE_BG[sNorm] || "#f3f4f6",
                              color: BADGE_COLOR[sNorm] || "#374151",
                            }}>
                              {labelStatus(item.status)}
                            </span>
                          </td>
                          <td style={{ color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.observacoes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Painel lateral */}
      {itemSelecionado && (
        <PainelDetalhes
          item={itemSelecionado}
          onFechar={() => setItemSelecionado(null)}
          onAcao={executarAcao}
          onEncaminhar={encaminharParaAtendimento}
          onRemarcar={(item) => setItemReagendar(item)}
        />
      )}

      {/* Modal remarcar */}
      {itemReagendar && (
        <ModalReagendar
          item={itemReagendar}
          onFechar={() => setItemReagendar(null)}
          onSalvar={reagendarAgendamento}
        />
      )}
    </div>
  );
}
