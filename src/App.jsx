import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  FileText,
  Stethoscope,
  Heart,
  Smile,
  Receipt,
  DollarSign,
  Package,
  BarChart2,
  BookOpen,
  Settings,
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { hasPermission } from "./config/permissions";
import api, { tokenStorage } from "./services/api";

import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import Pagamentos from "./pages/Pagamentos";
import Agendamentos from "./pages/Agendamentos";
import Medicos from "./pages/Medicos";
import Enfermagem from "./pages/Enfermagem";
import Odonto from "./pages/Odonto";
import Faturamento from "./pages/Faturamento";
import Financeiro from "./pages/Financeiro";
import Administracao from "./pages/Administracao";
import Normas from "./pages/Normas";
import Prontuario from "./pages/Prontuario";
import Estoque from "./pages/Estoque";
import Relatorios from "./pages/Relatorios";
import DashboardMedico from "./pages/DashboardMedico";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import ModalPerfil from "./components/ModalPerfil";

function LoginScreen() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!usuario.trim() || !senha) {
      setErro("Preencha usuário e senha.");
      return;
    }
    try {
      setCarregando(true);
      setErro("");
      await login(usuario.trim(), senha);
    } catch (error) {
      if (error.status === 401) setErro("Credenciais inválidas. Verifique usuário e senha.");
      else if (error.status === 403) setErro("Usuário inativo. Contate o administrador.");
      else if (error.isNetworkError) setErro("Não foi possível conectar ao servidor.");
      else setErro(`Não foi possível entrar. ${error.message || ""}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-page-v2">
      <div className="login-wrapper-v2">
        <div className="login-brand-panel-v2">
          <div className="login-brand-chip-v2">NexusCare</div>

          <h1 className="login-title-v2">
            Gestão clínica moderna, segura e integrada.
          </h1>

          <p className="login-description-v2">
            Acesse a plataforma com seu usuário criado no sistema e gerencie
            recepção, atendimentos, prontuários e setores administrativos em um
            único ambiente.
          </p>

          <div className="login-info-list-v2">
            <div className="login-info-item-v2">
              <strong>Recepção integrada</strong>
              <span>Cadastro, agendamento e atendimento imediato conectados.</span>
            </div>

            <div className="login-info-item-v2">
              <strong>Prontuário digital</strong>
              <span>Atendimentos médicos salvos e pesquisáveis.</span>
            </div>

            <div className="login-info-item-v2">
              <strong>Acesso por perfil</strong>
              <span>Usuários e permissões organizados por setor.</span>
            </div>
          </div>
        </div>

        <div className="login-card-v2">
          <div className="login-card-header-v2">
            <h2>Entrar</h2>
            <p>Informe seu usuário ou e-mail e senha para acessar o NexusCare.</p>
          </div>

          <div className="login-form-v2">
            <div className="login-field-v2">
              <label>Usuário ou e-mail</label>
              <input
                className="login-input-v2"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Digite seu usuário ou e-mail"
                autoComplete="username"
              />
            </div>

            <div className="login-field-v2">
              <label>Senha</label>
              <input
                className="login-input-v2"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") entrar();
                }}
              />
            </div>

            {erro && <div className="login-error-v2">{erro}</div>}

            <button
              className="login-button-v2"
              onClick={entrar}
              disabled={carregando}
            >
              {carregando ? "Entrando..." : "Acessar sistema"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EscolherConsultorio({
  consultorios = [],
  userData,
  onSelecionar,
  onSair,
}) {
  const meuId = String(userData?.id || "");

  function sessaoAtiva(consultorio) {
    if (!consultorio?.lastActive) return false;
    const ts = consultorio.lastActive?.toDate
      ? consultorio.lastActive.toDate()
      : new Date(consultorio.lastActive);
    return Date.now() - ts.getTime() < 60000;
  }

  const salas = Array.from({ length: 7 }, (_, index) => {
    const numero = index + 1;
    const encontrado = consultorios.find((item) => Number(item.numero) === numero);
    const ocupado = encontrado && sessaoAtiva(encontrado) ? encontrado : null;

    return {
      numero,
      nome: `Consultório ${numero}`,
      ocupado,
    };
  });

  async function escolherSala(sala) {
    if (sala.ocupado && sala.ocupado.medicoId !== meuId) {
      alert(`${sala.nome} já está em uso por ${sala.ocupado.medicoNome}.`);
      return;
    }

    await onSelecionar(sala.numero);
  }

  return (
    <div className="consultorio-select-page">
      <div className="consultorio-select-card">
        <div className="consultorio-select-header">
          <div>
            <span className="consultorio-chip">NexusCare</span>
            <h1>Escolha seu consultório</h1>
            <p>
              Selecione a sala onde você irá atender hoje. Essa informação será
              exibida no painel operacional em tempo real.
            </p>
          </div>

          <button className="secondary-btn" onClick={onSair}>
            Sair
          </button>
        </div>

        <div className="consultorio-user-box">
          <strong>{userData?.nome || userData?.email}</strong>
          <span>Perfil médico</span>
        </div>

        <div className="consultorio-grid">
          {salas.map((sala) => {
            const emUso = sala.ocupado && sala.ocupado.medicoId !== meuId;

            return (
              <button
                key={sala.numero}
                className={`consultorio-option ${emUso ? "ocupado" : "livre"}`}
                onClick={() => escolherSala(sala)}
                disabled={emUso}
              >
                <div>
                  <strong>{sala.nome}</strong>
                  <span>{emUso ? "Ocupado" : "Disponível"}</span>
                </div>

                {emUso ? (
                  <small>{sala.ocupado.medicoNome}</small>
                ) : (
                  <small>Clique para iniciar</small>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { userData, loading, logout } = useAuth();
  const meuId = String(userData?.id || "");
  const [view, setView] = useState("");
  const [sidebarMinimizada, setSidebarMinimizada] = useState(false);
  const [consultorioConfirmadoSessao, setConsultorioConfirmadoSessao] = useState(false);
  const [consultaSelecionadaExterna, setConsultaSelecionadaExterna] = useState(null);
  const [pagamentoCheckout, setPagamentoCheckout] = useState(null);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [users, setUsers] = useState([]);
  const [atendimentosOdonto, setAtendimentosOdonto] = useState([]);
  const [procedimentosOdonto, setProcedimentosOdonto] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Carregamento via API MySQL (módulos migrados) ─────────────────────────────
  const carregarPacientes = useCallback(async () => {
    try {
      const res = await api.pacientes.listar({ per_page: 200 });
      setPacientes(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro pacientes:", e);
    }
  }, []);

  const carregarPagamentos = useCallback(async () => {
    try {
      const res = await api.pagamentos.listar({ per_page: 200 });
      setPagamentos(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro pagamentos:", e);
    }
  }, []);

  const carregarConsultas = useCallback(async () => {
    try {
      const role = userData?.role || "";
      const podeVerTodos =
        role === "admin" || role === "recepcao" || role === "financeiro" ||
        role === "estoque" || role === "enfermagem" ||
        (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
      const params = { per_page: 200 };
      if (!podeVerTodos && userData?.id) {
        params.usuario_id = userData.id;
      }
      const res = await api.atendimentos.listar(params);
      const docs = Array.isArray(res?.data) ? res.data : [];
      if (!podeVerTodos) docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setConsultas(docs);
      setDataLoading(false);
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro consultas:", e);
      setConsultas([]);
      setDataLoading(false);
    }
  }, [userData?.id, userData?.role, userData?.permissions]);

  const carregarAtendimentosOdonto = useCallback(async () => {
    try {
      const res = await api.atendimentosOdonto.listar({ per_page: 200 });
      setAtendimentosOdonto(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro atendimentosOdonto:", e);
    }
  }, []);

  const carregarProcedimentosOdonto = useCallback(async () => {
    try {
      const res = await api.procedimentosOdonto.listar();
      setProcedimentosOdonto(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro procedimentosOdonto:", e);
    }
  }, []);

  const carregarUsuarios = useCallback(async () => {
    try {
      const res = await api.usuarios.listar({ per_page: 500 });
      setUsers(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro usuários:", e);
    }
  }, []);

  const carregarEstoque = useCallback(async () => {
    try { const r = await api.estoque.listar(); setEstoque(r.data || []); } catch { setEstoque([]); }
  }, []);


  // ── Busca global ─────────────────────────────────────────────────────────────
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [buscaGlobalAberta, setBuscaGlobalAberta] = useState(false);
  const refBuscaGlobal = useRef(null);

  useEffect(() => {
    function fecharBusca(e) {
      if (refBuscaGlobal.current && !refBuscaGlobal.current.contains(e.target)) {
        setBuscaGlobalAberta(false);
      }
    }
    document.addEventListener("mousedown", fecharBusca);
    return () => document.removeEventListener("mousedown", fecharBusca);
  }, []);

  const resultadosBusca = useMemo(() => {
    const termo = buscaGlobal.trim();
    if (!termo || termo.length < 2) return [];
    const norm = (str) =>
      String(str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const t = norm(termo);
    const inclui = (str) => norm(str).includes(t);
    const lista = [];

    pacientes.forEach((p) => {
      if (inclui(p.nome) || inclui(p.cpf) || inclui(p.telefone) || inclui(p.email)) {
        lista.push({
          id: `pac-${p.id}`,
          titulo: p.nome || "Paciente sem nome",
          tipo: "Paciente",
          descricao: [p.cpf && `CPF: ${p.cpf}`, p.telefone && `Tel: ${p.telefone}`].filter(Boolean).join(" · ") || "—",
          cor: "#2563eb", icone: "👤", view: "pacientes",
        });
      }
    });

    consultas.forEach((c) => {
      if (inclui(c.paciente) || inclui(c.nomePaciente) || inclui(c.medico) || inclui(c.especialidade) || inclui(c.status)) {
        lista.push({
          id: `con-${c.id}`,
          titulo: c.paciente || c.nomePaciente || "Consulta",
          tipo: "Agendamento",
          descricao: [c.medico && `Dr(a). ${c.medico}`, c.especialidade, c.data, c.status].filter(Boolean).join(" · "),
          cor: "#7c3aed", icone: "📅", view: "agendamentos",
        });
      }
    });

    pagamentos.forEach((p) => {
      if (inclui(p.paciente) || inclui(p.nomePaciente) || inclui(p.status) || inclui(p.statusPagamento) || inclui(p.descricao) || inclui(p.servico)) {
        lista.push({
          id: `pag-${p.id}`,
          titulo: p.paciente || p.nomePaciente || "Pagamento",
          tipo: "Pagamento",
          descricao: [p.descricao || p.servico, p.valor != null && `R$ ${Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, p.statusPagamento || p.status].filter(Boolean).join(" · "),
          cor: "#0f766e", icone: "💰", view: "financeiro",
        });
      }
    });

    users.forEach((u) => {
      if (inclui(u.nome) || inclui(u.name) || inclui(u.email) || inclui(u.especialidade) || inclui(u.role)) {
        lista.push({
          id: `usr-${u.id}`,
          titulo: u.nome || u.name || u.email || "Profissional",
          tipo: "Profissional",
          descricao: [u.role, u.especialidade, u.email].filter(Boolean).join(" · "),
          cor: "#d97706", icone: "👨‍⚕️", view: "admin",
        });
      }
    });

    atendimentosOdonto.forEach((at) => {
      if (inclui(at.pacienteNome) || inclui(at.profissionalNome) || inclui(at.status) || inclui(at.tipoAtendimento)) {
        lista.push({
          id: `ato-${at.id}`,
          titulo: at.pacienteNome || "Atendimento odontológico",
          tipo: "Odontologia",
          descricao: [at.profissionalNome && `Dr(a). ${at.profissionalNome}`, at.tipoAtendimento, at.status].filter(Boolean).join(" · "),
          cor: "#0d9488", icone: "🦷", view: "odonto",
        });
      }
    });

    return lista.slice(0, 10);
  }, [buscaGlobal, pacientes, consultas, pagamentos, users, atendimentosOdonto]);

  const isMedico =
    userData?.role === "medico" ||
    hasPermission(userData, "medicos");

  const consultorioAtual = useMemo(() => {
    if (!userData) return null;
    return consultorios.find((item) => item.medicoId === meuId) || null;
  }, [consultorios, meuId, userData]);


  useEffect(() => {
    setConsultorioConfirmadoSessao(false);
    setConsultaSelecionadaExterna(null);
  }, [userData?.id]);

  useEffect(() => {
    if (!consultorioConfirmadoSessao || !meuId) return;
    const interval = setInterval(async () => {
      try { await api.consultorios.ocupar({ status: 'ocupado' }); } catch (_) {}
    }, 10000);
    return () => clearInterval(interval);
  }, [consultorioConfirmadoSessao, meuId]);

  useEffect(() => {
    if (!consultorioConfirmadoSessao || !meuId) return;
    const handleUnload = () => {
      navigator.sendBeacon
        ? navigator.sendBeacon(`/nexuscare-api/api/consultorios/${meuId}`, '')
        : fetch(`/nexuscare-api/api/consultorios/${meuId}`, { method: 'DELETE', keepalive: true }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [consultorioConfirmadoSessao, meuId]);

  useEffect(() => {
    if (!userData) {
      setPacientes([]);
      setConsultas([]);
      setPagamentos([]);
      setConsultorios([]);
      setUsers([]);
      setAtendimentosOdonto([]);
      setProcedimentosOdonto([]);
      setEstoque([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    // ── Módulos migrados para MySQL: polling ───────────────────────────────
    carregarPacientes();
    carregarPagamentos();
    carregarConsultas();
    carregarAtendimentosOdonto();
    carregarProcedimentosOdonto();
    carregarUsuarios();
    const timerPacientes          = setInterval(carregarPacientes,          30000);
    const timerPagamentos         = setInterval(carregarPagamentos,         15000);
    const timerConsultas          = setInterval(carregarConsultas,          30000);
    const timerAtendimentosOdonto = setInterval(carregarAtendimentosOdonto, 30000);
    const timerUsuarios           = setInterval(carregarUsuarios,           60000);

    const carregarConsultorios = async () => {
      try { const r = await api.consultorios.listar(); setConsultorios(r.data || []); } catch { }
    };

    carregarConsultorios();
    carregarEstoque();
    const timerConsultorios = setInterval(carregarConsultorios, 10000);
    const timerEstoque      = setInterval(carregarEstoque,      15000);

    return () => {
      clearInterval(timerPacientes);
      clearInterval(timerPagamentos);
      clearInterval(timerConsultas);
      clearInterval(timerAtendimentosOdonto);
      clearInterval(timerUsuarios);
      clearInterval(timerConsultorios);
      clearInterval(timerEstoque);
    };
  }, [userData?.id, userData?.role, userData?.permissions, carregarPacientes, carregarPagamentos, carregarConsultas, carregarAtendimentosOdonto, carregarProcedimentosOdonto, carregarUsuarios, carregarEstoque]);

  async function criarUsuario(novoUsuario) {
    await api.usuarios.criar({
      login:            (novoUsuario.username || novoUsuario.login || "").trim(),
      nome:             novoUsuario.nome,
      email:            novoUsuario.email.trim().toLowerCase(),
      senha:            novoUsuario.senha,
      role:             novoUsuario.role || "recepcao",
      ativo:            novoUsuario.ativo !== false ? 1 : 0,
      permissions:      novoUsuario.permissions || [],
      crm:              novoUsuario.crm || null,
      coren:            novoUsuario.coren || null,
      cargo:            novoUsuario.cargo || null,
      especialidade:    novoUsuario.especialidade || null,
      especialidades:   novoUsuario.especialidades || [],
      atende_pacientes: (novoUsuario.atendePacientes || novoUsuario.atende_pacientes) ? 1 : 0,
      dias_atendimento: novoUsuario.diasAtendimento || [],
      horarios:         novoUsuario.horarios || [],
      hora_inicio:      novoUsuario.horaInicio || null,
      hora_fim:         novoUsuario.horaFim || null,
      intervalo:        novoUsuario.intervalo || 30,
      pausa_inicio:     novoUsuario.pausaInicio || null,
      pausa_fim:        novoUsuario.pausaFim || null,
    });
    await carregarUsuarios();
  }

  async function atualizarUsuario(id, dados) {
    await api.usuarios.atualizar(id, {
      login:            (dados.username || dados.login || dados.usuario || "").trim() || undefined,
      nome:             dados.nome || dados.name,
      email:            dados.email ? dados.email.trim().toLowerCase() : undefined,
      role:             dados.role,
      ativo:            dados.ativo !== false ? 1 : 0,
      permissions:      dados.permissions,
      crm:              dados.crm,
      coren:            dados.coren,
      cargo:            dados.cargo,
      especialidade:    dados.especialidade,
      especialidades:   dados.especialidades,
      atende_pacientes: (dados.atendePacientes || dados.atende_pacientes) ? 1 : 0,
      dias_atendimento: dados.diasAtendimento,
      horarios:         dados.horarios,
      hora_inicio:      dados.horaInicio,
      hora_fim:         dados.horaFim,
      intervalo:        dados.intervalo,
      pausa_inicio:     dados.pausaInicio,
      pausa_fim:        dados.pausaFim,
    });
    await carregarUsuarios();
  }

  async function excluirUsuario(usuario) {
    if (!usuario?.id) throw new Error("Usuário inválido para exclusão.");
    await api.usuarios.excluir(usuario.id);
    await carregarUsuarios();
  }

  async function selecionarConsultorio(numero) {
    if (!meuId) return;
    await api.consultorios.ocupar({
      numero,
      medico_nome:  userData?.nome  || userData?.email || "",
      medico_email: userData?.email || "",
      crm:          userData?.crm   || "",
      status:       "ocupado",
    });
    setConsultorioConfirmadoSessao(true);
    setView("medicos");
  }

  async function liberarConsultorio() {
    if (!meuId) return;
    try { await api.consultorios.liberar(meuId); } catch (e) {
      console.error("Erro ao liberar consultório:", e);
    }
  }

  async function liberarConsultorioDeUsuario(usuarioId) {
    try { await api.consultorios.liberar(String(usuarioId)); } catch (e) {
      console.error("Erro ao liberar consultório do usuário:", e);
    }
  }

  function encaminharParaPagamento(checkoutData) {
    setPagamentoCheckout(checkoutData);
    setView("pagamentos");
  }

  async function adicionarPaciente(novoPaciente) {
    await api.pacientes.criar({
      nome:                novoPaciente.nome,
      cpf:                 novoPaciente.cpf || null,
      telefone:            novoPaciente.telefone || null,
      data_nascimento:     novoPaciente.dataNascimento || null,
      sexo:                novoPaciente.sexo || null,
      email:               novoPaciente.email || null,
      endereco:            novoPaciente.rua || novoPaciente.endereco || null,
      cep:                 novoPaciente.cep || null,
      plano_saude:         novoPaciente.convenio || null,
      observacoes:         novoPaciente.observacoes || null,
      alergias:            novoPaciente.alergias || null,
      tipo_sanguineo:      novoPaciente.tipoSanguineo || null,
      telefone_emergencia: novoPaciente.telefoneEmergencia || null,
    });
    await carregarPacientes();
  }

  async function adicionarConsulta(novaConsulta) {
    const res = await api.atendimentos.criar({
      nome_paciente:              novaConsulta.paciente || novaConsulta.nomePaciente || "",
      usuario_id:                 null,
      nome_medico:                novaConsulta.medico || novaConsulta.profissional || "",
      profissional_firebase_id:   novaConsulta.profissionalId || novaConsulta.medicoId || "",
      data:                       novaConsulta.data || new Date().toISOString().slice(0, 10),
      hora:                       novaConsulta.hora || "",
      tipo_atendimento:           novaConsulta.tipoAtendimento || "",
      especialidade:               novaConsulta.especialidade || "",
      observacoes:                novaConsulta.observacoesRecepcao || "",
      status:                     "agendado",
    });
    await carregarConsultas();
    return res?.data;
  }

  async function iniciarAtendimento(id) {
    await api.atendimentos.atualizar(id, { status: "em_atendimento" });
    await carregarConsultas();
  }

  async function salvarProntuario(id, prontuario) {
    await api.atendimentos.atualizar(id, { prontuario });
  }

  async function finalizarAtendimento(id, prontuarioFinal) {
    const prontuario = {
      ...prontuarioFinal,
      medicoNome: userData?.nome || userData?.email || "",
      crm: userData?.crm || "",
      coren: userData?.coren || "",
      profissionalRole: userData?.role || "",
    };
    await api.atendimentos.atualizar(id, { status: "finalizado", prontuario });
    await carregarConsultas();
  }

  const indicadores = useMemo(() => {
    return {
      total: consultas.length,
      agendadas: consultas.filter((c) => c.status === "agendado").length,
      emAtendimento: consultas.filter((c) => c.status === "em_atendimento").length,
      altas: consultas.filter((c) => c.status === "finalizado").length,
      totalPacientes: pacientes.length,
      pagamentos: pagamentos.length,
      odontoAguardando: atendimentosOdonto.filter((a) => a.status === "aguardando").length,
      odontoEmAtendimento: atendimentosOdonto.filter((a) => a.status === "em_atendimento").length,
      odontoFinalizados: atendimentosOdonto.filter((a) => a.status === "finalizado").length,
    };
  }, [consultas, pacientes, pagamentos, atendimentosOdonto]);

  function getFirstAllowedView() {
    const orderedViews = [
      "dashboard",
      "pacientes",
      "pagamentos",
      "agendamentos",
      "prontuario",
      "medicos",
      "enfermagem",
      "odonto",
      "faturamento",
      "financeiro",
      "administracao",
      "normas",
      "estoque",
      "relatorios",
    ];

    return orderedViews.find((item) => hasPermission(userData, item)) || "dashboard";
  }

  useEffect(() => {
    if (userData && !view) {
      setView(isMedico ? "medicos" : getFirstAllowedView());
      return;
    }

    if (userData && view && !hasPermission(userData, view)) {
      setView(getFirstAllowedView());
    }
  }, [userData, view, isMedico]);

  function renderView() {
    switch (view) {
      case "pacientes":
        return (
          <Pacientes
            pacientes={pacientes}
            consultas={consultas}
            pagamentos={pagamentos}
            users={users}
            procedimentosOdonto={procedimentosOdonto}
            onAdicionarPaciente={adicionarPaciente}
            onAdicionarConsulta={adicionarConsulta}
            onEncaminharParaPagamento={encaminharParaPagamento}
          />
        );

      case "pagamentos":
        return (
          <Pagamentos
            pacientes={pacientes}
            consultas={consultas}
            pagamentos={pagamentos}
            pagamentoCheckout={pagamentoCheckout}
            onLimparCheckout={() => setPagamentoCheckout(null)}
            onIrParaFinanceiro={() => setView("financeiro")}
            onIrParaRelatorios={() => setView("relatorios")}
          />
        );

      case "agendamentos":
        return (
          <Agendamentos
            consultas={consultas}
            agendamentosOdonto={[...atendimentosOdonto]}
            onAbrirAtendimento={(consulta) => {
              setConsultaSelecionadaExterna(consulta);
              setView("medicos");
            }}
          />
        );

      case "medicos":
        return (
          <Medicos
            consultas={consultas}
            pagamentos={pagamentos}
            pacientes={pacientes}
            consultaSelecionadaExterna={consultaSelecionadaExterna}
            limparConsultaExterna={() => setConsultaSelecionadaExterna(null)}
            consultorioAtual={consultorioAtual}
            onIniciarAtendimento={iniciarAtendimento}
            onSalvarProntuario={salvarProntuario}
            onFinalizarAtendimento={finalizarAtendimento}
          />
        );

      case "enfermagem":
        return <Enfermagem />;

      case "odonto":
        return (
          <Odonto
            pacientes={pacientes}
            users={users}
            userData={userData}
            pagamentos={pagamentos}
            procedimentosOdonto={procedimentosOdonto}
            atendimentosOdonto={atendimentosOdonto}
            onIrParaPagamentos={() => setView("pagamentos")}
          />
        );

      case "faturamento":
        return <Faturamento />;

      case "financeiro":
        return (
          <Financeiro
            pagamentos={pagamentos}
            consultas={consultas}
            pacientes={pacientes}
            onIrParaRelatorios={() => setView("relatorios")}
            onIrParaPagamentos={() => setView("pagamentos")}
          />
        );

      case "administracao":
        return (
          <Administracao
            users={users}
            consultorios={consultorios}
            onCriarUsuario={criarUsuario}
            onAtualizarUsuario={atualizarUsuario}
            onExcluirUsuario={excluirUsuario}
            onLiberarConsultorio={liberarConsultorioDeUsuario}
          />
        );

      case "normas":
        return <Normas />;

      case "prontuario":
        return (
          <Prontuario
            consultas={consultas}
            atendimentosOdonto={atendimentosOdonto}
            pacientes={pacientes}
            pagamentos={pagamentos}
          />
        );

      case "estoque":
        return <Estoque estoque={estoque} onRefresh={carregarEstoque} />;

      case "relatorios":
        return (
          <Relatorios
            consultas={consultas}
            pagamentos={pagamentos}
            pacientes={pacientes}
            users={users}
            onIrParaFinanceiro={() => setView("financeiro")}
            onIrParaPagamentos={() => setView("pagamentos")}
          />
        );

      default: {
        const role = userData?.role || "";
        if (role === "medico") {
          return (
            <DashboardMedico
              consultas={consultas}
              consultorioAtual={consultorioAtual}
              userData={userData}
              onIrParaConsultas={() => setView("medicos")}
            />
          );
        }
        if (role === "financeiro") {
          return (
            <DashboardFinanceiro
              pagamentos={pagamentos}
              onIrParaFinanceiro={() => setView("financeiro")}
              onIrParaPagamentos={() => setView("pagamentos")}
              onIrParaRelatorios={() => setView("relatorios")}
            />
          );
        }
        return (
          <Dashboard
            consultas={consultas}
            pagamentos={pagamentos}
            indicadores={indicadores}
            pacientes={pacientes}
            consultorios={consultorios}
            users={users}
            atendimentosOdonto={atendimentosOdonto}
            estoque={estoque}
            onIrParaEstoque={() => setView("estoque")}
            onIrParaFinanceiro={() => setView("financeiro")}
            onIrParaPagamentos={() => setView("pagamentos")}
            onIrParaRelatorios={() => setView("relatorios")}
          />
        );
      }
    }
  }

  const MENU_ICONS = {
    dashboard: LayoutDashboard,
    pacientes: Users,
    pagamentos: CreditCard,
    agendamentos: Calendar,
    prontuario: FileText,
    medicos: Stethoscope,
    enfermagem: Heart,
    odonto: Smile,
    faturamento: Receipt,
    financeiro: DollarSign,
    estoque: Package,
    relatorios: BarChart2,
    normas: BookOpen,
    administracao: Settings,
  };

  const VIEW_TITLES = {
    dashboard: "Dashboard",
    pacientes: "Recepção",
    pagamentos: "Pagamentos",
    agendamentos: "Agendamentos",
    medicos: "Consultas",
    enfermagem: "Enfermagem",
    odonto: "Odontologia",
    financeiro: "Financeiro",
    faturamento: "Faturamento",
    relatorios: "Relatórios",
    estoque: "Estoque",
    prontuario: "Prontuário",
    normas: "Normas",
    administracao: "Administração",
  };

  const VIEW_SECTIONS = {
    pacientes: "Atendimento",
    agendamentos: "Atendimento",
    pagamentos: "Atendimento",
    medicos: "Clínico",
    enfermagem: "Clínico",
    prontuario: "Clínico",
    odonto: "Clínico",
    financeiro: "Financeiro",
    faturamento: "Financeiro",
    relatorios: "Financeiro",
    estoque: "Financeiro",
    administracao: "Sistema",
    normas: "Sistema",
  };

  const ROLE_LABELS = {
    admin: "Administrador",
    recepcao: "Recepção",
    medico: "Médico",
    enfermagem: "Enfermagem",
    odonto: "Odontologia",
    financeiro: "Financeiro",
    estoque: "Estoque",
  };

  const ROLE_COLORS = {
    admin: "#7c3aed",
    recepcao: "#2563eb",
    medico: "#0f766e",
    enfermagem: "#db2777",
    odonto: "#0d9488",
    financeiro: "#16a34a",
    estoque: "#ea580c",
  };

  function hasAnyInGroup(keys) {
    return keys.some((k) => hasPermission(userData, k));
  }

  function menu(label, value) {
    if (!hasPermission(userData, value)) return null;
    const Icon = MENU_ICONS[value];

    return (
      <button
        className={`sidebar-btn ${view === value ? "active" : ""}`}
        onClick={() => setView(value)}
        title={label}
      >
        <span className="sidebar-btn-icon">
          {Icon && <Icon size={17} strokeWidth={2} />}
        </span>
        <span className="sidebar-btn-label">{label}</span>
      </button>
    );
  }

  async function sairSistema() {
    try {
      if (userData?.atende_pacientes) {
        await liberarConsultorio();
      }

      setConsultorioConfirmadoSessao(false);
      setConsultaSelecionadaExterna(null);
      await logout();
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Não foi possível sair do sistema.");
    }
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Carregando sistema...</div>;
  }

  if (!userData) {
    return <LoginScreen />;
  }

  if (dataLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Carregando dados...</div>;
  }

  if (userData?.atende_pacientes && !consultorioConfirmadoSessao) {
    return (
      <EscolherConsultorio
        consultorios={consultorios}
        userData={userData}
        onSelecionar={selecionarConsultorio}
        onSair={sairSistema}
      />
    );
  }

  return (
    <div className={`app-shell ${sidebarMinimizada ? "sidebar-collapsed-mode" : ""}`}>
      <aside className={`sidebar ${sidebarMinimizada ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <h2 className="brand-title">NexusCare</h2>
            <p className="brand-subtitle">Healthcare System</p>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarMinimizada((prev) => !prev)}
            title={sidebarMinimizada ? "Expandir menu" : "Minimizar menu"}
          >
            {sidebarMinimizada ? "☰" : "‹"}
          </button>
        </div>

        <div className="sidebar-nav">
          {menu("Dashboard", "dashboard")}

          {hasAnyInGroup(["pacientes", "agendamentos", "pagamentos"]) && (
            <div className="menu-section-toggle" style={{ cursor: "default", pointerEvents: "none" }}>
              Atendimento
            </div>
          )}
          <div className="menu-group">
            {menu("Recepção", "pacientes")}
            {menu("Agendamentos", "agendamentos")}
            {menu("Pagamentos", "pagamentos")}
          </div>

          {hasAnyInGroup(["medicos", "prontuario", "enfermagem", "odonto"]) && (
            <div className="menu-section-toggle" style={{ cursor: "default", pointerEvents: "none" }}>
              Clínico
            </div>
          )}
          <div className="menu-group">
            {menu("Consultas", "medicos")}
            {menu("Prontuário", "prontuario")}
            {menu("Enfermagem", "enfermagem")}
            {menu("Odontologia", "odonto")}
          </div>

          {hasAnyInGroup(["financeiro", "faturamento", "relatorios", "estoque"]) && (
            <div className="menu-section-toggle" style={{ cursor: "default", pointerEvents: "none" }}>
              Financeiro
            </div>
          )}
          <div className="menu-group">
            {menu("Financeiro", "financeiro")}
            {menu("Faturamento", "faturamento")}
            {menu("Relatórios", "relatorios")}
            {menu("Estoque", "estoque")}
          </div>

          {hasAnyInGroup(["administracao", "normas"]) && (
            <div className="menu-section-toggle" style={{ cursor: "default", pointerEvents: "none" }}>
              Sistema
            </div>
          )}
          <div className="menu-group">
            {menu("Administração", "administracao")}
            {menu("Normas", "normas")}
          </div>
        </div>

        <div
          className="sidebar-footer"
          onClick={() => setMostrarPerfil(true)}
          style={{ cursor: "pointer" }}
          title="Meu Perfil"
        >
          <div className="sidebar-user-avatar" style={{ overflow: "hidden", padding: 0 }}>
            {userData?.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Foto"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              (userData?.nome || userData?.email || "U").charAt(0).toUpperCase()
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {userData?.nome || userData?.email}
            </span>
            <span className="sidebar-user-role">
              {userData?.role || "Usuário"}
            </span>
          </div>
        </div>
      </aside>

      <div className="content-area">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">
              {VIEW_SECTIONS[view] && (
                <span style={{ fontSize: "12px", fontWeight: 500, color: "#94a3b8", marginRight: "6px" }}>
                  {VIEW_SECTIONS[view]} /
                </span>
              )}
              {VIEW_TITLES[view] || (view ? view.charAt(0).toUpperCase() + view.slice(1) : "Dashboard")}
            </div>
            <div className="topbar-subtitle">
              {consultorioAtual
                ? `${consultorioAtual.nome} · ${consultorioAtual.medicoNome}`
                : "NexusCare Healthcare System"}
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-search" ref={refBuscaGlobal} style={{ position: "relative" }}>
              <span className="topbar-search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <input
                className="topbar-search-input"
                type="text"
                placeholder="Buscar no sistema..."
                value={buscaGlobal}
                onChange={(e) => { setBuscaGlobal(e.target.value); setBuscaGlobalAberta(true); }}
                onFocus={() => setBuscaGlobalAberta(true)}
                autoComplete="off"
              />

              {buscaGlobalAberta && buscaGlobal.length >= 2 && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  minWidth: "380px",
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
                  border: "1px solid #e2e8f0",
                  zIndex: 9999,
                  maxHeight: "400px",
                  overflowY: "auto",
                }}>
                  {resultadosBusca.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔍</div>
                      Nenhum resultado encontrado para <strong>"{buscaGlobal}"</strong>.
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: "8px 14px 4px", fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {resultadosBusca.length} resultado{resultadosBusca.length !== 1 ? "s" : ""} encontrado{resultadosBusca.length !== 1 ? "s" : ""}
                      </div>
                      {resultadosBusca.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderTop: "1px solid #f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                          onClick={() => {
                            setView(r.view);
                            setBuscaGlobal("");
                            setBuscaGlobalAberta(false);
                          }}
                        >
                          <span style={{ fontSize: "18px", flexShrink: 0 }}>{r.icone}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b", marginBottom: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.titulo}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.descricao}
                            </div>
                          </div>
                          <span style={{
                            fontSize: "11px", fontWeight: 700, flexShrink: 0,
                            color: r.cor,
                            background: r.cor + "18",
                            border: `1px solid ${r.cor}33`,
                            borderRadius: "6px", padding: "2px 8px",
                          }}>
                            {r.tipo}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {userData?.role && (
              <div style={{
                background: (ROLE_COLORS[userData.role] || "#64748b") + "18",
                color: ROLE_COLORS[userData.role] || "#64748b",
                border: `1px solid ${(ROLE_COLORS[userData.role] || "#64748b")}33`,
                borderRadius: "999px",
                padding: "4px 12px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {ROLE_LABELS[userData.role] || userData.role}
              </div>
            )}
            <button className="secondary-btn" onClick={sairSistema}>
              Sair
            </button>
          </div>
        </div>

        <main className="main-content">{renderView()}</main>
      </div>

      {mostrarPerfil && (
        <ModalPerfil
          userData={userData}
          onClose={() => setMostrarPerfil(false)}
        />
      )}
    </div>
  );
}