import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RealtimeClient, REALTIME_STATUS } from "./services/realtime";
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
  FolderOpen,
  UserCog,
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import { hasPermission } from "./config/permissions";
import api from "./services/api";
import { hojeISO, isFuturo } from "./utils/dateUtils";

// Eager-loaded: used immediately after login or very lightweight
import Dashboard from "./pages/Dashboard";
import DashboardMedico from "./pages/DashboardMedico";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import Agendamentos from "./pages/Agendamentos";
import Normas from "./pages/Normas";
import Cadastros from "./pages/Cadastros";
import ModalPerfil from "./components/ModalPerfil";
import ModalAntecipacaoData from "./components/ModalAntecipacaoData";

// Lazy-loaded: heavier modules loaded on first navigation
const Pacientes      = lazy(() => import("./pages/Pacientes"));
const Pagamentos     = lazy(() => import("./pages/Pagamentos"));
const Medicos        = lazy(() => import("./pages/Medicos"));
const Enfermagem     = lazy(() => import("./pages/Enfermagem"));
const Odonto         = lazy(() => import("./pages/Odonto"));
const Faturamento    = lazy(() => import("./pages/Faturamento"));
const Financeiro     = lazy(() => import("./pages/Financeiro"));
const Prontuario     = lazy(() => import("./pages/Prontuario"));
const Estoque        = lazy(() => import("./pages/Estoque"));
const Relatorios     = lazy(() => import("./pages/Relatorios"));
const Configuracoes  = lazy(() => import("./pages/Configuracoes"));

function mascaraCPF(cpf) {
  if (!cpf) return "—";
  const c = String(cpf).replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}

function mascaraTelefone(tel) {
  if (!tel) return "—";
  const t = String(tel).replace(/\D/g, "");
  if (t.length === 11) return `(${t.slice(0, 2)}) *****-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ****-${t.slice(6)}`;
  return tel;
}

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
          {/* Logo Vynor Clinic */}
          <div className="login-logo-wordmark">
            <svg className="login-logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 41C24 41 5 27.5 5 15.5C5 10.8 8.8 7 13.5 7C17.2 7 20.4 9.2 22 12.5L24 16.5L26 12.5C27.6 9.2 30.8 7 34.5 7C39.2 7 43 10.8 43 15.5C43 27.5 24 41 24 41Z" stroke="#C4B5FD" strokeWidth="2.2" fill="rgba(196,181,253,0.12)"/>
              <path d="M9 22H15L17.5 16.5L20.5 27L23 19L25.5 23L28 22H39" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <div className="login-logo-text">Vynor<span> Clinic</span></div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "2px" }}>Healthcare System</div>
            </div>
          </div>

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
            <p>Informe seu usuário ou e-mail e senha para acessar o Vynor Clinic.</p>
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
  salasDef = [],
  userData,
  onSelecionar,
  onSair,
}) {
  const meuId = String(userData?.id || "");
  const toast = useToast();

  const salas = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    function sessaoAtiva(consultorio) {
      if (!consultorio?.lastActive) return false;
      const ts = consultorio.lastActive instanceof Date
        ? consultorio.lastActive
        : new Date(consultorio.lastActive);
      return now - ts.getTime() < 60000;
    }
    const base = salasDef.length > 0
      ? salasDef.map((s) => ({ numero: Number(s.numero), nome: s.nome }))
      : Array.from({ length: 7 }, (_, i) => ({ numero: i + 1, nome: `Consultório ${i + 1}` }));
    return base.map(({ numero, nome }) => {
      const encontrado = consultorios.find((item) => Number(item.numero) === numero);
      const ocupado = encontrado && sessaoAtiva(encontrado) ? encontrado : null;
      return { numero, nome, ocupado };
    });
  }, [consultorios, salasDef]);

  async function escolherSala(sala) {
    if (sala.ocupado && sala.ocupado.medicoId !== meuId) {
      toast.warn(`${sala.nome} já está em uso por ${sala.ocupado.medicoNome}.`);
      return;
    }

    await onSelecionar(sala.numero);
  }

  return (
    <div className="consultorio-select-page">
      <div className="consultorio-select-card">
        <div className="consultorio-select-header">
          <div>
            <span className="consultorio-chip">Vynor Clinic</span>
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
  const toast = useToast();
  const meuId = String(userData?.id || "");
  const [view, setView] = useState("");
  const [sidebarMinimizada, setSidebarMinimizada] = useState(false);
  const [consultorioConfirmadoSessao, setConsultorioConfirmadoSessao] = useState(false);
  const [consultaSelecionadaExterna, setConsultaSelecionadaExterna] = useState(null);
  const [pagamentoCheckout, setPagamentoCheckout] = useState(null);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);

  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [pagamentosCarregados, setPagamentosCarregados] = useState(false);
  const [consultorios, setConsultorios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [users, setUsers] = useState([]);
  const [atendimentosOdonto, setAtendimentosOdonto] = useState([]);
  const [procedimentosOdonto, setProcedimentosOdonto] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [agendamentosOdonto, setAgendamentosOdonto] = useState([]);
  // Tracks which resources have already been loaded at least once (avoids toast spam on polls)
  const carregouUmaVez = useRef({});
  const staleData = useRef(new Set());
  const viewRef = useRef("");
  const prevForceRefreshCount = useRef(0);
  const [forceRefreshCount, setForceRefreshCount] = useState(0);

  // ── Realtime SSE ───────────────────────────────────────────────────────────
  const realtimeRef                         = useRef(null);
  const [realtimeStatus, setRealtimeStatus] = useState(REALTIME_STATUS.OFFLINE);

  // ── Carregamento via API MySQL (módulos migrados) ─────────────────────────────
  const carregarPacientes = useCallback(async () => {
    if (userData?.role === "estoque") return;
    const primeira = !carregouUmaVez.current.pacientes;
    try {
      const res = await api.pacientes.listar({ per_page: 100 });
      setPacientes(Array.isArray(res?.data) ? res.data : []);
      carregouUmaVez.current.pacientes = true;
    } catch (e) {
      if (primeira && !e.isNetworkError) toast.error("Não foi possível carregar os pacientes.");
      console.error("Erro pacientes:", e);
    }
  }, [toast, userData]);

  const carregarPagamentos = useCallback(async () => {
    if (userData?.role === "estoque") return;
    const primeira = !carregouUmaVez.current.pagamentos;
    try {
      const res = await api.pagamentos.listar({ per_page: 100, include_all_pending: 1 });
      setPagamentos(Array.isArray(res?.data) ? res.data : []);
      setPagamentosCarregados(true);
      carregouUmaVez.current.pagamentos = true;
    } catch (e) {
      if (primeira && !e.isNetworkError) toast.error("Não foi possível carregar os pagamentos.");
      console.error("Erro pagamentos:", e);
    }
  }, [toast, userData]);

  const userId = userData?.id;
  const userRole = userData?.role;
  const userPermissions = userData?.permissions;

  const carregarConsultas = useCallback(async () => {
    if (userRole === "estoque") return;
    const primeira = !carregouUmaVez.current.consultas;
    try {
      const podeVerTodos =
        userRole === "admin" || userRole === "recepcao" || userRole === "financeiro" ||
        userRole === "enfermagem" ||
        (Array.isArray(userPermissions) && (userPermissions.includes("administracao") || userPermissions.includes("configuracoes")));
      const params = { per_page: 100 };
      if (!podeVerTodos && userId) {
        params.usuario_id = userId;
      }
      const res = await api.atendimentos.listar(params);
      const docs = Array.isArray(res?.data) ? res.data : [];
      if (!podeVerTodos) docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setConsultas(docs);
      carregouUmaVez.current.consultas = true;
    } catch (e) {
      if (primeira && !e.isNetworkError) toast.error("Não foi possível carregar os atendimentos.");
      console.error("Erro consultas:", e);
      setConsultas([]);
    }
  }, [userId, userRole, userPermissions, toast]);

  const carregarAtendimentosOdonto = useCallback(async () => {
    try {
      const res = await api.atendimentosOdonto.listar({ per_page: 100 });
      setAtendimentosOdonto(Array.isArray(res?.data) ? res.data : []);
      carregouUmaVez.current.atendimentosOdonto = true;
    } catch (e) {
      console.error("Erro atendimentosOdonto:", e);
    }
  }, []);

  const carregarAgendamentosOdonto = useCallback(async () => {
    try {
      const res = await api.agendamentosOdonto.listar({ per_page: 100 });
      setAgendamentosOdonto(Array.isArray(res?.data) ? res.data : []);
      carregouUmaVez.current.agendamentosOdonto = true;
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro agendamentosOdonto:", e);
    }
  }, []);

  const criarAtendimentoOdontoDeAgendamento = useCallback(async (item) => {
    const jaExiste = atendimentosOdonto.some(
      (a) => String(a.agendamentoId || a.agendamento_id || "") === String(item.id)
    );
    if (jaExiste) return;
    try {
      // Criar pagamento pendente na chegada do paciente (não no agendamento)
      const res = await api.agendamentosOdonto.confirmarChegada(item.id, { status: "aguardando" });
      await Promise.all([carregarAgendamentosOdonto(), carregarAtendimentosOdonto(), carregarPagamentos()]);
      return res?.data;
    } catch (e) {
      console.error("Erro ao criar atendimento odonto de agendamento:", e);
      throw e;
    }
  }, [atendimentosOdonto, carregarAgendamentosOdonto, carregarAtendimentosOdonto, carregarPagamentos]);

  const carregarProcedimentosOdonto = useCallback(async () => {
    try {
      const res = await api.procedimentosOdonto.listar();
      setProcedimentosOdonto(Array.isArray(res?.data) ? res.data : []);
      carregouUmaVez.current.procedimentosOdonto = true;
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro procedimentosOdonto:", e);
    }
  }, []);

  const carregarUsuarios = useCallback(async () => {
    try {
      const res = await api.usuarios.listar({ per_page: 100 });
      setUsers(Array.isArray(res?.data) ? res.data : []);
      carregouUmaVez.current.users = true;
    } catch (e) {
      if (!e.isNetworkError) console.error("Erro usuários:", e);
    }
  }, []);

  const carregarEstoque = useCallback(async () => {
    try { const r = await api.estoque.listar(); setEstoque(r.data || []); carregouUmaVez.current.estoque = true; } catch { setEstoque([]); }
  }, []);

  // Mantém viewRef sincronizado para uso em SSE handlers (closures)
  useEffect(() => { viewRef.current = view; }, [view]);

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

    // ── Módulos do menu ──────────────────────────────────────────────────────
    const MODULOS_MENU = [
      { id: 'mod-recepcao',    label: 'Recepção',      view: 'pacientes',   palavras: ['recepcao', 'recepção', 'paciente', 'cadastro', 'check-in'] },
      { id: 'mod-consultas',   label: 'Consultas',     view: 'consultas',   palavras: ['consultas', 'atendimento', 'fila', 'medico', 'médico'] },
      { id: 'mod-agendamentos',label: 'Agendamentos',  view: 'agendamentos',palavras: ['agendamento', 'agenda', 'calendário', 'calendario'] },
      { id: 'mod-pagamentos',  label: 'Pagamentos',    view: 'pagamentos',  palavras: ['pagamento', 'checkout', 'cobrança', 'cobranca', 'pagar'] },
      { id: 'mod-financeiro',  label: 'Financeiro',    view: 'financeiro',  palavras: ['financeiro', 'receita', 'despesa', 'caixa', 'dinheiro'] },
      { id: 'mod-faturamento', label: 'Faturamento',   view: 'faturamento', palavras: ['faturamento', 'fatura', 'nota', 'nf'] },
      { id: 'mod-relatorios',  label: 'Relatórios',    view: 'relatorios',  palavras: ['relatorio', 'relatório', 'report', 'grafico', 'gráfico'] },
      { id: 'mod-estoque',     label: 'Estoque',       view: 'estoque',     palavras: ['estoque', 'medicamento', 'insumo', 'inventario', 'produto'] },
      { id: 'mod-enfermagem',  label: 'Enfermagem',    view: 'enfermagem',  palavras: ['enfermagem', 'triagem', 'sinais', 'vital', 'enfermeiro'] },
      { id: 'mod-odonto',      label: 'Odontologia',   view: 'odonto',      palavras: ['odonto', 'odontologia', 'dentista', 'dente', 'dental'] },
      { id: 'mod-normas',      label: 'Normas',        view: 'normas',      palavras: ['norma', 'protocolo', 'documento', 'regra'] },
      { id: 'mod-config',      label: 'Configurações', view: 'admin',       palavras: ['configuracao', 'configuração', 'config', 'admin', 'usuario'] },
    ];
    MODULOS_MENU.forEach((mod) => {
      if (inclui(mod.label) || mod.palavras.some((p) => inclui(p))) {
        lista.push({
          id: mod.id,
          titulo: mod.label,
          tipo: 'Módulo',
          descricao: `Abrir módulo ${mod.label}`,
          cor: '#6366f1',
          icone: '🗂️',
          view: mod.view,
        });
      }
    });

    pacientes.forEach((p) => {
      if (inclui(p.nome) || inclui(p.cpf) || inclui(p.telefone) || inclui(p.email)) {
        lista.push({
          id: `pac-${p.id}`,
          titulo: p.nome || "Paciente sem nome",
          tipo: "Paciente",
          descricao: [p.cpf && `CPF: ${mascaraCPF(p.cpf)}`, p.telefone && `Tel: ${mascaraTelefone(p.telefone)}`].filter(Boolean).join(" · ") || "—",
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

  const isMedico = userData?.role === "medico";

  const consultorioAtual = useMemo(() => {
    if (!userData) return null;
    return consultorios.find((item) => item.medicoId === meuId) || null;
  }, [consultorios, meuId, userData]);


  useEffect(() => {
    setConsultorioConfirmadoSessao(false);
    setConsultaSelecionadaExterna(null);
  }, [userData?.id]); // reseta estado de sessão ao trocar de usuário

  useEffect(() => {
    if (!consultorioConfirmadoSessao || !meuId) return;
    const interval = setInterval(async () => {
      try { await api.consultorios.ocupar({ status: 'ocupado' }); } catch { /* heartbeat silencioso */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [consultorioConfirmadoSessao, meuId]);

  useEffect(() => {
    if (!consultorioConfirmadoSessao || !meuId) return;
    const handleUnload = () => {
      navigator.sendBeacon
        ? navigator.sendBeacon(`/vynor-clinic-api/api/consultorios/${meuId}`, '')
        : fetch(`/vynor-clinic-api/api/consultorios/${meuId}`, { method: 'DELETE', keepalive: true }).catch(() => {});
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
      setPagamentosCarregados(false);
      setConsultorios([]);
      setSalas([]);
      setUsers([]);
      setAtendimentosOdonto([]);
      setAgendamentosOdonto([]);
      setProcedimentosOdonto([]);
      setEstoque([]);
      carregouUmaVez.current = {};
      staleData.current.clear();
      return;
    }

    // Apenas dados globais obrigatórios: consultorios e salas (necessários antes de qualquer view)
    const carregarConsultorios = async () => {
      try { const r = await api.consultorios.listar(); setConsultorios(r.data || []); } catch { /* ignora */ }
    };
    const carregarSalas = async () => {
      try { const r = await api.salas.listar(); setSalas(r.data || []); } catch { /* ignora */ }
    };

    carregarConsultorios();
    carregarSalas();
    const timerConsultorios = setInterval(carregarConsultorios, 30000);
    const timerSalas        = setInterval(carregarSalas, 120000);

    return () => {
      clearInterval(timerConsultorios);
      clearInterval(timerSalas);
    };
  }, [userData]);

  // ── Carregamento lazy por view: carrega apenas o que a view ativa precisa ──
  useEffect(() => {
    if (!userData || !view) return;

    const isForcedRefresh = forceRefreshCount !== prevForceRefreshCount.current;
    prevForceRefreshCount.current = forceRefreshCount;
    const needs = (key) => isForcedRefresh || !carregouUmaVez.current[key] || staleData.current.has(key);
    const flush = (key, fn) => { if (needs(key)) { fn(); staleData.current.delete(key); } };

    switch (view) {
      case 'pacientes':
        flush('pacientes', carregarPacientes);
        flush('agendamentosOdonto', carregarAgendamentosOdonto);
        break;
      case 'agendamentos':
        flush('consultas', carregarConsultas);
        flush('agendamentosOdonto', carregarAgendamentosOdonto);
        flush('users', carregarUsuarios);
        break;
      case 'pagamentos':
        flush('pagamentos', carregarPagamentos);
        flush('atendimentosOdonto', carregarAtendimentosOdonto);
        break;
      case 'medicos':
        flush('consultas', carregarConsultas);
        flush('pacientes', carregarPacientes);
        break;
      case 'enfermagem':
        flush('consultas', carregarConsultas);
        flush('pacientes', carregarPacientes);
        flush('procedimentosOdonto', carregarProcedimentosOdonto);
        break;
      case 'odonto':
        flush('pacientes', carregarPacientes);
        flush('users', carregarUsuarios);
        flush('pagamentos', carregarPagamentos);
        flush('atendimentosOdonto', carregarAtendimentosOdonto);
        flush('agendamentosOdonto', carregarAgendamentosOdonto);
        flush('procedimentosOdonto', carregarProcedimentosOdonto);
        break;
      case 'faturamento':
        flush('pagamentos', carregarPagamentos);
        flush('atendimentosOdonto', carregarAtendimentosOdonto);
        break;
      case 'financeiro':
        flush('pagamentos', carregarPagamentos);
        flush('consultas', carregarConsultas);
        flush('pacientes', carregarPacientes);
        break;
      case 'prontuario':
        flush('consultas', carregarConsultas);
        flush('pacientes', carregarPacientes);
        flush('atendimentosOdonto', carregarAtendimentosOdonto);
        flush('pagamentos', carregarPagamentos);
        break;
      case 'relatorios':
        flush('consultas', carregarConsultas);
        flush('pagamentos', carregarPagamentos);
        flush('pacientes', carregarPacientes);
        flush('users', carregarUsuarios);
        break;
      case 'estoque':
        flush('estoque', carregarEstoque);
        break;
      case 'configuracoes':
      case 'administracao':
        flush('users', carregarUsuarios);
        break;
      case 'cadastros':
        flush('procedimentosOdonto', carregarProcedimentosOdonto);
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, userData, forceRefreshCount, carregarPacientes, carregarPagamentos, carregarConsultas,
      carregarAtendimentosOdonto, carregarAgendamentosOdonto, carregarProcedimentosOdonto,
      carregarUsuarios, carregarEstoque]);

  // ── Realtime: conecta/desconecta conforme autenticação ───────────────────
  useEffect(() => {
    const token = userData
      ? localStorage.getItem('vynorclinic_token')
      : null;

    if (!token) {
      if (realtimeRef.current) {
        realtimeRef.current.disconnect();
        realtimeRef.current = null;
      }
      setRealtimeStatus(REALTIME_STATUS.OFFLINE);
      return;
    }

    // Cria o client e conecta
    const client = new RealtimeClient(token);
    realtimeRef.current = client;

    // Acompanha mudanças de status para o indicador visual
    const unsubStatus = client.onStatusChange(setRealtimeStatus);

    // ── Handlers: disparam o carregamento seletivo da lista afetada ─────────
    // Usando os mesmos loaders do polling — garante normalização idêntica
    // e evita qualquer lógica de merge manual que poderia duplicar registros.

    // applyEvent: se a view atual precisa deste dado → recarrega agora; senão → marca stale
    const VIEWS_FOR_KEY = {
      pacientes:          ['pacientes', 'medicos', 'enfermagem', 'prontuario', 'relatorios', 'financeiro', 'odonto'],
      consultas:          ['agendamentos', 'medicos', 'enfermagem', 'financeiro', 'prontuario', 'relatorios'],
      pagamentos:         ['pagamentos', 'faturamento', 'financeiro', 'prontuario', 'relatorios', 'odonto'],
      atendimentosOdonto: ['pagamentos', 'odonto', 'faturamento', 'prontuario'],
      agendamentosOdonto: ['pacientes', 'agendamentos', 'odonto'],
    };
    const applyEvent = (key, fn) => {
      if ((VIEWS_FOR_KEY[key] || []).includes(viewRef.current)) { fn(); }
      else { staleData.current.add(key); }
    };
    const onPagamentoEvent = () => {
      applyEvent('pagamentos', carregarPagamentos);
      applyEvent('consultas', carregarConsultas);
      applyEvent('atendimentosOdonto', carregarAtendimentosOdonto);
    };

    const unsubs = [
      unsubStatus,
      client.on('pacientes.created', () => applyEvent('pacientes', carregarPacientes)),
      client.on('pacientes.updated', () => applyEvent('pacientes', carregarPacientes)),

      client.on('atendimentos.created',        () => applyEvent('consultas', carregarConsultas)),
      client.on('atendimentos.updated',        () => applyEvent('consultas', carregarConsultas)),
      client.on('atendimentos.status_changed', () => applyEvent('consultas', carregarConsultas)),

      client.on('pagamentos.created',        onPagamentoEvent),
      client.on('pagamentos.updated',        onPagamentoEvent),
      client.on('pagamentos.status_changed', onPagamentoEvent),

      client.on('odonto.agendamento_created', () => applyEvent('agendamentosOdonto', carregarAgendamentosOdonto)),
      client.on('odonto.agendamento_updated', () => applyEvent('agendamentosOdonto', carregarAgendamentosOdonto)),

      client.on('odonto.atendimento_created', () => applyEvent('atendimentosOdonto', carregarAtendimentosOdonto)),
      client.on('odonto.atendimento_updated', () => applyEvent('atendimentosOdonto', carregarAtendimentosOdonto)),

      client.on('consultorios.updated', async () => {
        try { const r = await api.consultorios.listar(); setConsultorios(r.data || []); } catch { /* ignora */ }
      }),

      client.on('salas.created', async () => {
        try { const r = await api.salas.listar(); setSalas(r.data || []); } catch { /* ignora */ }
      }),
      client.on('salas.updated', async () => {
        try { const r = await api.salas.listar(); setSalas(r.data || []); } catch { /* ignora */ }
      }),
    ];

    client.connect();

    return () => {
      unsubs.forEach((fn) => fn());
      client.disconnect();
      realtimeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id]); // reconecta apenas quando o usuário logado muda

  // ── Fallback polling (3 min) quando SSE está offline ──────────────────────
  useEffect(() => {
    if (!userData || realtimeStatus !== REALTIME_STATUS.OFFLINE) return;
    const interval = setInterval(() => setForceRefreshCount(c => c + 1), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userData, realtimeStatus]);

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
      cro:              novoUsuario.cro || null,
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
      cro:              dados.cro,
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
      ...(dados.senha ? { senha: dados.senha } : {}),
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

  async function criarSala(dados) {
    await api.salas.criar(dados);
    const r = await api.salas.listar();
    setSalas(r.data || []);
  }

  async function atualizarSala(id, dados) {
    await api.salas.atualizar(id, dados);
    const r = await api.salas.listar();
    setSalas(r.data || []);
  }

  async function excluirSala(id) {
    await api.salas.excluir(id);
    const r = await api.salas.listar();
    setSalas(r.data || []);
  }

  function encaminharParaPagamento(checkoutData) {
    setPagamentoCheckout(checkoutData);
    setView("pagamentos");
  }

  function solicitarOverride(consulta) {
    return new Promise((resolve) => {
      setOverrideModal({
        consulta,
        onConfirm: (resultado) => {
          setOverrideModal(null);
          resolve({ aprovado: true, resultado });
        },
        onCancel: () => {
          setOverrideModal(null);
          resolve({ aprovado: false });
        },
      });
    });
  }

  function buildPacientePayload(p) {
    return {
      nome:                p.nome,
      cpf:                 p.cpf || null,
      telefone:            p.telefone || null,
      data_nascimento:     p.dataNascimento || null,
      sexo:                ({ Masculino: 'M', Feminino: 'F', Outro: 'outro' }[p.sexo] ?? null),
      email:               p.email || null,
      endereco:            p.rua || p.endereco || null,
      bairro:              p.bairro || null,
      cep:                 p.cep || null,
      plano_saude:         p.convenio || null,
      observacoes:         p.observacoes || null,
      alergias:            p.alergias || null,
      tipo_sanguineo:      p.tipoSanguineo || null,
      telefone_emergencia: p.telefoneEmergencia || null,
      nome_mae:            p.mae || null,
      nome_pai:            p.pai || null,
      ativo:               p.status === 'Inativo' ? 0 : 1,
    };
  }

  async function adicionarPaciente(novoPaciente) {
    await api.pacientes.criar(buildPacientePayload(novoPaciente));
    await carregarPacientes();
  }

  async function atualizarPaciente(id, dados) {
    await api.pacientes.atualizar(id, buildPacientePayload(dados));
    await carregarPacientes();
  }

  async function adicionarConsulta(novaConsulta) {
    const res = await api.atendimentos.criar({
      nome_paciente:    novaConsulta.paciente || novaConsulta.nomePaciente || "",
      usuario_id:       novaConsulta.medicoId || novaConsulta.profissionalId || novaConsulta.usuarioId || null,
      nome_medico:      novaConsulta.medico || novaConsulta.profissional || "",
      data:             novaConsulta.data || hojeISO(),
      hora:             novaConsulta.hora || "",
      tipo_atendimento: novaConsulta.tipoAtendimento || "",
      especialidade:    novaConsulta.especialidade || "",
      valor_consulta:   Number(novaConsulta.valorConsulta || 0),
      observacoes:      novaConsulta.observacoesRecepcao || "",
      status: (novaConsulta.tipoAtendimento || "").toLowerCase().includes("imediato") ? "aguardando" : "agendado",
    });
    await carregarConsultas();
    return res?.data;
  }

  async function iniciarAtendimento(id) {
    const alvo = consultas.find((c) => String(c.id) === String(id));
    if (alvo && isFuturo(alvo.data) && !alvo.antecipado_em) {
      const { aprovado, resultado } = await solicitarOverride(alvo);
      if (!aprovado) return;
      const { acao, consultaAtualizada } = resultado;
      setConsultas((prev) =>
        prev.map((c) => String(c.id) === String(id) ? { ...c, ...consultaAtualizada } : c)
      );
      if (acao === "remarcar" && isFuturo(consultaAtualizada.data) && !consultaAtualizada.antecipado_em) {
        toast.success("Atendimento remarcado. Aguarde a nova data agendada.");
        await carregarConsultas();
        return;
      }
      await carregarConsultas();
    }
    await api.atendimentos.atualizar(id, { status: "em_atendimento" });
    await carregarConsultas();
  }

  async function salvarProntuario(id, prontuario) {
    await api.atendimentos.atualizar(id, { prontuario });
  }

  async function finalizarAtendimento(id, prontuarioFinal) {
    const alvo = consultas.find((c) => String(c.id) === String(id));
    if (alvo && isFuturo(alvo.data) && !alvo.antecipado_em) {
      toast.error(
        "Não é possível finalizar um atendimento agendado para data futura sem autorização prévia."
      );
      return;
    }
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
      agendadas: consultas.filter((c) => ["agendado", "confirmado", "remarcado"].includes(c.status)).length,
      aguardando: consultas.filter((c) => ["aguardando", "presente"].includes(c.status)).length,
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
      "cadastros",
      "configuracoes",
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getFirstAllowedView closes over userData which is in deps
  }, [userData, view, isMedico]);

  function renderView() {
    switch (view) {
      case "pacientes":
        return (
          <Pacientes
            pacientes={pacientes}
            consultas={consultas}
            agendamentosOdonto={agendamentosOdonto}
            pagamentos={pagamentos}
            users={users}
            procedimentosOdonto={procedimentosOdonto}
            onAdicionarPaciente={adicionarPaciente}
            onAtualizarPaciente={atualizarPaciente}
            onAdicionarConsulta={adicionarConsulta}
            onEncaminharParaPagamento={encaminharParaPagamento}
            onAtualizarConsulta={async (id, dados) => {
              await api.atendimentos.atualizar(id, dados);
              await Promise.all([carregarConsultas(), carregarPagamentos()]);
            }}
            onAtualizarAgendamentoOdonto={async (id, dados) => {
              await api.agendamentosOdonto.atualizar(id, dados);
              await carregarAgendamentosOdonto();
            }}
            onRefreshAgendamentosOdonto={carregarAgendamentosOdonto}
          />
        );

      case "pagamentos":
        return (
          <Pagamentos
            pacientes={pacientes}
            consultas={consultas}
            pagamentos={pagamentos}
            carregando={!pagamentosCarregados}
            atendimentosOdonto={atendimentosOdonto}
            pagamentoCheckout={pagamentoCheckout}
            onLimparCheckout={() => setPagamentoCheckout(null)}
            onIrParaFinanceiro={() => setView("financeiro")}
            onIrParaRelatorios={() => setView("relatorios")}
            onPagamentoCriado={() => Promise.all([carregarPagamentos(), carregarConsultas(), carregarAtendimentosOdonto()])}
            onAtualizarAtendimentoOdonto={async (id, dados) => {
              await api.atendimentosOdonto.atualizar(id, dados);
              await carregarAtendimentosOdonto();
            }}
          />
        );

      case "agendamentos":
        return (
          <Agendamentos
            consultas={consultas}
            agendamentosOdonto={agendamentosOdonto}
            users={users}
            onNavegar={(destino) => setView(destino)}
            onAtualizarConsulta={async (id, dados) => {
              await api.atendimentos.atualizar(id, dados);
              await Promise.all([carregarConsultas(), carregarPagamentos()]);
            }}
            onAtualizarAgendamentoOdonto={async (id, dados) => {
              await api.agendamentosOdonto.atualizar(id, dados);
              await carregarAgendamentosOdonto();
            }}
            onCriarAtendimentoOdonto={criarAtendimentoOdontoDeAgendamento}
            onEncaminharParaPagamento={encaminharParaPagamento}
          />
        );

      case "medicos":
        return (
          <Medicos
            consultas={consultas}
            pacientes={pacientes}
            consultaSelecionadaExterna={consultaSelecionadaExterna}
            limparConsultaExterna={() => setConsultaSelecionadaExterna(null)}
            consultorioAtual={consultorioAtual}
            onIniciarAtendimento={iniciarAtendimento}
            onSalvarProntuario={salvarProntuario}
            onFinalizarAtendimento={finalizarAtendimento}
            onSolicitarOverride={solicitarOverride}
          />
        );

      case "enfermagem":
        return (
          <Enfermagem
            consultas={consultas}
            pacientes={pacientes}
            procedimentosOdonto={procedimentosOdonto}
            onRefresh={carregarConsultas}
            onEncaminharParaPagamento={(checkout) => {
              setPagamentoCheckout(checkout);
              setView("pagamentos");
            }}
          />
        );

      case "odonto":
        return (
          <Odonto
            pacientes={pacientes}
            users={users}
            userData={userData}
            pagamentos={pagamentos}
            procedimentosOdonto={procedimentosOdonto}
            atendimentosOdonto={atendimentosOdonto}
            agendamentosOdonto={agendamentosOdonto}
            onRefreshAtendimentosOdonto={carregarAtendimentosOdonto}
            onRefreshAgendamentosOdonto={carregarAgendamentosOdonto}
            onIrParaPagamentos={() => setView("pagamentos")}
          />
        );

      case "faturamento":
        return <Faturamento pagamentosApp={pagamentos} atendimentosOdonto={atendimentosOdonto} onNavegar={setView} />;

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

      case "normas":
        return <Normas />;

      case "cadastros":
        return (
          <Cadastros
            procedimentosOdonto={procedimentosOdonto}
            onRefreshProcedimentosOdonto={carregarProcedimentosOdonto}
          />
        );

      case "prontuario":
        return (
          <Prontuario
            consultas={consultas}
            atendimentosOdonto={atendimentosOdonto}
            pacientes={pacientes}
            pagamentos={pagamentos}
          />
        );

      case "administracao":
      case "configuracoes":
        return (
          <Configuracoes
            users={users}
            consultorios={consultorios}
            salas={salas}
            userData={userData}
            onCriarUsuario={criarUsuario}
            onAtualizarUsuario={atualizarUsuario}
            onExcluirUsuario={excluirUsuario}
            onLiberarConsultorio={liberarConsultorioDeUsuario}
            onCriarSala={criarSala}
            onAtualizarSala={atualizarSala}
            onExcluirSala={excluirSala}
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
            userData={userData}
            onNavigate={(v) => setView(v)}
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
    administracao:  Settings,
    cadastros:      FolderOpen,
    configuracoes:  UserCog,
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
    normas:        "Normas",
    administracao: "Configurações",
    cadastros:     "Cadastros",
    configuracoes: "Configurações",
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
    administracao:  "Sistema",
    normas:         "Sistema",
    cadastros:      "Sistema",
    configuracoes:  "Sistema",
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
      toast.error("Não foi possível sair do sistema.");
    }
  }

  if (loading) {
    return (
      <div className="nx-loading-screen">
        <div className="nx-spinner" />
        <p>Iniciando o sistema…</p>
      </div>
    );
  }

  if (!userData) {
    return <LoginScreen />;
  }

  if (userData?.atende_pacientes && !consultorioConfirmadoSessao) {
    return (
      <EscolherConsultorio
        consultorios={consultorios}
        salasDef={salas}
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
            <div className="sidebar-logo-wordmark">
              <svg className="sidebar-logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 41C24 41 5 27.5 5 15.5C5 10.8 8.8 7 13.5 7C17.2 7 20.4 9.2 22 12.5L24 16.5L26 12.5C27.6 9.2 30.8 7 34.5 7C39.2 7 43 10.8 43 15.5C43 27.5 24 41 24 41Z" stroke="#C4B5FD" strokeWidth="2.5" fill="rgba(196,181,253,0.12)"/>
                <path d="M9 22H15L17.5 16.5L20.5 27L23 19L25.5 23L28 22H39" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="sidebar-logo-textblock">
                <h2 className="brand-title" style={{ margin: 0 }}>Vynor<span style={{ color: "#C4B5FD" }}> Clinic</span></h2>
                <p className="brand-subtitle">Healthcare System</p>
              </div>
            </div>
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

          {hasAnyInGroup(["normas", "cadastros", "configuracoes"]) && (
            <div className="menu-section-toggle" style={{ cursor: "default", pointerEvents: "none" }}>
              Sistema
            </div>
          )}
          <div className="menu-group">
            {menu("Cadastros", "cadastros")}
            {menu("Configurações", "configuracoes")}
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
                : "Vynor Clinic"}
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

            {/* Indicador de conexão realtime */}
            {(() => {
              const cfg = {
                [REALTIME_STATUS.ONLINE]:       { color: "#16a34a", label: "Tempo real", dot: "#22c55e" },
                [REALTIME_STATUS.CONNECTING]:   { color: "#d97706", label: "Conectando", dot: "#fbbf24" },
                [REALTIME_STATUS.RECONNECTING]: { color: "#d97706", label: "Reconectando", dot: "#fbbf24" },
                [REALTIME_STATUS.OFFLINE]:      { color: "#64748b", label: "Polling", dot: "#94a3b8" },
              }[realtimeStatus] || { color: "#64748b", label: "—", dot: "#94a3b8" };
              return (
                <div
                  title={`Conexão: ${cfg.label}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    background: cfg.color + "12",
                    border: `1px solid ${cfg.color}30`,
                    borderRadius: "999px",
                    padding: "3px 9px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: cfg.color,
                    flexShrink: 0,
                    cursor: "default",
                    userSelect: "none",
                  }}
                >
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: cfg.dot,
                    flexShrink: 0,
                    animation: realtimeStatus === REALTIME_STATUS.RECONNECTING
                      ? "pulse-rt 1.2s ease-in-out infinite"
                      : "none",
                  }} />
                  {cfg.label}
                </div>
              );
            })()}

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

        <main className="main-content">
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-secondary, #64748b)", fontSize: 15 }}>Carregando módulo…</div>}>
            {renderView()}
          </Suspense>
        </main>
      </div>

      {mostrarPerfil && (
        <ModalPerfil
          userData={userData}
          onClose={() => setMostrarPerfil(false)}
        />
      )}

      {overrideModal && (
        <ModalAntecipacaoData
          consulta={overrideModal.consulta}
          userData={userData}
          onConfirm={overrideModal.onConfirm}
          onCancel={overrideModal.onCancel}
        />
      )}
    </div>
  );
}
