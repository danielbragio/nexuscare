import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

// ── Helpers ────────────────────────────────────────────────────────────────────

function normStatus(status) {
  const t = (status || "").toLowerCase().trim();
  if (t === "finalizado" || t === "finalizada") return "finalizado";
  if (t === "em atendimento" || t === "em_atendimento") return "em_atendimento";
  return "agendado";
}

function labelStatus(status) {
  const s = normStatus(status);
  if (s === "finalizado") return "Finalizado";
  if (s === "em_atendimento") return "Em atendimento";
  return "Agendado";
}

function normTipo(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("pronto") || t.includes("imediato")) return "Imediato";
  return "Agendado";
}

function formatarData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const nasc = new Date(dataNasc + "T00:00:00");
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
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
  pagamentos = [],
  pacientes = [],
  consultaSelecionadaExterna,
  limparConsultaExterna,
  onIniciarAtendimento,
  onSalvarProntuario,
  onFinalizarAtendimento,
}) {
  const { userData } = useAuth();
  const [busca, setBusca] = useState("");
  const [abaLista, setAbaLista] = useState("agendados");
  const [consultaSelecionada, setConsultaSelecionada] = useState(null);
  const [abaAtendimento, setAbaAtendimento] = useState("dados");
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [autoSalvo, setAutoSalvo] = useState(null);
  const [novaMed, setNovaMed] = useState({ nome: "", dose: "", via: "oral", frequencia: "", duracao: "" });
  const [novoExame, setNovoExame] = useState({ categoria: "Sangue", nome: "", urgencia: "Eletivo", observacao: "" });
  const autoSaveTimer = useRef(null);

  // Auto-save every 30s when consultation is open
  useEffect(() => {
    if (!consultaSelecionada || !onSalvarProntuario) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await onSalvarProntuario(consultaSelecionada.id, form);
        setAutoSalvo(new Date());
      } catch (_) {}
    }, 30000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [form, consultaSelecionada]);

  useEffect(() => {
    if (consultaSelecionadaExterna) {
      abrirAtendimento(consultaSelecionadaExterna);
      if (limparConsultaExterna) limparConsultaExterna();
    }
  }, [consultaSelecionadaExterna]);

  useEffect(() => {
    function handleEvento(e) {
      if (e.detail) abrirAtendimento(e.detail);
    }
    window.addEventListener("abrir-atendimento", handleEvento);
    return () => window.removeEventListener("abrir-atendimento", handleEvento);
  }, []);

  const consultasComPagamento = useMemo(() => {
    const pagas = new Set();
    pagamentos.forEach((p) => {
      const st = (p.statusPagamento || p.status || "").toLowerCase();
      if (st === "pago" || st === "paga") {
        if (p.consultaId) pagas.add(p.consultaId);
        if (p.agendamentoId) pagas.add(p.agendamentoId);
      }
    });
    return pagas;
  }, [pagamentos]);

  const consultasAtivas = useMemo(() => {
    const role = userData?.role || "";
    const isAdmin = role === "admin" || (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
    const isRecepcao = role === "recepcao";
    const meuId = String(userData?.id || "");
    const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
    return [...consultas]
      .filter((c) => {
        if (normStatus(c.status) === "finalizado") return false;
        if (c.pagamentoId && !consultasComPagamento.has(c.id)) return false;
        if (isAdmin || isRecepcao) return true;
        const mId = c.usuarioId != null
          ? String(c.usuarioId)
          : (c.profissionalId || "").trim();
        if (mId) return mId === meuId;
        return (c.medico || c.profissionalNome || "").toLowerCase().trim() === nome;
      })
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  }, [consultas, consultasComPagamento, userData]);

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

  async function abrirAtendimento(consulta) {
    setConsultaSelecionada(consulta);
    setAbaAtendimento("dados");
    if (normStatus(consulta.status) === "agendado" && onIniciarAtendimento) {
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

  function gerarAtestadoModelo() {
    if (!consultaSelecionada) return;
    const pac = consultaSelecionada.paciente || "—";
    setForm((prev) => ({
      ...prev,
      atestado: `Atesto para os devidos fins que o(a) paciente ${pac} compareceu a esta unidade de saúde na data de ${consultaSelecionada.data || "___/___/___"} às ${consultaSelecionada.hora || "___:___"} e que por motivo de saúde necessita de afastamento de suas atividades pelo período de ____ (____) dias a partir desta data.`,
    }));
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
      alert("Não foi possível salvar o prontuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function finalizarAtendimento() {
    if (!consultaSelecionada || !onFinalizarAtendimento) return;
    if (!window.confirm(`Finalizar atendimento de ${consultaSelecionada.paciente}?`)) return;
    try {
      setSalvando(true);
      await onFinalizarAtendimento(consultaSelecionada.id, { ...form, statusAtendimento: "Finalizado" });
      voltarParaLista();
    } catch (e) {
      console.error(e);
      alert("Não foi possível finalizar o atendimento.");
    } finally {
      setSalvando(false);
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
                  <button onClick={aplicarTemplate} style={{ ...S.btnSecondary, marginTop: "16px", fontSize: "12px" }}>
                    📋 Aplicar template de {esp || "Clínico Geral"}
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
                    <input style={S.input} name="cid" value={form.cid} onChange={handleChange} placeholder="Ex: J06.9" />
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
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803d", marginBottom: "8px" }}>
                      ✓ {form.examesSolicitados.length} exame(s) selecionado(s)
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
                  <button onClick={gerarReceitaTexto} style={{ ...S.btnSecondary, fontSize: "12px" }}>
                    📄 Gerar texto da receita
                  </button>
                )}

                <div>
                  <span style={S.label}>Texto livre da receita</span>
                  <textarea style={{ ...S.textarea, minHeight: "120px" }} name="receita" value={form.receita} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* ABA DOCUMENTOS */}
            {abaAtendimento === "documentos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={S.label}>Atestado médico</span>
                    <button onClick={gerarAtestadoModelo} style={{ ...S.btnSecondary, fontSize: "12px", padding: "5px 12px" }}>Gerar modelo</button>
                  </div>
                  <textarea style={{ ...S.textarea, minHeight: "120px" }} name="atestado" value={form.atestado} onChange={handleChange} placeholder="Texto do atestado..." />
                </div>
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
            )}
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

  // ── RENDER: Lista de consultas ────────────────────────────────────────────────

  const listaAtual = abaLista === "agendados" ? consultasAgendadas : consultasImediatas;
  const emAtendimento = consultasAtivas.filter((c) => normStatus(c.status) === "em_atendimento");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>Consultas</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Fila de atendimento — pacientes com pagamento confirmado.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[
          { label: "NA FILA", valor: consultasAtivas.length, cor: "#6366f1", sub: "Total ativo" },
          { label: "AGENDADOS", valor: consultasAgendadas.length, cor: "#2563eb", sub: "Com horário marcado" },
          { label: "IMEDIATO", valor: consultasImediatas.length, cor: "#f59e0b", sub: "Pronto atendimento" },
          { label: "EM ATENDIMENTO", valor: emAtendimento.length, cor: "#16a34a", sub: "Consultório aberto" },
        ].map((k) => (
          <div key={k.label} style={{ ...S.card, padding: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k.label}</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: k.cor, margin: "4px 0" }}>{k.valor}</div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtro e lista */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...S.input, maxWidth: "260px" }}
            placeholder="Buscar paciente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div style={{ display: "flex", gap: "2px", background: "#f8fafc", padding: "4px", borderRadius: "10px" }}>
            <button onClick={() => setAbaLista("agendados")} style={S.pill(abaLista === "agendados")}>
              Agendados ({consultasAgendadas.length})
            </button>
            <button onClick={() => setAbaLista("imediato")} style={S.pill(abaLista === "imediato")}>
              Imediato ({consultasImediatas.length})
            </button>
          </div>
        </div>

        {listaAtual.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🏥</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Nenhum paciente na fila</p>
            <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
              {abaLista === "agendados" ? "Sem agendamentos pendentes" : "Sem atendimentos imediatos"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {listaAtual.map((c) => {
              const st = normStatus(c.status);
              const statusCor = { finalizado: "#16a34a", em_atendimento: "#0f766e", agendado: "#6366f1" }[st] || "#64748b";
              const statusBg = { finalizado: "#f0fdf4", em_atendimento: "#f0fdf9", agendado: "#eef2ff" }[st] || "#f8fafc";
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "12px", background: "#fafafa", border: "1px solid #f1f5f9" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>{c.paciente || "—"}</span>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: statusBg, color: statusCor }}>
                        {labelStatus(c.status)}
                      </span>
                      {normTipo(c.tipoAtendimento) === "Imediato" && (
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#fffbeb", color: "#d97706" }}>⚡ Imediato</span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span>🕐 {c.hora || "—"} · {formatarData(c.data)}</span>
                      {c.especialidade && <span>🏥 {c.especialidade}</span>}
                      {c.medico && <span>👨‍⚕️ {c.medico}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => abrirAtendimento(c)}
                    style={{ ...S.btnPrimary, fontSize: "12px", padding: "8px 16px" }}
                  >
                    Abrir atendimento →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
