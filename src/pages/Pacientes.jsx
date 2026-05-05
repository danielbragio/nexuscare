import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

import { auth, db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
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

export default function Pacientes({
  pacientes = [],
  consultas = [],
  procedimentosOdonto = [],
  users = [],
  onAdicionarPaciente,
  onAdicionarConsulta,
  onEncaminharParaPagamento,
}) {
  const { userData, firebaseUser } = useAuth();

  const [abaAtiva, setAbaAtiva] = useState("cadastro");
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [salvandoConsulta, setSalvandoConsulta] = useState(false);

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
  const [carregandoProfissionaisOdonto, setCarregandoProfissionaisOdonto] = useState(false);
  const [profissionalOdontoId, setProfissionalOdontoId] = useState("");
  const [profissionalOdontoNome, setProfissionalOdontoNome] = useState("");
  const [horaOdonto, setHoraOdonto] = useState("");

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
      carregarProfissionaisDisponiveis(agendamento.data, especialidadeSelecionada);
    }
  }, [agendamento.data, consultas, especialidadeSelecionada]);

  async function carregarProfissionaisOdonto() {
    try {
      setCarregandoProfissionaisOdonto(true);
      const snap = await getDocs(query(collection(db, "users"), where("ativo", "==", true)));
      const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProfissionaisOdonto(todos.filter(profissionalEhOdontologico));
    } catch (e) {
      console.error("Erro ao carregar profissionais odonto:", e);
      setProfissionaisOdonto([]);
    } finally {
      setCarregandoProfissionaisOdonto(false);
    }
  }

  async function carregarProfissionaisDisponiveis(dataSelecionada, espFiltro = "") {
    if (!dataSelecionada) {
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

      const diaSemana = obterDiaSemana(dataSelecionada);

      const buscas = await Promise.allSettled([
        getDocs(query(collection(db, "users"), where("ativo", "==", true))),
        getDocs(query(collection(db, "medicos"), where("ativo", "==", true))),
      ]);

      const profissionais = [];

      buscas.forEach((resultado) => {
        if (resultado.status !== "fulfilled") return;

        resultado.value.docs.forEach((documento) => {
          const dados = { id: documento.id, ...documento.data() };

          const jaExiste = profissionais.some(
            (item) =>
              obterIdProfissional(item) === obterIdProfissional(dados) ||
              normalizarTexto(item.email) === normalizarTexto(dados.email)
          );

          if (!jaExiste) {
            profissionais.push(dados);
          }
        });
      });

      const disponiveis = profissionais
        .filter((profissional) => profissional.ativo === true)
        .filter(profissionalEhAssistencial)
        .filter((profissional) => profissionalTemEspecialidade(profissional, espFiltro))
        .filter((profissional) => possuiAgendaNoDia(profissional, diaSemana))
        .map((profissional) => {
          const horariosCadastrados = obterHorariosDoProfissional(profissional, diaSemana);

          const horariosOcupados = consultas
            .filter((consulta) => consulta.data === dataSelecionada)
            .filter(consultaOcupaHorario)
            .filter((consulta) => consultaPertenceAoProfissional(consulta, profissional))
            .map((consulta) => normalizarHora(consulta.hora));

          const horariosLivres = horariosCadastrados.filter(
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

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleAgendamentoChange(e) {
    const { name, value } = e.target;

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
      return;
    }

    if (name === "medico") {
      const profissional = profissionaisDisponiveis.find(
        (item) => obterIdProfissional(item) === value
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
    const isOdontoNova =
      normalizarTexto(nova).includes("odonto") || normalizarTexto(nova).includes("dentis");
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
    setHorariosDisponiveis([]);
    setProfissionaisDisponiveis([]);
    if (isOdontoNova) carregarProfissionaisOdonto();
  }

  function limparFormulario() {
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
    if (!form.nome || !form.cpf || !form.telefone) {
      alert("Preencha nome, CPF e telefone.");
      return;
    }

    try {
      setSalvandoPaciente(true);
      await onAdicionarPaciente(form);
      limparFormulario();
      setAbaAtiva("buscar");
      alert("Paciente salvo com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar paciente:", error);
      alert("Não foi possível salvar o paciente.");
    } finally {
      setSalvandoPaciente(false);
    }
  }

  async function registrarAtendimento() {
    if (!agendamento.nomePaciente || !agendamento.data) {
      alert("Preencha ao menos o nome do paciente e a data.");
      return;
    }

    if (destinoAtendimento === "odonto") {
      if (!agendamento.nomePaciente.trim()) {
        alert("Informe o nome do paciente.");
        return;
      }
      try {
        setSalvandoConsulta(true);
        const statusInicial =
          agendamento.tipoAtendimento === "Atendimento Imediato" ? "aguardando" : "agendado";
        const tipoAtend =
          agendamento.tipoAtendimento === "Atendimento Imediato" ? "Consulta Imediata" : "Consulta";
        const valorTotal = procedimentosSelecionadosOdonto.reduce(
          (acc, p) => acc + Number(p.valor || 0), 0
        );
        const descricaoProc =
          procedimentosSelecionadosOdonto.map((p) => p.nome).join(", ") ||
          "Atendimento odontológico";
        const dataHoje = new Date().toISOString().split("T")[0];

        // 1. Criar agendamento odonto
        const agRef = await addDoc(collection(db, "agendamentosOdonto"), {
          pacienteNome: agendamento.nomePaciente,
          pacienteId: "",
          profissionalNome: profissionalOdontoNome || "",
          profissionalId: profissionalOdontoId || "",
          data: agendamento.data || dataHoje,
          hora: horaOdonto || "",
          tipoAtendimento: tipoAtend,
          status: statusInicial,
          procedimentosSolicitados: procedimentosSelecionadosOdonto,
          valorEstimado: valorTotal,
          observacoes: agendamento.observacoesRecepcao,
          origemRecepcao: true,
          pagamentoId: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Criar pagamento pendente vinculado
        const pagRef = await addDoc(collection(db, "pagamentos"), {
          paciente: agendamento.nomePaciente,
          nomePaciente: agendamento.nomePaciente,
          pacienteId: "",
          profissional: profissionalOdontoNome || "",
          profissionalId: profissionalOdontoId || "",
          descricao: descricaoProc,
          servico: "Odontologia",
          procedimentos: procedimentosSelecionadosOdonto,
          valor: valorTotal,
          status: "pendente",
          statusPagamento: "Pendente",
          formaPagamento: "",
          tipo: "odonto",
          origem: "odonto",
          agendamentoId: agRef.id,
          atendimentoOdontoId: "",
          data: agendamento.data || dataHoje,
          dataPagamento: "",
          createdAt: serverTimestamp(),
        });

        // 3. Vincular pagamentoId no agendamento
        await updateDoc(doc(db, "agendamentosOdonto", agRef.id), {
          pagamentoId: pagRef.id,
        });

        limparAgendamento();
        if (onEncaminharParaPagamento) {
          onEncaminharParaPagamento({
            pagamentoId: pagRef.id,
            atendimentoId: agRef.id,
            paciente: agendamento.nomePaciente,
            cpf: agendamento.cpf || "",
            telefone: agendamento.telefone || "",
            tipoAtendimento: `Odontologia — ${tipoAtend}`,
            profissional: profissionalOdontoNome || "",
            valor: valorTotal,
            descricao: descricaoProc,
            tipo: "odonto",
          });
        } else {
          alert(
            `Paciente encaminhado para Odontologia.\nPagamento pendente de ${valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} criado no módulo Pagamentos.`
          );
        }
      } catch (error) {
        console.error("Erro ao encaminhar para odonto:", error);
        alert("Não foi possível encaminhar para Odontologia.");
      } finally {
        setSalvandoConsulta(false);
      }
      return;
    }

    // Destino: médico (fluxo original)
    if (
      !agendamento.cpf ||
      !agendamento.telefone ||
      !agendamento.medico ||
      !agendamento.especialidade ||
      !agendamento.hora ||
      !agendamento.tipoAtendimento
    ) {
      alert("Preencha todos os dados do atendimento médico.");
      return;
    }

    const horarioAindaDisponivel = horariosDisponiveis.includes(normalizarHora(agendamento.hora));

    if (!horarioAindaDisponivel) {
      alert("Este horário não está mais disponível para o profissional selecionado.");
      return;
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
        medicoEmail: agendamento.medicoEmail,
        profissionalEmail: agendamento.medicoEmail,
        data: agendamento.data,
        hora: agendamento.hora,
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

      // Create linked payment for medical appointment
      let checkoutMedico = null;
      if (docRef?.id) {
        const valorConsulta = Number(agendamento.valorConsulta || 0);
        const pagRef = await addDoc(collection(db, "pagamentos"), {
          paciente: agendamento.nomePaciente,
          nomePaciente: agendamento.nomePaciente,
          cpf: agendamento.cpf,
          telefone: agendamento.telefone,
          profissional: agendamento.medico,
          especialidade: agendamento.especialidade,
          descricao: `Consulta — ${agendamento.especialidade}`,
          servico: "Consulta Médica",
          valor: valorConsulta,
          status: "pendente",
          statusPagamento: "Pendente",
          formaPagamento: "",
          tipo: "consulta",
          origem: "medico",
          consultaId: docRef.id,
          agendamentoId: docRef.id,
          data: agendamento.data,
          dataPagamento: "",
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "appointments", docRef.id), {
          pagamentoId: pagRef.id,
        });
        checkoutMedico = {
          pagamentoId: pagRef.id,
          atendimentoId: docRef.id,
          paciente: agendamento.nomePaciente,
          cpf: agendamento.cpf || "",
          telefone: agendamento.telefone || "",
          tipoAtendimento: `Consulta — ${agendamento.especialidade}`,
          profissional: agendamento.medico || "",
          valor: valorConsulta,
          descricao: `Consulta — ${agendamento.especialidade}`,
          tipo: "consulta",
        };
      }

      limparAgendamento();
      if (checkoutMedico && onEncaminharParaPagamento) {
        onEncaminharParaPagamento(checkoutMedico);
      } else {
        alert("Atendimento registrado com sucesso.\nPagamento pendente criado no módulo Pagamentos.");
      }
    } catch (error) {
      console.error("Erro ao registrar atendimento:", error);
      alert("Não foi possível registrar o atendimento.");
    } finally {
      setSalvandoConsulta(false);
    }
  }

  async function validarSenhaAdministrador() {
    if (!firebaseUser || !firebaseUser.email) {
      alert("Não foi possível validar o usuário logado.");
      return false;
    }

    const senha = prompt("Digite sua senha de administrador para confirmar:");

    if (!senha) return false;

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, senha);
      await reauthenticateWithCredential(auth.currentUser, credential);
      return true;
    } catch (error) {
      console.error("Erro ao validar senha:", error);
      alert("Senha inválida. Exclusão cancelada.");
      return false;
    }
  }

  async function excluirPaciente(paciente) {
    if (!isAdmin) {
      alert("Apenas administradores podem excluir cadastros.");
      return;
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o cadastro de ${paciente.nome}?`
    );

    if (!confirmar) return;

    const senhaValida = await validarSenhaAdministrador();

    if (!senhaValida) return;

    const motivo = prompt("Informe o motivo da exclusão:");

    if (!motivo) {
      alert("Informe o motivo para concluir a exclusão.");
      return;
    }

    try {
      await addDoc(collection(db, "auditLogs"), {
        tipo: "EXCLUSAO_PACIENTE",
        pacienteId: paciente.id,
        pacienteNome: paciente.nome || "",
        pacienteCpf: paciente.cpf || "",
        motivo,
        excluidoPor:
          userData?.nome || userData?.name || firebaseUser?.email || "Administrador",
        excluidoPorEmail: firebaseUser?.email || "",
        criadoEm: serverTimestamp(),
      });

      await deleteDoc(doc(db, "patients", paciente.id));

      alert("Cadastro excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir paciente:", error);
      alert("Erro ao excluir cadastro.");
    }
  }

  function carregarPaciente(item) {
    setForm({
      nome: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
      dataNascimento: item.dataNascimento || "",
      sexo: item.sexo || "",
      mae: item.mae || "",
      pai: item.pai || "",
      endereco: item.endereco || "",
      rua: item.rua || "",
      cep: item.cep || "",
      convenio: item.convenio || "Particular",
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

  function carregarParaAtendimento(item) {
    setAgendamento((prev) => ({
      ...prev,
      nomePaciente: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
    }));
    setAbaAtiva("agendamento");
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

  const profissionalDesabilitado =
    !especialidadeSelecionada ||
    !agendamento.data ||
    carregandoProfissionais ||
    profissionaisDisponiveis.length === 0;

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

      <div className="stats-grid">
        <div className="stat-box patients-stat patients-stat-blue">
          <div className="stat-label">Total de pacientes</div>
          <div className="stat-value">{totalPacientes}</div>
          <div className="stat-info">Base cadastrada</div>
        </div>

        <div className="stat-box patients-stat patients-stat-cyan">
          <div className="stat-label">Pacientes ativos</div>
          <div className="stat-value">{pacientesAtivos}</div>
          <div className="stat-info">Em acompanhamento</div>
        </div>

        <div className="stat-box patients-stat patients-stat-purple">
          <div className="stat-label">Retornos</div>
          <div className="stat-value">{pacientesRetorno}</div>
          <div className="stat-info">Consultas de revisão</div>
        </div>

        <div className="stat-box patients-stat patients-stat-green">
          <div className="stat-label">Atendimentos do paciente</div>
          <div className="stat-value">{consultasDoPaciente.length}</div>
          <div className="stat-info">Histórico na recepção</div>
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
            onClick={() => {
              setAbaAtiva("buscar");
              setPaginaBusca(1);
            }}
          >
            Buscar cadastro
          </button>

          <button
            className={`patients-tab ${abaAtiva === "agendamento" ? "active" : ""}`}
            onClick={() => setAbaAtiva("agendamento")}
          >
            Encaminhar atendimento
          </button>
        </div>

        <div style={conteudoAbaStyle}>
          {abaAtiva === "cadastro" && (
            <div className="patients-cadastro-layout" style={{ height: "100%" }}>
              <div className="patients-cadastro-main" style={scrollInternoStyle}>
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
                      />
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
                      <label>Endereço / bairro</label>
                      <input
                        className="input"
                        name="endereco"
                        value={form.endereco}
                        onChange={handleChange}
                        placeholder="Digite o bairro ou endereço geral"
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
                    {salvandoPaciente ? "Salvando..." : "Salvar paciente"}
                  </button>
                  <button onClick={limparFormulario} className="secondary-btn">
                    Limpar
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
                    <strong>{form.cpf || "—"}</strong>
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
                        <td>{item.cpf}</td>
                        <td>{item.telefone}</td>
                        <td>{item.convenio}</td>
                        <td>
                          <span className={badgeClass(item.status)}>{item.status}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              className="secondary-btn"
                              onClick={() => carregarPaciente(item)}
                            >
                              Carregar cadastro
                            </button>

                            <button
                              className="secondary-btn"
                              onClick={() => carregarParaAtendimento(item)}
                            >
                              Encaminhar
                            </button>

                            {isAdmin && (
                              <button
                                className="danger-btn"
                                onClick={() => excluirPaciente(item)}
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {buscaCadastroFiltrada.length === 0 && (
                      <tr>
                        <td colSpan="6">Nenhum cadastro encontrado.</td>
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
                  <h4 className="patients-section-title">Encaminhar atendimento</h4>

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
                      <select
                        className="select"
                        value={especialidadeSelecionada}
                        onChange={(e) => handleEspecialidadeChange(e.target.value)}
                      >
                        <option value="">Selecione a especialidade</option>
                        <optgroup label="🏥 Medicina">
                          {ESPECIALIDADES_MEDICO.map((esp) => (
                            <option key={`med-${esp}`} value={esp}>
                              {esp}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🦷 Odontologia">
                          {ESPECIALIDADES_ODONTO.filter(
                            (esp) => ESPECIALIDADES_ODONTO_EXCLUSIVAS.has(esp)
                          ).map((esp) => (
                            <option key={`odo-${esp}`} value={esp}>
                              {esp}
                            </option>
                          ))}
                        </optgroup>
                      </select>
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

                    <div>
                      <label>Data</label>
                      <input
                        className="input"
                        type="date"
                        name="data"
                        value={agendamento.data}
                        onChange={handleAgendamentoChange}
                      />
                    </div>

                    {destinoAtendimento === "odonto" ? (
                      <>
                        <div>
                          <label>Profissional odontológico</label>
                          <select
                            className="select"
                            value={profissionalOdontoId}
                            onChange={(e) => {
                              const id = e.target.value;
                              const prof = profissionaisOdonto.find((p) => (p.id || p.uid) === id);
                              setProfissionalOdontoId(id);
                              setProfissionalOdontoNome(prof ? obterNomeProfissional(prof) : "");
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
                              Cadastre um profissional com perfil "Odonto" na Administração para que ele apareça aqui.
                            </div>
                          )}
                        </div>

                        <div>
                          <label>Horário preferencial</label>
                          <input
                            className="input"
                            type="time"
                            value={horaOdonto}
                            onChange={(e) => setHoraOdonto(e.target.value)}
                          />
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
                                : !agendamento.data
                                ? "Selecione uma data"
                                : carregandoProfissionais
                                ? "Carregando profissionais..."
                                : profissionaisDisponiveis.length === 0
                                ? "Nenhum profissional disponível para esta data"
                                : "Selecione o profissional"}
                            </option>
                            {profissionaisDisponiveis.map((profissional) => (
                              <option
                                key={obterIdProfissional(profissional)}
                                value={obterIdProfissional(profissional)}
                              >
                                {profissional.nomeExibicao} — {profissional.totalHorariosLivres} horário(s)
                              </option>
                            ))}
                          </select>
                        </div>

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
                        ? "🦷 Encaminhar para Odontologia"
                        : "Encaminhar para o profissional"}
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
        </div>
      </div>
    </div>
  );
}