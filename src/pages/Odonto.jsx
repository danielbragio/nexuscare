import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, Check, Clock, FileText, Save, Stethoscope, User, X } from "lucide-react";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { hojeISO, calcularIdade, dateToLocalISO } from "../utils/dateUtils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function labelStatus(status) {
  const map = {
    agendado:       "Agendado",
    aguardando:     "Aguardando",
    em_atendimento: "Em Atendimento",
    finalizado:     "Finalizado",
    cancelado:      "Cancelado",
  };
  return map[status] || status;
}

function corStatus(status) {
  const map = {
    agendado:       "#2563eb",
    aguardando:     "#f59e0b",
    em_atendimento: "#0f766e",
    finalizado:     "#16a34a",
    cancelado:      "#dc2626",
  };
  return map[status] || "#64748b";
}

function formatarValor(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}


function dataAtendimento(at) {
  if (at.data) return at.data;
  const d = at.createdAt ? new Date(at.createdAt) : null;
  return d && !isNaN(d) ? dateToLocalISO(d) : "";
}

function tempoEspera(at) {
  if (!at.createdAt) return null;
  const ts = new Date(at.createdAt).getTime();
  if (isNaN(ts)) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, "0") + "m" : ""}`;
}


// ── Constantes ───────────────────────────────────────────────────────────────

const FORM_ANAMNESE_INICIAL = {
  queixaPrincipal: "",
  historiaAtual: "",
  doencasPreexistentes: "",
  alergias: "",
  medicamentos: "",
  historicoOdonto: "",
  sangramentoGengival: "",
  dorMastigar: "",
  sensibilidadeDentaria: "",
  usoProstese: "",
  tratamentosAnteriores: "",
  observacoesClinicas: "",
  temDiabetes: "",
  temHipertensao: "",
  estaGestante: "",
  alergiaAnestesia: "",
  usaAnticoagulante: "",
  reacaoProcedimento: "",
  temProblemaCardiaco: "",
  evolucao: "",
  diagnostico: "",
  conduta: "",
  prescricao: "",
};

const PERGUNTAS_RAPIDAS = [
  { campo: "temDiabetes",        label: "Possui diabetes?" },
  { campo: "temHipertensao",     label: "Possui hipertensão?" },
  { campo: "estaGestante",       label: "Está gestante?" },
  { campo: "alergiaAnestesia",   label: "Tem alergia a anestesia?" },
  { campo: "usaAnticoagulante",  label: "Usa anticoagulante?" },
  { campo: "reacaoProcedimento", label: "Já teve reação em procedimento odontológico?" },
  { campo: "temProblemaCardiaco",label: "Possui problema cardíaco?" },
];

// ── Odontograma — nomes dos dentes (notação FDI 11-48) ───────────────────────
// Usado no painel lateral do dente selecionado.
const NOMES_DENTES = {
  // Superior direito (18→11)
  18: "3º molar superior direito",  17: "2º molar superior direito",
  16: "1º molar superior direito",  15: "2º pré-molar superior direito",
  14: "1º pré-molar superior direito", 13: "Canino superior direito",
  12: "Incisivo lateral superior direito", 11: "Incisivo central superior direito",
  // Superior esquerdo (21→28)
  21: "Incisivo central superior esquerdo", 22: "Incisivo lateral superior esquerdo",
  23: "Canino superior esquerdo",   24: "1º pré-molar superior esquerdo",
  25: "2º pré-molar superior esquerdo", 26: "1º molar superior esquerdo",
  27: "2º molar superior esquerdo", 28: "3º molar superior esquerdo",
  // Inferior esquerdo (38→31)
  38: "3º molar inferior esquerdo", 37: "2º molar inferior esquerdo",
  36: "1º molar inferior esquerdo", 35: "2º pré-molar inferior esquerdo",
  34: "1º pré-molar inferior esquerdo", 33: "Canino inferior esquerdo",
  32: "Incisivo lateral inferior esquerdo", 31: "Incisivo central inferior esquerdo",
  // Inferior direito (41→48)
  41: "Incisivo central inferior direito", 42: "Incisivo lateral inferior direito",
  43: "Canino inferior direito",    44: "1º pré-molar inferior direito",
  45: "2º pré-molar inferior direito", 46: "1º molar inferior direito",
  47: "2º molar inferior direito",  48: "3º molar inferior direito",
};

// 5 estados do dente — paleta clínica suave (sem cores gritantes).
const ESTADOS_DENTE = [
  { key: "normal",    label: "Sem registro", fill: "#f8fafc", stroke: "#cbd5e1", text: "#64748b" },
  { key: "tratado",   label: "Tratado",      fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  { key: "pendente",  label: "Pendente",     fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  { key: "urgente",   label: "Urgente",      fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b" },
  { key: "planejado", label: "Planejado",    fill: "#dcfce7", stroke: "#22c55e", text: "#15803d" },
];
const COR_ESTADO_DENTE = Object.fromEntries(ESTADOS_DENTE.map((e) => [e.key, e]));

// ── Estilos (redesign Zendenta — clean, indigo primário) ─────────────────────

// Paleta inspirada no mock Zendenta: indigo/blue corporativo, cards arejados,
// tabs com underline em vez de pílulas pesadas, avatares circulares.
const ACCENT       = "#4f46e5";  // indigo-600 — cor primária
const ACCENT_HOVER = "#4338ca";  // indigo-700
const ACCENT_SOFT  = "#eef2ff";  // indigo-50 — bg suave

const S = {
  card: {
    background: "#fff",
    borderRadius: "20px",
    boxShadow: "0 0 0 1px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.04)",
    padding: "24px",
  },
  // Pílula clássica (mantida para outros usos legados como ações inline)
  pill: (ativo) => ({
    padding: "7px 16px",
    borderRadius: "999px",
    border: "none",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    background: ativo ? ACCENT : "transparent",
    color: ativo ? "#fff" : "#64748b",
    transition: "all .15s",
    whiteSpace: "nowrap",
  }),
  // Nova tab estilo Zendenta — texto com underline animado
  tabUnderline: (ativo) => ({
    padding: "10px 4px",
    border: "none",
    background: "transparent",
    fontSize: "13px",
    fontWeight: ativo ? 700 : 500,
    color: ativo ? ACCENT : "#64748b",
    cursor: "pointer",
    borderBottom: `2px solid ${ativo ? ACCENT : "transparent"}`,
    transition: "all .15s",
    whiteSpace: "nowrap",
  }),
  label: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    marginBottom: "4px",
    display: "block",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
    outline: "none",
    color: "#0f172a",
    boxSizing: "border-box",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
    outline: "none",
    color: "#0f172a",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "100px",
    lineHeight: 1.6,
    fontFamily: "inherit",
    background: "#fff",
  },
  btnPrimary: {
    padding: "10px 22px",
    borderRadius: "10px",
    border: "none",
    background: ACCENT,
    color: "#fff",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(79,70,229,.25)",
    transition: "background .15s",
  },
  btnSecondary: {
    padding: "9px 18px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#475569",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
};

// Helpers do redesign: avatar circular com iniciais coloridas estáveis (hash do nome).
function iniciais(nome) {
  if (!nome) return "?";
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Hash determinístico → cor estável por paciente (não muda entre renders).
const AVATAR_COLORS = [
  ["#dbeafe", "#1d4ed8"], // blue
  ["#e0e7ff", "#4338ca"], // indigo
  ["#fae8ff", "#a21caf"], // fuchsia
  ["#fce7f3", "#be185d"], // pink
  ["#ffedd5", "#c2410c"], // orange
  ["#fef3c7", "#a16207"], // amber
  ["#dcfce7", "#15803d"], // green
  ["#ccfbf1", "#0f766e"], // teal
];
function corAvatar(nome) {
  const s = String(nome || "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ nome, size = 40 }) {
  const [bg, fg] = corAvatar(nome);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: fg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: Math.round(size * 0.36),
      flexShrink: 0, letterSpacing: ".02em",
    }}>
      {iniciais(nome)}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Odonto({
  pacientes = [],
  userData = null,
  // Dados já polled pelo App.jsx (60 s) — evita intervalos duplicados
  atendimentosOdonto: propAtendimentos = [],
  agendamentosOdonto: propAgendamentos = [],
  procedimentosOdonto: propProcedimentos = [],
  onRefreshAtendimentosOdonto,
  onRefreshAgendamentosOdonto,
}) {
  const toast = useToast();
  const isAdmin =
    userData?.role === "admin" ||
    (Array.isArray(userData?.permissions) && (userData.permissions.includes("administracao") || userData.permissions.includes("configuracoes")));

  const [abaLista, setAbaLista] = useState("aguardando");
  const [buscaFila, setBuscaFila] = useState("");
  const [filtroFila, setFiltroFila] = useState("hoje");
  const [paginaFila, setPaginaFila] = useState(1);
  const ITENS_FILA = 10;
  const [dentesMarcados, setDentesMarcados] = useState({});
  // Painel lateral do dente selecionado (puramente UI; não vai pro backend).
  const [denteSelecionado, setDenteSelecionado] = useState(null);
  const [agendamentos, setAgendamentos] = useState(propAgendamentos);
  const [atendimentos, setAtendimentos] = useState(propAtendimentos);
  const [procedimentos, setProcedimentos] = useState(propProcedimentos);

  // ── Atendimento aberto ──────────────────────────────────────────────────────
  const [atendimentoAberto, setAtendimentoAberto] = useState(null);
  const [abaAtendimento, setAbaAtendimento] = useState("dados");
  const [formAnamnese, setFormAnamnese] = useState(FORM_ANAMNESE_INICIAL);
  const [procedimentosSelecionados, setProcedimentosSelecionados] = useState([]);
  const [descontoGeral, setDescontoGeral] = useState(0);
  const [obsAtendimento, setObsAtendimento] = useState("");

  // ── Modal de pagamento obrigatório no check-in ─────────────────────────────
  const [modalPagto, setModalPagto] = useState(null); // {agendamento, valorEstimado, descricao}
  const [formaPagamentoChegada, setFormaPagamentoChegada] = useState("dinheiro");
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Sincroniza estado local quando App.jsx re-poll traz dados novos
  useEffect(() => { setAtendimentos(propAtendimentos); }, [propAtendimentos]);
  useEffect(() => { setAgendamentos(propAgendamentos); }, [propAgendamentos]);
  useEffect(() => { if (propProcedimentos.length > 0) setProcedimentos(propProcedimentos); }, [propProcedimentos]);

  // Reseta página ao mudar filtros
  useEffect(() => { setPaginaFila(1); }, [buscaFila, abaLista, filtroFila]);

  // ── Funções de refresh local (chamadas após ações de mutação) ─────────────
  async function carregarAtendimentos() {
    try {
      const res = await api.atendimentosOdonto.listar();
      setAtendimentos(res.data || []);
      onRefreshAtendimentosOdonto?.();
    } catch { /* ignora falhas pontuais */ }
  }

  async function carregarAgendamentos() {
    try {
      const res = await api.agendamentosOdonto.listar();
      setAgendamentos(res.data || []);
      onRefreshAgendamentosOdonto?.();
    } catch { /* ignora falhas pontuais */ }
  }

  // Carrega procedimentos na montagem; faz seed se lista vazia
  useEffect(() => {
    if (propProcedimentos.length > 0) return;
    async function carregarProcedimentos() {
      try {
        const res = await api.procedimentosOdonto.listar();
        const lista = res.data || [];
        if (lista.length === 0) {
          await api.procedimentosOdonto.seed();
          const res2 = await api.procedimentosOdonto.listar();
          setProcedimentos(res2.data || []);
        } else {
          setProcedimentos(lista);
        }
      } catch { setProcedimentos([]); }
    }
    carregarProcedimentos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Computed ────────────────────────────────────────────────────────────────
  const hoje = hojeISO();

  const agendamentosFiltrados = useMemo(() => {
    const role = userData?.role || "";
    if (isAdmin || role === "admin" || role === "recepcao") return agendamentos;
    const meuId = String(userData?.id || "");
    if (!meuId) return [];
    const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
    return agendamentos.filter((ag) => {
      const pid = String(ag.profissionalId || "").trim();
      if (pid) return pid === meuId;
      if (!nome) return false;
      return (ag.profissionalNome || "").toLowerCase().trim() === nome;
    });
  }, [agendamentos, userData, isAdmin]);

  const atendimentosFiltrados = useMemo(() => {
    const role = userData?.role || "";
    if (isAdmin || role === "admin" || role === "recepcao") return atendimentos;
    const meuId = String(userData?.id || "");
    if (!meuId) return [];
    const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
    return atendimentos.filter((at) => {
      const pid = String(at.profissionalId || "").trim();
      if (pid) return pid === meuId;
      if (!nome) return false;
      return (at.profissionalNome || "").toLowerCase().trim() === nome;
    });
  }, [atendimentos, userData, isAdmin]);

  const filaAguardando = useMemo(
    () =>
      [...atendimentosFiltrados.filter((a) => {
        if (a.status !== "aguardando") return false;
        if (!["pago","cortesia"].includes((a.statusPagamento || "").toLowerCase())) return false;
        if (filtroFila === "hoje") return dataAtendimento(a) === hoje;
        return true;
      })].sort((a, b) => (a.hora || "").localeCompare(b.hora || "")),
    [atendimentosFiltrados, filtroFila, hoje]
  );

  const filaEmAtendimento = useMemo(
    () => atendimentosFiltrados.filter((a) => {
      if (a.status !== "em_atendimento") return false;
      if (!["pago","cortesia"].includes((a.statusPagamento || "").toLowerCase())) return false;
      if (filtroFila === "hoje") return dataAtendimento(a) === hoje;
      return true;
    }),
    [atendimentosFiltrados, filtroFila, hoje]
  );

  const agendamentosHoje = useMemo(
    () => agendamentosFiltrados.filter((a) => a.data === hoje),
    [agendamentosFiltrados, hoje]
  );

  // IDs de agendamentos que já têm atendimento odonto INICIADO ou FINALIZADO/CANCELADO.
  // Esses não devem aparecer mais na lista de "não iniciados".
  const agendamentosJaAtendidos = useMemo(() => {
    const set = new Set();
    (atendimentos || []).forEach((at) => {
      const s = (at.status || "").toLowerCase();
      const agId = at.agendamentoId ?? at.agendamento_id;
      if (agId && ["em_atendimento", "finalizado", "cancelado"].includes(s)) {
        set.add(String(agId));
      }
    });
    return set;
  }, [atendimentos]);

  const agendamentosNaoEncaminhados = useMemo(
    () => agendamentosHoje.filter((ag) => {
      // Status do AGENDAMENTO deve estar em fase pré-atendimento.
      if (!["confirmado", "aguardando", "presente"].includes(ag.status)) return false;
      // Se já existe atendimento iniciado/finalizado/cancelado para esse agendamento, sai da fila.
      if (agendamentosJaAtendidos.has(String(ag.id))) return false;
      return true;
    }),
    [agendamentosHoje, agendamentosJaAtendidos]
  );

  const subtotalAtendimento = procedimentosSelecionados.reduce(
    (acc, p) => acc + (Number(p.valorFinal) || 0),
    0
  );

  const dadosPaciente = useMemo(() => {
    if (!atendimentoAberto) return null;
    const nome = (atendimentoAberto.pacienteNome || "").toLowerCase();
    return pacientes.find((p) => (p.nome || "").toLowerCase() === nome) || null;
  }, [pacientes, atendimentoAberto]);

  // ── Ações ────────────────────────────────────────────────────────────────────

  async function encaminharParaFila(ag) {
    try {
      await api.agendamentosOdonto.confirmarChegada(ag.id, { status: "aguardando" });
      await Promise.all([carregarAtendimentos(), carregarAgendamentos()]);
    } catch (e) {
      const errors = e.data?.errors || e.data;
      if (errors?.action === "redirect_to_pagamentos") {
        setFormaPagamentoChegada("dinheiro");
        setModalPagto({
          agendamento: ag,
          valorEstimado: errors.valor_estimado || 0,
          descricao: errors.descricao || ag.tipoAtendimento || "Atendimento odontológico",
        });
        return;
      }
      toast.error("Erro ao encaminhar: " + (e.data?.detail || e.message));
    }
  }

  async function registrarPagamentoEEncaminhar() {
    if (!modalPagto) return;
    setProcessandoPagamento(true);
    try {
      const { agendamento, valorEstimado, descricao } = modalPagto;
      await api.pagamentos.criar({
        agendamento_odonto_id: agendamento.id,
        paciente_id:           agendamento.pacienteId || null,
        nome_paciente:         agendamento.pacienteNome || "",
        descricao,
        servico:               "Odontologia",
        valor:                 valorEstimado,
        desconto:              0,
        valor_final:           valorEstimado,
        status:                "pago",
        status_pagamento:      "pago",
        forma_pagamento:       formaPagamentoChegada,
        tipo:                  "odonto",
        origem:                "agendamento_odonto",
        profissional:          agendamento.profissionalNome || "",
        data:                  agendamento.data || hojeISO(),
        data_pagamento:        hojeISO(),
      });
      // Após registrar pagamento, tenta encaminhar novamente
      await api.agendamentosOdonto.confirmarChegada(agendamento.id, { status: "aguardando" });
      setModalPagto(null);
      await Promise.all([carregarAtendimentos(), carregarAgendamentos()]);
      toast.success("Pagamento registrado. Paciente encaminhado para a fila.");
    } catch (e) {
      toast.error("Erro ao registrar pagamento: " + (e.data?.detail || e.message));
    } finally {
      setProcessandoPagamento(false);
    }
  }

  function abrirAtendimento(at) {
    setAtendimentoAberto(at);
    setAbaAtendimento("dados");
    setFormAnamnese(at.anamnese || FORM_ANAMNESE_INICIAL);
    setProcedimentosSelecionados(at.procedimentosRealizados || []);
    setDescontoGeral(at.desconto || 0);
    setObsAtendimento(at.observacoesAtendimento || "");
    setDentesMarcados({});
    setDenteSelecionado(null);
  }

  function voltarParaFila() {
    setAtendimentoAberto(null);
    setDenteSelecionado(null);
  }

  async function iniciarAtendimento() {
    if (!atendimentoAberto) return;
    await api.atendimentosOdonto.atualizar(atendimentoAberto.id, { status: "em_atendimento" });
    setAtendimentoAberto((prev) => ({ ...prev, status: "em_atendimento" }));
  }

  async function salvarAtendimento() {
    if (!atendimentoAberto) return;
    const total = subtotalAtendimento;
    const desconto = Number(descontoGeral) || 0;
    const valorFinal = Math.max(0, total - desconto);
    try {
      await api.atendimentosOdonto.atualizar(atendimentoAberto.id, {
        anamnese:                 formAnamnese,
        procedimentos_realizados: procedimentosSelecionados,
        total,
        desconto,
        valor_final:              valorFinal,
        observacoes_atendimento:  obsAtendimento,
      });
      toast.success("Atendimento salvo com sucesso.");
    } catch (e) {
      toast.error("Erro ao salvar: " + (e.data?.detail || e.message));
    }
  }

  async function finalizarAtendimento() {
    if (!atendimentoAberto) return;
    const totalProcRealizados = procedimentosSelecionados.reduce(
      (acc, p) => acc + (Number(p.valorFinal) || 0), 0
    );
    const totalSolicitados = (atendimentoAberto.procedimentosSolicitados || []).reduce(
      (acc, p) => acc + Number(p.valor || 0), 0
    );
    const total = totalProcRealizados > 0 ? totalProcRealizados : totalSolicitados;
    const desconto = Number(descontoGeral) || 0;
    const valorFinal = Math.max(0, total - desconto);
    const descricaoProcedimentos =
      procedimentosSelecionados.map((p) => p.nome).join(", ") ||
      (atendimentoAberto.procedimentosSolicitados || []).map((p) => p.nome).join(", ") ||
      "Atendimento odontológico";

    try {
      // Atualizar o atendimento_odonto com os dados clínicos finais.
      // Pagamento fica sob responsabilidade exclusiva do módulo Pagamentos.
      await api.atendimentosOdonto.atualizar(atendimentoAberto.id, {
        status:                   "finalizado",
        anamnese:                 formAnamnese,
        procedimentos_realizados: procedimentosSelecionados,
        total,
        desconto,
        valor_final:              valorFinal,
        observacoes_atendimento:  obsAtendimento,
      });

      // Atualizar o valor no pagamento vinculado (se houver) sem mudar status
      if (atendimentoAberto.pagamentoId) {
        await api.pagamentos.atualizar(atendimentoAberto.pagamentoId, {
          valor:                 valorFinal,
          valor_final:           valorFinal,
          descricao:             descricaoProcedimentos,
          atendimento_odonto_id: String(atendimentoAberto.id),
        });
      }

      if (atendimentoAberto.agendamentoId) {
        await api.agendamentosOdonto.atualizar(atendimentoAberto.agendamentoId, { status: "finalizado" });
      }

      setAtendimentoAberto(null);
      await Promise.all([carregarAtendimentos(), carregarAgendamentos()]);
      toast.success("Atendimento finalizado com sucesso.");
    } catch (e) {
      toast.error("Erro ao finalizar: " + (e.data?.detail || e.message));
    }
  }

  function adicionarProcedimento(proc) {
    if (procedimentosSelecionados.find((p) => p.procedimentoId === proc.id)) return;
    setProcedimentosSelecionados((prev) => [
      ...prev,
      {
        procedimentoId: proc.id,
        nome: proc.nome,
        categoria: proc.categoria,
        valor: proc.valor,
        desconto: 0,
        valorFinal: proc.valor,
        observacoes: "",
      },
    ]);
  }

  function removerProcedimento(procedimentoId) {
    setProcedimentosSelecionados((prev) =>
      prev.filter((p) => p.procedimentoId !== procedimentoId)
    );
  }

  function atualizarProcedimento(procedimentoId, campo, valor) {
    setProcedimentosSelecionados((prev) =>
      prev.map((p) => {
        if (p.procedimentoId !== procedimentoId) return p;
        const updated = { ...p, [campo]: valor };
        if (campo === "valor" || campo === "desconto") {
          const v = Number(updated.valor) || 0;
          const d = Number(updated.desconto) || 0;
          updated.valorFinal = Math.max(0, v - d);
        }
        return updated;
      })
    );
  }

  // ── RENDER: Atendimento aberto ────────────────────────────────────────────────

  if (atendimentoAberto) {
    const abas = [
      { key: "dados",         label: "Dados" },
      { key: "odontograma",   label: "Odontograma" },
      { key: "historico",     label: "Histórico" },
      { key: "anamnese",      label: "Anamnese" },
      { key: "evolucao",      label: "Evolução Clínica" },
      { key: "procedimentos", label: "Procedimentos" },
      { key: "resumo",        label: "Resumo" },
    ];

    const idade = dadosPaciente?.dataNascimento ? calcularIdade(dadosPaciente.dataNascimento) : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Breadcrumb estilo Zendenta */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94a3b8" }}>
          <button
            onClick={voltarParaFila}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0, fontSize: 13 }}
          >
            Fila de odonto
          </button>
          <span>›</span>
          <span style={{ color: ACCENT, fontWeight: 600 }}>Detalhe do atendimento</span>
        </div>

        {/* Header do paciente — padrão "patient detail" Zendenta */}
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Avatar nome={atendimentoAberto.pacienteNome} size={64} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-.01em" }}>
                {atendimentoAberto.pacienteNome}
              </h1>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8,
                padding: "4px 10px", borderRadius: 8, background: "#f1f5f9",
                fontSize: 12, color: "#475569",
              }}>
                {atendimentoAberto.tipoAtendimento ? (
                  <>
                    <Stethoscope size={12} color={ACCENT} />
                    <span>{atendimentoAberto.tipoAtendimento}</span>
                  </>
                ) : (
                  <span>Sem tipo de atendimento</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                {idade !== null && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#64748b" }}>
                    <Calendar size={11} />{idade} anos
                  </span>
                )}
                {atendimentoAberto.hora && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#64748b" }}>
                    <Clock size={11} />{atendimentoAberto.hora}
                  </span>
                )}
                {atendimentoAberto.profissionalNome && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#64748b" }}>
                    <User size={11} />Dr(a). {atendimentoAberto.profissionalNome}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Status pill — discreta, com dot colorido */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: corStatus(atendimentoAberto.status) + "14",
                color: corStatus(atendimentoAberto.status),
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: corStatus(atendimentoAberto.status),
                }} />
                {labelStatus(atendimentoAberto.status)}
              </span>

              {atendimentoAberto.status === "aguardando" && (
                <button onClick={iniciarAtendimento} style={S.btnPrimary}>
                  ▶ Iniciar atendimento
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "16px", alignItems: "start" }}>

          {/* Coluna principal */}
          <div style={S.card}>
            {/* Tabs underline estilo Zendenta — patient detail */}
            <div style={{
              display: "flex", gap: 24, marginBottom: 20,
              borderBottom: "1px solid #e5e7eb", overflowX: "auto",
            }}>
              {abas.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAbaAtendimento(a.key)}
                  style={S.tabUnderline(abaAtendimento === a.key)}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* ABA DADOS */}
            {abaAtendimento === "dados" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {[
                    ["Paciente",   atendimentoAberto.pacienteNome || "—"],
                    ["Profissional", atendimentoAberto.profissionalNome || "—"],
                    ["Tipo de Atendimento", atendimentoAberto.tipoAtendimento || "—"],
                    ["Horário",    atendimentoAberto.hora || "—"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <span style={S.label}>{l}</span>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", padding: "8px 10px", background: "#f8fafc", borderRadius: "8px" }}>{v}</div>
                    </div>
                  ))}
                </div>

                {atendimentoAberto.observacoesRecepcao && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px" }}>
                    <strong style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                      <FileText size={12} />Observações da Recepção
                    </strong>
                    <p style={{ margin: 0, color: "#78350f", lineHeight: 1.5 }}>{atendimentoAberto.observacoesRecepcao}</p>
                  </div>
                )}

                {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
                  <div style={{ background: "#f0fdfa", border: "2px solid #99f6e4", borderRadius: "12px", padding: "14px 16px" }}>
                    <strong style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                      <Stethoscope size={12} />Procedimentos Solicitados
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                      {(atendimentoAberto.procedimentosSolicitados || []).map((p, i) => (
                        <span key={i} style={{ background: "#fff", border: "1.5px solid #0f766e", borderRadius: "8px", padding: "4px 12px", fontSize: "13px", color: "#0f766e", fontWeight: 600 }}>
                          {p.nome}{p.valor ? ` — ${formatarValor(p.valor)}` : ""}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontWeight: 700, color: "#0f766e", fontSize: "15px" }}>
                      Total estimado: {formatarValor((atendimentoAberto.procedimentosSolicitados || []).reduce((acc, p) => acc + Number(p.valor || 0), 0))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA ODONTOGRAMA — redesenho clínico Zendenta-style */}
            {abaAtendimento === "odontograma" && (() => {
              function renderDente(n, x, y) {
                const isIncisor = [11,12,21,22,31,32,41,42].includes(n);
                const r = isIncisor ? 11 : 14;
                const estado = dentesMarcados[n] || "normal";
                const c = COR_ESTADO_DENTE[estado];
                const isSelected = denteSelecionado === n;
                return (
                  <g key={n} style={{ cursor: "pointer" }} onClick={() => setDenteSelecionado(n)}>
                    {isSelected && (
                      <rect x={x-r-3} y={y-r-3} width={(r+3)*2} height={(r+3)*2} rx="7"
                        fill="none" stroke={ACCENT} strokeWidth="2"/>
                    )}
                    <rect x={x-r} y={y-r} width={r*2} height={r*2} rx="5"
                      fill={c.fill} stroke={c.stroke} strokeWidth="1.8"/>
                    <text x={x} y={y+4} textAnchor="middle" fontSize="10" fill={c.text} fontWeight="700">{n}</text>
                  </g>
                );
              }
              const selecionado = denteSelecionado;
              const estadoSel = selecionado ? (dentesMarcados[selecionado] || "normal") : null;
              // Procedimentos associados ao dente: busca por menção ao número nas observações.
              const procsRelacionados = selecionado
                ? [...procedimentosSelecionados, ...(atendimentoAberto.procedimentosSolicitados || [])]
                    .filter((p) => (p?.observacoes || "").includes(String(selecionado)) || (p?.nome || "").includes(`#${selecionado}`))
                : [];

              return (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 20, alignItems: "start" }}
                     className="odonto-graph-grid">
                  {/* Coluna 1: odontograma central */}
                  <div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Odontograma</div>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                        Clique no dente para abrir o painel lateral.
                      </p>
                    </div>

                    <div style={{
                      background: "#fafbfc", border: "1px solid #f1f5f9",
                      borderRadius: 16, padding: "20px 16px",
                    }}>
                      <svg viewBox="0 0 540 220" style={{ width: "100%", maxWidth: 540, display: "block", margin: "0 auto" }}>
                        <line x1="270" y1="10" x2="270" y2="210" stroke="#e5e7eb" strokeWidth="1.2" strokeDasharray="4,4"/>
                        <line x1="10" y1="110" x2="530" y2="110" stroke="#e5e7eb" strokeWidth="1.2" strokeDasharray="4,4"/>
                        {[18,17,16,15,14,13,12,11].map((n,i) => renderDente(n, 262 - i*30, 40))}
                        {[21,22,23,24,25,26,27,28].map((n,i) => renderDente(n, 278 + i*30, 40))}
                        {[41,42,43,44,45,46,47,48].map((n,i) => renderDente(n, 262 - i*30, 180))}
                        {[31,32,33,34,35,36,37,38].map((n,i) => renderDente(n, 278 + i*30, 180))}
                        <text x="10"  y="20"  fontSize="9" fill="#94a3b8" fontWeight="600">SUPERIOR DIREITO</text>
                        <text x="420" y="20"  fontSize="9" fill="#94a3b8" fontWeight="600">SUPERIOR ESQUERDO</text>
                        <text x="10"  y="215" fontSize="9" fill="#94a3b8" fontWeight="600">INFERIOR DIREITO</text>
                        <text x="420" y="215" fontSize="9" fill="#94a3b8" fontWeight="600">INFERIOR ESQUERDO</text>
                      </svg>
                    </div>

                    {/* Legenda */}
                    <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
                      {ESTADOS_DENTE.map((e) => (
                        <div key={e.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: e.fill, border: `1.5px solid ${e.stroke}`, display: "inline-block" }}/>
                          {e.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coluna 2: painel do dente selecionado */}
                  <div style={{
                    background: "#fff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 18,
                    position: "sticky", top: 16, minHeight: 320,
                  }}>
                    {!selecionado ? (
                      <div style={{ textAlign: "center", padding: "32px 8px", color: "#94a3b8" }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: "50%", background: ACCENT_SOFT,
                          margin: "0 auto 10px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Stethoscope size={24} color={ACCENT} />
                        </div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#0f172a" }}>Nenhum dente selecionado</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12 }}>Clique em um dente do odontograma para ver os detalhes.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* Cabeçalho do dente */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                              Dente
                            </span>
                            <button
                              onClick={() => setDenteSelecionado(null)}
                              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                              aria-label="Fechar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginTop: 2 }}>
                            {selecionado}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                            {NOMES_DENTES[selecionado] || "—"}
                          </div>
                        </div>

                        {/* Estado atual */}
                        <div>
                          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                            Condição
                          </span>
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {ESTADOS_DENTE.map((e) => {
                              const ativo = estadoSel === e.key;
                              return (
                                <button
                                  key={e.key}
                                  onClick={() => setDentesMarcados((prev) => ({ ...prev, [selecionado]: e.key }))}
                                  style={{
                                    padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    border: `1.5px solid ${ativo ? e.stroke : "#e5e7eb"}`,
                                    background: ativo ? e.fill : "#fff",
                                    color: ativo ? e.text : "#64748b",
                                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.stroke, display: "inline-block" }} />
                                  {e.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Procedimentos relacionados */}
                        <div>
                          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                            Procedimentos ({procsRelacionados.length})
                          </span>
                          <div style={{ marginTop: 6 }}>
                            {procsRelacionados.length === 0 ? (
                              <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                                Nenhum procedimento ligado a este dente.
                              </div>
                            ) : procsRelacionados.map((p, i) => (
                              <div key={i} style={{
                                padding: "8px 10px", borderRadius: 8, background: "#f8fafc",
                                marginBottom: 6, fontSize: 12,
                              }}>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>{p.nome}</div>
                                {p.valor > 0 && <div style={{ color: "#64748b", marginTop: 2 }}>{formatarValor(p.valor)}</div>}
                                {p.observacoes && <div style={{ color: "#64748b", marginTop: 2, fontStyle: "italic" }}>{p.observacoes}</div>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Dica de fluxo */}
                        <div style={{
                          padding: "8px 10px", background: ACCENT_SOFT, borderRadius: 8,
                          fontSize: 11, color: "#3730a3", lineHeight: 1.5,
                        }}>
                          Para registrar procedimentos vá à aba <strong>Procedimentos</strong>.
                          Marcações no odontograma são visuais para apoiar a consulta.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ABA HISTÓRICO — timeline de tratamentos do atendimento atual */}
            {abaAtendimento === "historico" && (() => {
              // Constrói timeline a partir dos dados disponíveis no atendimento.
              const eventos = [];
              if (atendimentoAberto.createdAt) {
                const d = atendimentoAberto.createdAt?.seconds
                  ? new Date(atendimentoAberto.createdAt.seconds * 1000)
                  : new Date(atendimentoAberto.createdAt);
                if (!isNaN(d)) eventos.push({
                  data: d, tipo: "agendamento", titulo: "Atendimento criado",
                  descricao: atendimentoAberto.tipoAtendimento || "Atendimento odontológico",
                  status: "info",
                });
              }
              (atendimentoAberto.procedimentosSolicitados || []).forEach((p) => {
                eventos.push({
                  data: atendimentoAberto.data ? new Date(atendimentoAberto.data + "T00:00:00") : null,
                  tipo: "solicitado", titulo: p.nome,
                  descricao: "Procedimento solicitado pela recepção",
                  valor: p.valor, status: "pendente",
                });
              });
              procedimentosSelecionados.forEach((p) => {
                eventos.push({
                  data: atendimentoAberto.data ? new Date(atendimentoAberto.data + "T00:00:00") : null,
                  tipo: "realizado", titulo: p.nome,
                  descricao: p.observacoes || `Procedimento ${p.categoria || ""}`.trim(),
                  valor: p.valorFinal, status: "concluido",
                });
              });
              if (atendimentoAberto.finalizadoEm) {
                eventos.push({
                  data: new Date(atendimentoAberto.finalizadoEm), tipo: "finalizado",
                  titulo: "Atendimento finalizado",
                  descricao: `Por Dr(a). ${atendimentoAberto.profissionalNome || "—"}`,
                  status: "concluido",
                });
              }
              eventos.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));

              const corStatusEvento = (s) => ({
                concluido: { bg: "#dcfce7", fg: "#15803d", label: "Concluído" },
                pendente:  { bg: "#fef3c7", fg: "#92400e", label: "Pendente" },
                info:      { bg: ACCENT_SOFT, fg: ACCENT, label: "Registro" },
              }[s] || { bg: "#f1f5f9", fg: "#64748b", label: "—" });

              if (eventos.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%", background: ACCENT_SOFT,
                      margin: "0 auto 12px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <FileText size={24} color={ACCENT} />
                    </div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: 15 }}>Sem histórico no atendimento</p>
                    <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                      Procedimentos e marcações realizados aparecem aqui em linha do tempo.
                    </p>
                  </div>
                );
              }

              return (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                    Linha do tempo
                  </div>
                  <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>
                    Eventos deste atendimento em ordem cronológica.
                  </p>
                  <div style={{ position: "relative", paddingLeft: 24 }}>
                    {/* Linha vertical da timeline */}
                    <div style={{
                      position: "absolute", left: 7, top: 6, bottom: 6,
                      width: 2, background: "#e5e7eb",
                    }}/>
                    {eventos.map((ev, i) => {
                      const c = corStatusEvento(ev.status);
                      return (
                        <div key={i} style={{ position: "relative", paddingBottom: 18 }}>
                          {/* Bolinha */}
                          <div style={{
                            position: "absolute", left: -24, top: 4,
                            width: 14, height: 14, borderRadius: "50%",
                            background: c.bg, border: `2px solid ${c.fg}`,
                          }}/>
                          <div style={{
                            background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12,
                            padding: "12px 14px",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                                  {ev.titulo}
                                </div>
                                {ev.descricao && (
                                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                    {ev.descricao}
                                  </div>
                                )}
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                                  {ev.data ? ev.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                  {ev.valor > 0 && <> · <strong style={{ color: ACCENT }}>{formatarValor(ev.valor)}</strong></>}
                                </div>
                              </div>
                              <span style={{
                                padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                                background: c.bg, color: c.fg, whiteSpace: "nowrap",
                              }}>
                                {c.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ABA ANAMNESE */}
            {abaAtendimento === "anamnese" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Queixa e História</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                      <span style={S.label}>Queixa principal *</span>
                      <textarea style={{ ...S.textarea, minHeight: "80px" }} value={formAnamnese.queixaPrincipal} onChange={(e) => setFormAnamnese((p) => ({ ...p, queixaPrincipal: e.target.value }))} placeholder="Descreva a queixa principal do paciente" />
                    </div>
                    <div>
                      <span style={S.label}>História da queixa atual</span>
                      <textarea style={{ ...S.textarea, minHeight: "80px" }} value={formAnamnese.historiaAtual} onChange={(e) => setFormAnamnese((p) => ({ ...p, historiaAtual: e.target.value }))} placeholder="Histórico da queixa atual" />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Saúde Geral</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {[
                      ["doencasPreexistentes", "Doenças preexistentes",  "Ex.: diabetes, hipertensão..."],
                      ["alergias",            "Alergias",                "Alergias conhecidas"],
                      ["medicamentos",        "Medicamentos em uso",     "Liste os medicamentos em uso"],
                      ["historicoOdonto",     "Histórico odontológico",  "Tratamentos anteriores relevantes"],
                    ].map(([campo, label, ph]) => (
                      <div key={campo}>
                        <span style={S.label}>{label}</span>
                        <textarea style={{ ...S.textarea, minHeight: "70px" }} value={formAnamnese[campo]} onChange={(e) => setFormAnamnese((p) => ({ ...p, [campo]: e.target.value }))} placeholder={ph} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Sintomas</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {[
                      ["sangramentoGengival",  "Sangramento gengival"],
                      ["dorMastigar",          "Dor ao mastigar"],
                      ["sensibilidadeDentaria","Sensibilidade dentária"],
                      ["usoProstese",          "Uso de prótese"],
                    ].map(([campo, label]) => (
                      <div key={campo}>
                        <span style={S.label}>{label}</span>
                        <input style={S.input} value={formAnamnese[campo]} onChange={(e) => setFormAnamnese((p) => ({ ...p, [campo]: e.target.value }))} placeholder="Descreva" />
                      </div>
                    ))}
                    <div>
                      <span style={S.label}>Tratamentos anteriores</span>
                      <textarea style={{ ...S.textarea, minHeight: "60px" }} value={formAnamnese.tratamentosAnteriores} onChange={(e) => setFormAnamnese((p) => ({ ...p, tratamentosAnteriores: e.target.value }))} placeholder="Descreva" />
                    </div>
                    <div>
                      <span style={S.label}>Observações clínicas</span>
                      <textarea style={{ ...S.textarea, minHeight: "60px" }} value={formAnamnese.observacoesClinicas} onChange={(e) => setFormAnamnese((p) => ({ ...p, observacoesClinicas: e.target.value }))} placeholder="Observações do profissional" />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>
                    <AlertTriangle size={12} />Alertas de Saúde
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {PERGUNTAS_RAPIDAS.map((item) => (
                      <div key={item.campo}>
                        <span style={{ ...S.label, color: "#92400e" }}>{item.label}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {["Sim", "Não", "Não sabe"].map((opcao) => (
                            <button
                              key={opcao}
                              onClick={() => setFormAnamnese((p) => ({ ...p, [item.campo]: opcao }))}
                              style={{
                                padding: "5px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                                border: `1px solid ${formAnamnese[item.campo] === opcao && opcao === "Sim" ? "#dc2626" : formAnamnese[item.campo] === opcao ? "#0f766e" : "#e2e8f0"}`,
                                background: formAnamnese[item.campo] === opcao && opcao === "Sim" ? "#dc2626" : formAnamnese[item.campo] === opcao ? "#f0fdfa" : "#fff",
                                color: formAnamnese[item.campo] === opcao && opcao === "Sim" ? "#fff" : formAnamnese[item.campo] === opcao ? "#0f766e" : "#64748b",
                              }}
                            >
                              {opcao}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ABA EVOLUÇÃO CLÍNICA */}
            {abaAtendimento === "evolucao" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  { campo: "evolucao",    label: "Evolução do atendimento",              placeholder: "Descreva a evolução clínica do paciente nesta consulta", rows: 4 },
                  { campo: "diagnostico", label: "Diagnóstico odontológico",             placeholder: "Diagnóstico clínico e/ou radiográfico", rows: 3 },
                  { campo: "conduta",     label: "Conduta / Plano de tratamento",        placeholder: "Descreva a conduta adotada e plano de tratamento", rows: 3 },
                  { campo: "prescricao",  label: "Prescrições / Orientações ao paciente",placeholder: "Medicamentos prescritos, cuidados pós-procedimento, retorno...", rows: 3 },
                ].map(({ campo, label, placeholder, rows }) => (
                  <div key={campo}>
                    <span style={S.label}>{label}</span>
                    <textarea
                      style={{ ...S.textarea, minHeight: `${rows * 22}px` }}
                      value={formAnamnese[campo]}
                      onChange={(e) => setFormAnamnese((p) => ({ ...p, [campo]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ABA PROCEDIMENTOS */}
            {abaAtendimento === "procedimentos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
                  <div style={{ background: "#f0fdfa", border: "2px solid #99f6e4", borderRadius: "12px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#0f766e", marginBottom: "10px", fontSize: "13px" }}>
                      <Stethoscope size={13} />Solicitados pela Recepção — clique para adicionar:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {(atendimentoAberto.procedimentosSolicitados || []).map((p, i) => {
                        const jaSel = procedimentosSelecionados.some((s) => s.nome === p.nome);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (!jaSel) {
                                setProcedimentosSelecionados((prev) => [...prev, { procedimentoId: `sol-${i}`, nome: p.nome, categoria: p.categoria || "", valor: Number(p.valor) || 0, desconto: 0, valorFinal: Number(p.valor) || 0, observacoes: "" }]);
                              }
                            }}
                            disabled={jaSel}
                            style={{ ...S.btnSecondary, background: jaSel ? "#0f766e" : "#fff", color: jaSel ? "#fff" : "#0f766e", borderColor: "#0f766e", fontWeight: 600, fontSize: "12px", padding: "6px 12px" }}
                          >
                            {jaSel ? "✓ " : "+ "}{p.nome}{p.valor ? ` (${formatarValor(p.valor)})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "10px", color: "#334155", fontSize: "13px" }}>Adicionar outros procedimentos</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {procedimentos.filter((p) => p.status === "ativo").map((proc) => (
                      <button key={proc.id} onClick={() => adicionarProcedimento(proc)}
                        style={{ ...S.btnSecondary, fontSize: "12px", padding: "5px 10px" }}>
                        + {proc.nome} ({formatarValor(proc.valor)})
                      </button>
                    ))}
                  </div>
                </div>

                {procedimentosSelecionados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: "12px" }}>
                    <Stethoscope size={36} color="#cbd5e1" style={{ marginBottom: "8px" }} />
                    <div style={{ fontWeight: 600 }}>Nenhum procedimento adicionado ainda.</div>
                  </div>
                ) : (
                  procedimentosSelecionados.map((p) => (
                    <div key={p.procedimentoId} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "#f0fdfa", borderBottom: "1px solid #e2e8f0" }}>
                        <strong style={{ color: "#0f766e", flex: 1 }}>{p.nome}</strong>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#dcfce7", color: "#15803d", fontSize: "11px", fontWeight: 700 }}>{p.categoria}</span>
                        <button onClick={() => removerProcedimento(p.procedimentoId)}
                          style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: "12px", color: "#dc2626", borderColor: "#fca5a5" }}>
                          Remover
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: "12px", padding: "12px 16px" }}>
                        <div>
                          <span style={S.label}>Valor (R$)</span>
                          <input style={S.input} type="number" min="0" value={p.valor} onChange={(e) => atualizarProcedimento(p.procedimentoId, "valor", e.target.value)} />
                        </div>
                        <div>
                          <span style={S.label}>Desconto (R$)</span>
                          <input style={S.input} type="number" min="0" value={p.desconto} onChange={(e) => atualizarProcedimento(p.procedimentoId, "desconto", e.target.value)} />
                        </div>
                        <div>
                          <span style={S.label}>Valor final</span>
                          <div style={{ padding: "8px 10px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "8px", fontWeight: 700, color: "#0f766e" }}>
                            {formatarValor(p.valorFinal)}
                          </div>
                        </div>
                        <div>
                          <span style={S.label}>Observações</span>
                          <input style={S.input} value={p.observacoes} onChange={(e) => atualizarProcedimento(p.procedimentoId, "observacoes", e.target.value)} placeholder="Obs. deste procedimento" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ABA RESUMO */}
            {abaAtendimento === "resumo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {procedimentosSelecionados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: "12px" }}>
                    <Stethoscope size={36} color="#cbd5e1" style={{ marginBottom: "8px" }} />
                    <div style={{ fontWeight: 600 }}>Nenhum procedimento realizado.</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>Vá para a aba Procedimentos para adicionar.</div>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f0fdfa" }}>
                        {["Procedimento", "Categoria", "Valor", "Desconto", "Valor Final"].map((h) => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {procedimentosSelecionados.map((p) => (
                        <tr key={p.procedimentoId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{p.nome}</td>
                          <td style={{ padding: "10px 12px", color: "#64748b" }}>{p.categoria}</td>
                          <td style={{ padding: "10px 12px" }}>{formatarValor(p.valor)}</td>
                          <td style={{ padding: "10px 12px", color: "#dc2626" }}>{formatarValor(p.desconto)}</td>
                          <td style={{ padding: "10px 12px" }}><strong style={{ color: "#0f766e" }}>{formatarValor(p.valorFinal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={S.label}>Desconto geral adicional (R$)</span>
                    <input style={S.input} type="number" min="0" value={descontoGeral} onChange={(e) => setDescontoGeral(e.target.value)} />
                  </div>
                  <div>
                    <span style={S.label}>Observações finais</span>
                    <input style={S.input} value={obsAtendimento} onChange={(e) => setObsAtendimento(e.target.value)} placeholder="Observações gerais do atendimento" />
                  </div>
                </div>

                <div style={{ background: "#f0fdfa", border: "2px solid #99f6e4", borderRadius: "14px", padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "#475569" }}>
                    <span>Subtotal dos procedimentos</span>
                    <strong>{formatarValor(subtotalAtendimento)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px", fontSize: "14px", color: "#dc2626" }}>
                    <span>Desconto geral</span>
                    <strong>— {formatarValor(descontoGeral)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #0f766e22", paddingTop: "14px", marginBottom: "20px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f766e" }}>Total a pagar</span>
                    <strong style={{ fontSize: "24px", color: "#0f766e" }}>
                      {formatarValor(Math.max(0, subtotalAtendimento - Number(descontoGeral)))}
                    </strong>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "12px", color: "#92400e" }}>
                    O pagamento já foi confirmado no check-in. Ao finalizar, o atendimento será encerrado com pagamento vinculado.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: dados do paciente — estilo "patient card" Zendenta */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {dadosPaciente && (
              <div style={{ ...S.card, padding: "18px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <Avatar nome={dadosPaciente.nome} size={72} />
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginTop: 10 }}>
                  {dadosPaciente.nome}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {idade !== null ? `${idade} anos` : "—"}
                  {dadosPaciente.tipoSanguineo ? ` · ${dadosPaciente.tipoSanguineo}` : ""}
                </div>

                <div style={{
                  width: "100%", marginTop: 14, paddingTop: 14,
                  borderTop: "1px solid #f1f5f9",
                  display: "flex", flexDirection: "column", gap: 8, textAlign: "left",
                }}>
                  {[
                    ["Convênio",  dadosPaciente.convenio || dadosPaciente.planoSaude || "Particular"],
                    ["Sexo",      ({ M: "Masculino", F: "Feminino", outro: "Outro" }[dadosPaciente.sexo] ?? dadosPaciente.sexo) || "—"],
                    ["Telefone",  dadosPaciente.telefone || "—"],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#94a3b8", fontWeight: 500 }}>{l}</span>
                      <span style={{ color: "#0f172a", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {dadosPaciente.alergias && (
                  <div style={{ width: "100%", marginTop: 12, padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 3 }}>
                      <AlertTriangle size={11} />ALERGIAS
                    </div>
                    <div style={{ fontSize: 12, color: "#7f1d1d" }}>{dadosPaciente.alergias}</div>
                  </div>
                )}
              </div>
            )}

            {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
              <div style={{ ...S.card, padding: "18px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 10 }}>Procedimentos solicitados</div>
                {(atendimentoAberto.procedimentosSolicitados || []).map((p, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: i < atendimentoAberto.procedimentosSolicitados.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{p.nome}</div>
                    {p.valor > 0 && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{formatarValor(p.valor)}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Barra de ações */}
        <div style={{ display: "flex", gap: "10px", padding: "14px 20px", background: "#fff", borderRadius: "14px", boxShadow: "0 -2px 8px rgba(0,0,0,.04)", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={salvarAtendimento} style={{ ...S.btnPrimary, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Save size={15} />Salvar atendimento
          </button>
          <button onClick={finalizarAtendimento} style={{ ...S.btnPrimary, display: "inline-flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, #059669, #16a34a)" }}>
            <Check size={15} />Finalizar atendimento
          </button>
          <button onClick={voltarParaFila} style={S.btnSecondary}>← Voltar</button>
        </div>
      </div>
    );
  }

  // ── RENDER: Fila de atendimento ───────────────────────────────────────────────

  const listaAtual = abaLista === "aguardando" ? filaAguardando : filaEmAtendimento;
  const listaFiltrada = listaAtual.filter(
    (a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())
  );
  const totalPaginasFila = Math.max(1, Math.ceil(listaFiltrada.length / ITENS_FILA));
  const listaExibida = listaFiltrada.slice((paginaFila - 1) * ITENS_FILA, paginaFila * ITENS_FILA);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header — breadcrumb leve + título estilo Zendenta */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>
            Clínico <span style={{ margin: "0 6px" }}>›</span>
            <span style={{ color: ACCENT, fontWeight: 600 }}>Odontologia</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a", letterSpacing: "-.01em" }}>
            Odontologia
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Fila de atendimento — {filtroFila === "hoje" ? "pacientes de hoje" : "todos os pacientes"}.
          </p>
        </div>
      </div>

      {/* KPIs resumidos — pequeno painel discreto */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Aguardando",     valor: filaAguardando.length,    cor: "#f59e0b", bg: "#fffbeb" },
          { label: "Em atendimento", valor: filaEmAtendimento.length, cor: "#0f766e", bg: "#f0fdfa" },
          { label: "Agendados hoje", valor: agendamentosHoje.length,  cor: ACCENT,    bg: ACCENT_SOFT },
        ].map((k) => (
          <div key={k.label} style={{
            ...S.card, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: k.bg,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: k.cor, fontWeight: 700, fontSize: 16,
            }}>{k.valor}</div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>{k.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                {k.label === "Aguardando" ? "Pacientes na fila" : k.label === "Em atendimento" ? "Em curso agora" : "Para confirmar chegada"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta: agendamentos não encaminhados */}
      {filtroFila === "hoje" && agendamentosNaoEncaminhados.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px 16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>
              {agendamentosNaoEncaminhados.length} paciente{agendamentosNaoEncaminhados.length > 1 ? "s" : ""} de hoje ainda não iniciado{agendamentosNaoEncaminhados.length > 1 ? "s" : ""} no atendimento
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {agendamentosNaoEncaminhados.map((ag) => {
                const chegou = ag.status === "aguardando";
                return (
                  <div key={ag.id} style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    background: chegou ? "#f0fdf4" : "#fff",
                    border: `1px solid ${chegou ? "#86efac" : "#fde68a"}`,
                    borderRadius: "8px", padding: "4px 10px",
                  }}>
                    {chegou && (
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 4, padding: "1px 5px" }}>
                        AQUI
                      </span>
                    )}
                    <span style={{ fontSize: "12px", fontWeight: 600, color: chegou ? "#15803d" : "#78350f" }}>
                      {ag.hora && <span style={{ marginRight: "4px", opacity: 0.7 }}>{ag.hora}</span>}
                      {ag.pacienteNome}
                    </span>
                    <button
                      onClick={() => encaminharParaFila(ag)}
                      style={{
                        background: chegou ? "#16a34a" : "#f59e0b",
                        border: "none", color: "#fff", borderRadius: "6px",
                        padding: "2px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {chegou ? "Iniciar" : "Encaminhar"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filtro + lista */}
      <div style={S.card}>
        {/* Linha 1: busca + filtro Hoje/Todos */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 320 }}>
            <input
              style={{ ...S.input, paddingLeft: 34 }}
              placeholder="Buscar paciente..."
              value={buscaFila}
              onChange={(e) => setBuscaFila(e.target.value)}
            />
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2, marginLeft: "auto" }}>
            {[{ v: "hoje", label: "Hoje" }, { v: "tudo", label: "Todos" }].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFiltroFila(opt.v)}
                style={{
                  background: filtroFila === opt.v ? "#fff" : "none",
                  border: filtroFila === opt.v ? "1px solid #e5e7eb" : "1px solid transparent",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12,
                  fontWeight: filtroFila === opt.v ? 700 : 500,
                  color: filtroFila === opt.v ? ACCENT : "#64748b",
                  cursor: "pointer",
                  boxShadow: filtroFila === opt.v ? "0 1px 2px rgba(15,23,42,.05)" : "none",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: abas underline */}
        <div style={{ display: "flex", gap: 24, marginBottom: 18, borderBottom: "1px solid #e5e7eb" }}>
          <button onClick={() => setAbaLista("aguardando")} style={S.tabUnderline(abaLista === "aguardando")}>
            Aguardando <span style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 999, background: abaLista === "aguardando" ? ACCENT_SOFT : "#f1f5f9", color: abaLista === "aguardando" ? ACCENT : "#64748b", fontSize: 11, fontWeight: 700 }}>{filaAguardando.length}</span>
          </button>
          <button onClick={() => setAbaLista("em_atendimento")} style={S.tabUnderline(abaLista === "em_atendimento")}>
            Em atendimento <span style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 999, background: abaLista === "em_atendimento" ? ACCENT_SOFT : "#f1f5f9", color: abaLista === "em_atendimento" ? ACCENT : "#64748b", fontSize: 11, fontWeight: 700 }}>{filaEmAtendimento.length}</span>
          </button>
        </div>

        {listaFiltrada.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px", color: "#94a3b8" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: ACCENT_SOFT,
              margin: "0 auto 12px", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Stethoscope size={28} color={ACCENT} />
            </div>
            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: 15 }}>Nenhum paciente na fila</p>
            <p style={{ margin: "6px 0 0", fontSize: 13 }}>
              {abaLista === "aguardando"
                ? "Pacientes liberados após pagamento aparecem aqui."
                : "Inicie um atendimento da aba Aguardando."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listaExibida.map((at) => {
              const cor = corStatus(at.status);
              const espera = tempoEspera(at);
              return (
                <div
                  key={at.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 18px", borderRadius: 14,
                    background: "#fff", border: "1px solid #f1f5f9",
                    transition: "all .15s",
                  }}
                >
                  <Avatar nome={at.pacienteNome} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{at.pacienteNome || "—"}</span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: cor + "14", color: cor,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: cor }} />
                        {labelStatus(at.status)}
                      </span>
                      {espera && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "#f1f5f9", color: "#64748b" }}>
                          <Clock size={10} />{espera}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {at.data && filtroFila === "tudo" && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Calendar size={11} />{at.data.split("-").reverse().join("/")}</span>}
                      {at.hora && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={11} />{at.hora}</span>}
                      {at.tipoAtendimento && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Stethoscope size={11} />{at.tipoAtendimento}</span>}
                      {at.profissionalNome && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><User size={11} />Dr(a). {at.profissionalNome}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => abrirAtendimento(at)}
                    style={{ ...S.btnPrimary, fontSize: 12, padding: "8px 16px" }}
                  >
                    Atender →
                  </button>
                </div>
              );
            })}
            {totalPaginasFila > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", marginTop: "4px" }}>
                <button
                  onClick={() => setPaginaFila(p => Math.max(1, p - 1))}
                  disabled={paginaFila === 1}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 14px", cursor: paginaFila === 1 ? "not-allowed" : "pointer", color: paginaFila === 1 ? "#cbd5e1" : "#475569", fontSize: "13px" }}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                  Página {paginaFila} de {totalPaginasFila}
                </span>
                <button
                  onClick={() => setPaginaFila(p => Math.min(totalPaginasFila, p + 1))}
                  disabled={paginaFila >= totalPaginasFila}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 14px", cursor: paginaFila >= totalPaginasFila ? "not-allowed" : "pointer", color: paginaFila >= totalPaginasFila ? "#cbd5e1" : "#475569", fontSize: "13px" }}
                >
                  Próxima →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Pagamento obrigatório no check-in ─────────────────────── */}
      {modalPagto && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
          <div style={{
            background: "#fff", borderRadius: "20px",
            boxShadow: "0 8px 40px rgba(0,0,0,.18)", padding: "32px",
            width: "100%", maxWidth: "460px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>Pagamento necessário</h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Registre o pagamento para liberar o paciente para o atendimento.
                </p>
              </div>
              <button onClick={() => setModalPagto(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a", marginBottom: "4px" }}>
                {modalPagto.agendamento.pacienteNome}
              </div>
              <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
                {modalPagto.descricao}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f766e" }}>
                {formatarValor(modalPagto.valorEstimado)}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={S.label}>Forma de pagamento</label>
              <select
                value={formaPagamentoChegada}
                onChange={(e) => setFormaPagamentoChegada(e.target.value)}
                style={{ ...S.input }}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
                <option value="cheque">Cheque</option>
                <option value="cortesia">Cortesia (isento)</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setModalPagto(null)}
                style={{ ...S.btnSecondary, flex: 1 }}
                disabled={processandoPagamento}
              >
                Cancelar
              </button>
              <button
                onClick={registrarPagamentoEEncaminhar}
                style={{ ...S.btnPrimary, flex: 2 }}
                disabled={processandoPagamento}
              >
                {processandoPagamento ? "Registrando..." : "Registrar pagamento e encaminhar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
