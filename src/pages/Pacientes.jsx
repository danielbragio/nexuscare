import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hojeISO } from "../utils/dateUtils";
import { validarCPF, validarTelefone, mascaraCPF as mascaraCPFInput, mascaraTelefone as mascaraTelInput } from "../utils/validacoes";
import {
  ESPECIALIDADES_MEDICO,
  ESPECIALIDADES_ODONTO,
  ESPECIALIDADES_ODONTO_EXCLUSIVAS,
} from "../config/especialidades";

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mascaraCPF(cpf) {
  if (!cpf) return "\u2014";
  const c = String(cpf).replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}

function mascaraTelefone(tel) {
  if (!tel) return "\u2014";
  const t = String(tel).replace(/\D/g, "");
  if (t.length === 11) return `(${t.slice(0, 2)}) *****-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ****-${t.slice(6)}`;
  return tel;
}

function normalizarHora(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 5);
}

function obterDiaSemana(dataISO) {
  if (!dataISO) return null;

  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);

  const nomes = [
    {
      numero: 0,
      nome: "domingo",
      variantes: ["domingo", "dom", "0"],
    },
    {
      numero: 1,
      nome: "segunda-feira",
      variantes: ["segunda-feira", "segunda", "seg", "1"],
    },
    {
      numero: 2,
      nome: "terça-feira",
      variantes: ["terça-feira", "terca-feira", "terça", "terca", "ter", "2"],
    },
    {
      numero: 3,
      nome: "quarta-feira",
      variantes: ["quarta-feira", "quarta", "qua", "3"],
    },
    {
      numero: 4,
      nome: "quinta-feira",
      variantes: ["quinta-feira", "quinta", "qui", "4"],
    },
    {
      numero: 5,
      nome: "sexta-feira",
      variantes: ["sexta-feira", "sexta", "sex", "5"],
    },
    {
      numero: 6,
      nome: "sábado",
      variantes: ["sábado", "sabado", "sab", "sáb", "6"],
    },
  ];

  return nomes[data.getDay()];
}

function gerarHorariosPorIntervalo(inicio, fim, intervaloMinutos = 30) {
  if (!inicio || !fim) return [];

  const [horaInicio, minutoInicio] = String(inicio).split(":").map(Number);
  const [horaFim, minutoFim] = String(fim).split(":").map(Number);

  if (
    Number.isNaN(horaInicio) ||
    Number.isNaN(minutoInicio) ||
    Number.isNaN(horaFim) ||
    Number.isNaN(minutoFim)
  ) {
    return [];
  }

  const horarios = [];
  const atual = new Date();
  atual.setHours(horaInicio, minutoInicio, 0, 0);

  const limite = new Date();
  limite.setHours(horaFim, minutoFim, 0, 0);

  while (atual <= limite) {
    const hora = String(atual.getHours()).padStart(2, "0");
    const minuto = String(atual.getMinutes()).padStart(2, "0");
    horarios.push(`${hora}:${minuto}`);
    atual.setMinutes(atual.getMinutes() + Number(intervaloMinutos || 30));
  }

  return horarios;
}

function obterNomeProfissional(profissional) {
  return (
    profissional.nome ||
    profissional.name ||
    profissional.medico ||
    profissional.profissional ||
    profissional.username ||
    profissional.email ||
    "Profissional sem nome"
  );
}

function obterIdProfissional(profissional) {
  return profissional.id || profissional.uid || profissional.medicoId || profissional.userId || "";
}

function profissionalEhOdontologico(profissional) {
  const role = normalizarTexto(profissional.role);
  const cargo = normalizarTexto(profissional.cargo || "");
  const tipo = normalizarTexto(profissional.tipo || "");
  const especialidade = normalizarTexto(profissional.especialidade || "");
  const permissions = Array.isArray(profissional.permissions)
    ? profissional.permissions.map(normalizarTexto)
    : [];
  return (
    role === "odonto" ||
    role === "odontologo" ||
    role === "odontólogo" ||
    role === "dentista" ||
    cargo.includes("odonto") ||
    cargo.includes("dentis") ||
    tipo.includes("odonto") ||
    tipo.includes("dentis") ||
    especialidade.includes("odonto") ||
    especialidade.includes("dentis") ||
    Boolean(profissional.cro) ||
    permissions.includes("odonto")
  );
}

function profissionalEhAssistencial(profissional) {
  const role = normalizarTexto(profissional.role);
  const cargo = normalizarTexto(profissional.cargo);
  const tipo = normalizarTexto(profissional.tipo);
  const especialidade = normalizarTexto(profissional.especialidade);
  const permissions = Array.isArray(profissional.permissions)
    ? profissional.permissions.map(normalizarTexto)
    : [];

  return (
    role === "medico" ||
    role === "médico" ||
    role === "enfermeiro" ||
    role === "enfermagem" ||
    role === "odontologo" ||
    role === "odontólogo" ||
    cargo.includes("medic") ||
    cargo.includes("enferm") ||
    cargo.includes("odonto") ||
    tipo.includes("medic") ||
    tipo.includes("enferm") ||
    tipo.includes("odonto") ||
    especialidade ||
    profissional.crm ||
    profissional.coren ||
    profissional.cro ||
    permissions.includes("medicos") ||
    permissions.includes("enfermagem") ||
    permissions.includes("odonto")
  );
}

function profissionalTemEspecialidade(prof, esp) {
  if (!esp) return true;
  const norm = normalizarTexto(esp);
  const profEsp = normalizarTexto(prof.especialidade || "");
  if (profEsp && (profEsp === norm || profEsp.includes(norm) || norm.includes(profEsp))) return true;
  if (!prof.especialidade) {
    if (norm.includes("odonto") || norm.includes("dentis")) return profissionalEhOdontologico(prof);
    const role = normalizarTexto(prof.role || "");
    if (norm.includes("enferm")) return role === "enfermeiro" || role === "enfermagem";
    if (norm.includes("medic") || norm.includes("médic") || norm.includes("clin") || norm.includes("geral")) {
      return role === "medico" || role === "médico";
    }
  }
  return false;
}

function possuiAgendaNoDia(profissional, diaSemana) {
  if (!diaSemana) return false;

  const variantes = diaSemana.variantes.map(normalizarTexto);

  const diasAtendimento =
    profissional.diasAtendimento ||
    profissional.dias ||
    profissional.diasAgenda ||
    profissional.diasDisponiveis ||
    profissional.diasDeAtendimento;

  if (Array.isArray(diasAtendimento)) {
    return diasAtendimento.some((dia) => variantes.includes(normalizarTexto(dia)));
  }

  if (typeof diasAtendimento === "string") {
    const diasTexto = diasAtendimento
      .split(/[;,|]/)
      .map(normalizarTexto)
      .filter(Boolean);

    return diasTexto.some((dia) => variantes.includes(dia));
  }

  const agenda =
    profissional.agenda ||
    profissional.agendaSemanal ||
    profissional.horariosPorDia ||
    profissional.disponibilidade;

  if (agenda && typeof agenda === "object") {
    return Object.keys(agenda).some((chave) => variantes.includes(normalizarTexto(chave)));
  }

  return false;
}

function obterHorariosDoProfissional(profissional, diaSemana) {
  if (!diaSemana) return [];

  const variantes = diaSemana.variantes.map(normalizarTexto);

  const agenda =
    profissional.agenda ||
    profissional.agendaSemanal ||
    profissional.horariosPorDia ||
    profissional.disponibilidade;

  if (agenda && typeof agenda === "object") {
    const chaveEncontrada = Object.keys(agenda).find((chave) =>
      variantes.includes(normalizarTexto(chave))
    );

    const horariosDoDia = chaveEncontrada ? agenda[chaveEncontrada] : null;

    if (Array.isArray(horariosDoDia)) {
      return horariosDoDia.map(normalizarHora).filter(Boolean);
    }

    if (horariosDoDia && typeof horariosDoDia === "object") {
      if (Array.isArray(horariosDoDia.horarios)) {
        return horariosDoDia.horarios.map(normalizarHora).filter(Boolean);
      }

      if (horariosDoDia.inicio && horariosDoDia.fim) {
        return gerarHorariosPorIntervalo(
          horariosDoDia.inicio,
          horariosDoDia.fim,
          horariosDoDia.intervalo || profissional.intervaloAtendimento || 30
        );
      }
    }
  }

  const horarios =
    profissional.horarios ||
    profissional.horariosAtendimento ||
    profissional.horariosDisponiveis ||
    profissional.horariosAgenda;

  if (Array.isArray(horarios)) {
    return horarios.map(normalizarHora).filter(Boolean);
  }

  if (typeof horarios === "string") {
    return horarios
      .split(/[;,|]/)
      .map(normalizarHora)
      .filter(Boolean);
  }

  if (profissional.horaInicio && profissional.horaFim) {
    return gerarHorariosPorIntervalo(
      profissional.horaInicio,
      profissional.horaFim,
      profissional.intervaloAtendimento || 30
    );
  }

  if (profissional.inicioAtendimento && profissional.fimAtendimento) {
    return gerarHorariosPorIntervalo(
      profissional.inicioAtendimento,
      profissional.fimAtendimento,
      profissional.intervaloAtendimento || 30
    );
  }

  return [];
}

function consultaPertenceAoProfissional(consulta, profissional) {
  const idProfissional = normalizarTexto(obterIdProfissional(profissional));
  const nomeProfissional = normalizarTexto(obterNomeProfissional(profissional));
  const emailProfissional = normalizarTexto(profissional.email);

  const valoresConsulta = [
    consulta.medicoId,
    consulta.profissionalId,
    consulta.userId,
    consulta.medico,
    consulta.profissional,
    consulta.nomeMedico,
    consulta.profissionalNome,
    consulta.medicoNome,
    consulta.medicoEmail,
    consulta.profissionalEmail,
  ]
    .filter(Boolean)
    .map(normalizarTexto);

  return valoresConsulta.some((valor) => {
    return (
      valor === idProfissional ||
      valor === nomeProfissional ||
      valor === emailProfissional ||
      valor.includes(nomeProfissional) ||
      nomeProfissional.includes(valor)
    );
  });
}

function consultaOcupaHorario(consulta) {
  const status = normalizarTexto(consulta.status);

  return ![
    "finalizado",
    "finalizada",
    "cancelado",
    "cancelada",
    "faltou",
    "ausente",
  ].includes(status);
}

// ── Searchable specialty combobox ────────────────────────────────────────────
function EspecialidadeCombobox({ value, onChange }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function fechar(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const buscaNorm = normalizarTexto(busca);

  const medicosFiltrados = ESPECIALIDADES_MEDICO.filter(
    (esp) => !buscaNorm || normalizarTexto(esp).includes(buscaNorm)
  );
  const odontoFiltradas = ESPECIALIDADES_ODONTO.filter(
    (esp) =>
      ESPECIALIDADES_ODONTO_EXCLUSIVAS.has(esp) &&
      (!buscaNorm || normalizarTexto(esp).includes(buscaNorm))
  );

  const semResultados = medicosFiltrados.length === 0 && odontoFiltradas.length === 0;

  function selecionar(esp) {
    onChange(esp);
    setBusca("");
    setAberto(false);
  }

  function limpar(e) {
    e.stopPropagation();
    onChange("");
    setBusca("");
    setAberto(false);
  }

  const itemStyle = (sel) => ({
    padding: "9px 16px",
    fontSize: "14px",
    cursor: "pointer",
    background: sel ? "#eff6ff" : "#fff",
    color: sel ? "#2563eb" : "#1e293b",
    fontWeight: sel ? 600 : 400,
    transition: "background 0.1s",
  });

  const groupHeaderStyle = {
    padding: "7px 12px 4px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    background: "#f8fafc",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderTop: "1px solid #f1f5f9",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        className="select"
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
        onClick={() => setAberto((prev) => !prev)}
      >
        <span style={{ color: value ? "inherit" : "#94a3b8" }}>
          {value || "Selecione a especialidade"}
        </span>
        <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {value && (
            <span
              onClick={limpar}
              style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1, fontWeight: 700, cursor: "pointer" }}
              title="Limpar"
            >
              ×
            </span>
          )}
          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{aberto ? "▲" : "▼"}</span>
        </span>
      </div>

      {aberto && (
        <div
          style={{
            position: "absolute",
            zIndex: 1050,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.13)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
            <input
              autoFocus
              className="input"
              placeholder="Buscar especialidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ margin: 0 }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {semResultados && (
              <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
                Nenhuma especialidade encontrada
              </div>
            )}

            {medicosFiltrados.length > 0 && (
              <>
                <div style={{ ...groupHeaderStyle, borderTop: "none" }}>🏥 Medicina</div>
                {medicosFiltrados.map((esp) => (
                  <div
                    key={`med-${esp}`}
                    style={itemStyle(value === esp)}
                    onMouseEnter={(e) => { if (value !== esp) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (value !== esp) e.currentTarget.style.background = "#fff"; }}
                    onClick={() => selecionar(esp)}
                  >
                    {esp}
                  </div>
                ))}
              </>
            )}

            {odontoFiltradas.length > 0 && (
              <>
                <div style={groupHeaderStyle}>🦷 Odontologia</div>
                {odontoFiltradas.map((esp) => (
                  <div
                    key={`odo-${esp}`}
                    style={itemStyle(value === esp)}
                    onMouseEnter={(e) => { if (value !== esp) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (value !== esp) e.currentTarget.style.background = "#fff"; }}
                    onClick={() => selecionar(esp)}
                  >
                    {esp}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de remarcação (usado no Check-in) ───────────────────────────────────
function ModalRemarcarCheckin({ ag, onSalvar, onFechar }) {
  const hoje = hojeISO();
  const [data, setData] = useState(ag.data || hoje);
  const [hora, setHora] = useState(ag.hora ? String(ag.hora).slice(0, 5) : "");
  const [salvando, setSalvando] = useState(false);
  const inp = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
  async function salvar() {
    if (!data) return;
    setSalvando(true);
    try { await onSalvar(data, hora); } finally { setSalvando(false); }
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "min(380px,92vw)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Remarcar agendamento</h3>
          <button onClick={onFechar} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#374151" }}>
          <strong>{ag.paciente || ag.pacienteNome || ag.nomePaciente}</strong>
          {ag.hora && <span> · {String(ag.hora).slice(0, 5)}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#374151" }}>Nova data *</label>
            <input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#374151" }}>Novo horário</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={inp} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onFechar} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={!data || salvando} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: (!data || salvando) ? "not-allowed" : "pointer", opacity: (!data || salvando) ? 0.7 : 1, fontSize: 13, fontWeight: 600 }}>
            {salvando ? "Salvando…" : "Confirmar remarcação"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pacientes({
  pacientes = [],
  consultas = [],
  agendamentosOdonto = [],
  procedimentosOdonto = [],
  users = [],
  onAdicionarPaciente,
  onAtualizarPaciente,
  onAdicionarConsulta,
  onEncaminharParaPagamento,
  onAtualizarConsulta,
  onAtualizarAgendamentoOdonto,
  onRefreshAgendamentosOdonto,
}) {
  const { userData } = useAuth();
  const toast = useToast();

  const [abaAtiva, setAbaAtiva] = useState("cadastro");
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [pacienteId, setPacienteId] = useState(null);
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [salvandoConsulta, setSalvandoConsulta] = useState(false);
  const [confirmandoCheckin, setConfirmandoCheckin] = useState(null);
  const [buscaCheckin, setBuscaCheckin] = useState("");
  const [remarcarCheckin, setRemarcarCheckin] = useState(null);

  const [paginaBusca, setPaginaBusca] = useState(1);
  const itensPorPagina = 8;

  const [profissionaisDisponiveis, setProfissionaisDisponiveis] = useState([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
  const [carregandoProfissionais, setCarregandoProfissionais] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    dataNascimento: "",
    sexo: "",
    mae: "",
    pai: "",
    endereco: "",
    rua: "",
    bairro: "",
    cep: "",
    convenio: "Particular",
    status: "Ativo",
    observacoes: "",
  });

  const [especialidadeSelecionada, setEspecialidadeSelecionada] = useState("");
  const [procedimentosSelecionadosOdonto, setProcedimentosSelecionadosOdonto] = useState([]);
  const [buscaProcedimentos, setBuscaProcedimentos] = useState("");
  const [mostrarProcedimentos, setMostrarProcedimentos] = useState(false);
  const [profissionaisOdonto, setProfissionaisOdonto] = useState([]);
  const [modalExclusao, setModalExclusao] = useState(null); // { paciente, etapa: 'senha'|'motivo', senha, motivo, processando }
  const [modalDataFutura, setModalDataFutura] = useState(null); // { motivo, payload } aguarda confirmação do usuário

  const [carregandoProfissionaisOdonto, setCarregandoProfissionaisOdonto] = useState(false);
  const [profissionalOdontoId, setProfissionalOdontoId] = useState("");
  const [profissionalOdontoNome, setProfissionalOdontoNome] = useState("");
  const [horaOdonto, setHoraOdonto] = useState("");
  const [horariosDisponiveisOdonto, setHorariosDisponiveisOdonto] = useState([]);

  const [agendamento, setAgendamento] = useState({
    nomePaciente: "",
    cpf: "",
    telefone: "",
    especialidade: "",
    medico: "",
    medicoId: "",
    medicoEmail: "",
    data: "",
    hora: "",
    observacoesRecepcao: "",
    tipoAtendimento: "Agendamento",
    valorConsulta: "",
  });

  const isAdmin = userData?.role === "admin";

  // Roteamento: especialidades exclusivamente odontológicas vão para odonto path
  const isOdonto = ESPECIALIDADES_ODONTO_EXCLUSIVAS.has(especialidadeSelecionada);

  const destinoAtendimento = isOdonto ? "odonto" : "medico";

  useEffect(() => {
    if (!isOdonto) {
      const isImediato = agendamento.tipoAtendimento === "Atendimento Imediato";
      carregarProfissionaisDisponiveis(agendamento.data, especialidadeSelecionada, isImediato);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- carregarProfissionaisDisponiveis is a stable sync function; isOdonto derives from especialidadeSelecionada which is in deps
  }, [agendamento.data, agendamento.tipoAtendimento, consultas, especialidadeSelecionada]);

  function carregarProfissionaisOdonto(espFiltro = "") {
    setCarregandoProfissionaisOdonto(true);
    try {
      const todos = users.filter((u) => u.ativo !== false);
      const odonto = todos.filter(profissionalEhOdontologico);
      if (espFiltro) {
        const norm = normalizarTexto(espFiltro);
        const comEsp = odonto.filter((p) => {
          if (!p.especialidade) return true;
          const pe = normalizarTexto(p.especialidade);
          return pe === norm || pe.includes(norm) || norm.includes(pe);
        });
        setProfissionaisOdonto(comEsp.length > 0 ? comEsp : odonto);
      } else {
        setProfissionaisOdonto(odonto);
      }
    } finally {
      setCarregandoProfissionaisOdonto(false);
    }
  }

  function computarHorariosOdonto(profId, data) {
    if (!profId || !data) return [];
    const prof = profissionaisOdonto.find((p) => String(p.id || p.uid) === String(profId));
    if (!prof) return [];
    const diaSemana = obterDiaSemana(data);
    const horariosCadastrados = diaSemana ? obterHorariosDoProfissional(prof, diaSemana) : [];
    const horariosBase =
      horariosCadastrados.length > 0
        ? horariosCadastrados
        : gerarHorariosPorIntervalo("08:00", "18:00", prof.intervalo_minutos || prof.intervalo || 30);
    const horariosOcupados = agendamentosOdonto
      .filter((a) => {
        if (a.data !== data) return false;
        const s = (a.status || "").toLowerCase();
        if (["finalizado", "cancelado", "faltou"].includes(s)) return false;
        const aId = String(a.profissionalId || "");
        const aNome = normalizarTexto(a.profissionalNome || "");
        const profNome = normalizarTexto(obterNomeProfissional(prof));
        return aId === String(profId) || aNome === profNome;
      })
      .map((a) => normalizarHora(a.hora));
    return horariosBase.filter((h) => h && !horariosOcupados.includes(h));
  }

  function carregarProfissionaisDisponiveis(dataSelecionada, espFiltro = "", imediato = false) {
    if (!dataSelecionada && !imediato) {
      setProfissionaisDisponiveis([]);
      setHorariosDisponiveis([]);
      setAgendamento((prev) => ({
        ...prev,
        medico: "",
        medicoId: "",
        medicoEmail: "",
        hora: "",
      }));
      return;
    }

    try {
      setCarregandoProfissionais(true);

      const profissionais = users.filter((u) => u.ativo !== false);

      let disponiveis;
      if (imediato) {
        disponiveis = profissionais
          .filter(profissionalEhAssistencial)
          .filter((profissional) => profissionalTemEspecialidade(profissional, espFiltro))
          .map((profissional) => ({
            ...profissional,
            nomeExibicao: obterNomeProfissional(profissional),
            horariosLivres: [],
            totalHorariosLivres: 1,
          }));
      } else {
        const diaSemana = obterDiaSemana(dataSelecionada);
        disponiveis = profissionais
          .filter(profissionalEhAssistencial)
          .filter((profissional) => profissionalTemEspecialidade(profissional, espFiltro))
          // Remove strict day-of-week filter: if no schedule is configured, professional is available any day
          .filter((profissional) => {
            // Has schedule config → respect configured days; no config → always available
            const temAgenda = !!(
              profissional.diasAtendimento || profissional.dias || profissional.diasAgenda ||
              profissional.diasDisponiveis || profissional.diasDeAtendimento ||
              profissional.agenda || profissional.agendaSemanal ||
              profissional.horariosPorDia || profissional.disponibilidade
            );
            return !temAgenda || possuiAgendaNoDia(profissional, diaSemana);
          })
          .map((profissional) => {
            const horariosCadastrados = obterHorariosDoProfissional(profissional, diaSemana);
            // Fall back to default 08:00-18:00 every 30 min when no schedule configured
            const horariosBase = horariosCadastrados.length > 0
              ? horariosCadastrados
              : gerarHorariosPorIntervalo("08:00", "18:00", 30);

            const horariosOcupados = consultas
              .filter((consulta) => consulta.data === dataSelecionada)
              .filter(consultaOcupaHorario)
              .filter((consulta) => consultaPertenceAoProfissional(consulta, profissional))
              .map((consulta) => normalizarHora(consulta.hora));

            const horariosLivres = horariosBase.filter(
              (hora) => hora && !horariosOcupados.includes(hora)
            );

            return {
              ...profissional,
              nomeExibicao: obterNomeProfissional(profissional),
              horariosLivres,
              totalHorariosLivres: horariosLivres.length,
            };
          })
          .filter((profissional) => profissional.totalHorariosLivres > 0)
          .sort((a, b) => b.totalHorariosLivres - a.totalHorariosLivres);
      }

      setProfissionaisDisponiveis(disponiveis);

      const profissionalAtual = disponiveis.find(
        (item) =>
          normalizarTexto(item.nomeExibicao) === normalizarTexto(agendamento.medico) ||
          normalizarTexto(obterIdProfissional(item)) === normalizarTexto(agendamento.medicoId)
      );

      if (profissionalAtual) {
        setHorariosDisponiveis(profissionalAtual.horariosLivres);
      } else {
        setHorariosDisponiveis([]);
        setAgendamento((prev) => ({
          ...prev,
          medico: "",
          medicoId: "",
          medicoEmail: "",
          hora: "",
        }));
      }
    } catch (error) {
      console.error("Erro ao carregar profissionais disponíveis:", error);
      setProfissionaisDisponiveis([]);
      setHorariosDisponiveis([]);
    } finally {
      setCarregandoProfissionais(false);
    }
  }

  function calcularIdade(dataNascimento) {
    if (!dataNascimento) return "";
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();

    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }

    return idade >= 0 ? idade : "";
  }

  const idadeAtual = calcularIdade(form.dataNascimento);

  const cpfDuplicado = useMemo(() => {
    const limpo = form.cpf.replace(/\D/g, "");
    if (limpo.length !== 11) return null;
    return pacientes.find((p) => {
      if (pacienteId && String(p.id) === String(pacienteId)) return false;
      const pc = String(p.cpf || "").replace(/\D/g, "");
      return pc.length === 11 && pc === limpo;
    }) || null;
  }, [form.cpf, pacientes, pacienteId]);

  // Verificação de duplicata via API (captura CPFs fora da lista local paginada)
  const [cpfApiNome, setCpfApiNome] = useState(null);
  useEffect(() => {
    const limpo = form.cpf.replace(/\D/g, "");
    // In edit mode the local cpfDuplicado check already excludes the current patient —
    // skip the API call to avoid the false "já cadastrado" warning for the patient's own CPF.
    if (limpo.length !== 11 || cpfDuplicado || pacienteId) {
      setCpfApiNome(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.pacientes.verificarDuplicata(limpo);
        setCpfApiNome(res?.data?.duplicado ? (res.data.nome || "Paciente existente") : null);
      } catch {
        setCpfApiNome(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.cpf, cpfDuplicado, pacienteId]);

  function handleChange(e) {
    const { name, value } = e.target;
    let v = value;
    if (name === "cpf") v = mascaraCPFInput(value);
    if (name === "telefone") v = mascaraTelInput(value);
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  function handleAgendamentoChange(e) {
    const { name, value } = e.target;

    if (name === "tipoAtendimento") {
      const isImediato = value === "Atendimento Imediato";
      const hoje = hojeISO();
      setAgendamento((prev) => ({
        ...prev,
        tipoAtendimento: value,
        data: isImediato ? hoje : prev.data,
        medico: "",
        medicoId: "",
        medicoEmail: "",
        hora: "",
      }));
      setHorariosDisponiveis([]);
      if (isImediato && especialidadeSelecionada && !ESPECIALIDADES_ODONTO_EXCLUSIVAS.has(especialidadeSelecionada)) {
        carregarProfissionaisDisponiveis(hoje, especialidadeSelecionada, true);
      }
      return;
    }

    if (name === "data") {
      setAgendamento((prev) => ({
        ...prev,
        data: value,
        medico: "",
        medicoId: "",
        medicoEmail: "",
        hora: "",
      }));
      setHorariosDisponiveis([]);
      if (ESPECIALIDADES_ODONTO_EXCLUSIVAS.has(especialidadeSelecionada)) {
        setHoraOdonto("");
        setHorariosDisponiveisOdonto(
          profissionalOdontoId ? computarHorariosOdonto(profissionalOdontoId, value) : []
        );
      } else if (especialidadeSelecionada && value) {
        const _isImediato = agendamento.tipoAtendimento === "Atendimento Imediato";
        carregarProfissionaisDisponiveis(value, especialidadeSelecionada, _isImediato);
      }
      return;
    }

    if (name === "medico") {
      const profissional = profissionaisDisponiveis.find(
        (item) => String(obterIdProfissional(item)) === String(value)
      );

      setAgendamento((prev) => ({
        ...prev,
        medico: profissional?.nomeExibicao || "",
        medicoId: obterIdProfissional(profissional || {}),
        medicoEmail: profissional?.email || "",
        especialidade: profissional?.especialidade || prev.especialidade,
        hora: "",
      }));

      setHorariosDisponiveis(profissional?.horariosLivres || []);
      return;
    }

    setAgendamento((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleEspecialidadeChange(nova) {
    setEspecialidadeSelecionada(nova);
    setAgendamento((prev) => ({
      ...prev,
      especialidade: nova,
      medico: "",
      medicoId: "",
      medicoEmail: "",
      hora: "",
    }));
    setProfissionalOdontoId("");
    setProfissionalOdontoNome("");
    setHorariosDisponiveisOdonto([]);
    setHoraOdonto("");
    setHorariosDisponiveis([]);
    setProfissionaisDisponiveis([]);
    if (ESPECIALIDADES_ODONTO_EXCLUSIVAS.has(nova)) {
      carregarProfissionaisOdonto(nova);
    } else if (agendamento.data) {
      // Date already selected — load professionals immediately instead of waiting for useEffect
      const _isImediato = agendamento.tipoAtendimento === "Atendimento Imediato";
      carregarProfissionaisDisponiveis(agendamento.data, nova, _isImediato);
    }
  }

  function limparFormulario() {
    setPacienteId(null);
    setForm({
      nome: "",
      cpf: "",
      telefone: "",
      dataNascimento: "",
      sexo: "",
      mae: "",
      pai: "",
      endereco: "",
      rua: "",
      bairro: "",
      cep: "",
      convenio: "Particular",
      status: "Ativo",
      observacoes: "",
    });
  }

  function limparAgendamento() {
    setAgendamento({
      nomePaciente: "",
      cpf: "",
      telefone: "",
      especialidade: "",
      medico: "",
      medicoId: "",
      medicoEmail: "",
      data: "",
      hora: "",
      observacoesRecepcao: "",
      tipoAtendimento: "Agendamento",
      valorConsulta: "",
    });
    setEspecialidadeSelecionada("");
    setProcedimentosSelecionadosOdonto([]);
    setBuscaProcedimentos("");
    setMostrarProcedimentos(false);
    setProfissionaisDisponiveis([]);
    setHorariosDisponiveis([]);
    setProfissionalOdontoId("");
    setProfissionalOdontoNome("");
    setHoraOdonto("");
    setHorariosDisponiveisOdonto([]);
  }

  function novoCadastro() {
    limparFormulario();
    setAbaAtiva("cadastro");

    setTimeout(() => {
      const campoNome = document.querySelector('input[name="nome"]');
      if (campoNome) campoNome.focus();
    }, 100);
  }

  function novoAtendimento() {
    limparAgendamento();
    setAbaAtiva("agendamento");

    setTimeout(() => {
      const campoPaciente = document.querySelector('input[name="nomePaciente"]');
      if (campoPaciente) campoPaciente.focus();
    }, 100);
  }

  async function salvarPaciente() {
    if (!form.nome || !form.telefone) {
      toast.warn("Preencha nome e telefone.");
      return;
    }
    if (form.cpf && !validarCPF(form.cpf)) {
      toast.warn("CPF inválido. Verifique os dígitos informados.");
      return;
    }
    if (!validarTelefone(form.telefone)) {
      toast.warn("Telefone inválido. Use o formato (00) 00000-0000.");
      return;
    }

    try {
      setSalvandoPaciente(true);
      if (pacienteId) {
        await onAtualizarPaciente(pacienteId, form);
        setPacienteId(null);
        toast.success("Paciente atualizado com sucesso.");
      } else {
        await onAdicionarPaciente(form);
        toast.success("Paciente cadastrado com sucesso.");
      }
      limparFormulario();
      setAbaAtiva("buscar");
    } catch (error) {
      // Erros de validação (400/409) são esperados — não logar como crítico
      if (error.status && error.status < 500) {
        const detalhe = error.data?.message || error.message || "Dados inválidos.";
        toast.error(detalhe);
      } else {
        console.error("Erro ao salvar paciente:", error);
        toast.error("Não foi possível salvar o paciente. Tente novamente.");
      }
    } finally {
      setSalvandoPaciente(false);
    }
  }

  async function registrarAtendimento(overrideMotivo = null) {
    const _isImediato = agendamento.tipoAtendimento === "Atendimento Imediato";
    const _hoje = hojeISO();
    const _dataEfetiva = agendamento.data || (_isImediato ? _hoje : "");

    if (!agendamento.nomePaciente || !_dataEfetiva) {
      toast.warn("Preencha ao menos o nome do paciente e a data.");
      return;
    }

    // ── Proteção de data futura ────────────────────────────────────────────
    if (!_isImediato && _dataEfetiva > _hoje && !overrideMotivo) {
      setModalDataFutura({ motivo: "" });
      return;
    }

    if (destinoAtendimento === "odonto") {
      if (!agendamento.nomePaciente.trim()) {
        toast.warn("Informe o nome do paciente.");
        return;
      }
      if (!profissionalOdontoId) {
        toast.warn("Selecione o profissional odontológico antes de encaminhar.");
        return;
      }
      try {
        setSalvandoConsulta(true);
        const statusInicial = _isImediato ? "aguardando" : "agendado";
        const tipoAtend =
          _isImediato ? "Consulta Imediata" : "Consulta";
        const valorTotal = procedimentosSelecionadosOdonto.reduce(
          (acc, p) => acc + Number(p.valor || 0), 0
        );
        const descricaoProc =
          procedimentosSelecionadosOdonto.map((p) => p.nome).join(", ") ||
          "Atendimento odontológico";
        const dataHoje = hojeISO();

        // 1. Criar agendamento odonto
        const agRes = await api.agendamentosOdonto.criar({
          paciente_nome:              agendamento.nomePaciente,
          profissional_nome:          profissionalOdontoNome || "",
          profissional_id:            profissionalOdontoId ? Number(profissionalOdontoId) || null : null,
          data:                       agendamento.data || dataHoje,
          hora:                       horaOdonto || "",
          tipo_atendimento:           tipoAtend,
          status:                     statusInicial,
          procedimentos_solicitados:  procedimentosSelecionadosOdonto,
          observacoes:                agendamento.observacoesRecepcao || "",
        });
        const agId = agRes?.data?.id;

        if (_isImediato) {
          const confirmacao = await api.agendamentosOdonto.confirmarChegada(agId, { status: "aguardando" });
          const pagId = confirmacao?.data?.pagamento?.id;
          limparAgendamento();
          if (onEncaminharParaPagamento) {
            onEncaminharParaPagamento({
              pagamentoId:     pagId,
              atendimentoId:   confirmacao?.data?.atendimento?.id || agId,
              paciente:        agendamento.nomePaciente,
              cpf:             agendamento.cpf || "",
              telefone:        agendamento.telefone || "",
              tipoAtendimento: `Odontologia - ${tipoAtend}`,
              profissional:    profissionalOdontoNome || "",
              valor:           valorTotal,
              descricao:       descricaoProc,
              tipo:            "odonto",
            });
          } else {
            toast.success("Paciente encaminhado para Odontologia. Cobrança pendente registrada em Pagamentos.");
          }
          await onRefreshAgendamentosOdonto?.();
          return;
          /*
          // Imediato: paciente já está aqui — criar pagamento pendente + atendimento
          const pagRes = await api.pagamentos.criar({
            nome_paciente:   agendamento.nomePaciente,
            descricao:       descricaoProc,
            servico:         "Odontologia",
            valor:           valorTotal,
            desconto:        0,
            valor_final:     valorTotal,
            status:          "pendente",
            status_pagamento:"pendente",
            forma_pagamento: "",
            tipo:            "odonto",
            origem:          "odonto",
            profissional:    profissionalOdontoNome || "",
            data:            dataHoje,
            data_pagamento:  "",
          });
          const pagId = pagRes?.data?.id;

          if (agId && pagId) {
            await api.agendamentosOdonto.atualizar(agId, { pagamento_id: pagId });
          }

          await api.atendimentosOdonto.criar({
            agendamento_id:            agId || null,
            paciente_nome:             agendamento.nomePaciente,
            profissional_id:           profissionalOdontoId ? Number(profissionalOdontoId) : null,
            profissional_nome:         profissionalOdontoNome || "",
            tipo_atendimento:          tipoAtend,
            status:                    "aguardando",
            status_pagamento:          "pendente",
            procedimentos_solicitados: procedimentosSelecionadosOdonto,
            observacoes_recepcao:      agendamento.observacoesRecepcao || "",
            total:                     valorTotal,
            desconto:                  0,
            valor_final:               valorTotal,
            pagamento_id:              pagId || null,
            data:                      dataHoje,
            hora:                      horaOdonto || "",
          });
          limparAgendamento();
          if (onEncaminharParaPagamento) {
            onEncaminharParaPagamento({
              pagamentoId:     pagId,
              atendimentoId:   agId,
              paciente:        agendamento.nomePaciente,
              cpf:             agendamento.cpf || "",
              telefone:        agendamento.telefone || "",
              tipoAtendimento: `Odontologia — ${tipoAtend}`,
              profissional:    profissionalOdontoNome || "",
              valor:           valorTotal,
              descricao:       descricaoProc,
              tipo:            "odonto",
            });
          } else {
            toast.success(`Paciente encaminhado para Odontologia. Cobrança pendente de ${valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} criada.`);
          }
          */
        } else {
          // Agendamento futuro: sem pagamento; pagamento nascerá na confirmação de chegada
          await onRefreshAgendamentosOdonto?.();
          limparAgendamento();
          toast.success("Agendamento odontológico criado. O paciente aparecerá no calendário e entrará na fila após check-in.");
        }
      } catch (error) {
        console.error("Erro ao encaminhar para odonto:", error);
        toast.error(error.data?.detail || error.message || "Não foi possível encaminhar para Odontologia.");
      } finally {
        setSalvandoConsulta(false);
      }
      return;
    }

    // Destino: médico (fluxo original)
    const _horaEfetiva = agendamento.hora ||
      (_isImediato
        ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "");

    if (!agendamento.medico || !agendamento.especialidade || (!_isImediato && !_horaEfetiva)) {
      const faltas = [];
      if (!agendamento.especialidade) faltas.push("especialidade");
      if (!agendamento.medico) faltas.push("profissional");
      if (!_isImediato && !_horaEfetiva) faltas.push("horário");
      toast.warn(`Preencha os campos: ${faltas.join(", ")}.`);
      return;
    }

    if (!_isImediato) {
      const horarioAindaDisponivel = horariosDisponiveis.includes(normalizarHora(_horaEfetiva));
      if (!horarioAindaDisponivel) {
        toast.warn("Este horário não está mais disponível para o profissional selecionado.");
        return;
      }
    }

    try {
      setSalvandoConsulta(true);
      const docRef = await onAdicionarConsulta({
        paciente: agendamento.nomePaciente,
        nomePaciente: agendamento.nomePaciente,
        cpf: agendamento.cpf,
        telefone: agendamento.telefone,
        especialidade: agendamento.especialidade,
        medico: agendamento.medico,
        profissional: agendamento.medico,
        medicoId: agendamento.medicoId,
        profissionalId: agendamento.medicoId,
        profissionalUid: agendamento.medicoId,
        medicoEmail: agendamento.medicoEmail,
        profissionalEmail: agendamento.medicoEmail,
        data: _dataEfetiva,
        hora: _horaEfetiva,
        observacoesRecepcao: agendamento.observacoesRecepcao,
        tipoAtendimento:
          agendamento.tipoAtendimento === "Atendimento Imediato"
            ? "Atendimento Imediato"
            : "Agendamento",
        chegouHoje: agendamento.tipoAtendimento === "Atendimento Imediato",
        fichaAberta: agendamento.tipoAtendimento === "Atendimento Imediato",
        tempoEsperaMinutos: 0,
        pagamentoId: "",
      });

      // Criar pagamento antecipado apenas para agendamentos futuros (não imediatos)
      // Para imediato, o pagamento será criado pelo médico ao finalizar o atendimento
      // ── Registro de auditoria para antecipação de data futura ────────────
      if (overrideMotivo) {
        api.auditLogs.registrar({
          usuario_id:    userData?.id || null,
          usuario_nome:  userData?.nome || userData?.name || "",
          usuario_role:  userData?.role || "",
          acao:          "antecipacao_atendimento",
          entidade:      "atendimento",
          entidade_id:   docRef?.id || null,
          data_original: _dataEfetiva,
          motivo:        overrideMotivo,
          detalhes:      {
            paciente:        agendamento.nomePaciente,
            profissional:    agendamento.medico || "",
            especialidade:   agendamento.especialidade || "",
            data_agendamento: _dataEfetiva,
            hora:            _horaEfetiva,
          },
        }).catch(() => {});
      }

      limparAgendamento();
      if (_isImediato) {
        toast.success(`Atendimento imediato criado. ${agendamento.nomePaciente} está aguardando pagamento antes da consulta.`);
      } else {
        toast.success("Agendamento criado com sucesso. A cobrança será gerada no check-in.");
      }
    } catch (error) {
      console.error("Erro ao registrar atendimento:", error);
      toast.error("Não foi possível registrar o atendimento.");
    } finally {
      setSalvandoConsulta(false);
    }
  }

  async function _EXCLUIR_PACIENTE_LEGADO(paciente) {
    if (!isAdmin) {
      toast.warn("Apenas administradores podem excluir cadastros.");
      return;
    }
    if (!await toast.confirm(`Tem certeza que deseja excluir o cadastro de ${paciente.nome}?`)) return;
    setModalExclusao({ paciente, etapa: "senha", senha: "", motivo: "", processando: false });
  }

  async function confirmarSenhaExclusao() {
    if (!modalExclusao?.senha) {
      toast.warn("Informe a senha para continuar.");
      return;
    }
    setModalExclusao((m) => ({ ...m, processando: true }));
    try {
      await api.auth.login(userData?.login || userData?.email, modalExclusao.senha);
      setModalExclusao((m) => ({ ...m, etapa: "motivo", processando: false }));
    } catch {
      setModalExclusao((m) => ({ ...m, processando: false }));
      toast.error("Senha inválida. Exclusão cancelada.");
    }
  }

  async function confirmarExclusaoFinal() {
    if (!modalExclusao?.motivo?.trim()) {
      toast.warn("Informe o motivo para concluir a exclusão.");
      return;
    }
    setModalExclusao((m) => ({ ...m, processando: true }));
    try {
      await api.pacientes.excluir(modalExclusao.paciente.id);
      toast.success("Cadastro excluído com sucesso.");
      setModalExclusao(null);
    } catch (error) {
      console.error("Erro ao excluir paciente:", error);
      setModalExclusao((m) => ({ ...m, processando: false }));
      toast.error("Erro ao excluir cadastro.");
    }
  }

  function carregarPaciente(item) {
    setPacienteId(item.id || null);
    setForm({
      nome: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
      dataNascimento: item.dataNascimento || item.data_nascimento || "",
      sexo: ({ M: 'Masculino', F: 'Feminino', outro: 'Outro' }[item.sexo] ?? item.sexo ?? ""),
      mae: item.mae || item.nome_mae || "",
      pai: item.pai || item.nome_pai || "",
      endereco: item.endereco || "",
      rua: item.rua || item.endereco || "",
      bairro: item.bairro || "",
      cep: item.cep || "",
      convenio: item.convenio || item.planoSaude || "Particular",
      status: item.status || "Ativo",
      observacoes: item.observacoes || "",
    });

    setAgendamento((prev) => ({
      ...prev,
      nomePaciente: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
    }));

    setAbaAtiva("cadastro");
  }


  function carregarParaAgendar(item) {
    limparAgendamento();
    setAgendamento((prev) => ({
      ...prev,
      nomePaciente: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
      tipoAtendimento: "Agendamento",
      data: "",
    }));
    setAbaAtiva("agendamento");
  }

  function carregarParaImediato(item) {
    limparAgendamento();
    setAgendamento((prev) => ({
      ...prev,
      nomePaciente: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
      tipoAtendimento: "Atendimento Imediato",
      data: hojeISO(),
    }));
    setAbaAtiva("agendamento");
  }

  async function _ENVIAR_PARA_FILA_LEGADO(item) {
    const hoje = hojeISO();
    const jaEstaFila = consultas.some((c) => {
      const s = (c.status || "").toLowerCase();
      return (
        (c.paciente === item.nome || c.nomePaciente === item.nome) &&
        c.data === hoje &&
        ["aguardando", "em_atendimento", "presente", "confirmado"].includes(s)
      );
    });
    if (jaEstaFila) {
      toast.warn(`${item.nome} já está na fila de atendimento hoje.`);
      return;
    }
    try {
      await onAdicionarConsulta({
        paciente:            item.nome,
        nomePaciente:        item.nome,
        cpf:                 item.cpf || "",
        telefone:            item.telefone || "",
        especialidade:       "",
        medico:              "",
        medicoId:            "",
        data:                hoje,
        hora:                new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        tipoAtendimento:     "Atendimento Imediato",
        observacoesRecepcao: "Paciente enviado para fila pela recepção.",
      });
      toast.success(`${item.nome} enviado para a fila de atendimento.`);
    } catch (e) {
      console.error("Erro ao enviar para fila:", e);
      toast.error("Não foi possível enviar o paciente para a fila.");
    }
  }

  async function registrarAcaoCheckin(ag, statusNovo) {
    if (statusNovo === "cancelado") {
      const nome = ag.paciente || ag.pacienteNome || ag.nomePaciente || "paciente";
      const ok = await toast.confirm(`Cancelar agendamento de ${nome}?`);
      if (!ok) return;
    }
    setConfirmandoCheckin(ag.id);
    try {
      if (ag._tipo === "odonto") {
        if (statusNovo === "aguardando") {
          await api.agendamentosOdonto.confirmarChegada(ag.id, { status: statusNovo });
          // Pagamento já está confirmado (pré-requisito do check-in odonto).
          // Apenas refresca dados — sem redirecionar para Pagamentos.
          await onRefreshAgendamentosOdonto?.();
        } else {
          await onAtualizarAgendamentoOdonto?.(ag.id, { status: statusNovo });
        }
      } else {
        await onAtualizarConsulta?.(ag.id, { status: statusNovo });
      }
      const nome = ag.paciente || ag.pacienteNome || ag.nomePaciente || "Paciente";
      const msgs = {
        aguardando: `Chegada de ${nome} confirmada. Paciente liberado para Odontologia.`,
        faltou:     `Falta de ${nome} registrada.`,
        cancelado:  `Agendamento de ${nome} cancelado.`,
      };
      toast.success(msgs[statusNovo] || "Agendamento atualizado.");
    } catch (e) {
      console.error(e);
      const errors = e?.data?.errors || e?.data;
      if (errors?.action === "redirect_to_pagamentos") {
        // Sem pagamento confirmado — direciona recepção para registrar pagamento
        const nome = ag.paciente || ag.pacienteNome || ag.nomePaciente || "";
        toast.warn("Pagamento obrigatório antes de liberar para Odontologia.");
        onEncaminharParaPagamento?.({
          agendamentoOdontoId: errors.agendamento_id || ag.id,
          pacienteId:          errors.paciente_id || ag.pacienteId || "",
          paciente:            errors.paciente_nome || nome,
          tipoAtendimento:     errors.descricao || ag.tipoAtendimento || "Atendimento odontológico",
          profissional:        ag.profissionalNome || "",
          valor:               errors.valor_estimado ? String(errors.valor_estimado) : "",
          tipo:                "odonto",
          origem:              "agendamento_odonto",
        });
        return;
      }
      toast.error(e?.data?.message || "Não foi possível atualizar o agendamento.");
    } finally {
      setConfirmandoCheckin(null);
    }
  }

  async function remarcarDeHoje(ag, { data, hora }) {
    setConfirmandoCheckin(ag.id);
    try {
      if (ag._tipo === "odonto") {
        await onAtualizarAgendamentoOdonto?.(ag.id, { data, hora: hora || null, status: "remarcado" });
      } else {
        await onAtualizarConsulta?.(ag.id, { data, hora: hora || null, status: "remarcado" });
      }
      toast.success("Agendamento remarcado.");
      setRemarcarCheckin(null);
    } catch {
      toast.error("Não foi possível remarcar.");
    } finally {
      setConfirmandoCheckin(null);
    }
  }

  const buscaCadastroFiltrada = useMemo(() => {
    return pacientes.filter((item) => {
      const termo = buscaCadastro.toLowerCase();
      return (
        (item.nome || "").toLowerCase().includes(termo) ||
        (item.cpf || "").toLowerCase().includes(termo) ||
        (item.telefone || "").toLowerCase().includes(termo) ||
        (item.convenio || "").toLowerCase().includes(termo)
      );
    });
  }, [pacientes, buscaCadastro]);

  const consultasDoPaciente = useMemo(() => {
    if (!agendamento.nomePaciente || !agendamento.cpf) return [];
    return consultas.filter(
      (item) =>
        item.paciente === agendamento.nomePaciente && item.cpf === agendamento.cpf
    );
  }, [consultas, agendamento.nomePaciente, agendamento.cpf]);

  const agendamentosDeHoje = useMemo(() => {
    const hoje = hojeISO();
    const medicos = consultas
      .filter((c) => c.data === hoje && ["agendado", "confirmado"].includes(c.status || ""))
      .map((c) => ({ ...c, _tipo: "medico" }));
    const odonto = agendamentosOdonto
      .filter((a) => a.data === hoje && ["agendado", "confirmado"].includes(a.status || ""))
      .map((a) => ({ ...a, _tipo: "odonto" }));
    return [...medicos, ...odonto].sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  }, [consultas, agendamentosOdonto]);

  const agendamentosDeHojeFiltrados = useMemo(() => {
    if (!buscaCheckin.trim()) return agendamentosDeHoje;
    const termo = buscaCheckin.toLowerCase().trim();
    return agendamentosDeHoje.filter((a) => {
      const nome = (a.paciente || a.pacienteNome || a.nomePaciente || "").toLowerCase();
      const prof = (a.medico || a.profissionalNome || "").toLowerCase();
      const esp  = (a.especialidade || "").toLowerCase();
      return nome.includes(termo) || prof.includes(termo) || esp.includes(termo);
    });
  }, [agendamentosDeHoje, buscaCheckin]);

  const totalPacientes = pacientes.length;
  const pacientesAtivos = pacientes.filter((item) => item.status === "Ativo").length;
  const pacientesRetorno = pacientes.filter((item) => item.status === "Retorno").length;

  const totalPaginasBusca = Math.max(
    1,
    Math.ceil(buscaCadastroFiltrada.length / itensPorPagina)
  );

  const buscaPaginada = buscaCadastroFiltrada.slice(
    (paginaBusca - 1) * itensPorPagina,
    paginaBusca * itensPorPagina
  );

  function badgeClass(status) {
    if (status === "Ativo") return "patients-badge patients-badge-blue";
    if (status === "Retorno") return "patients-badge patients-badge-purple";
    return "patients-badge";
  }

  const painelInternoStyle = {
    maxHeight: "calc(100vh - 250px)",
    overflow: "hidden",
  };

  const conteudoAbaStyle = {
    marginTop: "20px",
    height: "calc(100vh - 360px)",
    minHeight: "360px",
    overflow: "hidden",
  };

  const scrollInternoStyle = {
    height: "100%",
    overflowY: "auto",
    paddingRight: "4px",
  };

  const tabelaScrollStyle = {
    maxHeight: "calc(100vh - 460px)",
    minHeight: "280px",
    overflowY: "auto",
    borderRadius: "12px",
  };

  const isImediato = agendamento.tipoAtendimento === "Atendimento Imediato";

  const profissionalDesabilitado =
    !especialidadeSelecionada ||
    carregandoProfissionais;

  const horarioDesabilitado =
    !agendamento.medico ||
    carregandoProfissionais ||
    horariosDisponiveis.length === 0;

  return (
    <div className="patients-page" style={{ height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <h1>Recepção</h1>
        <p className="page-subtitle">
          Cadastro completo, busca rápida e envio para o fluxo do profissional.
        </p>
      </div>

      <div className="patients-hero">
        <div>
          <div className="patients-hero-kicker">Central de recepção</div>
          <h2 className="patients-hero-title">
            Cadastro, busca e envio para agendamento ou atendimento imediato
          </h2>
          <p className="patients-hero-text">
            Cadastre pacientes, localize registros existentes e envie para a fila do profissional.
          </p>
        </div>

        <div className="patients-hero-badges">
          <span className="patients-chip">Total: {totalPacientes}</span>
          <span className="patients-chip">Ativos: {pacientesAtivos}</span>
          <span className="patients-chip">Retorno: {pacientesRetorno}</span>
        </div>
      </div>

      <div
        className="page-card patients-card patients-main-card"
        style={{ marginTop: "20px", ...painelInternoStyle }}
      >
        <div className="patients-card-header">
          <div>
            <h3>Central de recepção</h3>
            <p className="patients-card-subtitle">Use as abas para organizar o fluxo</p>
          </div>

          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="secondary-btn" onClick={novoCadastro}>
              Novo cadastro
            </button>
            <button className="secondary-btn" onClick={novoAtendimento}>
              Limpar atendimento
            </button>
          </div>
        </div>

        <div className="patients-tabs">
          <button
            className={`patients-tab ${abaAtiva === "cadastro" ? "active" : ""}`}
            onClick={() => setAbaAtiva("cadastro")}
          >
            Cadastro
          </button>

          <button
            className={`patients-tab ${abaAtiva === "buscar" ? "active" : ""}`}
            onClick={() => { setAbaAtiva("buscar"); setPaginaBusca(1); }}
          >
            Buscar paciente
          </button>

          <button
            className={`patients-tab ${abaAtiva === "agendamento" ? "active" : ""}`}
            onClick={() => setAbaAtiva("agendamento")}
          >
            Agendar
          </button>

          <button
            className={`patients-tab ${abaAtiva === "checkin" ? "active" : ""}`}
            onClick={() => setAbaAtiva("checkin")}
          >
            Check-in{agendamentosDeHoje.length > 0 && (
              <span style={{ marginLeft: 6, background: "#2563eb", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>
                {agendamentosDeHoje.length}
              </span>
            )}
          </button>
        </div>

        <div style={conteudoAbaStyle}>
          {abaAtiva === "cadastro" && (
            <div className="patients-cadastro-layout" style={{ height: "100%" }}>
              <div className="patients-cadastro-main" style={scrollInternoStyle}>
                {pacienteId && (
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>
                    ✏️ Editando paciente — as alterações sobrescreverão o cadastro existente.
                  </div>
                )}
                <div className="patients-section-card">
                  <h4 className="patients-section-title">Dados pessoais</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Nome completo</label>
                      <input
                        className="input"
                        name="nome"
                        value={form.nome}
                        onChange={handleChange}
                        placeholder="Digite o nome do paciente"
                      />
                    </div>

                    <div>
                      <label>CPF</label>
                      <input
                        className="input"
                        name="cpf"
                        value={form.cpf}
                        onChange={handleChange}
                        placeholder="000.000.000-00"
                        style={(cpfDuplicado || cpfApiNome) ? { borderColor: "#f59e0b" } : form.cpf.replace(/\D/g,"").length === 11 && !validarCPF(form.cpf) ? { borderColor: "#dc2626" } : {}}
                      />
                      {(cpfDuplicado || cpfApiNome) && (
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#d97706", fontWeight: 600 }}>
                          ⚠ Paciente já cadastrado: {cpfDuplicado ? cpfDuplicado.nome : cpfApiNome}
                        </p>
                      )}
                      {!cpfDuplicado && !cpfApiNome && form.cpf.replace(/\D/g,"").length === 11 && !validarCPF(form.cpf) && (
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
                          CPF inválido
                        </p>
                      )}
                    </div>

                    <div>
                      <label>Telefone</label>
                      <input
                        className="input"
                        name="telefone"
                        value={form.telefone}
                        onChange={handleChange}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <label>Data de nascimento</label>
                      <input
                        className="input"
                        type="date"
                        name="dataNascimento"
                        value={form.dataNascimento}
                        onChange={handleChange}
                      />
                    </div>

                    <div>
                      <label>Idade</label>
                      <input
                        className="input"
                        value={idadeAtual}
                        readOnly
                        placeholder="Calculada automaticamente"
                      />
                    </div>

                    <div>
                      <label>Sexo</label>
                      <select
                        className="select"
                        name="sexo"
                        value={form.sexo}
                        onChange={handleChange}
                      >
                        <option value="">Selecione</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div>
                      <label>Convênio</label>
                      <select
                        className="select"
                        name="convenio"
                        value={form.convenio}
                        onChange={handleChange}
                      >
                        <option>Particular</option>
                        <option>Unimed</option>
                        <option>SUS</option>
                      </select>
                    </div>

                    <div>
                      <label>Status</label>
                      <select
                        className="select"
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                      >
                        <option>Ativo</option>
                        <option>Retorno</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="patients-section-card">
                  <h4 className="patients-section-title">Filiação</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Nome da mãe</label>
                      <input
                        className="input"
                        name="mae"
                        value={form.mae}
                        onChange={handleChange}
                        placeholder="Digite o nome da mãe"
                      />
                    </div>

                    <div>
                      <label>Nome do pai</label>
                      <input
                        className="input"
                        name="pai"
                        value={form.pai}
                        onChange={handleChange}
                        placeholder="Digite o nome do pai"
                      />
                    </div>
                  </div>
                </div>

                <div className="patients-section-card">
                  <h4 className="patients-section-title">Endereço</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Endereço</label>
                      <input
                        className="input"
                        name="endereco"
                        value={form.endereco}
                        onChange={handleChange}
                        placeholder="Digite o endereço"
                      />
                    </div>

                    <div>
                      <label>Rua</label>
                      <input
                        className="input"
                        name="rua"
                        value={form.rua}
                        onChange={handleChange}
                        placeholder="Digite a rua"
                      />
                    </div>

                    <div>
                      <label>Bairro</label>
                      <input
                        className="input"
                        name="bairro"
                        value={form.bairro}
                        onChange={handleChange}
                        placeholder="Digite o bairro"
                      />
                    </div>

                    <div>
                      <label>CEP</label>
                      <input
                        className="input"
                        name="cep"
                        value={form.cep}
                        onChange={handleChange}
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                </div>

                <div className="patients-section-card">
                  <h4 className="patients-section-title">Observações</h4>

                  <div>
                    <label>Observações do paciente</label>
                    <textarea
                      className="textarea"
                      name="observacoes"
                      value={form.observacoes}
                      onChange={handleChange}
                      placeholder="Digite observações importantes do paciente"
                    />
                  </div>
                </div>

                <div className="patients-form-actions">
                  <button
                    onClick={salvarPaciente}
                    className="primary-btn patients-save-btn"
                    disabled={salvandoPaciente}
                  >
                    {salvandoPaciente
                      ? "Salvando..."
                      : pacienteId
                      ? "Salvar alterações"
                      : "Cadastrar paciente"}
                  </button>
                  <button onClick={limparFormulario} className="secondary-btn">
                    {pacienteId ? "Cancelar edição" : "Limpar"}
                  </button>
                </div>
              </div>

              <div className="patients-cadastro-side">
                <div className="page-card patients-card patients-side-highlight">
                  <h4 className="patients-section-title">Resumo do cadastro</h4>

                  <div className="patients-summary-card-item">
                    <span>Nome</span>
                    <strong>{form.nome || "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>CPF</span>
                    <strong>{mascaraCPF(form.cpf)}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>Idade</span>
                    <strong>{idadeAtual !== "" ? `${idadeAtual} anos` : "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>Convênio</span>
                    <strong>{form.convenio || "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>Status</span>
                    <strong>{form.status || "—"}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === "buscar" && (
            <div style={scrollInternoStyle}>
              <div className="toolbar">
                <input
                  className="input search-input"
                  value={buscaCadastro}
                  onChange={(e) => {
                    setBuscaCadastro(e.target.value);
                    setPaginaBusca(1);
                  }}
                  placeholder="Buscar por nome, CPF, telefone ou convênio"
                />
              </div>

              <div style={tabelaScrollStyle}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>CPF</th>
                      <th>Telefone</th>
                      <th>Convênio</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buscaPaginada.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nome}</td>
                        <td>{mascaraCPF(item.cpf)}</td>
                        <td>{mascaraTelefone(item.telefone)}</td>
                        <td>{item.convenio}</td>
                        <td>
                          <span className={badgeClass(item.status)}>{item.status}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                            <button
                              className="secondary-btn"
                              style={{ fontSize: "12px", padding: "5px 10px" }}
                              onClick={() => carregarPaciente(item)}
                            >
                              Editar
                            </button>
                            <button
                              className="secondary-btn"
                              style={{ fontSize: "12px", padding: "5px 10px", background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
                              onClick={() => carregarParaAgendar(item)}
                              title="Agendar consulta para data futura"
                            >
                              Agendar consulta
                            </button>
                            <button
                              className="secondary-btn"
                              style={{ fontSize: "12px", padding: "5px 10px", background: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" }}
                              onClick={() => carregarParaImediato(item)}
                              title="Criar atendimento imediato — paciente entra na fila agora"
                            >
                              Atendimento imediato
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {buscaCadastroFiltrada.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "36px 20px" }}>
                          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>
                            {buscaCadastro
                              ? `Nenhum cadastro encontrado para "${buscaCadastro}".`
                              : "Nenhum paciente cadastrado ainda."}
                          </div>
                          {!buscaCadastro && (
                            <button
                              className="primary-btn"
                              style={{ fontSize: 13, padding: "7px 18px" }}
                              onClick={() => setAbaAtiva("cadastro")}
                            >
                              + Cadastrar primeiro paciente
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  className="secondary-btn"
                  disabled={paginaBusca === 1}
                  onClick={() => setPaginaBusca((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </button>

                <span>
                  Página {paginaBusca} de {totalPaginasBusca}
                </span>

                <button
                  className="secondary-btn"
                  disabled={paginaBusca >= totalPaginasBusca}
                  onClick={() =>
                    setPaginaBusca((prev) => Math.min(totalPaginasBusca, prev + 1))
                  }
                >
                  Próxima
                </button>
              </div>
            </div>
          )}

          {abaAtiva === "agendamento" && (
            <div className="patients-cadastro-layout" style={{ height: "100%" }}>
              <div className="patients-cadastro-main" style={scrollInternoStyle}>
                <div className="patients-section-card">
                  <h4 className="patients-section-title">
                    {isImediato ? "Atendimento imediato" : "Agendar consulta"}
                  </h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Nome do paciente</label>
                      <input
                        className="input"
                        name="nomePaciente"
                        value={agendamento.nomePaciente}
                        onChange={handleAgendamentoChange}
                        placeholder="Nome do paciente"
                      />
                    </div>

                    <div>
                      <label>CPF</label>
                      <input
                        className="input"
                        name="cpf"
                        value={agendamento.cpf}
                        onChange={handleAgendamentoChange}
                        placeholder="CPF"
                      />
                    </div>

                    <div>
                      <label>Telefone</label>
                      <input
                        className="input"
                        name="telefone"
                        value={agendamento.telefone}
                        onChange={handleAgendamentoChange}
                        placeholder="Telefone"
                      />
                    </div>

                    <div>
                      <label>Tipo de atendimento</label>
                      <select
                        className="select"
                        name="tipoAtendimento"
                        value={agendamento.tipoAtendimento}
                        onChange={handleAgendamentoChange}
                      >
                        <option value="Agendamento">Agendamento</option>
                        <option value="Atendimento Imediato">Atendimento Imediato</option>
                      </select>
                    </div>

                    <div className="patients-full-width">
                      <label>Especialidade do atendimento</label>
                      <EspecialidadeCombobox
                        value={especialidadeSelecionada}
                        onChange={handleEspecialidadeChange}
                      />
                    </div>

                    {destinoAtendimento === "odonto" && (
                      <div className="patients-full-width">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <label style={{ marginBottom: 0 }}>
                            Procedimentos odontológicos{procedimentosSelecionadosOdonto.length > 0 ? ` (${procedimentosSelecionadosOdonto.length} selecionados)` : " (opcional)"}
                          </label>
                          <button
                            type="button"
                            className="secondary-btn"
                            style={{ fontSize: "12px", padding: "4px 12px" }}
                            onClick={() => setMostrarProcedimentos((prev) => !prev)}
                          >
                            {mostrarProcedimentos ? "Recolher" : "Selecionar procedimentos"}
                          </button>
                        </div>

                        {procedimentosSelecionadosOdonto.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                            {procedimentosSelecionadosOdonto.map((p) => (
                              <span
                                key={p.id}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "6px",
                                  padding: "4px 10px", borderRadius: "8px", fontSize: "12px",
                                  background: "#0f766e", color: "#fff", fontWeight: 600,
                                }}
                              >
                                {p.nome}
                                <button
                                  type="button"
                                  onClick={() => setProcedimentosSelecionadosOdonto((prev) => prev.filter((x) => x.id !== p.id))}
                                  style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, lineHeight: 1 }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {mostrarProcedimentos && (
                          <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", background: "#f8fafc" }}>
                            <input
                              className="input"
                              placeholder="Buscar procedimento..."
                              value={buscaProcedimentos}
                              onChange={(e) => setBuscaProcedimentos(e.target.value)}
                              style={{ marginBottom: "10px" }}
                            />
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                              {procedimentosOdonto
                                .filter((p) => p.status === "ativo")
                                .filter((p) =>
                                  !buscaProcedimentos ||
                                  (p.nome || "").toLowerCase().includes(buscaProcedimentos.toLowerCase())
                                )
                                .map((proc) => {
                                  const sel = procedimentosSelecionadosOdonto.some((p) => p.id === proc.id);
                                  return (
                                    <button
                                      key={proc.id}
                                      type="button"
                                      onClick={() => {
                                        if (sel) {
                                          setProcedimentosSelecionadosOdonto((prev) => prev.filter((p) => p.id !== proc.id));
                                        } else {
                                          setProcedimentosSelecionadosOdonto((prev) => [...prev, proc]);
                                        }
                                      }}
                                      style={{
                                        padding: "6px 12px", fontSize: "12px", borderRadius: "8px",
                                        border: "1px solid", cursor: "pointer", fontWeight: 600,
                                        borderColor: sel ? "#0f766e" : "#cbd5e1",
                                        background: sel ? "#0f766e" : "#fff",
                                        color: sel ? "#fff" : "#334155",
                                      }}
                                    >
                                      {proc.nome} — {Number(proc.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </button>
                                  );
                                })}
                              {procedimentosOdonto.filter((p) => p.status === "ativo").length === 0 && (
                                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Nenhum procedimento cadastrado.</div>
                              )}
                            </div>
                          </div>
                        )}

                        {procedimentosSelecionadosOdonto.length > 0 && (
                          <div style={{ marginTop: "8px", fontSize: "13px", color: "#0f766e", fontWeight: 700 }}>
                            Total estimado:{" "}
                            {procedimentosSelecionadosOdonto
                              .reduce((acc, p) => acc + Number(p.valor || 0), 0)
                              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                        )}
                      </div>
                    )}

                    {isImediato ? (
                      <div>
                        <label>Data</label>
                        <input
                          className="input"
                          type="date"
                          value={agendamento.data}
                          readOnly
                          disabled
                          style={{ color: "#64748b", background: "#f1f5f9" }}
                        />
                      </div>
                    ) : (
                      <div>
                        <label>Data</label>
                        <input
                          className="input"
                          type="date"
                          name="data"
                          value={agendamento.data}
                          min={hojeISO()}
                          onChange={handleAgendamentoChange}
                        />
                      </div>
                    )}

                    {destinoAtendimento === "odonto" ? (
                      <>
                        <div>
                          <label>Profissional odontológico</label>
                          <select
                            className="select"
                            value={profissionalOdontoId}
                            onChange={(e) => {
                              const id = e.target.value;
                              const prof = profissionaisOdonto.find((p) => String(p.id || p.uid) === id);
                              setProfissionalOdontoId(id);
                              setProfissionalOdontoNome(prof ? obterNomeProfissional(prof) : "");
                              setHoraOdonto("");
                              setHorariosDisponiveisOdonto(
                                id ? computarHorariosOdonto(id, agendamento.data) : []
                              );
                            }}
                            disabled={carregandoProfissionaisOdonto}
                          >
                            <option value="">
                              {carregandoProfissionaisOdonto
                                ? "Carregando..."
                                : profissionaisOdonto.length === 0
                                ? "Nenhum profissional odontológico cadastrado"
                                : "Selecione o dentista / profissional"}
                            </option>
                            {profissionaisOdonto.map((prof) => (
                              <option key={prof.id || prof.uid} value={prof.id || prof.uid}>
                                {obterNomeProfissional(prof)}
                                {prof.especialidade ? ` — ${prof.especialidade}` : ""}
                              </option>
                            ))}
                          </select>
                          {profissionaisOdonto.length === 0 && !carregandoProfissionaisOdonto && (
                            <div style={{ fontSize: "12px", color: "#f59e0b", marginTop: "4px" }}>
                              Cadastre um profissional com perfil "Odonto" em Configurações para que ele apareça aqui.
                            </div>
                          )}
                        </div>

                        <div>
                          <label>Horário</label>
                          {!isImediato && profissionalOdontoId && horariosDisponiveisOdonto.length > 0 ? (
                            <select
                              className="select"
                              value={horaOdonto}
                              onChange={(e) => setHoraOdonto(e.target.value)}
                            >
                              <option value="">Selecione o horário</option>
                              {horariosDisponiveisOdonto.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input"
                              type="time"
                              value={horaOdonto}
                              onChange={(e) => setHoraOdonto(e.target.value)}
                            />
                          )}
                          {!isImediato && profissionalOdontoId && agendamento.data && horariosDisponiveisOdonto.length === 0 && (
                            <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 4 }}>
                              Nenhum horário configurado. Insira manualmente.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label>Profissional</label>
                          <select
                            className="select"
                            name="medico"
                            value={agendamento.medicoId}
                            onChange={handleAgendamentoChange}
                            disabled={profissionalDesabilitado}
                          >
                            <option value="">
                              {!especialidadeSelecionada
                                ? "Selecione a especialidade primeiro"
                                : carregandoProfissionais
                                ? "Carregando profissionais..."
                                : !isImediato && !agendamento.data
                                ? "Selecione uma data para ver horários disponíveis"
                                : profissionaisDisponiveis.length === 0
                                ? isImediato
                                  ? "Nenhum profissional encontrado para esta especialidade"
                                  : "Nenhum profissional disponível para esta data"
                                : "Selecione o profissional"}
                            </option>
                            {profissionaisDisponiveis.map((profissional) => (
                              <option
                                key={obterIdProfissional(profissional)}
                                value={obterIdProfissional(profissional)}
                              >
                                {profissional.nomeExibicao}
                                {!isImediato && ` — ${profissional.totalHorariosLivres} horário(s)`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {isImediato ? (
                          <div>
                            <label>Hora</label>
                            <input
                              className="input"
                              type="text"
                              value="Registrado automaticamente"
                              disabled
                              readOnly
                              style={{ color: "#94a3b8", fontStyle: "italic" }}
                            />
                          </div>
                        ) : (
                          <div>
                            <label>Hora</label>
                            <select
                              className="select"
                              name="hora"
                              value={agendamento.hora}
                              onChange={handleAgendamentoChange}
                              disabled={horarioDesabilitado}
                            >
                              <option value="">
                                {!agendamento.medico
                                  ? "Selecione um profissional"
                                  : horariosDisponiveis.length === 0
                                  ? "Nenhum horário disponível"
                                  : "Selecione o horário"}
                              </option>
                              {horariosDisponiveis.map((hora) => (
                                <option key={hora} value={hora}>
                                  {hora}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {destinoAtendimento === "medico" && (
                      <div>
                        <label>Valor da consulta (R$)</label>
                        <input
                          className="input"
                          type="number"
                          name="valorConsulta"
                          value={agendamento.valorConsulta}
                          onChange={handleAgendamentoChange}
                          placeholder="0,00"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    )}

                    <div className="patients-full-width">
                      <label>Observações da recepção</label>
                      <textarea
                        className="textarea"
                        name="observacoesRecepcao"
                        value={agendamento.observacoesRecepcao}
                        onChange={handleAgendamentoChange}
                        placeholder="Digite observações para o atendimento"
                      />
                    </div>
                  </div>

                  <div className="patients-form-actions">
                    <button
                      onClick={registrarAtendimento}
                      className="primary-btn"
                      disabled={salvandoConsulta || (!isOdonto && carregandoProfissionais) || !especialidadeSelecionada}
                    >
                      {salvandoConsulta
                        ? "Enviando..."
                        : isOdonto
                          ? isImediato ? "🦷 Iniciar atendimento odontológico" : "🦷 Criar agendamento odontológico"
                          : isImediato ? "Iniciar atendimento imediato" : "Criar agendamento"}
                    </button>
                    <button onClick={limparAgendamento} className="secondary-btn">
                      Limpar
                    </button>
                  </div>
                </div>
              </div>

              <div className="patients-cadastro-side" style={{ overflowY: "auto" }}>
                <div className="page-card patients-card patients-side-highlight">
                  <h4 className="patients-section-title">Histórico do paciente</h4>

                  {consultasDoPaciente.length > 0 ? (
                    <div className="patients-mini-list">
                      {consultasDoPaciente.map((item) => (
                        <div
                          key={item.id}
                          className="muted-box"
                          style={{ marginBottom: "12px" }}
                        >
                          <strong>
                            {item.data} às {item.hora}
                          </strong>
                          <div>{item.tipoAtendimento}</div>
                          <div>Profissional: {item.medico}</div>
                          <div>Especialidade: {item.especialidade}</div>
                          <div>Status: {item.status}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted-box">
                      Nenhum atendimento vinculado a este paciente ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Aba Check-in ─────────────────────────────────────────────────── */}
          {abaAtiva === "checkin" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Busca */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 220 }}
                  placeholder="Buscar por paciente, profissional ou especialidade…"
                  value={buscaCheckin}
                  onChange={(e) => setBuscaCheckin(e.target.value)}
                />
                <span style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
                  {agendamentosDeHojeFiltrados.length} agendamento{agendamentosDeHojeFiltrados.length !== 1 ? "s" : ""} pendente{agendamentosDeHojeFiltrados.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {agendamentosDeHojeFiltrados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#64748b" }}>
                      {buscaCheckin ? "Nenhum resultado" : "Nenhum agendamento pendente para hoje"}
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                      {!buscaCheckin && "Todos os check-ins foram realizados ou não há agendamentos para hoje."}
                    </p>
                  </div>
                ) : agendamentosDeHojeFiltrados.map((ag) => {
                  const s = ag.status || "agendado";
                  const nome = ag.paciente || ag.pacienteNome || ag.nomePaciente || "—";
                  const prof = ag.medico || ag.profissionalNome || "—";
                  const esp  = ag.especialidade || (ag._tipo === "odonto" ? "Odontologia" : "—");
                  const tel  = ag.telefone || ag.paciente_telefone || ag.celular || "";
                  const hora = ag.hora ? String(ag.hora).slice(0, 5) : "—";
                  const carregando = confirmandoCheckin === ag.id;
                  const COR_S   = { agendado: "#2563eb", confirmado: "#059669" };
                  const LABEL_S = { agendado: "Agendado", confirmado: "Confirmado" };
                  const corBorda = COR_S[s] || "#2563eb";
                  return (
                    <div key={ag.id} style={{
                      background: "#fff", border: "1px solid #e2e8f0",
                      borderLeft: `4px solid ${corBorda}`,
                      borderRadius: 12, padding: "14px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{nome}</span>
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, color: corBorda, background: `${corBorda}18` }}>
                              {LABEL_S[s] || s}
                            </span>
                            {ag._tipo === "odonto" && (
                              <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 8, background: "#f0fdf4", color: "#0f766e", fontWeight: 600 }}>Odonto</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 14, flexWrap: "wrap" }}>
                            <span>🕐 {hora}</span>
                            <span>👨‍⚕️ {prof}</span>
                            {esp && esp !== "—" && <span>🩺 {esp}</span>}
                            {tel && <span>📱 {tel}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0, alignItems: "center" }}>
                          <button
                            onClick={() => registrarAcaoCheckin(ag, "aguardando")}
                            disabled={carregando}
                            style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, background: carregando ? "#f1f5f9" : "#1d4ed8", color: carregando ? "#94a3b8" : "#fff", cursor: carregando ? "not-allowed" : "pointer" }}
                          >
                            {carregando ? "…" : "✓ Confirmar chegada"}
                          </button>
                          <button
                            onClick={() => setRemarcarCheckin(ag)}
                            disabled={carregando}
                            style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, background: "#fff", color: "#475569", cursor: "pointer" }}
                          >
                            ↻ Remarcar
                          </button>
                          <button
                            onClick={() => registrarAcaoCheckin(ag, "faltou")}
                            disabled={carregando}
                            style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #fee2e2", fontSize: 12, fontWeight: 600, background: "#fff5f5", color: "#dc2626", cursor: "pointer" }}
                          >
                            Faltou
                          </button>
                          <button
                            onClick={() => registrarAcaoCheckin(ag, "cancelado")}
                            disabled={carregando}
                            style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, background: "#f8fafc", color: "#64748b", cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de remarcação via Check-in */}
      {remarcarCheckin && (
        <ModalRemarcarCheckin
          ag={remarcarCheckin}
          onSalvar={(data, hora) => remarcarDeHoje(remarcarCheckin, { data, hora })}
          onFechar={() => setRemarcarCheckin(null)}
        />
      )}

      {modalExclusao && (
        <div className="modal-overlay" onClick={() => !modalExclusao.processando && setModalExclusao(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", maxWidth: 420, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <h3 style={{ margin: "0 0 6px", color: "#0f172a", fontSize: 17 }}>Excluir cadastro</h3>
            <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 14 }}>
              Paciente: <strong>{modalExclusao.paciente.nome}</strong>
            </p>

            {modalExclusao.etapa === "senha" && (
              <>
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>Confirme sua senha de administrador para prosseguir.</p>
                <input
                  type="password"
                  className="login-input-v2"
                  style={{ width: "100%", marginBottom: 16, boxSizing: "border-box" }}
                  placeholder="Senha do administrador"
                  value={modalExclusao.senha}
                  autoFocus
                  onChange={(e) => setModalExclusao((m) => ({ ...m, senha: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && confirmarSenhaExclusao()}
                  disabled={modalExclusao.processando}
                />
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setModalExclusao(null)} disabled={modalExclusao.processando}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={confirmarSenhaExclusao} disabled={modalExclusao.processando}>
                    {modalExclusao.processando ? "Verificando..." : "Confirmar"}
                  </button>
                </div>
              </>
            )}

            {modalExclusao.etapa === "motivo" && (
              <>
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>Informe o motivo da exclusão.</p>
                <input
                  type="text"
                  className="login-input-v2"
                  style={{ width: "100%", marginBottom: 16, boxSizing: "border-box" }}
                  placeholder="Motivo da exclusão"
                  value={modalExclusao.motivo}
                  autoFocus
                  onChange={(e) => setModalExclusao((m) => ({ ...m, motivo: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && confirmarExclusaoFinal()}
                  disabled={modalExclusao.processando}
                />
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setModalExclusao(null)} disabled={modalExclusao.processando}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={confirmarExclusaoFinal} disabled={modalExclusao.processando}
                    style={{ background: "var(--danger, #dc2626)", borderColor: "var(--danger, #dc2626)" }}>
                    {modalExclusao.processando ? "Excluindo..." : "Excluir definitivamente"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: agendamento em data futura ─────────────────────────────── */}
      {modalDataFutura && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: "28px 32px",
            maxWidth: 460, width: "90%", boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#b45309" }}>
                  Agendamento em data futura
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f" }}>
                  Esta consulta está marcada para <strong>{(() => {
                    const d = agendamento.data;
                    if (!d) return "data futura";
                    const [y, m, dia] = d.split("-");
                    return `${dia}/${m}/${y}`;
                  })()}</strong>. O paciente não deve ser enviado para a fila antes da data do atendimento.
                </p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#374151", marginBottom: 14 }}>
              Para antecipar o atendimento, informe o motivo. Isso será registrado no log de auditoria.
            </p>
            <textarea
              rows={3}
              placeholder="Motivo da antecipação (ex: paciente solicitou urgência, encaixe por indicação médica…)"
              value={modalDataFutura.motivo}
              onChange={(e) => setModalDataFutura((m) => ({ ...m, motivo: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", padding: "9px 12px",
                borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 13,
                resize: "vertical", minHeight: 72, outline: "none",
                fontFamily: "inherit",
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={() => setModalDataFutura(null)}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid #d1d5db",
                  background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!modalDataFutura.motivo.trim()) {
                    toast.warn("Informe o motivo da antecipação para continuar.");
                    return;
                  }
                  const motivo = modalDataFutura.motivo;
                  setModalDataFutura(null);
                  registrarAtendimento(motivo);
                }}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#b45309", color: "#fff",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                Confirmar antecipação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
