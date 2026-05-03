import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

import { auth, db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

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
  onAdicionarPaciente,
  onAdicionarConsulta,
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
  });

  const isAdmin = userData?.role === "admin";

  useEffect(() => {
    carregarProfissionaisDisponiveis(agendamento.data);
  }, [agendamento.data, consultas]);

  async function carregarProfissionaisDisponiveis(dataSelecionada) {
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
    });

    setProfissionaisDisponiveis([]);
    setHorariosDisponiveis([]);
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
    if (
      !agendamento.nomePaciente ||
      !agendamento.cpf ||
      !agendamento.telefone ||
      !agendamento.medico ||
      !agendamento.especialidade ||
      !agendamento.data ||
      !agendamento.hora ||
      !agendamento.tipoAtendimento
    ) {
      alert("Preencha os dados do atendimento.");
      return;
    }

    const horarioAindaDisponivel = horariosDisponiveis.includes(normalizarHora(agendamento.hora));

    if (!horarioAindaDisponivel) {
      alert("Este horário não está mais disponível para o profissional selecionado.");
      return;
    }

    try {
      setSalvandoConsulta(true);
      await onAdicionarConsulta({
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
      });

      limparAgendamento();
      alert("Atendimento registrado com sucesso.");
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
                          {!agendamento.data
                            ? "Selecione uma data primeiro"
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
                      <label>Especialidade</label>
                      <input
                        className="input"
                        name="especialidade"
                        value={agendamento.especialidade}
                        onChange={handleAgendamentoChange}
                        placeholder="Ex.: Médico, Enfermeiro, Odontólogo, Fisioterapeuta"
                      />
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
                      disabled={salvandoConsulta || carregandoProfissionais}
                    >
                      {salvandoConsulta ? "Enviando..." : "Enviar para o profissional"}
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