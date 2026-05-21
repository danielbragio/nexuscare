import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, FileText, FlaskConical, Pill } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { jsPDF } from "jspdf";
import { useCadastros } from "../context/CadastrosContext";
import { isFuturo, formatarData, calcularIdade, hojeISO } from "../utils/dateUtils";

function porExtenso(n) {
  const uns = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dez = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  if (!n || isNaN(n) || n < 1) return "";
  n = Math.floor(n);
  if (n < 20) return uns[n];
  if (n < 100) return dez[Math.floor(n / 10)] + (n % 10 ? " e " + uns[n % 10] : "");
  return String(n);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normStatus(status) {
  const t = (status || "").toLowerCase().trim();
  if (t === "finalizado" || t === "finalizada") return "finalizado";
  if (t === "em_atendimento" || t === "em atendimento") return "em_atendimento";
  if (t === "aguardando" || t === "aguardando atendimento") return "aguardando";
  if (t === "presente" || t === "chegou") return "presente";
  if (t === "confirmado" || t === "confirmada") return "confirmado";
  if (t === "cancelado" || t === "cancelada") return "cancelado";
  if (t === "faltou") return "faltou";
  if (t === "remarcado" || t === "remarcada") return "remarcado";
  return "agendado";
}



function normTipo(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("pronto") || t.includes("imediato")) return "Imediato";
  return "Agendado";
}

// ── Templates por especialidade ────────────────────────────────────────────────

const TEMPLATES = {
  "Cardiologia": {
    anamnese: "Queixa principal:\n\nDor precordial: ( ) Sim  ( ) Não\nDispneia: ( ) Sim  ( ) Não\nOrtopneia: ( ) Sim  ( ) Não\nEdema MMII: ( ) Sim  ( ) Não\nPalpitações: ( ) Sim  ( ) Não\nSíncope: ( ) Sim  ( ) Não\n\nHDA:\n",
    exameFisico: "Estado geral:\nPA: ___/___  mmHg\nFC: ___ bpm\nFR: ___ irpm\nTemp: ___°C  SpO2: ___%\n\nAuscultação cardíaca:\nAuscultação pulmonar:\nAbdômen:\nMMII:",
  },
  "Clínico Geral": {
    anamnese: "Queixa principal:\n\nHDA:\n\nHPP:\n\nMedicamentos em uso:\n\nAlergias:\n",
    exameFisico: "Estado geral: ( ) Bom  ( ) Regular  ( ) Grave\nPA: ___/___ mmHg  FC: ___ bpm\nTemp: ___°C  Peso: ___ kg\n\nApR:\nACV:\nAbdômen:",
  },
  "Pediatria": {
    anamnese: "Queixa principal:\n\nFebre: ( ) Sim  Dias: ___  Pico: ___°C\nTosse: ( ) Sim  ( ) Não\nCoriza: ( ) Sim  ( ) Não\nVômitos: ( ) Sim  ( ) Não\nDiarreia: ( ) Sim  ( ) Não\n\nAlimentação:\nVacinação em dia: ( ) Sim  ( ) Não",
    exameFisico: "Estado geral:\nPeso: ___ kg  Alt: ___ cm  PC: ___ cm\nTemp: ___°C  FC: ___ bpm  FR: ___ irpm  SpO2: ___%\n\nOrofaringe:\nOuvidos:\nApR:\nAbdômen:",
  },
  "Ginecologia": {
    anamnese: "Queixa principal:\n\nCiclo menstrual: ( ) Regular  ( ) Irregular\nDUM:\nG: ___  P: ___  A: ___\nMétodo contraceptivo:\nÚlt. Papanicolau:\nÚlt. Mamografia:\n\nHDA:",
    exameFisico: "Estado geral:\nPA: ___/___ mmHg  Peso: ___ kg\n\nMamas:\nAbdômen:\nExame pélvico:",
  },
  "Dermatologia": {
    anamnese: "Queixa principal:\n\nLocalização da lesão:\nAparência: ( ) Mácula  ( ) Pápula  ( ) Nódulo  ( ) Vesícula  ( ) Bolha  ( ) Pústula\nPrurido: ( ) Sim  ( ) Não\nTempo de evolução:\nFatores desencadeantes:\n\nAlergias cutâneas prévias:\n",
    exameFisico: "Localização:\nColoração:\nBordas:\nTamanho aproximado:\nDistribuição: ( ) Localizada  ( ) Disseminada  ( ) Simétrica",
  },
  "Ortopedia": {
    anamnese: "Queixa principal:\n\nLocalização da dor: \nCaráter: ( ) Contínuo  ( ) Intermitente\nIntensidade (0-10): ___\nTrauma: ( ) Sim  ( ) Não  Mecanismo:\nLimita atividades: ( ) Sim  ( ) Não\n\nHDA:",
    exameFisico: "Estado geral:\nInspeção:\nPalpação:\nAmplitude de movimento:\nForça muscular:\nTestes especiais:",
  },
};

const EXAMES_CATEGORIAS = {
  "Sangue": ["Hemograma completo", "Glicemia de jejum", "HbA1c", "Lipidograma", "TSH / T4 livre", "PCR", "VHS", "Coagulograma", "Função renal (Ureia/Creatinina)", "TGO / TGP", "Ácido úrico", "Vitamina D"],
  "Urina": ["EAS (Urina tipo I)", "Urinocultura", "Proteinúria 24h"],
  "Imagem": ["Raio-X de tórax", "Raio-X de coluna", "Ultrassom abdominal", "Ultrassom pélvico", "Ecocardiograma", "Eletrocardiograma (ECG)", "TC de tórax", "TC abdominal", "Ressonância magnética"],
  "Cardiológico": ["Teste ergométrico", "Holter 24h", "MAPA 24h"],
};

const MEDICAMENTOS_COMUNS = [
  "Dipirona 500mg", "Paracetamol 500mg", "Ibuprofeno 600mg", "Amoxicilina 500mg",
  "Azitromicina 500mg", "Omeprazol 20mg", "Metformina 500mg", "Atenolol 25mg",
  "Losartana 50mg", "Sinvastatina 20mg", "Loratadina 10mg", "Dexametasona 4mg",
];

const FORM_INICIAL = {
  statusAtendimento: "Em atendimento",
  // Sinais vitais
  pressaoSistolica: "", pressaoDiastolica: "",
  frequenciaCardiaca: "", frequenciaRespiratoria: "",
  temperatura: "", peso: "", altura: "", saturacaoO2: "",
  glicemia: "", escalaDor: "",
  // Clínico
  anamnese: "", exameFisico: "", hipoteseDiagnostica: "",
  cid: "", conduta: "", evolucao: "", observacoes: "", retorno: "",
  // Estruturados
  medicamentos: [], examesSolicitados: [],
  // Documentos
  receita: "", atestado: "", alergias: "",
  tipoAtestado: "atestado", diasAfastamento: "",
};

const MED_ID = () => Math.random().toString(36).slice(2, 9);

// ── Estilos inline ──────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.05)",
    padding: "20px",
  },
  pill: (ativo) => ({
    padding: "7px 16px",
    borderRadius: "999px",
    border: "none",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    background: ativo ? "#0f172a" : "transparent",
    color: ativo ? "#fff" : "#64748b",
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
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "13px",
    outline: "none",
    color: "#0f172a",
    boxSizing: "border-box",
    background: "#fafafa",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    fontSize: "13px",
    outline: "none",
    color: "#0f172a",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "100px",
    lineHeight: 1.6,
    fontFamily: "inherit",
    background: "#fafafa",
  },
  btnPrimary: {
    padding: "9px 20px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #0f172a, #1e40af)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "9px 18px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#475569",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
};

// ── Componente principal ────────────────────────────────────────────────────────

export default function Medicos({
  consultas = [],
  pacientes = [],
  consultaSelecionadaExterna,
  limparConsultaExterna,
  consultorioAtual,
  onIniciarAtendimento,
  onSalvarProntuario,
  onFinalizarAtendimento,
  onSolicitarOverride,
}) {
  const { userData } = useAuth();
  const toast = useToast();
  const { cids } = useCadastros();
  const [busca, setBusca] = useState("");
  const [abaLista, setAbaLista] = useState("todos");
  const [consultaSelecionada, setConsultaSelecionada] = useState(null);
  const [abaAtendimento, setAbaAtendimento] = useState("dados");
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [autoSalvo, setAutoSalvo] = useState(null);
  const [novaMed, setNovaMed] = useState({ nome: "", dose: "", via: "oral", frequencia: "", duracao: "" });
  const [novoExame, setNovoExame] = useState({ categoria: "Sangue", nome: "", urgencia: "Eletivo", observacao: "" });
  const autoSaveTimer = useRef(null);
  const [showModelosModal, setShowModelosModal] = useState(false);

  function pagamentoLiberado(consulta) {
    const statusPag = String(consulta.statusPagamento || "").toLowerCase();
    if (statusPag === "pago" || statusPag === "cortesia") return true;
    return !consulta.pagamentoId && !consulta.statusPagamento;
  }

  // Auto-save every 30s when consultation is open
  useEffect(() => {
    if (!consultaSelecionada || !onSalvarProntuario) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await onSalvarProntuario(consultaSelecionada.id, form);
        setAutoSalvo(new Date());
      } catch { /* auto-save silencioso */ }
    }, 30000);
    return () => clearTimeout(autoSaveTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onSalvarProntuario is a stable prop; adding it would restart the 30s timer on every parent render
  }, [form, consultaSelecionada]);

  useEffect(() => {
    if (consultaSelecionadaExterna) {
      abrirAtendimento(consultaSelecionadaExterna);
      if (limparConsultaExterna) limparConsultaExterna();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- abrirAtendimento and limparConsultaExterna are stable; adding them would re-register on every render
  }, [consultaSelecionadaExterna]);

  useEffect(() => {
    function handleEvento(e) {
      if (e.detail) abrirAtendimento(e.detail);
    }
    window.addEventListener("abrir-atendimento", handleEvento);
    return () => window.removeEventListener("abrir-atendimento", handleEvento);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- event listener intentionally registered once; abrirAtendimento uses refs internally
  }, []);

  const consultasAtivas = useMemo(() => {
    const role = userData?.role || "";
    const isAdmin = role === "admin" || (Array.isArray(userData?.permissions) && (userData.permissions.includes("administracao") || userData.permissions.includes("configuracoes")));
    const isRecepcao = role === "recepcao";
    const meuId = String(userData?.id || "");
    const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
    return [...consultas]
      .filter((c) => {
        const s = normStatus(c.status);
        if (s === "finalizado" || s === "cancelado" || s === "faltou") return false;
        const statusClinico = normStatus(c.status);
        const exigePagamento = ["confirmado", "aguardando", "presente"].includes(statusClinico);
        if (exigePagamento && !pagamentoLiberado(c)) return false;
        if (isAdmin || isRecepcao) return true;
        // Records with no assigned professional are general-queue entries visible to everyone
        const temProfissional = c.usuarioId != null || (c.medico || c.profissionalNome || "").trim();
        if (!temProfissional) return true;
        const mId = c.usuarioId != null
          ? String(c.usuarioId)
          : (c.profissionalId || "").trim();
        if (mId) return mId === meuId;
        return (c.medico || c.profissionalNome || "").toLowerCase().trim() === nome;
      })
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  }, [consultas, userData]);

  const consultasFiltradas = useMemo(() =>
    consultasAtivas.filter((c) =>
      (c.paciente || "").toLowerCase().includes(busca.toLowerCase())
    ), [consultasAtivas, busca]);

  const consultasAgendadas = useMemo(() =>
    consultasFiltradas.filter((c) => normTipo(c.tipoAtendimento) === "Agendado"),
    [consultasFiltradas]);

  const consultasImediatas = useMemo(() =>
    consultasFiltradas.filter((c) => normTipo(c.tipoAtendimento) === "Imediato"),
    [consultasFiltradas]);

  // Histórico do paciente (últimas 5 consultas finalizadas)
  const historicoPaciente = useMemo(() => {
    if (!consultaSelecionada) return [];
    const nome = (consultaSelecionada.paciente || "").toLowerCase();
    return consultas
      .filter((c) =>
        normStatus(c.status) === "finalizado" &&
        (c.paciente || "").toLowerCase() === nome &&
        c.id !== consultaSelecionada.id
      )
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .slice(0, 5);
  }, [consultas, consultaSelecionada]);

  // Dados do paciente cadastrado
  const dadosPaciente = useMemo(() => {
    if (!consultaSelecionada) return null;
    const nome = (consultaSelecionada.paciente || "").toLowerCase();
    return pacientes.find((p) => (p.nome || "").toLowerCase() === nome) || null;
  }, [pacientes, consultaSelecionada]);

  // Alertas clínicos do histórico
  const alertasClinicos = useMemo(() => {
    if (!historicoPaciente.length) return { cids: [], alergias: "", ultimaMed: "" };
    const cidsMap = {};
    let alergias = "";
    let ultimaMed = "";
    historicoPaciente.forEach((c) => {
      const p = c.prontuario || {};
      if (p.cid) {
        const cid = p.cid.trim().toUpperCase();
        cidsMap[cid] = (cidsMap[cid] || 0) + 1;
      }
      if (!alergias && p.alergias) alergias = p.alergias;
      if (!ultimaMed && p.receita) ultimaMed = p.receita.split("\n")[0];
    });
    const cids = Object.entries(cidsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cod, n]) => ({ cod, n }));
    return { cids, alergias, ultimaMed };
  }, [historicoPaciente]);

  // ── Dashboard: dados derivados ─────────────────────────────────────────────────

  const hoje = useMemo(() => hojeISO(), []);

  const emAtendimento = useMemo(
    () => consultasAtivas.filter((c) => normStatus(c.status) === "em_atendimento"),
    [consultasAtivas]
  );

  const consultasHoje = useMemo(
    () => consultas.filter((c) => c.data === hoje),
    [consultas, hoje]
  );

  const atendidosHoje = useMemo(
    () => consultasHoje.filter((c) => normStatus(c.status) === "finalizado"),
    [consultasHoje]
  );

  const aguardandoNaFila = useMemo(
    () => consultasAtivas.filter((c) => {
      const s = normStatus(c.status);
      return (s === "confirmado" || s === "aguardando" || s === "presente") && c.data === hoje;
    }),
    [consultasAtivas, hoje]
  );

  const consultasPorMes = useMemo(() => {
    const meses = {};
    consultas.forEach((c) => {
      if (!c.data) return;
      const key = c.data.substring(0, 7);
      meses[key] = (meses[key] || 0) + 1;
    });
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      return { key, label, count: meses[key] || 0 };
    });
  }, [consultas]);


  const proximasConsultas = useMemo(() => {
    const agora = hoje + "T" + new Date().toTimeString().slice(0, 5);
    return consultasAtivas
      .filter((c) => {
        if (normStatus(c.status) === "finalizado") return false;
        const dt = `${c.data || ""}T${c.hora || ""}`;
        return dt >= agora;
      })
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
      .slice(0, 8);
  }, [consultasAtivas, hoje]);

  async function abrirAtendimento(consulta) {
    const statusAtual = normStatus(consulta.status);
    if (["confirmado", "aguardando", "presente"].includes(statusAtual) && !pagamentoLiberado(consulta)) {
      toast.warn("Atendimento aguardando liberação em Pagamentos.");
      return;
    }
    if (statusAtual === "agendado" && !pagamentoLiberado(consulta)) {
      toast.warn("Confirme a chegada na Recepção/Agendamentos e conclua o pagamento antes de atender.");
      return;
    }

    if (normStatus(consulta.status) === "agendado" && isFuturo(consulta.data) && !consulta.antecipado_em) {
      if (!onSolicitarOverride) {
        toast.warn(`Atendimento agendado para ${formatarData(consulta.data)}. Solicite autorização antes de atender.`);
        return;
      }
      const { aprovado, resultado } = await onSolicitarOverride(consulta);
      if (!aprovado) return;
      const { acao, consultaAtualizada } = resultado;
      if (acao === "remarcar" && isFuturo(consultaAtualizada.data) && !consultaAtualizada.antecipado_em) {
        toast.success("Atendimento remarcado com sucesso.");
        return;
      }
      consulta = consultaAtualizada;
    }

    setConsultaSelecionada(consulta);
    setAbaAtendimento("dados");
    if (["agendado", "confirmado", "aguardando", "presente"].includes(normStatus(consulta.status)) && onIniciarAtendimento) {
      await onIniciarAtendimento(consulta.id);
    }
    const p = consulta.prontuario || {};
    setForm({
      statusAtendimento: p.statusAtendimento || "Em atendimento",
      pressaoSistolica: p.pressaoSistolica || "",
      pressaoDiastolica: p.pressaoDiastolica || "",
      frequenciaCardiaca: p.frequenciaCardiaca || "",
      frequenciaRespiratoria: p.frequenciaRespiratoria || "",
      temperatura: p.temperatura || "",
      peso: p.peso || "",
      altura: p.altura || "",
      saturacaoO2: p.saturacaoO2 || "",
      glicemia: p.glicemia || "",
      escalaDor: p.escalaDor || "",
      anamnese: p.anamnese || "",
      exameFisico: p.exameFisico || "",
      hipoteseDiagnostica: p.hipoteseDiagnostica || "",
      cid: p.cid || "",
      conduta: p.conduta || "",
      evolucao: p.evolucao || "",
      observacoes: p.observacoes || "",
      retorno: p.retorno || "",
      medicamentos: p.medicamentos || [],
      examesSolicitados: p.examesSolicitados || [],
      receita: p.receita || "",
      atestado: p.atestado || "",
      alergias: p.alergias || "",
      tipoAtestado: p.tipoAtestado || "atestado",
      diasAfastamento: p.diasAfastamento || "",
    });
  }

  function voltarParaLista() {
    setConsultaSelecionada(null);
    setAbaAtendimento("dados");
    clearTimeout(autoSaveTimer.current);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function aplicarTemplate() {
    const esp = consultaSelecionada?.especialidade || "";
    const tpl = TEMPLATES[esp] || TEMPLATES["Clínico Geral"];
    setForm((prev) => ({
      ...prev,
      anamnese: prev.anamnese || tpl.anamnese,
      exameFisico: prev.exameFisico || tpl.exameFisico,
    }));
    setAbaAtendimento("clinico");
  }

  function adicionarMedicamento() {
    if (!novaMed.nome) return;
    setForm((prev) => ({
      ...prev,
      medicamentos: [...prev.medicamentos, { ...novaMed, id: MED_ID() }],
    }));
    setNovaMed({ nome: "", dose: "", via: "oral", frequencia: "", duracao: "" });
    // Sync text receita
    setTimeout(() => gerarReceitaTexto(), 0);
  }

  function removerMedicamento(id) {
    setForm((prev) => ({
      ...prev,
      medicamentos: prev.medicamentos.filter((m) => m.id !== id),
    }));
  }

  function gerarReceitaTexto() {
    setForm((prev) => {
      const linhas = prev.medicamentos.map((m, i) =>
        `${i + 1}. ${m.nome}${m.dose ? " – " + m.dose : ""}${m.via ? " – " + m.via : ""}${m.frequencia ? "\n   " + m.frequencia : ""}${m.duracao ? " por " + m.duracao : ""}`
      );
      return { ...prev, receita: linhas.join("\n\n") };
    });
  }

  function toggleExame(cat, nome) {
    setForm((prev) => {
      const key = `${cat}::${nome}`;
      const existe = prev.examesSolicitados.some((e) => e.key === key);
      return {
        ...prev,
        examesSolicitados: existe
          ? prev.examesSolicitados.filter((e) => e.key !== key)
          : [...prev.examesSolicitados, { key, categoria: cat, nome, urgencia: "Eletivo", observacao: "" }],
      };
    });
  }

  function adicionarExameCustom() {
    if (!novoExame.nome) return;
    const key = `custom::${MED_ID()}`;
    setForm((prev) => ({
      ...prev,
      examesSolicitados: [...prev.examesSolicitados, { ...novoExame, key }],
    }));
    setNovoExame({ categoria: "Sangue", nome: "", urgencia: "Eletivo", observacao: "" });
  }

  // ── PDF helpers ──────────────────────────────────────────────────────────────

  function _cabecalhoPDF(doc) {
    const W = 210; const M = 20;
    const nomeMed = userData?.nome || userData?.name || "—";
    const crm     = userData?.crm  || "";
    const esp     = consultaSelecionada?.especialidade || userData?.especialidade || "";
    const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, W, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Vynor Clinic", M, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Dr(a). ${nomeMed}${crm ? " — CRM: " + crm : ""}${esp ? "  |  " + esp : ""}`, M, 22);
    doc.setFontSize(8);
    doc.setTextColor(180, 230, 220);
    doc.text(`Emitido em: ${dataHoje}`, M, 30);
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 285, W, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Vynor Clinic — Documento gerado automaticamente — Uso exclusivo médico", W / 2, 292, { align: "center" });
    return { W, M, CW: W - M * 2, nomeMed, crm, esp, dataHoje };
  }

  function gerarPDFReceita() {
    if (!form.medicamentos.length && !form.receita.trim()) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const { W, M, CW, nomeMed, crm, esp, dataHoje } = _cabecalhoPDF(doc);
    const nomePaciente = consultaSelecionada?.paciente || "—";

    // Título
    let y = 46;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RECEITA MÉDICA", W / 2, y, { align: "center" });
    y += 4;
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.8);
    doc.line(M + 30, y, W - M - 30, y);
    y += 10;

    // Paciente
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, 18, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("PACIENTE", M + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(nomePaciente, M + 6, y + 14);
    const dataConsulta = formatarData(consultaSelecionada?.data || "");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(dataConsulta, W - M - 6, y + 14, { align: "right" });
    y += 26;

    // Medicamentos
    if (form.medicamentos.length > 0) {
      form.medicamentos.forEach((m, i) => {
        if (y > 250) { doc.addPage(); _cabecalhoPDF(doc); y = 46; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`${i + 1}. ${m.nome}${m.dose ? " – " + m.dose : ""}`, M, y);
        y += 6;
        const detalhes = [m.via, m.frequencia, m.duracao].filter(Boolean).join("  ·  ");
        if (detalhes) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(71, 85, 105);
          doc.text(detalhes, M + 4, y);
          y += 5;
        }
        y += 5;
      });
    } else if (form.receita.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const linhas = doc.splitTextToSize(form.receita, CW);
      doc.text(linhas, M, y, { lineHeightFactor: 1.7 });
      y += linhas.length * 7;
    }

    // Assinatura
    const sigY = Math.max(y + 28, 230);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(W / 2 - 35, sigY, W / 2 + 35, sigY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dr(a). ${nomeMed}`, W / 2, sigY + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (crm) doc.text(`CRM: ${crm}`, W / 2, sigY + 12, { align: "center" });
    if (esp)  doc.text(esp, W / 2, sigY + 18, { align: "center" });
    doc.text(dataHoje, W / 2, sigY + (esp ? 26 : 22), { align: "center" });

    const slug = (nomePaciente).toLowerCase().replace(/\s+/g, "-");
    doc.save(`receita-${slug}-${hojeISO()}.pdf`);
  }

  function gerarPDFSolicitacaoExame() {
    if (!form.examesSolicitados.length) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const { W, M, CW, nomeMed, crm, esp } = _cabecalhoPDF(doc);
    const nomePaciente = consultaSelecionada?.paciente || "—";

    let y = 46;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SOLICITAÇÃO DE EXAMES", W / 2, y, { align: "center" });
    y += 4;
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.8);
    doc.line(M + 20, y, W - M - 20, y);
    y += 10;

    // Paciente
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, 18, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("PACIENTE", M + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(nomePaciente, M + 6, y + 14);
    const dataConsulta = formatarData(consultaSelecionada?.data || "");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(dataConsulta, W - M - 6, y + 14, { align: "right" });
    y += 28;

    const porCategoria = {};
    form.examesSolicitados.forEach((e) => {
      if (!porCategoria[e.categoria]) porCategoria[e.categoria] = [];
      porCategoria[e.categoria].push(e);
    });

    Object.entries(porCategoria).forEach(([cat, exames]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(cat.toUpperCase(), M, y);
      y += 6;
      exames.forEach((e) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`• ${e.nome}${e.urgencia && e.urgencia !== "Eletivo" ? "  [" + e.urgencia + "]" : ""}`, M + 4, y);
        y += 6;
      });
      y += 4;
    });

    const sigY = Math.max(y + 20, 220);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(W / 2 - 35, sigY, W / 2 + 35, sigY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dr(a). ${nomeMed}`, W / 2, sigY + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (crm) doc.text(`CRM: ${crm}`, W / 2, sigY + 12, { align: "center" });
    if (esp)  doc.text(esp, W / 2, sigY + 18, { align: "center" });

    const slug = nomePaciente.toLowerCase().replace(/\s+/g, "-");
    doc.save(`solicitacao-exames-${slug}-${hojeISO()}.pdf`);
  }

  function gerarModeloEmBranco(tipo) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210; const M = 20; const CW = W - M * 2;
    const nomeMed  = userData?.nome || userData?.name || "_________________________";
    const crm      = userData?.crm  || "";
    const esp      = userData?.especialidade || "";
    const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

    // Cabeçalho
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, W, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Vynor Clinic", M, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Dr(a). ${nomeMed}${crm ? " — CRM: " + crm : ""}${esp ? "  |  " + esp : ""}`, M, 22);
    doc.setFontSize(8);
    doc.setTextColor(180, 230, 220);
    doc.text(`Emitido em: ${dataHoje}`, M, 30);
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 285, W, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("Vynor Clinic — Documento gerado automaticamente — Uso exclusivo médico", W / 2, 292, { align: "center" });

    const titulos = {
      receita:     "RECEITA MÉDICA",
      atestado:    "ATESTADO MÉDICO",
      solicitacao: "SOLICITAÇÃO DE EXAMES",
    };
    const titulo = titulos[tipo] || "DOCUMENTO MÉDICO";

    let y = 46;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, W / 2, y, { align: "center" });
    y += 4;
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.8);
    doc.line(M + 25, y, W - M - 25, y);
    y += 12;

    // Box paciente em branco
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, 22, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("PACIENTE", M + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Nome: __________________________________________________________________", M + 6, y + 14);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Data: ${dataHoje}`, W - M - 6, y + 19, { align: "right" });
    y += 32;

    // Linhas em branco
    const nLinhas = tipo === "receita" ? 14 : tipo === "solicitacao" ? 16 : 12;
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.2);
    for (let i = 0; i < nLinhas; i++) {
      doc.line(M, y + i * 10, W - M, y + i * 10);
    }
    y += nLinhas * 10 + 10;

    // Assinatura
    const sigY = Math.max(y + 10, 230);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(W / 2 - 35, sigY, W / 2 + 35, sigY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dr(a). ${nomeMed}`, W / 2, sigY + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (crm) doc.text(`CRM: ${crm}`, W / 2, sigY + 12, { align: "center" });
    if (esp)  doc.text(esp, W / 2, sigY + 18, { align: "center" });
    doc.text(dataHoje, W / 2, sigY + (esp ? 26 : 22), { align: "center" });

    doc.save(`modelo-${tipo}-em-branco-${hojeISO()}.pdf`);
    setShowModelosModal(false);
  }

  function gerarAtestadoModelo() {
    if (!consultaSelecionada) return;
    const pac  = consultaSelecionada.paciente || "—";
    const data = formatarData(consultaSelecionada.data || "");
    const hora = consultaSelecionada.hora || "";

    setForm((prev) => {
      const dias = prev.diasAfastamento ? parseInt(prev.diasAfastamento) : null;
      const diasTexto = dias
        ? `${dias} (${porExtenso(dias)}) ${dias === 1 ? "dia" : "dias"}`
        : "_____ (_____) dias";

      let texto = "";
      const tipo = prev.tipoAtestado || "atestado";

      if (tipo === "comparecimento") {
        texto = `Declaro para os devidos fins que o(a) Sr(a). ${pac} compareceu a esta unidade de saúde na data de ${data}${hora ? ` às ${hora}` : ""}, em consulta médica, pelo período de aproximadamente _____ horas.`;
      } else if (tipo === "laudo") {
        texto = `Atesto para os devidos fins que o(a) Sr(a). ${pac}, foi submetido(a) a avaliação clínica nesta data, apresentando as seguintes condições de saúde:\n\n_________________________________________________________\n\nConclusão: ________________________________________________`;
      } else {
        texto = `Atesto para os devidos fins que o(a) Sr(a). ${pac} foi atendido(a) nesta data, necessitando de afastamento de suas atividades por ${diasTexto}, a contar de ${data}.`;
      }

      return { ...prev, atestado: texto };
    });

    setAbaAtendimento("documentos");
  }

  async function salvarProntuario() {
    if (!consultaSelecionada || !onSalvarProntuario) return;
    try {
      setSalvando(true);
      await onSalvarProntuario(consultaSelecionada.id, form);
      setAutoSalvo(new Date());
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar o prontuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function finalizarAtendimento() {
    if (!consultaSelecionada || !onFinalizarAtendimento) return;
    if (!await toast.confirm(`Finalizar atendimento de ${consultaSelecionada.paciente}?`)) return;
    try {
      setSalvando(true);
      await onFinalizarAtendimento(consultaSelecionada.id, { ...form, statusAtendimento: "Finalizado" });
      voltarParaLista();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível finalizar o atendimento.");
    } finally {
      setSalvando(false);
    }
  }

  function dadosAtestado() {
    const nomePaciente = consultaSelecionada?.paciente || dadosPaciente?.nome || "—";
    const cpf          = dadosPaciente?.cpf || "";
    const nomeMedico   = userData?.nome || userData?.name || "—";
    const crm          = userData?.crm || "";
    const especialidade = consultaSelecionada?.especialidade || userData?.especialidade || "";
    const dataConsulta = formatarData(consultaSelecionada?.data || "");
    const horaConsulta = consultaSelecionada?.hora || "";
    const tipo         = form.tipoAtestado || "atestado";
    const titulo       = { atestado: "ATESTADO MÉDICO", comparecimento: "DECLARAÇÃO DE COMPARECIMENTO", laudo: "LAUDO MÉDICO" }[tipo] || "ATESTADO MÉDICO";
    const texto        = form.atestado || "";
    const dias         = form.diasAfastamento || "";
    const cid          = form.cid || "";
    const dataHoje     = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    return { nomePaciente, cpf, nomeMedico, crm, especialidade, dataConsulta, horaConsulta, tipo, titulo, texto, dias, cid, dataHoje };
  }

  function gerarPDFAtestado() {
    const { nomePaciente, cpf, nomeMedico, crm, especialidade, dataConsulta, horaConsulta, titulo, texto, dias, cid, dataHoje } = dadosAtestado();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210; const H = 297; const M = 20; const CW = W - M * 2;

    // ── Cabeçalho ──
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, W, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Vynor Clinic", M, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const sub = `Dr(a). ${nomeMedico}${crm ? " — CRM: " + crm : ""}${especialidade ? "  |  " + especialidade : ""}`;
    doc.text(sub, M, 22);
    doc.setFontSize(8);
    doc.setTextColor(180, 230, 220);
    doc.text(`Emitido em: ${dataHoje}`, M, 30);

    // ── Título ──
    let y = 48;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, W / 2, y, { align: "center" });
    y += 4;
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.8);
    doc.line(M + 25, y, W - M - 25, y);
    y += 10;

    // ── Dados do paciente ──
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, cpf || cid ? 26 : 18, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("IDENTIFICAÇÃO DO PACIENTE", M + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Paciente: ${nomePaciente}`, M + 6, y + 13);
    if (cpf) { doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text(`CPF: ${cpf}`, M + 6, y + 20); }
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const dtStr = `Data: ${dataConsulta}${horaConsulta ? " às " + horaConsulta : ""}`;
    doc.text(dtStr, W - M - 6, y + 13, { align: "right" });
    if (cid) doc.text(`CID-10: ${cid}`, W - M - 6, y + 20, { align: "right" });
    y += (cpf || cid ? 26 : 18) + 10;

    // ── Corpo ──
    if (texto) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const linhas = doc.splitTextToSize(texto, CW);
      doc.text(linhas, M, y, { lineHeightFactor: 1.7 });
      y += linhas.length * 7 + 8;
    }

    // ── Dias de afastamento ──
    if (dias && form.tipoAtestado !== "comparecimento") {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(134, 239, 172);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, y, CW, 14, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(22, 101, 52);
      const ext = porExtenso(parseInt(dias));
      doc.text(`Período de afastamento: ${dias} (${ext}) dia(s) a partir da presente data.`, M + 6, y + 9);
      y += 22;
    }

    // ── Assinatura ──
    const sigY = Math.max(y + 30, H - 58);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    const sx = W / 2 - 35;
    doc.line(sx, sigY, sx + 70, sigY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dr(a). ${nomeMedico}`, W / 2, sigY + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (crm) { doc.text(`CRM: ${crm}`, W / 2, sigY + 12, { align: "center" }); }
    if (especialidade) { doc.text(especialidade, W / 2, sigY + 18, { align: "center" }); }
    doc.setFontSize(8.5);
    doc.text(dataHoje, W / 2, sigY + (especialidade ? 26 : 22), { align: "center" });

    // ── Rodapé ──
    doc.setFillColor(15, 118, 110);
    doc.rect(0, H - 12, W, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Vynor Clinic — Documento gerado automaticamente — Uso exclusivo médico", W / 2, H - 5, { align: "center" });

    const slug = (consultaSelecionada?.paciente || "paciente").toLowerCase().replace(/\s+/g, "-");
    doc.save(`${form.tipoAtestado || "atestado"}-${slug}-${hojeISO()}.pdf`);
  }

  function imprimirAtestado() {
    const { nomePaciente, cpf, nomeMedico, crm, especialidade, dataConsulta, horaConsulta, titulo, texto, dias, cid, dataHoje } = dadosAtestado();
    const ext = dias ? porExtenso(parseInt(dias)) : "";
    const janela = window.open("", "_blank", "width=820,height=1000");
    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8"><title>${titulo}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Georgia,serif;background:#fff;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;margin:0 auto;display:flex;flex-direction:column}
.header{background:#0f766e;color:#fff;padding:16px 24px 14px}
.header h1{font-size:18px;font-weight:bold;letter-spacing:.5px}
.header p{font-size:10.5px;opacity:.85;margin-top:5px}
.header small{font-size:9px;opacity:.65;display:block;margin-top:3px}
.body{padding:24px 28px;flex:1}
.title-wrap{text-align:center;margin-bottom:22px}
.title-wrap h2{font-size:15px;letter-spacing:3px;font-weight:bold;text-transform:uppercase}
.title-wrap hr{border:none;border-top:2.5px solid #0f766e;width:55%;margin:9px auto 0}
.patient-box{border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin-bottom:22px;background:#f8fafc;display:flex;justify-content:space-between;gap:16px}
.patient-box .left{}
.patient-box .right{text-align:right}
.lbl{font-size:9px;color:#94a3b8;font-weight:bold;text-transform:uppercase;display:block;margin-bottom:2px}
.pname{font-size:13px;font-weight:bold}
.pinfo{font-size:10.5px;color:#475569;margin-top:3px}
.cid-tag{font-size:10px;color:#dc2626;font-weight:bold}
.text-body{font-size:12.5px;line-height:2;text-align:justify;margin-bottom:18px;white-space:pre-wrap}
.days-box{border:1px solid #86efac;border-radius:6px;padding:10px 16px;margin-bottom:20px;background:#f0fdf4;color:#166534;font-size:12px;font-weight:bold}
.sig{margin-top:48px;text-align:center}
.sig-line{border-top:1px solid #94a3b8;width:200px;margin:0 auto 10px}
.sig-name{font-size:13px;font-weight:bold}
.sig-info{font-size:10.5px;color:#64748b;margin-top:3px}
.sig-date{font-size:10px;color:#94a3b8;margin-top:12px}
.footer{background:#0f766e;color:#fff;text-align:center;font-size:8px;padding:7px;margin-top:auto}
@media print{
  @page{size:A4;margin:0}
  body{margin:0}
  .page{page-break-after:always}
}
</style></head><body><div class="page">
<div class="header">
  <h1>Vynor Clinic</h1>
  <p>Dr(a). ${nomeMedico}${crm ? " &mdash; CRM: " + crm : ""}${especialidade ? " &nbsp;|&nbsp; " + especialidade : ""}</p>
  <small>Emitido em: ${dataHoje}</small>
</div>
<div class="body">
  <div class="title-wrap"><h2>${titulo}</h2><hr></div>
  <div class="patient-box">
    <div class="left">
      <span class="lbl">Paciente</span>
      <div class="pname">${nomePaciente}</div>
      ${cpf ? `<div class="pinfo">CPF: ${cpf}</div>` : ""}
    </div>
    <div class="right">
      <span class="lbl">Data do atendimento</span>
      <div class="pinfo">${dataConsulta}${horaConsulta ? " às " + horaConsulta : ""}</div>
      ${cid ? `<div class="cid-tag">CID-10: ${cid}</div>` : ""}
    </div>
  </div>
  <div class="text-body">${texto || ""}</div>
  ${dias && form.tipoAtestado !== "comparecimento"
    ? `<div class="days-box">&#128337; Período de afastamento: ${dias} (${ext}) dia(s) a partir da presente data.</div>` : ""}
  <div class="sig">
    <div class="sig-line"></div>
    <div class="sig-name">Dr(a). ${nomeMedico}</div>
    ${crm ? `<div class="sig-info">CRM: ${crm}</div>` : ""}
    ${especialidade ? `<div class="sig-info">${especialidade}</div>` : ""}
    <div class="sig-date">${dataHoje}</div>
  </div>
</div>
<div class="footer">Vynor Clinic &mdash; Documento gerado automaticamente &mdash; Uso exclusivo médico</div>
</div><script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`);
    janela.document.close();
  }

  async function finalizarDireto(consulta) {
    if (!onFinalizarAtendimento) return;
    if (!await toast.confirm(`Finalizar atendimento de ${consulta.paciente}?`)) return;
    try {
      await onFinalizarAtendimento(consulta.id, {
        ...(consulta.prontuario || {}),
        statusAtendimento: "Finalizado",
      });
    } catch {
      toast.error("Não foi possível finalizar o atendimento.");
    }
  }

  // ── RENDER: Atendimento aberto ────────────────────────────────────────────────

  if (consultaSelecionada) {
    const abas = [
      { key: "dados", label: "Dados" },
      { key: "vitais", label: "Sinais Vitais" },
      { key: "clinico", label: "Clínico" },
      { key: "exames", label: "Exames" },
      { key: "prescricao", label: "Prescrição" },
      { key: "documentos", label: "Documentos" },
    ];

    const idade = dadosPaciente?.dataNascimento ? calcularIdade(dadosPaciente.dataNascimento) : null;
    const esp = consultaSelecionada.especialidade || "";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <button onClick={voltarParaLista} style={{
            padding: "8px 14px", borderRadius: "10px",
            border: "1px solid #e2e8f0", background: "#fff",
            color: "#475569", fontWeight: 700, cursor: "pointer", fontSize: "16px",
          }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
              {consultaSelecionada.paciente}
            </h1>
            <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
              {idade !== null && (
                <span style={{ fontSize: "12px", color: "#64748b" }}>🎂 {idade} anos</span>
              )}
              {esp && <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: 600 }}>🏥 {esp}</span>}
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                📅 {formatarData(consultaSelecionada.data)} às {consultaSelecionada.hora || "—"}
              </span>
              {consultaSelecionada.medico && (
                <span style={{ fontSize: "12px", color: "#64748b" }}>👨‍⚕️ {consultaSelecionada.medico}</span>
              )}
            </div>
          </div>

          {/* Alertas clínicos rápidos */}
          {alertasClinicos.cids.length > 0 && (
            <div style={{
              display: "flex", gap: "6px", flexWrap: "wrap",
              padding: "8px 12px", borderRadius: "10px",
              background: "#fffbeb", border: "1px solid #fde68a",
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706" }}>HISTÓRICO DE CIDs:</span>
              {alertasClinicos.cids.map((c) => (
                <span key={c.cod} style={{
                  padding: "2px 8px", borderRadius: "999px",
                  background: "#fef9c3", border: "1px solid #fde68a",
                  fontSize: "11px", fontWeight: 700, color: "#92400e",
                }}>
                  {c.cod} ({c.n}×)
                </span>
              ))}
            </div>
          )}

          {alertasClinicos.alergias && (
            <div style={{
              padding: "8px 12px", borderRadius: "10px",
              background: "#fef2f2", border: "1px solid #fecaca",
              fontSize: "12px", fontWeight: 700, color: "#dc2626",
            }}>
              ⚠ ALERGIA: {alertasClinicos.alergias}
            </div>
          )}

          {autoSalvo && (
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              ✓ Salvo {autoSalvo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "16px", alignItems: "start" }}>

          {/* Coluna principal */}
          <div style={S.card}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "2px", marginBottom: "20px", background: "#f8fafc", padding: "5px", borderRadius: "12px", overflowX: "auto" }}>
              {abas.map((a) => (
                <button key={a.key} onClick={() => setAbaAtendimento(a.key)} style={S.pill(abaAtendimento === a.key)}>
                  {a.label}
                </button>
              ))}
            </div>

            {/* ABA DADOS */}
            {abaAtendimento === "dados" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {[
                    ["Paciente", consultaSelecionada.paciente],
                    ["CPF", consultaSelecionada.cpf || "—"],
                    ["Telefone", consultaSelecionada.telefone || "—"],
                    ["Convênio", dadosPaciente?.convenio || consultaSelecionada.convenio || "Particular"],
                    ["Especialidade", esp || "—"],
                    ["Tipo", normTipo(consultaSelecionada.tipoAtendimento)],
                    ["Data", formatarData(consultaSelecionada.data)],
                    ["Hora", consultaSelecionada.hora || "—"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <span style={S.label}>{l}</span>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", padding: "8px 10px", background: "#f8fafc", borderRadius: "8px" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <span style={S.label}>Observações da recepção</span>
                  <div style={{ fontSize: "13px", color: "#475569", padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", lineHeight: 1.6 }}>
                    {consultaSelecionada.observacoesRecepcao || "Sem observações registradas."}
                  </div>
                </div>
                {(esp in TEMPLATES || "Clínico Geral" in TEMPLATES) && (
                  <button onClick={aplicarTemplate} style={{ ...S.btnSecondary, marginTop: "16px", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <ClipboardList size={13} /> Aplicar template de {esp || "Clínico Geral"}
                  </button>
                )}
              </div>
            )}

            {/* ABA SINAIS VITAIS */}
            {abaAtendimento === "vitais" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={S.label}>Pressão Arterial</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input style={{ ...S.input, width: "60px" }} name="pressaoSistolica" value={form.pressaoSistolica} onChange={handleChange} placeholder="120" />
                      <span style={{ color: "#94a3b8", fontWeight: 700 }}>/</span>
                      <input style={{ ...S.input, width: "60px" }} name="pressaoDiastolica" value={form.pressaoDiastolica} onChange={handleChange} placeholder="80" />
                      <span style={{ color: "#64748b", fontSize: "12px" }}>mmHg</span>
                    </div>
                  </div>
                  {[
                    ["frequenciaCardiaca", "FC", "bpm", "75"],
                    ["frequenciaRespiratoria", "FR", "irpm", "16"],
                    ["temperatura", "Temperatura", "°C", "36.5"],
                    ["saturacaoO2", "SpO2", "%", "98"],
                    ["peso", "Peso", "kg", "70"],
                    ["altura", "Altura", "cm", "170"],
                    ["glicemia", "Glicemia", "mg/dL", "100"],
                    ["escalaDor", "Dor (0–10)", "/10", "0"],
                  ].map(([name, label, unit, ph]) => (
                    <div key={name}>
                      <span style={S.label}>{label}</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input style={{ ...S.input, flex: 1 }} name={name} value={form[name]} onChange={handleChange} placeholder={ph} type="number" min="0" step={name === "temperatura" ? "0.1" : "1"} />
                        <span style={{ color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}>{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <span style={S.label}>Alergias conhecidas</span>
                  <input style={S.input} name="alergias" value={form.alergias} onChange={handleChange} placeholder="Ex: Dipirona, Penicilina..." />
                </div>
              </div>
            )}

            {/* ABA CLÍNICO */}
            {abaAtendimento === "clinico" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  ["anamnese", "Anamnese / História Clínica", 6],
                  ["exameFisico", "Exame Físico", 5],
                  ["hipoteseDiagnostica", "Hipótese Diagnóstica", 3],
                  ["conduta", "Conduta / Plano terapêutico", 4],
                  ["evolucao", "Evolução", 3],
                  ["observacoes", "Observações adicionais", 2],
                ].map(([name, label, rows]) => (
                  <div key={name}>
                    <span style={S.label}>{label}</span>
                    <textarea style={{ ...S.textarea, minHeight: `${rows * 22}px` }} name={name} value={form[name]} onChange={handleChange} />
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={S.label}>CID-10</span>
                    <input style={S.input} name="cid" value={form.cid} onChange={handleChange} placeholder="Ex: J06.9" list="nexus-cids" autoComplete="off" />
                    <datalist id="nexus-cids">
                      {cids.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} – {c.descricao}</option>)}
                    </datalist>
                  </div>
                  <div>
                    <span style={S.label}>Retorno</span>
                    <input style={S.input} name="retorno" value={form.retorno} onChange={handleChange} placeholder="Ex: 30 dias, se necessário..." />
                  </div>
                </div>
              </div>
            )}

            {/* ABA EXAMES */}
            {abaAtendimento === "exames" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {form.examesSolicitados.length > 0 && (
                  <div style={{ padding: "12px 16px", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803d" }}>
                        ✓ {form.examesSolicitados.length} exame(s) selecionado(s)
                      </div>
                      <button onClick={gerarPDFSolicitacaoExame} style={{ ...S.btnPrimary, fontSize: "11px", padding: "5px 10px" }}>
                        ⬇ PDF Solicitação
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {form.examesSolicitados.map((e) => (
                        <span key={e.key} style={{ padding: "3px 10px", borderRadius: "999px", background: "#dcfce7", border: "1px solid #86efac", fontSize: "12px", fontWeight: 600, color: "#15803d", display: "flex", alignItems: "center", gap: "4px" }}>
                          {e.nome}
                          <button onClick={() => setForm((p) => ({ ...p, examesSolicitados: p.examesSolicitados.filter((x) => x.key !== e.key) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d", padding: 0, fontSize: "14px" }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Object.entries(EXAMES_CATEGORIAS).map(([cat, itens]) => (
                  <div key={cat}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>{cat}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {itens.map((nome) => {
                        const sel = form.examesSolicitados.some((e) => e.key === `${cat}::${nome}`);
                        return (
                          <button key={nome} onClick={() => toggleExame(cat, nome)} style={{
                            padding: "5px 12px", borderRadius: "999px",
                            border: `1px solid ${sel ? "#6366f1" : "#e2e8f0"}`,
                            background: sel ? "#eef2ff" : "#fff",
                            color: sel ? "#6366f1" : "#475569",
                            fontWeight: sel ? 700 : 500,
                            fontSize: "12px", cursor: "pointer",
                          }}>{nome}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Exame personalizado</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input style={{ ...S.input, flex: 1 }} placeholder="Nome do exame" value={novoExame.nome} onChange={(e) => setNovoExame((p) => ({ ...p, nome: e.target.value }))} />
                    <button onClick={adicionarExameCustom} style={S.btnPrimary}>+ Adicionar</button>
                  </div>
                </div>
              </div>
            )}

            {/* ABA PRESCRIÇÃO */}
            {abaAtendimento === "prescricao" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {form.medicamentos.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {form.medicamentos.map((m, i) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontWeight: 700, color: "#6366f1", fontSize: "12px", minWidth: "20px" }}>{i + 1}.</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{m.nome}</div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {[m.dose, m.via, m.frequencia, m.duracao].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <button onClick={() => removerMedicamento(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "16px", padding: "4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "12px" }}>Adicionar medicamento</div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                    <div>
                      <span style={S.label}>Medicamento</span>
                      <input style={S.input} list="meds-list" value={novaMed.nome} onChange={(e) => setNovaMed((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome ou pesquise..." />
                      <datalist id="meds-list">
                        {MEDICAMENTOS_COMUNS.map((m) => <option key={m} value={m} />)}
                      </datalist>
                    </div>
                    <div>
                      <span style={S.label}>Dose</span>
                      <input style={S.input} value={novaMed.dose} onChange={(e) => setNovaMed((p) => ({ ...p, dose: e.target.value }))} placeholder="Ex: 500mg" />
                    </div>
                    <div>
                      <span style={S.label}>Via</span>
                      <select style={S.input} value={novaMed.via} onChange={(e) => setNovaMed((p) => ({ ...p, via: e.target.value }))}>
                        {["oral", "sublingual", "intravenosa", "intramuscular", "tópica", "inalatória", "retal"].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px", marginBottom: "12px" }}>
                    <div>
                      <span style={S.label}>Posologia</span>
                      <input style={S.input} value={novaMed.frequencia} onChange={(e) => setNovaMed((p) => ({ ...p, frequencia: e.target.value }))} placeholder="Ex: 1 comprimido de 8/8h" />
                    </div>
                    <div>
                      <span style={S.label}>Duração</span>
                      <input style={S.input} value={novaMed.duracao} onChange={(e) => setNovaMed((p) => ({ ...p, duracao: e.target.value }))} placeholder="Ex: 7 dias" />
                    </div>
                  </div>
                  <button onClick={adicionarMedicamento} style={S.btnPrimary}>+ Adicionar à prescrição</button>
                </div>

                {form.medicamentos.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={gerarReceitaTexto} style={{ ...S.btnSecondary, fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <FileText size={13} /> Gerar texto da receita
                    </button>
                    <button onClick={gerarPDFReceita} style={{ ...S.btnPrimary, fontSize: "12px" }}>
                      ⬇ Baixar PDF da receita
                    </button>
                  </div>
                )}

                <div>
                  <span style={S.label}>Texto livre da receita</span>
                  <textarea style={{ ...S.textarea, minHeight: "120px" }} name="receita" value={form.receita} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* ABA DOCUMENTOS */}
            {abaAtendimento === "documentos" && (() => {
              const { nomePaciente, cpf, nomeMedico, crm, especialidade, dataConsulta, horaConsulta, titulo, dataHoje } = dadosAtestado();
              const ext = form.diasAfastamento ? porExtenso(parseInt(form.diasAfastamento)) : "";
              const TIPOS = [
                { key: "atestado",      label: "Atestado Médico" },
                { key: "comparecimento", label: "Comparecimento" },
                { key: "laudo",          label: "Laudo Médico" },
              ];
              return (
                <div style={{ display: "flex", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }}>

                  {/* ── Editor ── */}
                  <div style={{ flex: "0 0 270px", minWidth: "220px", display: "flex", flexDirection: "column", gap: "12px" }}>

                    {/* Tipo de documento */}
                    <div>
                      <span style={S.label}>Tipo de documento</span>
                      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        {TIPOS.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setForm((p) => ({ ...p, tipoAtestado: t.key }))}
                            style={{
                              padding: "5px 11px", borderRadius: "8px", border: "none",
                              background: form.tipoAtestado === t.key ? "#0f172a" : "#f1f5f9",
                              color: form.tipoAtestado === t.key ? "#fff" : "#64748b",
                              fontSize: "11px", fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dias de afastamento */}
                    {form.tipoAtestado !== "comparecimento" && (
                      <div>
                        <span style={S.label}>Dias de afastamento</span>
                        <input
                          style={S.input}
                          type="number"
                          name="diasAfastamento"
                          value={form.diasAfastamento}
                          onChange={handleChange}
                          placeholder="Ex: 3"
                          min="1"
                          max="365"
                        />
                      </div>
                    )}

                    {/* CID */}
                    <div>
                      <span style={S.label}>CID-10 (opcional)</span>
                      <input style={S.input} name="cid" value={form.cid} onChange={handleChange} placeholder="Ex: J06.9" list="nexus-cids" autoComplete="off" />
                    </div>

                    {/* Texto */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={S.label}>Texto do documento</span>
                        <button onClick={gerarAtestadoModelo} style={{ ...S.btnSecondary, fontSize: "10px", padding: "3px 9px" }}>
                          Gerar modelo
                        </button>
                      </div>
                      <textarea
                        style={{ ...S.textarea, minHeight: "130px" }}
                        name="atestado"
                        value={form.atestado}
                        onChange={handleChange}
                        placeholder="Texto personalizado do documento..."
                      />
                    </div>

                    {/* Botões de ação */}
                    <div style={{ display: "flex", gap: "7px" }}>
                      <button
                        onClick={gerarPDFAtestado}
                        style={{ ...S.btnPrimary, flex: 1, textAlign: "center", fontSize: "12px" }}
                      >
                        ⬇ Baixar PDF
                      </button>
                      <button
                        onClick={imprimirAtestado}
                        style={{ ...S.btnSecondary, flex: 1, textAlign: "center", fontSize: "12px" }}
                      >
                        🖨 Imprimir
                      </button>
                    </div>

                    {/* Status do atendimento */}
                    <div>
                      <span style={S.label}>Status do atendimento</span>
                      <select style={S.input} name="statusAtendimento" value={form.statusAtendimento} onChange={handleChange}>
                        <option value="Em atendimento">Em atendimento</option>
                        <option value="Em observação">Em observação</option>
                        <option value="Encaminhado">Encaminhado</option>
                        <option value="Alta">Alta</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Pré-visualização ── */}
                  <div style={{ flex: 1, minWidth: "280px" }}>
                    <span style={S.label}>Pré-visualização</span>
                    <div style={{
                      background: "#f1f5f9",
                      borderRadius: "10px",
                      padding: "10px",
                      maxHeight: "600px",
                      overflowY: "auto",
                    }}>
                      {/* Documento simulado */}
                      <div style={{
                        background: "#fff",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.13)",
                        fontFamily: "'Georgia', 'Times New Roman', serif",
                        fontSize: "11px",
                        color: "#0f172a",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}>
                        {/* Cabeçalho */}
                        <div style={{ background: "#0f766e", color: "#fff", padding: "13px 18px 11px" }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: ".3px" }}>
                            Vynor Clinic
                          </div>
                          <div style={{ fontSize: "9.5px", opacity: .82, marginTop: "4px" }}>
                            Dr(a). {nomeMedico}{crm ? ` — CRM: ${crm}` : ""}{especialidade ? `  |  ${especialidade}` : ""}
                          </div>
                          <div style={{ fontSize: "8.5px", opacity: .62, marginTop: "3px" }}>
                            Emitido em: {dataHoje}
                          </div>
                        </div>

                        <div style={{ padding: "18px 20px" }}>
                          {/* Título */}
                          <div style={{ textAlign: "center", marginBottom: "16px" }}>
                            <div style={{ fontSize: "12.5px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>
                              {titulo}
                            </div>
                            <div style={{ height: "2px", background: "#0f766e", width: "50%", margin: "7px auto 0", borderRadius: "1px" }} />
                          </div>

                          {/* Dados do paciente */}
                          <div style={{
                            border: "1px solid #e2e8f0", borderRadius: "6px",
                            padding: "10px 13px", marginBottom: "14px",
                            background: "#f8fafc",
                            display: "flex", justifyContent: "space-between", gap: "10px",
                          }}>
                            <div>
                              <div style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Paciente</div>
                              <div style={{ fontSize: "11px", fontWeight: 700 }}>{nomePaciente}</div>
                              {cpf && <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>CPF: {cpf}</div>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Atendimento</div>
                              <div style={{ fontSize: "9.5px" }}>{dataConsulta}{horaConsulta ? ` às ${horaConsulta}` : ""}</div>
                              {form.cid && <div style={{ fontSize: "9px", color: "#dc2626", fontWeight: 600, marginTop: "2px" }}>CID-10: {form.cid}</div>}
                            </div>
                          </div>

                          {/* Corpo do texto */}
                          <div style={{ fontSize: "10.5px", lineHeight: 1.95, textAlign: "justify", marginBottom: "12px", whiteSpace: "pre-wrap", minHeight: "60px", color: form.atestado ? "#0f172a" : "#94a3b8", fontStyle: form.atestado ? "normal" : "italic" }}>
                            {form.atestado || "O texto do documento aparecerá aqui conforme você digita..."}
                          </div>

                          {/* Box de afastamento */}
                          {form.diasAfastamento && form.tipoAtestado !== "comparecimento" && (
                            <div style={{
                              border: "1px solid #86efac", borderRadius: "5px",
                              padding: "8px 12px", marginBottom: "14px",
                              background: "#f0fdf4", color: "#166534",
                              fontSize: "10px", fontWeight: 700,
                            }}>
                              ⏱ Afastamento: {form.diasAfastamento} ({ext}) dia(s) a partir da presente data.
                            </div>
                          )}

                          {/* Assinatura */}
                          <div style={{ textAlign: "center", marginTop: "32px" }}>
                            <div style={{ borderTop: "1px solid #94a3b8", width: "160px", margin: "0 auto 8px" }} />
                            <div style={{ fontSize: "10.5px", fontWeight: 700 }}>Dr(a). {nomeMedico}</div>
                            {crm && <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>CRM: {crm}</div>}
                            {especialidade && <div style={{ fontSize: "9px", color: "#64748b" }}>{especialidade}</div>}
                            <div style={{ fontSize: "8.5px", color: "#94a3b8", marginTop: "10px" }}>{dataHoje}</div>
                          </div>
                        </div>

                        {/* Rodapé */}
                        <div style={{ background: "#0f766e", color: "#fff", padding: "5px", textAlign: "center", fontSize: "7.5px" }}>
                          Vynor Clinic — Documento gerado automaticamente — Uso exclusivo médico
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Sidebar: histórico do paciente */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ ...S.card, padding: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", marginBottom: "12px" }}>
                Histórico do paciente
              </div>
              {historicoPaciente.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Primeira consulta nesta clínica.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {historicoPaciente.map((c) => (
                    <div key={c.id} style={{ padding: "10px 12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{formatarData(c.data)}</div>
                      <div style={{ fontSize: "11px", color: "#6366f1", marginTop: "2px" }}>{c.especialidade || "Consulta"}</div>
                      {c.prontuario?.cid && (
                        <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600, marginTop: "2px" }}>CID: {c.prontuario.cid}</div>
                      )}
                      {c.prontuario?.conduta && (
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }} title={c.prontuario.conduta}>
                          {c.prontuario.conduta.slice(0, 60)}{c.prontuario.conduta.length > 60 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {dadosPaciente && (
              <div style={{ ...S.card, padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", marginBottom: "10px" }}>Dados do paciente</div>
                {[
                  ["Convênio", dadosPaciente.convenio || "Particular"],
                  ["Sexo", dadosPaciente.sexo || "—"],
                  ["Idade", idade !== null ? `${idade} anos` : "—"],
                  ["Telefone", dadosPaciente.telefone || "—"],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>{l}</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Barra de ações */}
        <div style={{ display: "flex", gap: "10px", padding: "14px 20px", background: "#fff", borderRadius: "14px", boxShadow: "0 -2px 8px rgba(0,0,0,.04)", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={salvarProntuario} disabled={salvando} style={S.btnPrimary}>
            {salvando ? "Salvando..." : "💾 Salvar prontuário"}
          </button>
          <button onClick={finalizarAtendimento} disabled={salvando} style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #059669, #16a34a)" }}>
            ✓ Finalizar atendimento
          </button>
          <button onClick={voltarParaLista} style={S.btnSecondary}>← Voltar</button>
          {autoSalvo && (
            <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "auto" }}>
              Rascunho salvo às {autoSalvo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── RENDER: Dashboard de Consultas ────────────────────────────────────────────

  const listaAtual = abaLista === "agendados"
    ? consultasAgendadas
    : abaLista === "imediato"
      ? consultasImediatas
      : consultasFiltradas;
  const mesAtual = hoje.slice(0, 7);

  const horaAtual = new Date().getHours();
  const saudacao = horaAtual < 12 ? "Bom dia" : horaAtual < 18 ? "Boa tarde" : "Boa noite";
  const nomeMedico = (userData?.nome || userData?.name || "").split(" ")[0] || "Doutor(a)";
  const sala = consultorioAtual?.nome || null;

  // ── Dados do gráfico semanal ──
  const hojeDate = new Date();
  const diaDaSemanaHoje = hojeDate.getDay();
  const DIAS_ABV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const consultasSemana = DIAS_ABV.map((label, i) => {
    const d = new Date(hojeDate);
    d.setDate(hojeDate.getDate() - diaDaSemanaHoje + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { label, key, count: consultas.filter((c) => c.data === key).length, isHoje: key === hoje };
  });
  const maxSemana = Math.max(...consultasSemana.map((d) => d.count), 1);

  // ── Lookup de idade por nome ──
  const pacienteIdadeMap = {};
  pacientes.forEach((p) => {
    pacienteIdadeMap[(p.nome || "").toLowerCase().trim()] = calcularIdade(p.dataNascimento || p.data_nascimento);
  });
  function obterIdadePaciente(nome) {
    return pacienteIdadeMap[(nome || "").toLowerCase().trim()];
  }

  // ── Donut chart (Patient Overview) ──
  const donutData = [
    { label: "Aguardando",      count: aguardandoNaFila.length, color: "#f59e0b" },
    { label: "Em Atendimento",  count: emAtendimento.length,    color: "#0f766e" },
    { label: "Finalizados Hoje",count: atendidosHoje.length,    color: "#16a34a" },
  ];
  const donutTotal = donutData.reduce((s, d) => s + d.count, 0) || 1;
  const R_DON = 40;
  const CIRC_DON = 2 * Math.PI * R_DON;
  let _cumLen = 0;
  const donutSegments = donutData.map((d) => {
    const len = (d.count / donutTotal) * CIRC_DON;
    const dashoffset = CIRC_DON - _cumLen;
    _cumLen += len;
    return { ...d, len, dashoffset };
  });

  // ── Calendar strip (semana) ──
  const weekAnchor = new Date(hojeDate);
  weekAnchor.setDate(hojeDate.getDate() - diaDaSemanaHoje);
  const semanaStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { label: DIAS_ABV[i], day: d.getDate(), isHoje: key === hoje };
  });

  // ── Área chart (mensal) ──
  const AREA_W = 260; const AREA_H = 90;
  const maxMesArea = Math.max(...consultasPorMes.map((m) => m.count), 1);
  const areaPoints = consultasPorMes
    .map((m, i) => {
      const x = (i / Math.max(consultasPorMes.length - 1, 1)) * AREA_W;
      const y = AREA_H - ((m.count / maxMesArea) * AREA_H * 0.82) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  const areaFillPts = `${areaPoints} ${AREA_W},${AREA_H} 0,${AREA_H}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: "4px" }}>
            Central de Consultas
          </div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            {saudacao}, {nomeMedico}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "5px", flexWrap: "wrap" }}>
            {sala && (
              <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#64748b" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                {sala} — ativo
              </span>
            )}
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "8px 14px", fontSize: "12px", color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
            Sistema ativo
          </div>
          <button
            onClick={() => setShowModelosModal(true)}
            style={{ background: "#1e293b", color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FileText size={14} /> Modelos de Documentos
          </button>
        </div>
      </div>

      {/* ── Modal: Modelos em branco ── */}
      {showModelosModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={() => setShowModelosModal(false)}
        >
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "28px 32px",
            width: "360px", boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>Modelos de Documentos</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "22px" }}>
              Baixe modelos em branco com o cabeçalho da clínica para preenchimento manual.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { tipo: "receita",     label: "Receita Médica em branco",         Icon: Pill,          desc: "Cabeçalho + linhas para prescrição" },
                { tipo: "atestado",    label: "Atestado Médico em branco",         Icon: ClipboardList, desc: "Cabeçalho + espaço para texto" },
                { tipo: "solicitacao", label: "Solicitação de Exames em branco",   Icon: FlaskConical,  desc: "Cabeçalho + linhas para exames" },
              ].map((m) => (
                <button
                  key={m.tipo}
                  onClick={() => gerarModeloEmBranco(m.tipo)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 16px", borderRadius: "10px",
                    border: "1px solid #e2e8f0", background: "#f8fafc",
                    cursor: "pointer", textAlign: "left", width: "100%",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F5F3FF"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#f8fafc"}
                >
                  <span style={{ color: "#7C3AED", display: "flex" }}><m.Icon size={22} /></span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{m.label}</div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>{m.desc}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: "12px", color: "#94a3b8" }}>⬇</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModelosModal(false)}
              style={{ marginTop: "18px", width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f1f5f9", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── 4 KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {[
          {
            label: "Total de Pacientes",
            value: pacientes.length,
            sub: "Cadastrados no sistema",
            color: "#2563eb",
            bg: "#EFF6FF",
            iconBg: "#DBEAFE",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ),
          },
          {
            label: "Atendidos Hoje",
            value: atendidosHoje.length,
            sub: "Consultas finalizadas",
            color: "#db2777",
            bg: "#FDF2F8",
            iconBg: "#FCE7F3",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ),
          },
          {
            label: "Consultas do Dia",
            value: consultasHoje.length,
            sub: emAtendimento.length > 0 ? `${emAtendimento.length} em andamento` : "Agendadas para hoje",
            color: "#059669",
            bg: "#ECFDF5",
            iconBg: "#D1FAE5",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            ),
          },
          {
            label: "Aguardando",
            value: aguardandoNaFila.length,
            sub: "Na fila de espera",
            color: "#d97706",
            bg: "#FFFBEB",
            iconBg: "#FEF3C7",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            ),
          },
        ].map((card) => (
          <div key={card.label} style={{
            background: card.bg, borderRadius: "18px", padding: "20px 22px",
            border: "none", boxShadow: "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div style={{ background: card.iconBg, borderRadius: "12px", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize: "34px", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
              {card.value}{card.value > 0 ? "+" : ""}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginTop: "7px" }}>
              {card.label}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Semana atual — barras */}
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>Estatísticas Diárias</h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>Consultas da semana atual</p>
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#64748b" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#0f766e", display: "inline-block" }} />
              Consultas
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px" }}>
            {consultasSemana.map((d) => {
              const barH = maxSemana === 0 ? 0 : Math.max((d.count / maxSemana) * 90, d.count > 0 ? 8 : 2);
              return (
                <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", alignItems: "center" }}>
                    {d.count > 0 && (
                      <div style={{ fontSize: "10px", color: d.isHoje ? "#7C3AED" : "#94a3b8", fontWeight: d.isHoje ? 700 : 400, marginBottom: "2px" }}>
                        {d.count}
                      </div>
                    )}
                    <div style={{
                      width: "100%", height: `${barH}px`,
                      background: d.isHoje ? "linear-gradient(180deg,#7C3AED,#6D28D9)" : "#e2e8f0",
                      borderRadius: "5px 5px 0 0", minHeight: "2px",
                    }} />
                  </div>
                  <div style={{ fontSize: "9px", color: d.isHoje ? "#7C3AED" : "#94a3b8", fontWeight: d.isHoje ? 700 : 400, textAlign: "center" }}>
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tendência mensal — área */}
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>Tendência Mensal</h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>Últimos 6 meses</p>
            </div>
          </div>
          <div style={{ position: "relative", height: "100px" }}>
            <svg width="100%" height="90" viewBox={`0 0 ${AREA_W} ${AREA_H}`} preserveAspectRatio="none" style={{ display: "block" }}>
              <defs>
                <linearGradient id="dshGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <polygon points={areaFillPts} fill="url(#dshGrad)" />
              <polyline points={areaPoints} fill="none" stroke="#0f766e" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              {consultasPorMes.map((m, i) => {
                const x = (i / Math.max(consultasPorMes.length - 1, 1)) * AREA_W;
                const y = AREA_H - ((m.count / maxMesArea) * AREA_H * 0.82) - 4;
                return (
                  <circle key={m.key} cx={x} cy={y} r={m.key === mesAtual ? 4 : 2.5}
                    fill={m.key === mesAtual ? "#0f766e" : "#fff"}
                    stroke="#0f766e" strokeWidth="1.5"
                  />
                );
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              {consultasPorMes.map((m) => (
                <div key={m.key} style={{ fontSize: "9px", color: m.key === mesAtual ? "#0f766e" : "#94a3b8", fontWeight: m.key === mesAtual ? 700 : 400, textAlign: "center", flex: 1 }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabela de Pacientes + Painel Direito ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px", alignItems: "start" }}>

        {/* ── Tabela de Pacientes ── */}
        <div style={{ ...S.card }}>
            {/* Cabeçalho + filtros */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>Pacientes</h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  {listaAtual.length} paciente{listaAtual.length !== 1 ? "s" : ""} {abaLista === "agendados" ? "agendados" : "imediatos"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...S.input, maxWidth: "190px", padding: "7px 10px" }}
                  placeholder="Buscar paciente..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <div style={{ display: "flex", gap: "2px", background: "#f8fafc", padding: "3px", borderRadius: "8px" }}>
                  <button onClick={() => setAbaLista("todos")} style={S.pill(abaLista === "todos")}>
                    Todos ({consultasFiltradas.length})
                  </button>
                  <button onClick={() => setAbaLista("agendados")} style={S.pill(abaLista === "agendados")}>
                    Agendados ({consultasAgendadas.length})
                  </button>
                  <button onClick={() => setAbaLista("imediato")} style={S.pill(abaLista === "imediato")}>
                    Imediato ({consultasImediatas.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Header da tabela */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.6fr 56px 96px 1fr 96px auto",
              padding: "8px 12px", background: "#f8fafc", borderRadius: "8px",
              marginBottom: "6px", gap: "8px",
            }}>
              {["Nome", "Idade", "Data & Hora", "Serviço", "Status", "Ações"].map((h) => (
                <div key={h} style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {h}
                </div>
              ))}
            </div>

            {listaAtual.length === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 24px", color: "#94a3b8" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "10px" }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#475569" }}>Sem pacientes</p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                  {abaLista === "agendados"
                    ? "Nenhum agendamento pendente para hoje."
                    : abaLista === "imediato"
                    ? "Nenhum atendimento imediato no momento."
                    : "Nenhum paciente aguardando na fila."}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#cbd5e1" }}>
                  Pacientes são adicionados pela recepção.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {listaAtual.map((c) => {
                  const st = normStatus(c.status);
                  const sCfg = {
                    em_atendimento: { label: "Em Atendimento", color: "#0f766e", bg: "#f0fdf9" },
                    finalizado:     { label: "Finalizado",     color: "#16a34a", bg: "#f0fdf4" },
                    agendado:       { label: "Aguardando",     color: "#d97706", bg: "#fffbeb" },
                  }[st] || { label: "Aguardando", color: "#d97706", bg: "#fffbeb" };

                  const isAtivo = st === "em_atendimento";
                  const isImediatoTipo = normTipo(c.tipoAtendimento) === "Imediato";
                  const nomePac = c.paciente || c.nomePaciente || "—";
                  const inicial = nomePac.charAt(0).toUpperCase();
                  const idade = obterIdadePaciente(nomePac);
                  const dataHora = [formatarData(c.data), c.hora].filter(Boolean).join(" — ");
                  const servico = c.especialidade || c.tipoAtendimento || "Consulta";

                  return (
                    <div key={c.id} style={{
                      display: "grid", gridTemplateColumns: "1.6fr 56px 96px 1fr 96px auto",
                      padding: "10px 12px", borderRadius: "10px",
                      background: isAtivo ? "#f0fdf9" : "#fafafa",
                      border: isAtivo ? "1.5px solid #6ee7b760" : "1px solid #f1f5f9",
                      alignItems: "center", gap: "8px",
                    }}>
                      {/* Nome + avatar */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{
                          width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                          background: isImediatoTipo ? "#FEF3C7" : "#DBEAFE",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "13px", fontWeight: 800,
                          color: isImediatoTipo ? "#d97706" : "#2563eb",
                        }}>
                          {inicial}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {nomePac}
                          </div>
                          {isImediatoTipo && (
                            <div style={{ fontSize: "9px", color: "#d97706", fontWeight: 700 }}>Imediato</div>
                          )}
                        </div>
                      </div>

                      {/* Idade */}
                      <div style={{ fontSize: "12px", color: "#475569" }}>
                        {idade != null ? `${idade}a` : "—"}
                      </div>

                      {/* Data & Hora */}
                      <div style={{ fontSize: "11px", color: "#475569", fontWeight: 500 }}>
                        {dataHora || "—"}
                      </div>

                      {/* Serviço */}
                      <div style={{ fontSize: "12px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {servico}
                      </div>

                      {/* Status */}
                      <div>
                        <span style={{
                          fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px",
                          background: sCfg.bg, color: sCfg.color,
                          border: `1px solid ${sCfg.color}22`,
                          display: "inline-block", whiteSpace: "nowrap",
                        }}>
                          {sCfg.label}
                        </span>
                      </div>

                      {/* Ações */}
                      <div style={{ display: "flex", gap: "4px", flexWrap: "nowrap" }}>
                        {st === "agendado" && (
                          <button
                            onClick={() => abrirAtendimento(c)}
                            style={{
                              padding: "5px 10px", borderRadius: "7px", border: "none",
                              background: "linear-gradient(135deg,#0f766e,#0d9488)",
                              color: "#fff", fontSize: "10px", fontWeight: 700,
                              cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            Atender
                          </button>
                        )}
                        <button
                          onClick={() => abrirAtendimento(c)}
                          style={{
                            padding: "5px 9px", borderRadius: "7px",
                            border: "1px solid #e2e8f0", background: "#fff",
                            color: "#475569", fontSize: "10px", fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          Ver
                        </button>
                        {st === "em_atendimento" && (
                          <button
                            onClick={() => finalizarDireto(c)}
                            style={{
                              padding: "5px 9px", borderRadius: "7px", border: "none",
                              background: "linear-gradient(135deg,#059669,#16a34a)",
                              color: "#fff", fontSize: "10px", fontWeight: 700,
                              cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            Finalizar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {/* ── Painel Direito ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Patient Overview — donut */}
          <div style={{ ...S.card }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
              Visão Geral
            </h3>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
              <div style={{ position: "relative", width: "120px", height: "120px" }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle r={R_DON} cx={60} cy={60} fill="none" stroke="#f1f5f9" strokeWidth={18} />
                  {donutSegments.map((seg) =>
                    seg.len > 0 ? (
                      <circle key={seg.label}
                        r={R_DON} cx={60} cy={60}
                        fill="none" stroke={seg.color} strokeWidth={18}
                        strokeDasharray={`${seg.len} ${CIRC_DON - seg.len}`}
                        strokeDashoffset={seg.dashoffset}
                        transform="rotate(-90 60 60)"
                      />
                    ) : null
                  )}
                </svg>
                <div style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {donutTotal === 1 && donutData.every((d) => d.count === 0) ? 0 : donutTotal}
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 600 }}>Total</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {donutData.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{d.label}</span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Próximos Atendimentos — calendário + lista */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>Próximos Atendimentos</h3>
                <span style={{ fontSize: "10px", fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: "999px", padding: "2px 8px" }}>
                  {proximasConsultas.length}
                </span>
              </div>
              {/* Calendar strip */}
              <div style={{ display: "flex", gap: "2px", marginTop: "12px" }}>
                {semanaStrip.map((d) => (
                  <div key={d.label} style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: "3px", padding: "6px 0", borderRadius: "8px",
                    background: d.isHoje ? "#0f766e" : "transparent",
                  }}>
                    <span style={{ fontSize: "8px", fontWeight: 700, color: d.isHoje ? "rgba(255,255,255,0.75)" : "#94a3b8", textTransform: "uppercase" }}>
                      {d.label}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: d.isHoje ? "#fff" : "#0f172a" }}>
                      {d.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {proximasConsultas.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                Nenhum próximo atendimento
              </div>
            ) : (
              <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                {proximasConsultas.slice(0, 8).map((c, i) => (
                  <div key={c.id || i} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 16px",
                    borderBottom: i < Math.min(proximasConsultas.length, 8) - 1 ? "1px solid #f8fafc" : "none",
                  }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                      background: "#DBEAFE", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "12px", fontWeight: 800, color: "#2563eb",
                    }}>
                      {(c.paciente || "P").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.paciente || "—"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                        {c.hora || "—"}
                        {c.data !== hoje ? ` · ${formatarData(c.data)}` : " · Hoje"}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "5px",
                      background: "#f1f5f9", color: "#64748b", whiteSpace: "nowrap",
                    }}>
                      {(c.convenio || "Particular").split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paciente em Atendimento agora */}
          {emAtendimento.length > 0 && emAtendimento.slice(0, 1).map((c) => (
            <div key={c.id} style={{
              background: "linear-gradient(135deg,#0f766e 0%,#0d9488 100%)",
              borderRadius: "16px", padding: "16px 18px",
              boxShadow: "0 4px 16px rgba(15,118,110,0.2)",
            }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.65)", marginBottom: "4px" }}>
                Em Atendimento Agora
              </div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "2px" }}>
                {c.paciente || "Paciente"}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", marginBottom: "12px" }}>
                {[c.hora, c.especialidade].filter(Boolean).join(" · ") || "Consulta"}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => abrirAtendimento(c)}
                  style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  Prontuário
                </button>
                <button
                  onClick={() => finalizarDireto(c)}
                  style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  Finalizar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabela de Agenda Futura ── */}
      <div style={{ ...S.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
            Agenda de Consultas
          </h3>
          <span style={{ fontSize: "11px", fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: "999px", padding: "2px 10px" }}>
            {proximasConsultas.length}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                {["Paciente", "Data", "Horário", "Especialidade", "Médico", "Status"].map((h) => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: "left",
                    fontSize: "10px", fontWeight: 700, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proximasConsultas.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "36px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                      Nenhuma consulta agendada para os próximos dias.
                    </div>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      Agende consultas na tela de Recepção para que apareçam aqui.
                    </div>
                  </td>
                </tr>
              ) : (
                proximasConsultas.map((c, i) => {
                  const st = normStatus(c.status);
                  const sCfg = {
                    em_atendimento: { label: "Em Atendimento", color: "#0f766e", bg: "#f0fdf9" },
                    finalizado:     { label: "Finalizado",     color: "#16a34a", bg: "#f0fdf4" },
                    agendado:       { label: "Agendado",       color: "#6366f1", bg: "#eef2ff" },
                  }[st] || { label: "Agendado", color: "#6366f1", bg: "#eef2ff" };

                  return (
                    <tr key={c.id || i} style={{
                      borderBottom: "1px solid #f8fafc",
                      background: i % 2 === 0 ? "transparent" : "#fafafa",
                    }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>
                        {c.paciente || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#475569" }}>
                        {formatarData(c.data)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>
                        {c.hora || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>
                        {c.especialidade || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>
                        {c.medico || c.profissional || "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: "10px", fontWeight: 700,
                          padding: "3px 9px", borderRadius: "6px",
                          background: sCfg.bg, color: sCfg.color,
                          border: `1px solid ${sCfg.color}22`,
                          whiteSpace: "nowrap",
                        }}>
                          {sCfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
