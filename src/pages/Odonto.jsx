import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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

function dataAtendimento(at) {
  if (at.data) return at.data;
  const s = at.createdAt?.seconds;
  if (s) return new Date(s * 1000).toISOString().slice(0, 10);
  const d = at.createdAt?.toDate?.();
  return d ? d.toISOString().slice(0, 10) : "";
}

function tempoEspera(at) {
  const s = at.createdAt?.seconds;
  if (!s) return null;
  const mins = Math.floor((Date.now() / 1000 - s) / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, "0") + "m" : ""}`;
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

const CATEGORIA_CORES = {
  Consulta:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Prevenção": { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "Dentística":{ bg: "#faf5ff", color: "#7c3aed", border: "#e9d5ff" },
  Periodontia: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  Cirurgia:    { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  Endodontia:  { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  "Estética":  { bg: "#fdf4ff", color: "#a21caf", border: "#f5d0fe" },
  "Prótese":   { bg: "#fefce8", color: "#a16207", border: "#fef08a" },
  "Diagnóstico":{ bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" },
  "Emergência":{ bg: "#fff1f2", color: "#be123c", border: "#fecdd3" },
};

export default function Odonto({ pacientes = [], users = [], userData = null, pagamentos = [], procedimentosOdonto = [] }) {
  const { firebaseUser } = useAuth();
  const isAdmin =
    userData?.role === "admin" ||
    (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
  const [abaAtual, setAbaAtual] = useState("agendamentos");
  const [buscaFila, setBuscaFila] = useState("");
  const [filtroFila, setFiltroFila] = useState("hoje");
  const [buscaAgendamentos, setBuscaAgendamentos] = useState("");
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
    const role = userData?.role || "";
    const uid = firebaseUser?.uid || "";
    const podeVerTodos =
      isAdmin || role === "recepcao" || !uid;

    const qAg = podeVerTodos
      ? query(collection(db, "agendamentosOdonto"), orderBy("createdAt", "desc"))
      : query(collection(db, "agendamentosOdonto"), where("profissionalId", "==", uid));

    const unsubAg = onSnapshot(qAg, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!podeVerTodos) docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAgendamentos(docs);
    }, (err) => { console.error("agendamentosOdonto:", err); setAgendamentos([]); });

    const qAt = podeVerTodos
      ? query(collection(db, "atendimentosOdonto"), orderBy("createdAt", "desc"))
      : query(collection(db, "atendimentosOdonto"), where("profissionalId", "==", uid));

    const unsubAt = onSnapshot(qAt, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!podeVerTodos) docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAtendimentos(docs);
    }, (err) => { console.error("atendimentosOdonto (at):", err); setAtendimentos([]); });

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
  }, [firebaseUser?.uid, userData?.role, isAdmin]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const hoje = getDataHoje();

  const agendamentosFiltrados = useMemo(() => {
    const role = userData?.role || "";
    if (isAdmin || role === "admin" || role === "recepcao") return agendamentos;
    const uid = firebaseUser?.uid || "";
    if (!uid) return [];
    const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
    return agendamentos.filter((ag) => {
      const pid = (ag.profissionalId || ag.profissionalUid || "").trim();
      if (pid) return pid === uid;
      if (!nome) return false;
      return (ag.profissionalNome || "").toLowerCase().trim() === nome;
    });
  }, [agendamentos, userData, firebaseUser, isAdmin]);

  const agendamentosHoje = useMemo(
    () => agendamentosFiltrados.filter((a) => a.data === hoje),
    [agendamentosFiltrados, hoje]
  );

  // Client-side filter garante que cada profissional vê apenas seus atendimentos
  const atendimentosFiltrados = useMemo(() => {
    const role = userData?.role || "";
    if (isAdmin || role === "admin" || role === "recepcao") return atendimentos;
    const uid = firebaseUser?.uid || "";
    if (!uid) return [];
    const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
    return atendimentos.filter((at) => {
      const pid = (at.profissionalId || at.profissionalUid || "").trim();
      if (pid) return pid === uid;
      if (!nome) return false;
      return (at.profissionalNome || "").toLowerCase().trim() === nome;
    });
  }, [atendimentos, userData, firebaseUser, isAdmin]);

  const filaAguardando = useMemo(
    () =>
      [...atendimentosFiltrados.filter((a) => {
        if (a.status !== "aguardando") return false;
        if (filtroFila === "hoje") return dataAtendimento(a) === hoje;
        return true;
      })].sort((a, b) => (a.hora || "").localeCompare(b.hora || "")),
    [atendimentosFiltrados, filtroFila, hoje]
  );

  const filaEmAtendimento = useMemo(
    () => atendimentosFiltrados.filter((a) => {
      if (a.status !== "em_atendimento") return false;
      if (filtroFila === "hoje") return dataAtendimento(a) === hoje;
      return true;
    }),
    [atendimentosFiltrados, filtroFila, hoje]
  );

  const filaFinalizados = useMemo(
    () =>
      [...atendimentosFiltrados.filter((a) => {
        if (a.status !== "finalizado") return false;
        if (filtroFila === "hoje") return dataAtendimento(a) === hoje;
        return true;
      })].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
    [atendimentosFiltrados, filtroFila, hoje]
  );

  const agendamentosNaoEncaminhados = useMemo(
    () => agendamentosHoje.filter((ag) => ag.status === "agendado"),
    [agendamentosHoje]
  );

  const subtotalAtendimento = procedimentosSelecionados.reduce(
    (acc, p) => acc + (Number(p.valorFinal) || 0),
    0
  );

  // ── Agendamentos ────────────────────────────────────────────────────────────
  function abrirFormAgendamento() {
    const uid = firebaseUser?.uid || "";
    const nome = userData?.nome || userData?.name || "";
    setFormAgendamento({
      pacienteNome: "",
      pacienteId: "",
      profissionalNome: isAdmin ? "" : nome,
      profissionalId: isAdmin ? "" : uid,
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
        statusPagamento: ag.statusPagamento || (ag.pagamentoId ? "pendente" : ""),
        anamnese: null,
        procedimentosSolicitados: ag.procedimentosSolicitados || [],
        procedimentosRealizados: [],
        total: ag.valorEstimado || 0,
        desconto: 0,
        valorFinal: ag.valorEstimado || 0,
        financeiroStatus: ag.statusPagamento || (ag.pagamentoId ? "pendente" : ""),
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

  async function sincMovOdonto(pagamentoId, valorFinal) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "movimentacoes"),
          where("referenciaId", "==", pagamentoId),
          where("origem", "==", "pagamentos")
        )
      );
      const dados = {
        referenciaId: pagamentoId,
        origem: "pagamentos",
        tipo: "Receita",
        categoria: "Odontologia",
        descricao: atendimentoAberto?.tipoAtendimento || "Atendimento odontológico",
        valor: valorFinal,
        data: getDataHoje(),
        nomePaciente: atendimentoAberto?.pacienteNome || "",
        formaPagamento: formaPagamentoOdonto,
        status: statusPagamentoOdonto,
        atualizadoEm: serverTimestamp(),
      };
      if (!snap.empty) {
        await updateDoc(doc(db, "movimentacoes", snap.docs[0].id), dados);
      } else {
        await addDoc(collection(db, "movimentacoes"), { ...dados, criadoEm: serverTimestamp() });
      }
    } catch (e) {
      console.error("Erro ao sincronizar movimentação odonto:", e);
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

      let pagId = atendimentoAberto.pagamentoId || null;
      if (pagId) {
        await updateDoc(doc(db, "pagamentos", pagId), {
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
        const pagRef = await addDoc(collection(db, "pagamentos"), {
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
        pagId = pagRef.id;
      }

      await sincMovOdonto(pagId, valorFinal);

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
        {/* Header */}
        <div className="page-header med-header-inline">
          <div className="med-header-left">
            <button className="med-back-btn" onClick={voltarParaFila}>←</button>
            <div>
              <h1 style={{ margin: 0 }}>🦷 Odontologia</h1>
              <p className="page-subtitle" style={{ margin: 0 }}>
                Atendimento · <strong>{atendimentoAberto.pacienteNome}</strong>
                {atendimentoAberto.hora && <span style={{ color: "#0f766e" }}> · {atendimentoAberto.hora}</span>}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span className="badge" style={{ background: corStatus(atendimentoAberto.status) + "22", color: corStatus(atendimentoAberto.status), border: `1px solid ${corStatus(atendimentoAberto.status)}44`, fontWeight: 700, fontSize: "13px" }}>
              {labelStatus(atendimentoAberto.status)}
            </span>
            {atendimentoAberto.status === "aguardando" && (
              <button className="primary-btn odonto-primary" onClick={iniciarAtendimento}>▶ Iniciar atendimento</button>
            )}
          </div>
        </div>

        <div className="page-card module-odonto">
          <div className="medical-tabs">
            {[
              { id: "dados",        label: "Dados",          icon: "📋" },
              { id: "anamnese",     label: "Anamnese",       icon: "📝" },
              { id: "evolucao",     label: "Evolução Clínica",icon: "📊" },
              { id: "procedimentos",label: "Procedimentos",  icon: "🦷" },
              { id: "resumo",       label: "Resumo",         icon: "💰" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`medical-tab odonto-tab ${abaAtendimento === tab.id ? "active" : ""}`}
                onClick={() => setAbaAtendimento(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "20px" }}>

            {/* ── ABA DADOS ── */}
            {abaAtendimento === "dados" && (
              <div>
                <div style={{
                  background: "linear-gradient(135deg, #f0fdfa, #f8fafc)",
                  border: "1px solid #99f6e4", borderRadius: "12px",
                  padding: "16px 20px", marginBottom: "20px",
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px",
                }}>
                  {[
                    { icon: "👤", label: "Paciente",          valor: atendimentoAberto.pacienteNome },
                    { icon: "👨‍⚕️", label: "Profissional",      valor: atendimentoAberto.profissionalNome || "—" },
                    { icon: "🏥", label: "Tipo de atendimento",valor: atendimentoAberto.tipoAtendimento || "—" },
                    { icon: "📊", label: "Status",             valor: labelStatus(atendimentoAberto.status) },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {item.icon} {item.label}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>{item.valor}</span>
                    </div>
                  ))}
                  {atendimentoAberto.pagamentoId && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>💳 Pagamento</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: atendimentoAberto.statusPagamento === "pago" ? "#16a34a" : "#d97706" }}>
                        {atendimentoAberto.statusPagamento === "pago" ? "✓ Pago" : atendimentoAberto.statusPagamento === "cortesia" ? "🎁 Cortesia" : "⏳ Pendente"}
                      </span>
                    </div>
                  )}
                </div>

                {atendimentoAberto.observacoesRecepcao && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px" }}>
                    <strong style={{ display: "block", fontSize: "12px", color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                      📝 Observações da Recepção
                    </strong>
                    <p style={{ margin: 0, color: "#78350f", lineHeight: 1.5 }}>{atendimentoAberto.observacoesRecepcao}</p>
                  </div>
                )}

                {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
                  <div style={{ background: "#f0fdfa", border: "2px solid #99f6e4", borderRadius: "12px", padding: "14px 16px" }}>
                    <strong style={{ display: "block", fontSize: "12px", color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                      🦷 Procedimentos Solicitados pela Recepção
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

            {/* ── ABA ANAMNESE ── */}
            {abaAtendimento === "anamnese" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <h3 style={{ margin: 0, color: "#0f766e" }}>📝 Anamnese Odontológica</h3>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Queixa e História</div>
                  <div className="form-grid-2">
                    <div className="full-width">
                      <label>Queixa principal *</label>
                      <textarea className="textarea" value={formAnamnese.queixaPrincipal} onChange={(e) => setFormAnamnese((p) => ({ ...p, queixaPrincipal: e.target.value }))} placeholder="Descreva a queixa principal do paciente" />
                    </div>
                    <div className="full-width">
                      <label>História da queixa atual</label>
                      <textarea className="textarea" value={formAnamnese.historiaAtual} onChange={(e) => setFormAnamnese((p) => ({ ...p, historiaAtual: e.target.value }))} placeholder="Histórico da queixa atual" />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Saúde Geral</div>
                  <div className="form-grid-2">
                    <div>
                      <label>Doenças preexistentes</label>
                      <textarea className="textarea" value={formAnamnese.doencasPreexistentes} onChange={(e) => setFormAnamnese((p) => ({ ...p, doencasPreexistentes: e.target.value }))} placeholder="Ex.: diabetes, hipertensão..." />
                    </div>
                    <div>
                      <label>Alergias</label>
                      <textarea className="textarea" value={formAnamnese.alergias} onChange={(e) => setFormAnamnese((p) => ({ ...p, alergias: e.target.value }))} placeholder="Alergias conhecidas" />
                    </div>
                    <div>
                      <label>Medicamentos em uso</label>
                      <textarea className="textarea" value={formAnamnese.medicamentos} onChange={(e) => setFormAnamnese((p) => ({ ...p, medicamentos: e.target.value }))} placeholder="Liste os medicamentos em uso" />
                    </div>
                    <div>
                      <label>Histórico odontológico</label>
                      <textarea className="textarea" value={formAnamnese.historicoOdonto} onChange={(e) => setFormAnamnese((p) => ({ ...p, historicoOdonto: e.target.value }))} placeholder="Tratamentos anteriores relevantes" />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Sintomas</div>
                  <div className="form-grid-2">
                    <div>
                      <label>Sangramento gengival</label>
                      <input className="input" value={formAnamnese.sangramentoGengival} onChange={(e) => setFormAnamnese((p) => ({ ...p, sangramentoGengival: e.target.value }))} placeholder="Descreva" />
                    </div>
                    <div>
                      <label>Dor ao mastigar</label>
                      <input className="input" value={formAnamnese.dorMastigar} onChange={(e) => setFormAnamnese((p) => ({ ...p, dorMastigar: e.target.value }))} placeholder="Descreva" />
                    </div>
                    <div>
                      <label>Sensibilidade dentária</label>
                      <input className="input" value={formAnamnese.sensibilidadeDentaria} onChange={(e) => setFormAnamnese((p) => ({ ...p, sensibilidadeDentaria: e.target.value }))} placeholder="Descreva" />
                    </div>
                    <div>
                      <label>Uso de prótese</label>
                      <input className="input" value={formAnamnese.usoProstese} onChange={(e) => setFormAnamnese((p) => ({ ...p, usoProstese: e.target.value }))} placeholder="Descreva" />
                    </div>
                    <div>
                      <label>Tratamentos anteriores</label>
                      <textarea className="textarea" value={formAnamnese.tratamentosAnteriores} onChange={(e) => setFormAnamnese((p) => ({ ...p, tratamentosAnteriores: e.target.value }))} placeholder="Descreva" />
                    </div>
                    <div>
                      <label>Observações clínicas</label>
                      <textarea className="textarea" value={formAnamnese.observacoesClinicas} onChange={(e) => setFormAnamnese((p) => ({ ...p, observacoesClinicas: e.target.value }))} placeholder="Observações do profissional" />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>
                    ⚠️ Perguntas Rápidas — Alertas de Saúde
                  </div>
                  <div className="form-grid-2">
                    {PERGUNTAS_RAPIDAS.map((item) => (
                      <div key={item.campo}>
                        <label style={{ color: "#78350f" }}>{item.label}</label>
                        <div className="odonto-simnao">
                          {["Sim", "Não", "Não sabe"].map((opcao) => (
                            <button
                              key={opcao}
                              className={`odonto-simnao-btn ${formAnamnese[item.campo] === opcao ? "active" : ""}`}
                              style={formAnamnese[item.campo] === opcao && opcao === "Sim" ? { background: "#dc2626", borderColor: "#dc2626", color: "#fff" } : {}}
                              onClick={() => setFormAnamnese((p) => ({ ...p, [item.campo]: opcao }))}
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

            {/* ── ABA EVOLUÇÃO CLÍNICA ── */}
            {abaAtendimento === "evolucao" && (
              <div>
                <h3 style={{ color: "#0f766e", marginTop: 0 }}>📊 Evolução Clínica</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[
                    { campo: "evolucao",   label: "Evolução do atendimento",              placeholder: "Descreva a evolução clínica do paciente nesta consulta", rows: 4 },
                    { campo: "diagnostico",label: "Diagnóstico odontológico",              placeholder: "Diagnóstico clínico e/ou radiográfico", rows: 3 },
                    { campo: "conduta",    label: "Conduta / Plano de tratamento",         placeholder: "Descreva a conduta adotada e plano de tratamento", rows: 3 },
                    { campo: "prescricao", label: "Prescrições / Orientações ao paciente", placeholder: "Medicamentos prescritos, cuidados pós-procedimento, retorno...", rows: 3 },
                  ].map(({ campo, label, placeholder, rows }) => (
                    <div key={campo} style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px 16px", border: "1px solid #e2e8f0" }}>
                      <label style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: "8px" }}>{label}</label>
                      <textarea
                        className="textarea"
                        rows={rows}
                        style={{ margin: 0, background: "#fff" }}
                        value={formAnamnese[campo]}
                        onChange={(e) => setFormAnamnese((p) => ({ ...p, [campo]: e.target.value }))}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ABA PROCEDIMENTOS ── */}
            {abaAtendimento === "procedimentos" && (
              <div>
                <h3 style={{ color: "#0f766e", marginTop: 0 }}>🦷 Procedimentos Realizados</h3>

                {(atendimentoAberto.procedimentosSolicitados || []).length > 0 && (
                  <div style={{ background: "#f0fdfa", border: "2px solid #99f6e4", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
                    <div style={{ fontWeight: 700, color: "#0f766e", marginBottom: "10px", fontSize: "13px" }}>
                      🦷 Solicitados pela Recepção — clique para adicionar ao atendimento:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {(atendimentoAberto.procedimentosSolicitados || []).map((p, i) => {
                        const jaSel = procedimentosSelecionados.some((s) => s.nome === p.nome);
                        return (
                          <button
                            key={i}
                            className="secondary-btn odonto-chip-btn"
                            style={{ background: jaSel ? "#0f766e" : "#fff", color: jaSel ? "#fff" : "#0f766e", borderColor: "#0f766e", fontWeight: 600 }}
                            onClick={() => {
                              if (!jaSel) {
                                setProcedimentosSelecionados((prev) => [...prev, { procedimentoId: `sol-${i}`, nome: p.nome, categoria: p.categoria || "", valor: Number(p.valor) || 0, desconto: 0, valorFinal: Number(p.valor) || 0, observacoes: "" }]);
                              }
                            }}
                            disabled={jaSel}
                          >
                            {jaSel ? "✓ " : "+ "}{p.nome}{p.valor ? ` (${formatarValor(p.valor)})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
                  <strong style={{ display: "block", marginBottom: "10px", color: "#334155" }}>Adicionar outros procedimentos</strong>
                  <div className="odonto-proc-chips">
                    {procedimentos.filter((p) => p.status === "ativo").map((proc) => (
                      <button key={proc.id} className="secondary-btn odonto-chip-btn" onClick={() => adicionarProcedimento(proc)}>
                        + {proc.nome} ({formatarValor(proc.valor)})
                      </button>
                    ))}
                  </div>
                </div>

                {procedimentosSelecionados.length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: "12px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🦷</div>
                    <div style={{ fontWeight: 600 }}>Nenhum procedimento adicionado ainda.</div>
                  </div>
                )}

                {procedimentosSelecionados.map((p) => (
                  <div key={p.procedimentoId} className="odonto-proc-item" style={{ border: "1px solid #e2e8f0", borderRadius: "12px", marginBottom: "12px", overflow: "hidden" }}>
                    <div className="odonto-proc-header" style={{ background: "linear-gradient(to right, #f0fdfa, #f8fafc)", borderBottom: "1px solid #e2e8f0" }}>
                      <strong style={{ color: "#0f766e" }}>{p.nome}</strong>
                      <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a" }}>{p.categoria}</span>
                      <button className="secondary-btn" style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "12px", color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => removerProcedimento(p.procedimentoId)}>
                        Remover
                      </button>
                    </div>
                    <div className="form-grid-2" style={{ marginTop: "0", padding: "12px 14px" }}>
                      <div>
                        <label>Valor (R$)</label>
                        <input className="input" type="number" min="0" value={p.valor} onChange={(e) => atualizarProcedimento(p.procedimentoId, "valor", e.target.value)} />
                      </div>
                      <div>
                        <label>Desconto (R$)</label>
                        <input className="input" type="number" min="0" value={p.desconto} onChange={(e) => atualizarProcedimento(p.procedimentoId, "desconto", e.target.value)} />
                      </div>
                      <div>
                        <label>Valor final</label>
                        <div style={{ padding: "10px 14px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "8px", fontWeight: 700, color: "#0f766e", fontSize: "16px" }}>
                          {formatarValor(p.valorFinal)}
                        </div>
                      </div>
                      <div>
                        <label>Observações</label>
                        <input className="input" value={p.observacoes} onChange={(e) => atualizarProcedimento(p.procedimentoId, "observacoes", e.target.value)} placeholder="Observações deste procedimento" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ABA RESUMO ── */}
            {abaAtendimento === "resumo" && (
              <div>
                <h3 style={{ color: "#0f766e", marginTop: 0 }}>💰 Resumo do Atendimento</h3>

                {procedimentosSelecionados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: "12px", marginBottom: "20px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🦷</div>
                    <div style={{ fontWeight: 600 }}>Nenhum procedimento realizado.</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>Vá para a aba Procedimentos para adicionar.</div>
                  </div>
                ) : (
                  <table className="table" style={{ marginBottom: "20px" }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(to right, #f0fdfa, #f8fafc)" }}>
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
                          <td style={{ fontWeight: 600 }}>{p.nome}</td>
                          <td>{p.categoria}</td>
                          <td>{formatarValor(p.valor)}</td>
                          <td style={{ color: "#dc2626" }}>{formatarValor(p.desconto)}</td>
                          <td><strong style={{ color: "#0f766e", fontSize: "15px" }}>{formatarValor(p.valorFinal)}</strong></td>
                          <td style={{ color: "#64748b" }}>{p.observacoes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="form-grid-2" style={{ marginBottom: "20px" }}>
                  <div>
                    <label>Desconto geral adicional (R$)</label>
                    <input className="input" type="number" min="0" value={descontoGeral} onChange={(e) => setDescontoGeral(e.target.value)} />
                  </div>
                  <div>
                    <label>Observações finais do atendimento</label>
                    <input className="input" value={obsAtendimento} onChange={(e) => setObsAtendimento(e.target.value)} placeholder="Observações gerais" />
                  </div>
                </div>

                <div style={{ background: "linear-gradient(135deg, #f0fdfa, #f8fafc)", border: "2px solid #99f6e4", borderRadius: "14px", padding: "20px 24px", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px", color: "#475569" }}>
                    <span>Subtotal dos procedimentos</span>
                    <strong>{formatarValor(subtotalAtendimento)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px", fontSize: "14px", color: "#dc2626" }}>
                    <span>Desconto geral</span>
                    <strong>— {formatarValor(descontoGeral)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #0f766e22", paddingTop: "14px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f766e" }}>Total a pagar</span>
                    <strong style={{ fontSize: "24px", color: "#0f766e" }}>
                      {formatarValor(Math.max(0, subtotalAtendimento - Number(descontoGeral)))}
                    </strong>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: "20px" }}>
                    <div>
                      <label>Forma de pagamento</label>
                      <select className="select" value={formaPagamentoOdonto} onChange={(e) => setFormaPagamentoOdonto(e.target.value)}>
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
                      <select className="select" value={statusPagamentoOdonto} onChange={(e) => setStatusPagamentoOdonto(e.target.value)}>
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

        <div className="toolbar" style={{ marginTop: "20px", gap: "12px" }}>
          <button className="primary-btn odonto-primary" style={{ padding: "10px 24px" }} onClick={salvarAtendimento}>
            💾 Salvar atendimento
          </button>
          <button className="secondary-btn" style={{ padding: "10px 24px", background: "#16a34a", color: "#fff", border: "none" }} onClick={finalizarAtendimento}>
            ✅ Finalizar atendimento
          </button>
          <button className="secondary-btn" style={{ padding: "10px 24px" }} onClick={voltarParaFila}>
            ← Voltar à fila
          </button>
        </div>
      </div>
    );
  }

  // ── Tela principal ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "52px", height: "52px", flexShrink: 0,
          background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
          borderRadius: "14px", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "26px",
          boxShadow: "0 4px 14px rgba(15,118,110,0.35)",
        }}>🦷</div>
        <div>
          <h1 style={{ margin: 0 }}>Odontologia</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Agendamentos, fila de atendimento e procedimentos odontológicos
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        {[
          { label: "Agendados hoje",  value: agendamentosHoje.length,        color: "#2563eb", icon: "📅", info: "Total do dia",    aba: "agendamentos" },
          { label: "Aguardando",      value: filaAguardando.length,           color: "#d97706", icon: "⏳", info: "Na fila agora",   aba: "fila" },
          { label: "Em atendimento",  value: filaEmAtendimento.length,        color: "#0f766e", icon: "🦷", info: "Ativos agora",    aba: "fila" },
          { label: "Finalizados hoje",value: filaFinalizados.length,          color: "#16a34a", icon: "✅", info: "Concluídos hoje", aba: "fila" },
        ].map((s) => (
          <div
            key={s.label}
            className="stat-box"
            style={{ borderTop: `4px solid ${s.color}`, cursor: "pointer", transition: "box-shadow 0.15s" }}
            onClick={() => setAbaAtual(s.aba)}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="stat-label">{s.label}</div>
              <span style={{ fontSize: "20px" }}>{s.icon}</span>
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-info">{s.info}</div>
          </div>
        ))}
      </div>

      {/* Abas principais */}
      <div className="medical-tabs" style={{ marginBottom: "16px" }}>
        {[
          { id: "agendamentos", label: "Agendamentos",       icon: "📅", count: agendamentosFiltrados.length },
          { id: "fila",         label: "Fila de Atendimento",icon: "⏳", count: filaAguardando.length + filaEmAtendimento.length },
          { id: "procedimentos",label: "Procedimentos",      icon: "📋", count: procedimentos.filter((p) => p.status === "ativo").length },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`medical-tab odonto-tab ${abaAtual === tab.id ? "active" : ""}`}
            onClick={() => setAbaAtual(tab.id)}
          >
            {tab.icon} {tab.label}
            {tab.count > 0 && (
              <span style={{
                marginLeft: "6px",
                background: abaAtual === tab.id ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                color: abaAtual === tab.id ? "#fff" : "#475569",
                borderRadius: "10px", padding: "1px 7px",
                fontSize: "11px", fontWeight: 700,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ABA AGENDAMENTOS ── */}
      {abaAtual === "agendamentos" && (
        <div className="page-card module-odonto">
          <div className="card-title-row">
            <div>
              <h3 style={{ margin: 0 }}>📅 Agendamentos Odontológicos</h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                {agendamentosFiltrados.length} agendamento{agendamentosFiltrados.length !== 1 ? "s" : ""} encontrado{agendamentosFiltrados.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button className="primary-btn odonto-primary" onClick={abrirFormAgendamento}>
              + Novo Agendamento
            </button>
          </div>

          {/* Busca */}
          <div style={{ margin: "0 0 16px" }}>
            <input
              className="input"
              style={{ margin: 0 }}
              placeholder="🔍 Buscar paciente ou profissional..."
              value={buscaAgendamentos}
              onChange={(e) => setBuscaAgendamentos(e.target.value)}
            />
          </div>

          {/* Formulário inline de agendamento */}
          {formAgendamentoAberto && (
            <div className="odonto-form-panel" style={{ border: "2px solid #99f6e4", marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "16px", color: "#0f766e", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🦷</span> Novo Agendamento Odontológico
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
                        <option key={p.id} value={p.id}>{p.nome || p.name}</option>
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
                        <option key={u.id} value={u.id}>{u.nome || u.name}</option>
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
                  <input className="input" type="date" value={formAgendamento.data} onChange={(e) => handleAgendamento("data", e.target.value)} />
                </div>
                <div>
                  <label>Horário *</label>
                  <input className="input" type="time" value={formAgendamento.hora} onChange={(e) => handleAgendamento("hora", e.target.value)} />
                </div>
                <div>
                  <label>Tipo de atendimento</label>
                  <select className="select" value={formAgendamento.tipoAtendimento} onChange={(e) => handleAgendamento("tipoAtendimento", e.target.value)}>
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
                  <select className="select" value={formAgendamento.status} onChange={(e) => handleAgendamento("status", e.target.value)}>
                    <option value="agendado">Agendado</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="full-width">
                  <label>Observações</label>
                  <textarea className="textarea" value={formAgendamento.observacoes} onChange={(e) => handleAgendamento("observacoes", e.target.value)} placeholder="Observações do agendamento" style={{ minHeight: "70px" }} />
                </div>
              </div>
              <div className="toolbar" style={{ marginTop: "16px" }}>
                <button className="primary-btn odonto-primary" onClick={salvarAgendamento}>Salvar agendamento</button>
                <button className="secondary-btn" onClick={() => setFormAgendamentoAberto(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <table className="table">
            <thead>
              <tr style={{ background: "linear-gradient(to right, #f0fdfa, #f8fafc)" }}>
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
              {agendamentosFiltrados
                .filter((ag) => {
                  if (!buscaAgendamentos) return true;
                  const t = buscaAgendamentos.toLowerCase();
                  return (
                    (ag.pacienteNome || "").toLowerCase().includes(t) ||
                    (ag.profissionalNome || "").toLowerCase().includes(t)
                  );
                })
                .map((ag) => (
                  <tr key={ag.id} style={{ borderLeft: `3px solid ${corStatus(ag.status)}22` }}>
                    <td>
                      {ag.hora ? (
                        <span style={{ fontWeight: 700, color: "#0f766e", background: "#f0fdfa", borderRadius: "6px", padding: "2px 8px", fontSize: "13px" }}>
                          {ag.hora}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ fontWeight: 600 }}>{ag.pacienteNome || "—"}</td>
                    <td style={{ color: "#475569" }}>{ag.profissionalNome || "—"}</td>
                    <td style={{ maxWidth: "180px" }}>
                      {(ag.procedimentosSolicitados || []).length > 0 ? (
                        <div style={{ fontSize: "12px" }}>
                          {(ag.procedimentosSolicitados || []).map((p) => p.nome).join(", ")}
                          {ag.valorEstimado ? (
                            <div style={{ fontWeight: 700, color: "#0f766e" }}>{formatarValor(ag.valorEstimado)}</div>
                          ) : null}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td style={{ color: "#64748b", fontSize: "13px" }}>{ag.data || "—"}</td>
                    <td>
                      <span className="badge" style={{ background: corStatus(ag.status) + "18", color: corStatus(ag.status), border: `1px solid ${corStatus(ag.status)}44`, fontWeight: 600 }}>
                        {labelStatus(ag.status)}
                      </span>
                    </td>
                    <td>
                      {ag.pagamentoId ? (
                        <span style={{
                          fontSize: "12px",
                          background: ag.statusPagamento === "pago" ? "#f0fdf4" : "#fffbeb",
                          color: ag.statusPagamento === "pago" ? "#16a34a" : "#d97706",
                          border: `1px solid ${ag.statusPagamento === "pago" ? "#86efac" : "#fde68a"}`,
                          borderRadius: "6px", padding: "2px 8px", fontWeight: 600,
                        }}>
                          {ag.statusPagamento === "pago" ? "✓ Pago" : "⏳ Pendente"}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {(ag.status === "agendado" || ag.status === "aguardando_pagamento") && (
                          <button className="primary-btn odonto-primary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => encaminharParaFila(ag)}>
                            Encaminhar
                          </button>
                        )}
                        {ag.status !== "cancelado" && ag.status !== "finalizado" && (
                          <button className="secondary-btn" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => atualizarStatusAgendamento(ag.id, "cancelado")}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {agendamentosFiltrados.filter((ag) => {
                if (!buscaAgendamentos) return true;
                const t = buscaAgendamentos.toLowerCase();
                return (ag.pacienteNome || "").toLowerCase().includes(t) || (ag.profissionalNome || "").toLowerCase().includes(t);
              }).length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>📅</div>
                    <div style={{ fontWeight: 600 }}>{buscaAgendamentos ? "Nenhum resultado encontrado." : "Nenhum agendamento cadastrado."}</div>
                    {!buscaAgendamentos && <div style={{ fontSize: "13px", marginTop: "4px" }}>Use o botão acima para criar o primeiro agendamento.</div>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ABA FILA ── */}
      {abaAtual === "fila" && (
        <div>
          {/* Barra de controles */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap",
          }}>
            {/* Toggle Hoje / Tudo */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "8px", padding: "3px", gap: "2px", flexShrink: 0 }}>
              {[{ v: "hoje", label: "Hoje" }, { v: "tudo", label: "Todos" }].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setFiltroFila(opt.v)}
                  style={{
                    background: filtroFila === opt.v ? "#fff" : "none",
                    border: filtroFila === opt.v ? "1px solid #e2e8f0" : "1px solid transparent",
                    borderRadius: "6px", padding: "5px 14px", fontSize: "12px",
                    fontWeight: filtroFila === opt.v ? 700 : 500,
                    color: filtroFila === opt.v ? "#0f766e" : "#64748b",
                    cursor: "pointer", boxShadow: filtroFila === opt.v ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Busca */}
            <input
              className="input"
              style={{ margin: 0, flex: 1, minWidth: "160px", maxWidth: "320px" }}
              placeholder="Buscar paciente..."
              value={buscaFila}
              onChange={(e) => setBuscaFila(e.target.value)}
            />
            {/* Contador rápido */}
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto", flexShrink: 0 }}>
              {[
                { label: "Aguardando", count: filaAguardando.length, color: "#d97706", bg: "#fffbeb" },
                { label: "Atendendo",  count: filaEmAtendimento.length, color: "#0f766e", bg: "#f0fdf9" },
                { label: "Prontos",    count: filaFinalizados.length, color: "#16a34a", bg: "#f0fdf4" },
              ].map((s) => (
                <span key={s.label} style={{ fontSize: "11px", fontWeight: 700, background: s.bg, color: s.color, borderRadius: "999px", padding: "3px 10px", border: `1px solid ${s.color}22` }}>
                  {s.count} {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Alerta: agendamentos de hoje ainda não encaminhados */}
          {filtroFila === "hoje" && agendamentosNaoEncaminhados.length > 0 && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px",
              padding: "12px 16px", marginBottom: "14px",
              display: "flex", alignItems: "flex-start", gap: "10px",
            }}>
              <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>
                  {agendamentosNaoEncaminhados.length} agendamento{agendamentosNaoEncaminhados.length > 1 ? "s" : ""} de hoje ainda não encaminhado{agendamentosNaoEncaminhados.length > 1 ? "s" : ""} para a fila
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {agendamentosNaoEncaminhados.map((ag) => (
                    <div key={ag.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #fde68a", borderRadius: "8px", padding: "4px 10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#78350f" }}>
                        {ag.hora && <span style={{ color: "#92400e", marginRight: "4px" }}>{ag.hora}</span>}
                        {ag.pacienteNome}
                      </span>
                      <button
                        onClick={() => encaminharParaFila(ag)}
                        style={{ background: "#f59e0b", border: "none", color: "#fff", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Encaminhar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setAbaAtual("agendamentos")}
                style={{ background: "none", border: "none", color: "#92400e", fontSize: "11px", fontWeight: 600, cursor: "pointer", flexShrink: 0, textDecoration: "underline" }}
              >
                Ver todos
              </button>
            </div>
          )}

          {/* Kanban 3 colunas */}
          <div className="odonto-fila-grid">
            {/* ── Aguardando ── */}
            <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "2px solid #fef3c7", background: "#fffbeb", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", flex: 1 }}>Aguardando</span>
                <span style={{ background: "#fde68a", color: "#92400e", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "1px 8px" }}>
                  {filaAguardando.filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())).length}
                </span>
              </div>
              <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px", minHeight: "120px" }}>
                {filaAguardando
                  .filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase()))
                  .map((at) => {
                    const espera = tempoEspera(at);
                    return (
                      <div key={at.id} style={{
                        background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "3px solid #f59e0b",
                        borderRadius: "10px", padding: "10px 12px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {at.pacienteNome}
                          </span>
                          {at.hora && (
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "5px", padding: "1px 6px", flexShrink: 0 }}>
                              {at.hora}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                          {at.tipoAtendimento}
                          {(isAdmin || userData?.role === "recepcao") && at.profissionalNome && (
                            <span style={{ color: "#7c3aed", marginLeft: "6px" }}>· {at.profissionalNome}</span>
                          )}
                        </div>
                        {(at.procedimentosSolicitados || []).length > 0 && (
                          <div style={{ fontSize: "10px", color: "#0f766e", marginBottom: "5px", lineHeight: 1.4 }}>
                            {(at.procedimentosSolicitados || []).map((p) => p.nome).join(" · ")}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "4px" }}>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {espera && (
                              <span style={{ fontSize: "10px", background: "#f1f5f9", color: "#64748b", borderRadius: "5px", padding: "1px 6px" }}>
                                ⏱ {espera}
                              </span>
                            )}
                            {at.pagamentoId && (
                              <span style={{
                                fontSize: "10px", borderRadius: "5px", padding: "1px 6px",
                                background: at.statusPagamento === "pago" ? "#f0fdf4" : "#fffbeb",
                                color: at.statusPagamento === "pago" ? "#16a34a" : "#d97706",
                                border: `1px solid ${at.statusPagamento === "pago" ? "#86efac" : "#fde68a"}`,
                              }}>
                                {at.statusPagamento === "pago" ? "✓ Pago" : "⏳ Pendente"}
                              </span>
                            )}
                          </div>
                          <button
                            className="primary-btn odonto-primary"
                            style={{ padding: "5px 12px", fontSize: "11px", flexShrink: 0 }}
                            onClick={() => abrirAtendimento(at)}
                          >
                            Atender
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {filaAguardando.filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())).length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 8px", color: "#94a3b8", fontSize: "12px" }}>
                    {buscaFila ? "Nenhum resultado." : filtroFila === "hoje" ? "Fila vazia hoje." : "Nenhum aguardando."}
                  </div>
                )}
              </div>
            </div>

            {/* ── Em Atendimento ── */}
            <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "2px solid #99f6e4", background: "#f0fdf9", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0f766e", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#134e4a", flex: 1 }}>Em Atendimento</span>
                <span style={{ background: "#99f6e4", color: "#134e4a", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "1px 8px" }}>
                  {filaEmAtendimento.filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())).length}
                </span>
              </div>
              <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px", minHeight: "120px" }}>
                {filaEmAtendimento
                  .filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase()))
                  .map((at) => {
                    const espera = tempoEspera(at);
                    return (
                      <div key={at.id} style={{
                        background: "#f0fdf9", border: "1px solid #a7f3d0", borderLeft: "3px solid #0f766e",
                        borderRadius: "10px", padding: "10px 12px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {at.pacienteNome}
                          </span>
                          {at.hora && (
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: "5px", padding: "1px 6px", flexShrink: 0 }}>
                              {at.hora}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#047857", marginBottom: "6px" }}>
                          {at.tipoAtendimento}
                          {(isAdmin || userData?.role === "recepcao") && at.profissionalNome && (
                            <span style={{ color: "#7c3aed", marginLeft: "6px" }}>· {at.profissionalNome}</span>
                          )}
                        </div>
                        {(at.procedimentosSolicitados || []).length > 0 && (
                          <div style={{ fontSize: "10px", color: "#0f766e", marginBottom: "5px", lineHeight: 1.4 }}>
                            {(at.procedimentosSolicitados || []).map((p) => p.nome).join(" · ")}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "4px" }}>
                          {espera && (
                            <span style={{ fontSize: "10px", background: "#d1fae5", color: "#065f46", borderRadius: "5px", padding: "1px 6px" }}>
                              ⏱ {espera}
                            </span>
                          )}
                          <button
                            className="primary-btn odonto-primary"
                            style={{ padding: "5px 12px", fontSize: "11px", flexShrink: 0, marginLeft: "auto" }}
                            onClick={() => abrirAtendimento(at)}
                          >
                            Continuar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {filaEmAtendimento.filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())).length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 8px", color: "#94a3b8", fontSize: "12px" }}>
                    Nenhum em atendimento agora.
                  </div>
                )}
              </div>
            </div>

            {/* ── Finalizados ── */}
            <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "2px solid #bbf7d0", background: "#f0fdf4", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#14532d", flex: 1 }}>Finalizados</span>
                <span style={{ background: "#bbf7d0", color: "#14532d", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "1px 8px" }}>
                  {filaFinalizados.filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())).length}
                </span>
              </div>
              <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px", minHeight: "120px" }}>
                {filaFinalizados
                  .filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase()))
                  .map((at) => (
                    <div key={at.id} style={{
                      background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "3px solid #16a34a",
                      borderRadius: "10px", padding: "10px 12px", opacity: 0.9,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {at.pacienteNome}
                        </span>
                        {at.hora && (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", background: "#dcfce7", border: "1px solid #86efac", borderRadius: "5px", padding: "1px 6px", flexShrink: 0 }}>
                            {at.hora}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "5px" }}>
                        {at.tipoAtendimento}
                        {(isAdmin || userData?.role === "recepcao") && at.profissionalNome && (
                          <span style={{ color: "#7c3aed", marginLeft: "6px" }}>· {at.profissionalNome}</span>
                        )}
                      </div>
                      {(at.procedimentosRealizados || []).length > 0 && (
                        <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "5px", lineHeight: 1.4 }}>
                          {(at.procedimentosRealizados || []).map((p) => p.nome).join(" · ")}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        {at.valorFinal > 0 && (
                          <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700 }}>{formatarValor(at.valorFinal)}</span>
                        )}
                        <button
                          className="secondary-btn"
                          style={{ padding: "4px 10px", fontSize: "11px", flexShrink: 0, marginLeft: "auto" }}
                          onClick={() => abrirAtendimento(at)}
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  ))}
                {filaFinalizados.filter((a) => !buscaFila || (a.pacienteNome || "").toLowerCase().includes(buscaFila.toLowerCase())).length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 8px", color: "#94a3b8", fontSize: "12px" }}>
                    {buscaFila ? "Nenhum resultado." : "Nenhum finalizado ainda."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA PROCEDIMENTOS ── */}
      {abaAtual === "procedimentos" && (
        <div className="page-card module-odonto">
          <div className="card-title-row">
            <div>
              <h3 style={{ margin: 0 }}>📋 Procedimentos Odontológicos</h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                {procedimentos.filter((p) => p.status === "ativo").length} procedimento{procedimentos.filter((p) => p.status === "ativo").length !== 1 ? "s" : ""} ativo{procedimentos.filter((p) => p.status === "ativo").length !== 1 ? "s" : ""}
              </p>
            </div>
            {isAdmin ? (
              <button className="primary-btn odonto-primary" onClick={abrirCriarProc}>+ Novo Procedimento</button>
            ) : (
              <span style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "4px 10px" }}>
                🔒 Somente administradores
              </span>
            )}
          </div>

          {/* Formulário inline de procedimento */}
          {formProcAberto && (
            <div className="odonto-form-panel" style={{ border: "2px solid #99f6e4", marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "16px", color: "#0f766e" }}>
                {editandoProc ? "✏️ Editar Procedimento" : "➕ Novo Procedimento"}
              </h4>
              <div className="form-grid-2">
                <div className="full-width">
                  <label>Nome *</label>
                  <input className="input" value={formProc.nome} onChange={(e) => setFormProc((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome do procedimento" />
                </div>
                <div>
                  <label>Categoria</label>
                  <select className="select" value={formProc.categoria} onChange={(e) => setFormProc((f) => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Selecione</option>
                    {Object.keys(CATEGORIA_CORES).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label>Valor padrão (R$) *</label>
                  <input className="input" type="number" min="0" value={formProc.valor} onChange={(e) => setFormProc((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                </div>
                <div>
                  <label>Tempo estimado (min)</label>
                  <input className="input" type="number" min="0" value={formProc.tempoEstimado} onChange={(e) => setFormProc((f) => ({ ...f, tempoEstimado: e.target.value }))} placeholder="30" />
                </div>
                <div>
                  <label>Status</label>
                  <select className="select" value={formProc.status} onChange={(e) => setFormProc((f) => ({ ...f, status: e.target.value }))}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div className="toolbar" style={{ marginTop: "16px" }}>
                <button className="primary-btn odonto-primary" onClick={salvarProc}>{editandoProc ? "Salvar alterações" : "Criar procedimento"}</button>
                <button className="secondary-btn" onClick={() => setFormProcAberto(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Cards por categoria */}
          {(() => {
            const categorias = [...new Set(procedimentos.map((p) => p.categoria || "Outros"))].sort();
            return categorias.map((cat) => {
              const procs = procedimentos.filter((p) => (p.categoria || "Outros") === cat);
              const cores = CATEGORIA_CORES[cat] || { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
              return (
                <div key={cat} style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{
                      background: cores.bg, color: cores.color,
                      border: `1px solid ${cores.border}`,
                      borderRadius: "8px", padding: "3px 12px",
                      fontSize: "13px", fontWeight: 700,
                    }}>{cat}</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {procs.filter((p) => p.status === "ativo").length} ativo{procs.filter((p) => p.status === "ativo").length !== 1 ? "s" : ""}
                      {procs.filter((p) => p.status === "inativo").length > 0 && ` · ${procs.filter((p) => p.status === "inativo").length} inativo${procs.filter((p) => p.status === "inativo").length !== 1 ? "s" : ""}`}
                    </span>
                    <div style={{ flex: 1, height: "1px", background: "#f1f5f9" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
                    {procs.map((proc) => (
                      <div
                        key={proc.id}
                        style={{
                          border: `1px solid ${proc.status === "inativo" ? "#f1f5f9" : cores.border}`,
                          borderRadius: "10px",
                          padding: "14px 16px",
                          background: proc.status === "inativo" ? "#fafafa" : cores.bg,
                          opacity: proc.status === "inativo" ? 0.6 : 1,
                          display: "flex", flexDirection: "column", gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <strong style={{ fontSize: "14px", color: proc.status === "inativo" ? "#94a3b8" : cores.color, lineHeight: 1.3 }}>
                            {proc.nome}
                          </strong>
                          <span style={{
                            fontSize: "11px", fontWeight: 700,
                            background: proc.status === "ativo" ? "#f0fdf4" : "#fef2f2",
                            color: proc.status === "ativo" ? "#16a34a" : "#dc2626",
                            border: `1px solid ${proc.status === "ativo" ? "#86efac" : "#fca5a5"}`,
                            borderRadius: "6px", padding: "1px 7px", flexShrink: 0, marginLeft: "8px",
                          }}>
                            {proc.status === "ativo" ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#475569" }}>
                          <span style={{ fontWeight: 700, color: cores.color, fontSize: "15px" }}>{formatarValor(proc.valor)}</span>
                          {proc.tempoEstimado ? <span>⏱ {proc.tempoEstimado} min</span> : null}
                        </div>
                        {isAdmin && (
                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: "12px", flex: 1 }} onClick={() => abrirEditarProc(proc)}>Editar</button>
                            <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: "12px", flex: 1 }} onClick={() => toggleStatusProc(proc)}>
                              {proc.status === "ativo" ? "Inativar" : "Ativar"}
                            </button>
                            <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: "12px", color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => excluirProc(proc)}>✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}

          {procedimentos.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: "15px" }}>Nenhum procedimento cadastrado.</div>
              <div style={{ fontSize: "13px", marginTop: "6px" }}>Carregando ou adicione o primeiro procedimento.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
