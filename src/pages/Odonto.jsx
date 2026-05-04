import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";

const PROCEDIMENTOS_PADRAO = [
  { nome: "Consulta Odontológica", categoria: "Consulta", valor: 150, tempoEstimado: 30, status: "ativo" },
  { nome: "Avaliação", categoria: "Consulta", valor: 80, tempoEstimado: 20, status: "ativo" },
  { nome: "Limpeza (Profilaxia)", categoria: "Prevenção", valor: 120, tempoEstimado: 45, status: "ativo" },
  { nome: "Raspagem", categoria: "Periodontia", valor: 200, tempoEstimado: 60, status: "ativo" },
  { nome: "Restauração", categoria: "Dentística", valor: 180, tempoEstimado: 60, status: "ativo" },
  { nome: "Extração Simples", categoria: "Cirurgia", valor: 250, tempoEstimado: 45, status: "ativo" },
  { nome: "Extração Complexa", categoria: "Cirurgia", valor: 450, tempoEstimado: 90, status: "ativo" },
  { nome: "Canal (Endodontia)", categoria: "Endodontia", valor: 800, tempoEstimado: 120, status: "ativo" },
  { nome: "Clareamento", categoria: "Estética", valor: 600, tempoEstimado: 90, status: "ativo" },
  { nome: "Aplicação de Flúor", categoria: "Prevenção", valor: 60, tempoEstimado: 20, status: "ativo" },
  { nome: "Curativo", categoria: "Cirurgia", valor: 80, tempoEstimado: 15, status: "ativo" },
  { nome: "Prótese", categoria: "Prótese", valor: 1200, tempoEstimado: 60, status: "ativo" },
  { nome: "Radiografia", categoria: "Diagnóstico", valor: 90, tempoEstimado: 15, status: "ativo" },
  { nome: "Emergência Odontológica", categoria: "Emergência", valor: 200, tempoEstimado: 30, status: "ativo" },
];

function labelStatus(status) {
  const map = {
    agendado: "Agendado",
    aguardando: "Aguardando",
    em_atendimento: "Em Atendimento",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };
  return map[status] || status;
}

function corStatus(status) {
  const map = {
    agendado: "#2563eb",
    aguardando: "#f59e0b",
    em_atendimento: "#0f766e",
    finalizado: "#16a34a",
    cancelado: "#dc2626",
  };
  return map[status] || "#64748b";
}

function formatarValor(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getDataHoje() {
  return new Date().toISOString().split("T")[0];
}

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
  { campo: "temDiabetes", label: "Possui diabetes?" },
  { campo: "temHipertensao", label: "Possui hipertensão?" },
  { campo: "estaGestante", label: "Está gestante?" },
  { campo: "alergiaAnestesia", label: "Tem alergia a anestesia?" },
  { campo: "usaAnticoagulante", label: "Usa anticoagulante?" },
  { campo: "reacaoProcedimento", label: "Já teve reação em procedimento odontológico?" },
  { campo: "temProblemaCardiaco", label: "Possui problema cardíaco?" },
];

export default function Odonto({ pacientes = [], users = [], userData = null, pagamentos = [], procedimentosOdonto = [] }) {
  const isAdmin =
    userData?.role === "admin" ||
    (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
  const [abaAtual, setAbaAtual] = useState("agendamentos");
  const [agendamentos, setAgendamentos] = useState([]);
  const [atendimentos, setAtendimentos] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);
  const [seeded, setSeeded] = useState(false);

  // ── Atendimento aberto ──────────────────────────────────────────────────────
  const [atendimentoAberto, setAtendimentoAberto] = useState(null);
  const [abaAtendimento, setAbaAtendimento] = useState("dados");
  const [formAnamnese, setFormAnamnese] = useState(FORM_ANAMNESE_INICIAL);
  const [procedimentosSelecionados, setProcedimentosSelecionados] = useState([]);
  const [descontoGeral, setDescontoGeral] = useState(0);
  const [obsAtendimento, setObsAtendimento] = useState("");
  const [formaPagamentoOdonto, setFormaPagamentoOdonto] = useState("dinheiro");
  const [statusPagamentoOdonto, setStatusPagamentoOdonto] = useState("pendente");

  // ── Formulário de agendamento ───────────────────────────────────────────────
  const [formAgendamentoAberto, setFormAgendamentoAberto] = useState(false);
  const [formAgendamento, setFormAgendamento] = useState({
    pacienteNome: "",
    pacienteId: "",
    profissionalNome: "",
    profissionalId: "",
    data: getDataHoje(),
    hora: "",
    tipoAtendimento: "Consulta",
    status: "agendado",
    observacoes: "",
  });

  // ── Formulário de procedimento ──────────────────────────────────────────────
  const [formProcAberto, setFormProcAberto] = useState(false);
  const [editandoProc, setEditandoProc] = useState(null);
  const [formProc, setFormProc] = useState({
    nome: "",
    categoria: "",
    valor: "",
    tempoEstimado: "",
    status: "ativo",
  });

  // ── Firestore subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubAg = onSnapshot(
      query(collection(db, "agendamentosOdonto"), orderBy("createdAt", "desc")),
      (snap) => setAgendamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubAt = onSnapshot(
      query(collection(db, "atendimentosOdonto"), orderBy("createdAt", "desc")),
      (snap) => setAtendimentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubProc = onSnapshot(
      query(collection(db, "procedimentosOdonto"), orderBy("nome", "asc")),
      async (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProcedimentos(lista);
        if (lista.length === 0 && !seeded) {
          setSeeded(true);
          for (const proc of PROCEDIMENTOS_PADRAO) {
            await addDoc(collection(db, "procedimentosOdonto"), {
              ...proc,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    );

    return () => {
      unsubAg();
      unsubAt();
      unsubProc();
    };
  }, []);

  // ── Computed ────────────────────────────────────────────────────────────────
  const hoje = getDataHoje();

  const agendamentosHoje = useMemo(
    () => agendamentos.filter((a) => a.data === hoje),
    [agendamentos, hoje]
  );

  const filaAguardando = useMemo(
    () => atendimentos.filter((a) => a.status === "aguardando"),
    [atendimentos]
  );

  const filaEmAtendimento = useMemo(
    () => atendimentos.filter((a) => a.status === "em_atendimento"),
    [atendimentos]
  );

  const filaFinalizados = useMemo(
    () => atendimentos.filter((a) => a.status === "finalizado"),
    [atendimentos]
  );

  const subtotalAtendimento = procedimentosSelecionados.reduce(
    (acc, p) => acc + (Number(p.valorFinal) || 0),
    0
  );

  // ── Agendamentos ────────────────────────────────────────────────────────────
  function abrirFormAgendamento() {
    setFormAgendamento({
      pacienteNome: "",
      pacienteId: "",
      profissionalNome: "",
      profissionalId: "",
      data: getDataHoje(),
      hora: "",
      tipoAtendimento: "Consulta",
      status: "agendado",
      observacoes: "",
    });
    setFormAgendamentoAberto(true);
  }

  function handleAgendamento(campo, valor) {
    setFormAgendamento((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvarAgendamento() {
    if (!formAgendamento.pacienteNome.trim() || !formAgendamento.hora) {
      alert("Preencha o paciente e o horário.");
      return;
    }
    try {
      await addDoc(collection(db, "agendamentosOdonto"), {
        ...formAgendamento,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setFormAgendamentoAberto(false);
    } catch (e) {
      alert("Erro ao salvar agendamento: " + e.message);
    }
  }

  async function atualizarStatusAgendamento(id, novoStatus) {
    await updateDoc(doc(db, "agendamentosOdonto", id), {
      status: novoStatus,
      updatedAt: serverTimestamp(),
    });
  }

  async function encaminharParaFila(ag) {
    try {
      const atRef = await addDoc(collection(db, "atendimentosOdonto"), {
        agendamentoId: ag.id,
        pacienteId: ag.pacienteId || "",
        pacienteNome: ag.pacienteNome,
        profissionalId: ag.profissionalId || "",
        profissionalNome: ag.profissionalNome || "",
        tipoAtendimento: ag.tipoAtendimento || "Consulta",
        observacoesRecepcao: ag.observacoes || ag.observacoesRecepcao || "",
        status: "aguardando",
        statusPagamento: ag.pagamentoId ? "pendente" : "",
        anamnese: null,
        procedimentosSolicitados: ag.procedimentosSolicitados || [],
        procedimentosRealizados: [],
        total: ag.valorEstimado || 0,
        desconto: 0,
        valorFinal: ag.valorEstimado || 0,
        financeiroStatus: ag.pagamentoId ? "pendente" : "",
        pagamentoId: ag.pagamentoId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await atualizarStatusAgendamento(ag.id, "aguardando");
      if (ag.pagamentoId) {
        await updateDoc(doc(db, "pagamentos", ag.pagamentoId), {
          atendimentoOdontoId: atRef.id,
          updatedAt: serverTimestamp(),
        });
      }
      setAbaAtual("fila");
    } catch (e) {
      alert("Erro: " + e.message);
    }
  }

  // ── Atendimento ─────────────────────────────────────────────────────────────
  function abrirAtendimento(at) {
    setAtendimentoAberto(at);
    setAbaAtendimento("dados");
    setFormAnamnese(at.anamnese || FORM_ANAMNESE_INICIAL);
    setProcedimentosSelecionados(at.procedimentosRealizados || []);
    setDescontoGeral(at.desconto || 0);
    setObsAtendimento(at.observacoesAtendimento || "");
  }

  function voltarParaFila() {
    setAtendimentoAberto(null);
  }

  async function iniciarAtendimento() {
    if (!atendimentoAberto) return;
    await updateDoc(doc(db, "atendimentosOdonto", atendimentoAberto.id), {
      status: "em_atendimento",
      updatedAt: serverTimestamp(),
    });
    setAtendimentoAberto((prev) => ({ ...prev, status: "em_atendimento" }));
  }

  async function salvarAtendimento() {
    if (!atendimentoAberto) return;
    const total = subtotalAtendimento;
    const desconto = Number(descontoGeral) || 0;
    const valorFinal = Math.max(0, total - desconto);
    try {
      await updateDoc(doc(db, "atendimentosOdonto", atendimentoAberto.id), {
        anamnese: formAnamnese,
        procedimentosRealizados: procedimentosSelecionados,
        total,
        desconto,
        valorFinal,
        observacoesAtendimento: obsAtendimento,
        updatedAt: serverTimestamp(),
      });
      alert("Atendimento salvo com sucesso.");
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
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
    const dataHoje = getDataHoje();
    const descricaoProcedimentos =
      procedimentosSelecionados.map((p) => p.nome).join(", ") ||
      (atendimentoAberto.procedimentosSolicitados || []).map((p) => p.nome).join(", ") ||
      "Atendimento odontológico";

    try {
      await updateDoc(doc(db, "atendimentosOdonto", atendimentoAberto.id), {
        status: "finalizado",
        anamnese: formAnamnese,
        procedimentosRealizados: procedimentosSelecionados,
        total,
        desconto,
        valorFinal,
        formaPagamento: formaPagamentoOdonto,
        statusPagamento: statusPagamentoOdonto,
        observacoesAtendimento: obsAtendimento,
        finalizadoEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
        financeiro: {
          pacienteId: atendimentoAberto.pacienteId || "",
          pacienteNome: atendimentoAberto.pacienteNome,
          atendimentoId: atendimentoAberto.id,
          descricao: descricaoProcedimentos,
          valor: total,
          desconto,
          valorFinal,
          statusFinanceiro: statusPagamentoOdonto,
          formaPagamento: formaPagamentoOdonto,
          dataLancamento: new Date().toISOString(),
          responsavel: atendimentoAberto.profissionalNome || "",
        },
      });

      // Atualizar agendamento vinculado
      if (atendimentoAberto.agendamentoId) {
        await updateDoc(doc(db, "agendamentosOdonto", atendimentoAberto.agendamentoId), {
          status: "finalizado",
          updatedAt: serverTimestamp(),
        });
      }

      if (atendimentoAberto.pagamentoId) {
        // Atualizar pagamento existente criado pela recepção
        await updateDoc(doc(db, "pagamentos", atendimentoAberto.pagamentoId), {
          valor: valorFinal,
          status: statusPagamentoOdonto,
          statusPagamento: statusPagamentoOdonto === "pago" ? "Pago" : statusPagamentoOdonto === "cortesia" ? "Cortesia" : "Pendente",
          formaPagamento: formaPagamentoOdonto,
          dataPagamento: dataHoje,
          descricao: descricaoProcedimentos,
          atendimentoOdontoId: atendimentoAberto.id,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Criar novo registro de pagamento (atendimento sem pagamento prévio)
        await addDoc(collection(db, "pagamentos"), {
          pacienteId: atendimentoAberto.pacienteId || "",
          paciente: atendimentoAberto.pacienteNome,
          nomePaciente: atendimentoAberto.pacienteNome,
          descricao: descricaoProcedimentos,
          servico: "Odontologia",
          valor: valorFinal,
          status: statusPagamentoOdonto,
          statusPagamento: statusPagamentoOdonto === "pago" ? "Pago" : statusPagamentoOdonto === "cortesia" ? "Cortesia" : "Pendente",
          formaPagamento: formaPagamentoOdonto,
          tipo: "odonto",
          origem: "odonto",
          atendimentoOdontoId: atendimentoAberto.id,
          profissional: atendimentoAberto.profissionalNome || "",
          data: dataHoje,
          dataPagamento: dataHoje,
          createdAt: serverTimestamp(),
        });
      }

      setAtendimentoAberto(null);
      setFormaPagamentoOdonto("dinheiro");
      setStatusPagamentoOdonto("pendente");
      alert("Atendimento finalizado. Financeiro e Pagamentos atualizados.");
    } catch (e) {
      alert("Erro ao finalizar: " + e.message);
    }
  }

  // ── Procedimentos selecionados ──────────────────────────────────────────────
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

  // ── Gerenciamento de procedimentos ─────────────────────────────────────────
  function abrirCriarProc() {
    setEditandoProc(null);
    setFormProc({ nome: "", categoria: "", valor: "", tempoEstimado: "", status: "ativo" });
    setFormProcAberto(true);
  }

  function abrirEditarProc(proc) {
    setEditandoProc(proc);
    setFormProc({
      nome: proc.nome,
      categoria: proc.categoria,
      valor: proc.valor,
      tempoEstimado: proc.tempoEstimado,
      status: proc.status,
    });
    setFormProcAberto(true);
  }

  async function salvarProc() {
    if (!formProc.nome.trim() || !formProc.valor) {
      alert("Nome e valor são obrigatórios.");
      return;
    }
    const dados = {
      ...formProc,
      valor: Number(formProc.valor),
      tempoEstimado: Number(formProc.tempoEstimado) || 0,
      updatedAt: serverTimestamp(),
    };
    try {
      if (editandoProc) {
        await updateDoc(doc(db, "procedimentosOdonto", editandoProc.id), dados);
      } else {
        await addDoc(collection(db, "procedimentosOdonto"), {
          ...dados,
          createdAt: serverTimestamp(),
        });
      }
      setFormProcAberto(false);
    } catch (e) {
      alert("Erro: " + e.message);
    }
  }

  async function toggleStatusProc(proc) {
    const novoStatus = proc.status === "ativo" ? "inativo" : "ativo";
    await updateDoc(doc(db, "procedimentosOdonto", proc.id), {
      status: novoStatus,
      updatedAt: serverTimestamp(),
    });
  }

  async function excluirProc(proc) {
    const usado = atendimentos.some((at) =>
      (at.procedimentosRealizados || []).some((p) => p.procedimentoId === proc.id)
    );
    if (usado) {
      alert("Este procedimento está vinculado a atendimentos e não pode ser excluído.");
      return;
    }
    if (!window.confirm(`Excluir "${proc.nome}"?`)) return;
    await deleteDoc(doc(db, "procedimentosOdonto", proc.id));
  }

  // ── Tela de atendimento ─────────────────────────────────────────────────────
  if (atendimentoAberto) {
    return (
      <div>
        <div className="page-header med-header-inline">
          <div className="med-header-left">
            <button className="med-back-btn" onClick={voltarParaFila}>←</button>
            <div>
              <h1>Odonto</h1>
              <p className="page-subtitle">
                Atendimento de {atendimentoAberto.pacienteNome}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span
              className="badge"
              style={{
                background: corStatus(atendimentoAberto.status) + "22",
                color: corStatus(atendimentoAberto.status),
              }}
            >
              {labelStatus(atendimentoAberto.status)}
            </span>
            {atendimentoAberto.status === "aguardando" && (
              <button className="primary-btn odonto-primary" onClick={iniciarAtendimento}>
                Iniciar atendimento
              </button>
            )}
          </div>
        </div>

        <div className="page-card module-odonto">
          <div className="medical-tabs">
            {[
              { id: "dados", label: "Dados" },
              { id: "anamnese", label: "Anamnese" },
              { id: "evolucao", label: "Evolução Clínica" },
              { id: "procedimentos", label: "Procedimentos" },
              { id: "resumo", label: "Resumo" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`medical-tab odonto-tab ${abaAtendimento === tab.id ? "active" : ""}`}
                onClick={() => setAbaAtendimento(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "20px" }}>

            {/* ── ABA DADOS ── */}
            {abaAtendimento === "dados" && (
              <div>
                <div className="med-panel-grid">
                  {[
                    { label: "Paciente", valor: atendimentoAberto.pacienteNome },
                    { label: "Profissional", valor: atendimentoAberto.profissionalNome || "—" },
                    { label: "Tipo de atendimento", valor: atendimentoAberto.tipoAtendimento || "—" },
                    { label: "Status", valor: labelStatus(atendimentoAberto.status) },
                  ].map((item) => (
                    <div key={item.label} className="muted-box">
                      <strong>{item.label}</strong>
                      <div>{item.valor}</div>
                    </div>
                  ))}
                  {atendimentoAberto.pagamentoId && (
                    <div className="muted-box" style={{ borderLeft: "3px solid #f59e0b" }}>
                      <strong>Status do pagamento</strong>
                      <div style={{ color: atendimentoAberto.statusPagamento === "pago" ? "#16a34a" : "#f59e0b", fontWeight: 700 }}>
                        {atendimentoAberto.statusPagamento === "pago" ? "✓ Pago" :
                         atendimentoAberto.statusPagamento === "cortesia" ? "🎁 Cortesia" : "⏳ Pendente"}
                      </div>
                    </div>
                  )}
                  <div className="muted-box med-full">
                    <strong>Observações da recepção</strong>
                    <div>{atendimentoAberto.observacoesRecepcao || "Sem observações."}</div>
                  </div>
                </div>

                {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
                  <div className="muted-box" style={{ marginTop: "16px", borderLeft: "3px solid #0f766e" }}>
                    <strong style={{ display: "block", marginBottom: "10px", color: "#0f766e" }}>
                      🦷 Procedimentos solicitados pela Recepção
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                      {(atendimentoAberto.procedimentosSolicitados || []).map((p, i) => (
                        <span
                          key={i}
                          style={{
                            background: "#f0fdf9",
                            border: "1px solid #99f6e4",
                            borderRadius: "8px",
                            padding: "4px 10px",
                            fontSize: "13px",
                            color: "#0f766e",
                            fontWeight: 600,
                          }}
                        >
                          {p.nome}
                          {p.valor ? ` — ${formatarValor(p.valor)}` : ""}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontWeight: 700, color: "#0f766e" }}>
                      Total estimado:{" "}
                      {formatarValor(
                        (atendimentoAberto.procedimentosSolicitados || []).reduce(
                          (acc, p) => acc + Number(p.valor || 0), 0
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ABA ANAMNESE ── */}
            {abaAtendimento === "anamnese" && (
              <div>
                <h3 className="odonto-section-title">Anamnese Odontológica</h3>
                <div className="form-grid-2">
                  <div className="full-width">
                    <label>Queixa principal *</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.queixaPrincipal}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, queixaPrincipal: e.target.value }))
                      }
                      placeholder="Descreva a queixa principal do paciente"
                    />
                  </div>
                  <div className="full-width">
                    <label>História da queixa atual</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.historiaAtual}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, historiaAtual: e.target.value }))
                      }
                      placeholder="Histórico da queixa atual"
                    />
                  </div>
                  <div>
                    <label>Doenças preexistentes</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.doencasPreexistentes}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, doencasPreexistentes: e.target.value }))
                      }
                      placeholder="Ex.: diabetes, hipertensão..."
                    />
                  </div>
                  <div>
                    <label>Alergias</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.alergias}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, alergias: e.target.value }))
                      }
                      placeholder="Alergias conhecidas"
                    />
                  </div>
                  <div>
                    <label>Medicamentos em uso</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.medicamentos}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, medicamentos: e.target.value }))
                      }
                      placeholder="Liste os medicamentos em uso"
                    />
                  </div>
                  <div>
                    <label>Histórico odontológico</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.historicoOdonto}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, historicoOdonto: e.target.value }))
                      }
                      placeholder="Tratamentos anteriores relevantes"
                    />
                  </div>
                  <div>
                    <label>Sangramento gengival</label>
                    <input
                      className="input"
                      value={formAnamnese.sangramentoGengival}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, sangramentoGengival: e.target.value }))
                      }
                      placeholder="Descreva"
                    />
                  </div>
                  <div>
                    <label>Dor ao mastigar</label>
                    <input
                      className="input"
                      value={formAnamnese.dorMastigar}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, dorMastigar: e.target.value }))
                      }
                      placeholder="Descreva"
                    />
                  </div>
                  <div>
                    <label>Sensibilidade dentária</label>
                    <input
                      className="input"
                      value={formAnamnese.sensibilidadeDentaria}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, sensibilidadeDentaria: e.target.value }))
                      }
                      placeholder="Descreva"
                    />
                  </div>
                  <div>
                    <label>Uso de prótese</label>
                    <input
                      className="input"
                      value={formAnamnese.usoProstese}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, usoProstese: e.target.value }))
                      }
                      placeholder="Descreva"
                    />
                  </div>
                  <div>
                    <label>Tratamentos anteriores</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.tratamentosAnteriores}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, tratamentosAnteriores: e.target.value }))
                      }
                      placeholder="Descreva"
                    />
                  </div>
                  <div>
                    <label>Observações clínicas</label>
                    <textarea
                      className="textarea"
                      value={formAnamnese.observacoesClinicas}
                      onChange={(e) =>
                        setFormAnamnese((p) => ({ ...p, observacoesClinicas: e.target.value }))
                      }
                      placeholder="Observações do profissional"
                    />
                  </div>
                </div>

                <h4 className="odonto-subsection-title">Perguntas Rápidas</h4>
                <div className="form-grid-2">
                  {PERGUNTAS_RAPIDAS.map((item) => (
                    <div key={item.campo}>
                      <label>{item.label}</label>
                      <div className="odonto-simnao">
                        {["Sim", "Não", "Não sabe"].map((opcao) => (
                          <button
                            key={opcao}
                            className={`odonto-simnao-btn ${
                              formAnamnese[item.campo] === opcao ? "active" : ""
                            }`}
                            onClick={() =>
                              setFormAnamnese((p) => ({ ...p, [item.campo]: opcao }))
                            }
                          >
                            {opcao}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ABA EVOLUÇÃO CLÍNICA ── */}
            {abaAtendimento === "evolucao" && (
              <div>
                <h3 className="odonto-section-title">Evolução Clínica</h3>
                <div className="form-grid-2">
                  <div className="full-width">
                    <label>Evolução do atendimento</label>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={formAnamnese.evolucao}
                      onChange={(e) => setFormAnamnese((p) => ({ ...p, evolucao: e.target.value }))}
                      placeholder="Descreva a evolução clínica do paciente nesta consulta"
                    />
                  </div>
                  <div className="full-width">
                    <label>Diagnóstico odontológico</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={formAnamnese.diagnostico}
                      onChange={(e) => setFormAnamnese((p) => ({ ...p, diagnostico: e.target.value }))}
                      placeholder="Diagnóstico clínico e/ou radiográfico"
                    />
                  </div>
                  <div className="full-width">
                    <label>Conduta / Plano de tratamento</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={formAnamnese.conduta}
                      onChange={(e) => setFormAnamnese((p) => ({ ...p, conduta: e.target.value }))}
                      placeholder="Descreva a conduta adotada e plano de tratamento"
                    />
                  </div>
                  <div className="full-width">
                    <label>Prescrições / Orientações ao paciente</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={formAnamnese.prescricao}
                      onChange={(e) => setFormAnamnese((p) => ({ ...p, prescricao: e.target.value }))}
                      placeholder="Medicamentos prescritos, cuidados pós-procedimento, retorno..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── ABA PROCEDIMENTOS ── */}
            {abaAtendimento === "procedimentos" && (
              <div>
                <h3 className="odonto-section-title">Procedimentos Realizados</h3>

                {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
                  <div style={{ background: "#f0fdf9", border: "1px solid #99f6e4", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px" }}>
                    <div style={{ fontWeight: 700, color: "#0f766e", marginBottom: "8px", fontSize: "13px" }}>
                      🦷 Solicitados pela Recepção — adicione-os ao atendimento se foram realizados:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {(atendimentoAberto.procedimentosSolicitados || []).map((p, i) => {
                        const jaSel = procedimentosSelecionados.some((s) => s.nome === p.nome);
                        return (
                          <button
                            key={i}
                            className="secondary-btn odonto-chip-btn"
                            style={{ background: jaSel ? "#0f766e" : undefined, color: jaSel ? "#fff" : undefined, borderColor: jaSel ? "#0f766e" : undefined }}
                            onClick={() => {
                              if (!jaSel) {
                                setProcedimentosSelecionados((prev) => [
                                  ...prev,
                                  {
                                    procedimentoId: `sol-${i}`,
                                    nome: p.nome,
                                    categoria: p.categoria || "",
                                    valor: Number(p.valor) || 0,
                                    desconto: 0,
                                    valorFinal: Number(p.valor) || 0,
                                    observacoes: "",
                                  },
                                ]);
                              }
                            }}
                            disabled={jaSel}
                          >
                            {jaSel ? "✓ " : "+ "}{p.nome}
                            {p.valor ? ` (${formatarValor(p.valor)})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="muted-box" style={{ marginBottom: "16px" }}>
                  <strong style={{ display: "block", marginBottom: "10px" }}>
                    Adicionar outros procedimentos
                  </strong>
                  <div className="odonto-proc-chips">
                    {procedimentos
                      .filter((p) => p.status === "ativo")
                      .map((proc) => (
                        <button
                          key={proc.id}
                          className="secondary-btn odonto-chip-btn"
                          onClick={() => adicionarProcedimento(proc)}
                        >
                          + {proc.nome} ({formatarValor(proc.valor)})
                        </button>
                      ))}
                  </div>
                </div>

                {procedimentosSelecionados.length === 0 && (
                  <div className="muted-box odonto-empty-msg">
                    Nenhum procedimento adicionado ainda.
                  </div>
                )}

                {procedimentosSelecionados.map((p) => (
                  <div key={p.procedimentoId} className="odonto-proc-item">
                    <div className="odonto-proc-header">
                      <strong>{p.nome}</strong>
                      <span
                        className="badge"
                        style={{ background: "#f0fdf4", color: "#16a34a" }}
                      >
                        {p.categoria}
                      </span>
                      <button
                        className="secondary-btn"
                        style={{ marginLeft: "auto", padding: "5px 10px", fontSize: "12px" }}
                        onClick={() => removerProcedimento(p.procedimentoId)}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="form-grid-2" style={{ marginTop: "10px" }}>
                      <div>
                        <label>Valor (R$)</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={p.valor}
                          onChange={(e) =>
                            atualizarProcedimento(p.procedimentoId, "valor", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label>Desconto (R$)</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={p.desconto}
                          onChange={(e) =>
                            atualizarProcedimento(p.procedimentoId, "desconto", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label>Valor final</label>
                        <div
                          className="muted-box"
                          style={{ padding: "10px 14px", fontWeight: "bold", color: "#0f766e" }}
                        >
                          {formatarValor(p.valorFinal)}
                        </div>
                      </div>
                      <div>
                        <label>Observações</label>
                        <input
                          className="input"
                          value={p.observacoes}
                          onChange={(e) =>
                            atualizarProcedimento(p.procedimentoId, "observacoes", e.target.value)
                          }
                          placeholder="Observações deste procedimento"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ABA RESUMO ── */}
            {abaAtendimento === "resumo" && (
              <div>
                <h3 className="odonto-section-title">Resumo do Atendimento</h3>

                {procedimentosSelecionados.length === 0 ? (
                  <div className="muted-box odonto-empty-msg">
                    Nenhum procedimento realizado.
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Procedimento</th>
                        <th>Categoria</th>
                        <th>Valor</th>
                        <th>Desconto</th>
                        <th>Valor Final</th>
                        <th>Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procedimentosSelecionados.map((p) => (
                        <tr key={p.procedimentoId}>
                          <td>{p.nome}</td>
                          <td>{p.categoria}</td>
                          <td>{formatarValor(p.valor)}</td>
                          <td>{formatarValor(p.desconto)}</td>
                          <td>
                            <strong style={{ color: "#0f766e" }}>
                              {formatarValor(p.valorFinal)}
                            </strong>
                          </td>
                          <td style={{ color: "#64748b" }}>{p.observacoes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="form-grid-2" style={{ marginTop: "20px" }}>
                  <div>
                    <label>Desconto geral adicional (R$)</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={descontoGeral}
                      onChange={(e) => setDescontoGeral(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Observações finais do atendimento</label>
                    <input
                      className="input"
                      value={obsAtendimento}
                      onChange={(e) => setObsAtendimento(e.target.value)}
                      placeholder="Observações gerais"
                    />
                  </div>
                </div>

                <div className="odonto-totais">
                  <div className="odonto-total-row">
                    <span>Subtotal dos procedimentos:</span>
                    <strong>{formatarValor(subtotalAtendimento)}</strong>
                  </div>
                  <div className="odonto-total-row">
                    <span>Desconto geral:</span>
                    <strong style={{ color: "#dc2626" }}>
                      — {formatarValor(descontoGeral)}
                    </strong>
                  </div>
                  <div className="odonto-total-row odonto-total-final">
                    <span>Total a pagar:</span>
                    <strong style={{ color: "#0f766e" }}>
                      {formatarValor(Math.max(0, subtotalAtendimento - Number(descontoGeral)))}
                    </strong>
                  </div>
                  <div className="form-grid-2" style={{ marginTop: "16px" }}>
                    <div>
                      <label>Forma de pagamento</label>
                      <select
                        className="select"
                        value={formaPagamentoOdonto}
                        onChange={(e) => setFormaPagamentoOdonto(e.target.value)}
                      >
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="cartao_debito">Cartão de Débito</option>
                        <option value="pix">PIX</option>
                        <option value="convenio">Convênio</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label>Status do pagamento</label>
                      <select
                        className="select"
                        value={statusPagamentoOdonto}
                        onChange={(e) => setStatusPagamentoOdonto(e.target.value)}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="cortesia">Cortesia</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: "20px" }}>
          <button className="primary-btn odonto-primary" onClick={salvarAtendimento}>
            Salvar atendimento
          </button>
          <button className="secondary-btn" onClick={finalizarAtendimento}>
            Finalizar atendimento
          </button>
          <button className="secondary-btn" onClick={voltarParaFila}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── Tela principal ──────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h1>Odonto</h1>
        <p className="page-subtitle">
          Módulo odontológico — agendamentos, atendimentos, anamnese e procedimentos.
        </p>
      </div>

      {/* Indicadores */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <div className="stat-box">
          <div className="stat-label">Agendados hoje</div>
          <div className="stat-value" style={{ color: "#0f766e" }}>
            {agendamentosHoje.length}
          </div>
          <div className="stat-info">Total do dia</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Aguardando</div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>
            {filaAguardando.length}
          </div>
          <div className="stat-info">Na fila agora</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Em atendimento</div>
          <div className="stat-value" style={{ color: "#0f766e" }}>
            {filaEmAtendimento.length}
          </div>
          <div className="stat-info">Ativos agora</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Finalizados</div>
          <div className="stat-value" style={{ color: "#16a34a" }}>
            {filaFinalizados.length}
          </div>
          <div className="stat-info">Hoje</div>
        </div>
      </div>

      {/* Abas principais */}
      <div className="medical-tabs" style={{ marginBottom: "16px" }}>
        {[
          { id: "agendamentos", label: "Agendamentos" },
          { id: "fila", label: "Fila de Atendimento" },
          { id: "procedimentos", label: "Procedimentos" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`medical-tab odonto-tab ${abaAtual === tab.id ? "active" : ""}`}
            onClick={() => setAbaAtual(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ABA AGENDAMENTOS ── */}
      {abaAtual === "agendamentos" && (
        <div className="page-card module-odonto">
          <div className="card-title-row">
            <h3>Agendamentos Odontológicos</h3>
            <button className="primary-btn odonto-primary" onClick={abrirFormAgendamento}>
              + Novo Agendamento
            </button>
          </div>

          {/* Formulário inline de agendamento */}
          {formAgendamentoAberto && (
            <div className="odonto-form-panel">
              <h4 style={{ marginBottom: "16px", color: "#0f766e" }}>
                Novo Agendamento Odontológico
              </h4>
              <div className="form-grid-2">
                <div className="full-width">
                  <label>Paciente *</label>
                  {pacientes.length > 0 ? (
                    <select
                      className="select"
                      value={formAgendamento.pacienteId}
                      onChange={(e) => {
                        const pac = pacientes.find((p) => p.id === e.target.value);
                        handleAgendamento("pacienteId", e.target.value);
                        handleAgendamento("pacienteNome", pac?.nome || pac?.name || "");
                      }}
                    >
                      <option value="">Selecione o paciente</option>
                      {pacientes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome || p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      placeholder="Nome do paciente"
                      value={formAgendamento.pacienteNome}
                      onChange={(e) => handleAgendamento("pacienteNome", e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label>Profissional responsável</label>
                  {users.length > 0 ? (
                    <select
                      className="select"
                      value={formAgendamento.profissionalId}
                      onChange={(e) => {
                        const u = users.find((u) => u.id === e.target.value);
                        handleAgendamento("profissionalId", e.target.value);
                        handleAgendamento("profissionalNome", u?.nome || u?.name || "");
                      }}
                    >
                      <option value="">Selecione o profissional</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome || u.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      placeholder="Nome do profissional"
                      value={formAgendamento.profissionalNome}
                      onChange={(e) => handleAgendamento("profissionalNome", e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label>Data *</label>
                  <input
                    className="input"
                    type="date"
                    value={formAgendamento.data}
                    onChange={(e) => handleAgendamento("data", e.target.value)}
                  />
                </div>
                <div>
                  <label>Horário *</label>
                  <input
                    className="input"
                    type="time"
                    value={formAgendamento.hora}
                    onChange={(e) => handleAgendamento("hora", e.target.value)}
                  />
                </div>
                <div>
                  <label>Tipo de atendimento</label>
                  <select
                    className="select"
                    value={formAgendamento.tipoAtendimento}
                    onChange={(e) => handleAgendamento("tipoAtendimento", e.target.value)}
                  >
                    <option value="Consulta">Consulta</option>
                    <option value="Avaliação">Avaliação</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Emergência">Emergência</option>
                    <option value="Limpeza">Limpeza</option>
                    <option value="Procedimento">Procedimento</option>
                  </select>
                </div>
                <div>
                  <label>Status inicial</label>
                  <select
                    className="select"
                    value={formAgendamento.status}
                    onChange={(e) => handleAgendamento("status", e.target.value)}
                  >
                    <option value="agendado">Agendado</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="full-width">
                  <label>Observações</label>
                  <textarea
                    className="textarea"
                    value={formAgendamento.observacoes}
                    onChange={(e) => handleAgendamento("observacoes", e.target.value)}
                    placeholder="Observações do agendamento"
                    style={{ minHeight: "70px" }}
                  />
                </div>
              </div>
              <div className="toolbar" style={{ marginTop: "16px" }}>
                <button className="primary-btn odonto-primary" onClick={salvarAgendamento}>
                  Salvar agendamento
                </button>
                <button className="secondary-btn" onClick={() => setFormAgendamentoAberto(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Profissional</th>
                <th>Procedimentos</th>
                <th>Data</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((ag) => (
                <tr key={ag.id}>
                  <td>{ag.hora || "—"}</td>
                  <td>{ag.pacienteNome || "—"}</td>
                  <td>{ag.profissionalNome || "—"}</td>
                  <td style={{ maxWidth: "180px" }}>
                    {(ag.procedimentosSolicitados || []).length > 0 ? (
                      <div style={{ fontSize: "12px" }}>
                        {(ag.procedimentosSolicitados || []).map((p) => p.nome).join(", ")}
                        {ag.valorEstimado ? (
                          <div style={{ fontWeight: 700, color: "#0f766e" }}>
                            {formatarValor(ag.valorEstimado)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td>{ag.data || "—"}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: corStatus(ag.status) + "22",
                        color: corStatus(ag.status),
                      }}
                    >
                      {labelStatus(ag.status)}
                    </span>
                  </td>
                  <td>
                    {ag.pagamentoId ? (
                      <span style={{ fontSize: "12px", background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: "6px", padding: "2px 7px" }}>
                        ⏳ Pendente
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(ag.status === "agendado" || ag.status === "aguardando_pagamento") && (
                        <button
                          className="primary-btn odonto-primary"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => encaminharParaFila(ag)}
                        >
                          Encaminhar
                        </button>
                      )}
                      {ag.status !== "cancelado" && ag.status !== "finalizado" && (
                        <button
                          className="secondary-btn"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => atualizarStatusAgendamento(ag.id, "cancelado")}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {agendamentos.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", color: "#64748b" }}>
                    Nenhum agendamento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ABA FILA ── */}
      {abaAtual === "fila" && (
        <div className="odonto-fila-grid">
          {/* Aguardando */}
          <div className="page-card">
            <h3 className="odonto-fila-titulo odonto-fila-aguardando">
              Aguardando ({filaAguardando.length})
            </h3>
            <div className="odonto-fila-lista">
              {filaAguardando.map((at) => (
                <div
                  key={at.id}
                  className="odonto-card-paciente"
                  style={{ borderLeftColor: "#f59e0b" }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{at.pacienteNome}</strong>
                    <div className="odonto-card-tipo">{at.tipoAtendimento}</div>
                    {(at.procedimentosSolicitados || []).length > 0 && (
                      <div style={{ fontSize: "11px", color: "#0f766e", marginTop: "2px" }}>
                        🦷 {(at.procedimentosSolicitados || []).map((p) => p.nome).join(", ")}
                      </div>
                    )}
                    {at.pagamentoId && (
                      <span style={{ fontSize: "11px", background: at.statusPagamento === "pago" ? "#f0fdf4" : "#fffbeb", color: at.statusPagamento === "pago" ? "#16a34a" : "#d97706", border: `1px solid ${at.statusPagamento === "pago" ? "#86efac" : "#fde68a"}`, borderRadius: "6px", padding: "1px 6px", display: "inline-block", marginTop: "3px" }}>
                        {at.statusPagamento === "pago" ? "✓ Pago" : "⏳ Pagamento pendente"}
                      </span>
                    )}
                  </div>
                  <button
                    className="primary-btn odonto-primary"
                    style={{ padding: "7px 12px", fontSize: "12px", flexShrink: 0 }}
                    onClick={() => abrirAtendimento(at)}
                  >
                    Atender
                  </button>
                </div>
              ))}
              {filaAguardando.length === 0 && (
                <div className="odonto-fila-vazia">Nenhum paciente aguardando.</div>
              )}
            </div>
          </div>

          {/* Em atendimento */}
          <div className="page-card">
            <h3 className="odonto-fila-titulo odonto-fila-em-atendimento">
              Em Atendimento ({filaEmAtendimento.length})
            </h3>
            <div className="odonto-fila-lista">
              {filaEmAtendimento.map((at) => (
                <div
                  key={at.id}
                  className="odonto-card-paciente"
                  style={{ borderLeftColor: "#0f766e" }}
                >
                  <div>
                    <strong>{at.pacienteNome}</strong>
                    <div className="odonto-card-tipo">{at.tipoAtendimento}</div>
                  </div>
                  <button
                    className="primary-btn odonto-primary"
                    style={{ padding: "7px 12px", fontSize: "12px" }}
                    onClick={() => abrirAtendimento(at)}
                  >
                    Continuar
                  </button>
                </div>
              ))}
              {filaEmAtendimento.length === 0 && (
                <div className="odonto-fila-vazia">Nenhum paciente em atendimento.</div>
              )}
            </div>
          </div>

          {/* Finalizados */}
          <div className="page-card">
            <h3 className="odonto-fila-titulo odonto-fila-finalizado">
              Finalizados ({filaFinalizados.length})
            </h3>
            <div className="odonto-fila-lista">
              {filaFinalizados.map((at) => (
                <div
                  key={at.id}
                  className="odonto-card-paciente"
                  style={{ borderLeftColor: "#16a34a", opacity: 0.85 }}
                >
                  <div>
                    <strong>{at.pacienteNome}</strong>
                    <div className="odonto-card-tipo">{at.tipoAtendimento}</div>
                    <div
                      style={{ fontSize: "12px", color: "#16a34a", fontWeight: "bold", marginTop: "2px" }}
                    >
                      {formatarValor(at.valorFinal)}
                    </div>
                  </div>
                  <button
                    className="secondary-btn"
                    style={{ padding: "7px 12px", fontSize: "12px" }}
                    onClick={() => abrirAtendimento(at)}
                  >
                    Ver
                  </button>
                </div>
              ))}
              {filaFinalizados.length === 0 && (
                <div className="odonto-fila-vazia">Nenhum finalizado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA PROCEDIMENTOS ── */}
      {abaAtual === "procedimentos" && (
        <div className="page-card module-odonto">
          <div className="card-title-row">
            <h3>Procedimentos Odontológicos</h3>
            {isAdmin ? (
              <button className="primary-btn odonto-primary" onClick={abrirCriarProc}>
                + Novo Procedimento
              </button>
            ) : (
              <span style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "4px 10px" }}>
                🔒 Somente administradores podem cadastrar procedimentos
              </span>
            )}
          </div>

          {/* Formulário inline de procedimento */}
          {formProcAberto && (
            <div className="odonto-form-panel">
              <h4 style={{ marginBottom: "16px", color: "#0f766e" }}>
                {editandoProc ? "Editar Procedimento" : "Novo Procedimento"}
              </h4>
              <div className="form-grid-2">
                <div className="full-width">
                  <label>Nome *</label>
                  <input
                    className="input"
                    value={formProc.nome}
                    onChange={(e) => setFormProc((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome do procedimento"
                  />
                </div>
                <div>
                  <label>Categoria</label>
                  <select
                    className="select"
                    value={formProc.categoria}
                    onChange={(e) => setFormProc((f) => ({ ...f, categoria: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    <option value="Consulta">Consulta</option>
                    <option value="Prevenção">Prevenção</option>
                    <option value="Dentística">Dentística</option>
                    <option value="Periodontia">Periodontia</option>
                    <option value="Cirurgia">Cirurgia</option>
                    <option value="Endodontia">Endodontia</option>
                    <option value="Estética">Estética</option>
                    <option value="Prótese">Prótese</option>
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Emergência">Emergência</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label>Valor padrão (R$) *</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={formProc.valor}
                    onChange={(e) => setFormProc((f) => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label>Tempo estimado (min)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={formProc.tempoEstimado}
                    onChange={(e) => setFormProc((f) => ({ ...f, tempoEstimado: e.target.value }))}
                    placeholder="30"
                  />
                </div>
                <div>
                  <label>Status</label>
                  <select
                    className="select"
                    value={formProc.status}
                    onChange={(e) => setFormProc((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div className="toolbar" style={{ marginTop: "16px" }}>
                <button className="primary-btn odonto-primary" onClick={salvarProc}>
                  {editandoProc ? "Salvar alterações" : "Criar procedimento"}
                </button>
                <button className="secondary-btn" onClick={() => setFormProcAberto(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Tempo (min)</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {procedimentos.map((proc) => (
                <tr key={proc.id} style={{ opacity: proc.status === "inativo" ? 0.55 : 1 }}>
                  <td>{proc.nome}</td>
                  <td>{proc.categoria || "—"}</td>
                  <td>{formatarValor(proc.valor)}</td>
                  <td>{proc.tempoEstimado || "—"}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: proc.status === "ativo" ? "#f0fdf4" : "#fef2f2",
                        color: proc.status === "ativo" ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {proc.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    {isAdmin ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="secondary-btn"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => abrirEditarProc(proc)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-btn"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => toggleStatusProc(proc)}
                        >
                          {proc.status === "ativo" ? "Inativar" : "Ativar"}
                        </button>
                        <button
                          className="secondary-btn"
                          style={{ padding: "5px 10px", fontSize: "12px", color: "#dc2626", borderColor: "#fca5a5" }}
                          onClick={() => excluirProc(proc)}
                        >
                          Excluir
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>🔒 Somente admin</span>
                    )}
                  </td>
                </tr>
              ))}
              {procedimentos.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "#64748b" }}>
                    Carregando procedimentos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
