import { useEffect, useMemo, useState } from "react";
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
  Video,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { auth, db } from "./services/firebase";
import { useAuth } from "./context/AuthContext";
import { hasPermission } from "./config/permissions";

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
import Telemedicina from "./pages/Telemedicina";

function FirebaseLoginScreen() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function buscarEmailDoUsuario(valorDigitado) {
    const termo = valorDigitado.trim();
    const termoLower = termo.toLowerCase();

    if (termo.includes("@")) return termoLower;

    const buscas = [
      { campo: "usernameLower", valor: termoLower },
      { campo: "username", valor: termo },
      { campo: "usuario", valor: termo },
      { campo: "login", valor: termo },
    ];

    for (const item of buscas) {
      const qUsuario = query(
        collection(db, "users"),
        where(item.campo, "==", item.valor),
        limit(1)
      );

      const snapshot = await getDocs(qUsuario);

      if (!snapshot.empty) {
        const dadosUsuario = snapshot.docs[0].data();

        if (dadosUsuario?.ativo === false) {
          throw new Error("USUARIO_INATIVO");
        }

        if (dadosUsuario?.email) {
          return String(dadosUsuario.email).trim().toLowerCase();
        }
      }
    }

    return null;
  }

  async function entrar() {
    if (!usuario.trim() || !senha) {
      setErro("Preencha usuário e senha.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const emailEncontrado = await buscarEmailDoUsuario(usuario);

      if (!emailEncontrado) {
        setErro("Usuário não encontrado.");
        return;
      }

      await signInWithEmailAndPassword(auth, emailEncontrado, senha);
    } catch (error) {
      console.error("ERRO REAL DO LOGIN:", error);

      if (error.message === "USUARIO_INATIVO") {
        setErro("Usuário inativo. Procure o administrador.");
      } else if (error.code === "auth/invalid-credential") {
        setErro("Credencial inválida. Confira e-mail/usuário e senha.");
      } else if (error.code === "auth/wrong-password") {
        setErro("Senha incorreta.");
      } else if (error.code === "auth/user-not-found") {
        setErro("Usuário não encontrado no Firebase Authentication.");
      } else if (error.code === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else if (error.code === "auth/too-many-requests") {
        setErro("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setErro(`Não foi possível entrar. ${error.message || ""}`);
      }
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
  firebaseUser,
  userData,
  onSelecionar,
  onSair,
}) {
  const salas = Array.from({ length: 7 }, (_, index) => {
    const numero = index + 1;
    const ocupado = consultorios.find((item) => Number(item.numero) === numero);

    return {
      numero,
      nome: `Consultório ${numero}`,
      ocupado,
    };
  });

  async function escolherSala(sala) {
    if (sala.ocupado && sala.ocupado.medicoId !== firebaseUser.uid) {
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
          <strong>{userData?.nome || userData?.name || firebaseUser?.email}</strong>
          <span>Perfil médico</span>
        </div>

        <div className="consultorio-grid">
          {salas.map((sala) => {
            const emUso = sala.ocupado && sala.ocupado.medicoId !== firebaseUser.uid;

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
  const { firebaseUser, userData, loading, logout } = useAuth();
  const [view, setView] = useState("");
  const [sidebarMinimizada, setSidebarMinimizada] = useState(false);
  const [consultorioConfirmadoSessao, setConsultorioConfirmadoSessao] = useState(false);
  const [consultaSelecionadaExterna, setConsultaSelecionadaExterna] = useState(null);

  const [menuAberto, setMenuAberto] = useState({
    principal: true,
    assistencial: false,
    gestao: false,
  });

  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [users, setUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const isMedico =
    userData?.role === "medico" ||
    hasPermission(userData, "medicos");

  const consultorioAtual = useMemo(() => {
    if (!firebaseUser) return null;
    return consultorios.find((item) => item.medicoId === firebaseUser.uid) || null;
  }, [consultorios, firebaseUser]);

  useEffect(() => {
    setConsultorioConfirmadoSessao(false);
    setConsultaSelecionadaExterna(null);
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser) {
      setPacientes([]);
      setConsultas([]);
      setPagamentos([]);
      setConsultorios([]);
      setUsers([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    const qPacientes = query(
      collection(db, "patients"),
      orderBy("createdAt", "desc")
    );

    const qConsultas = query(
      collection(db, "appointments"),
      orderBy("createdAt", "desc")
    );

    const qPagamentos = query(
      collection(db, "pagamentos"),
      orderBy("createdAt", "desc")
    );

    const qConsultorios = query(
      collection(db, "consultorios"),
      orderBy("numero", "asc")
    );

    const qUsers = query(
      collection(db, "users"),
      orderBy("nome", "asc")
    );

    const unsubPacientes = onSnapshot(qPacientes, (snapshot) => {
      setPacientes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubConsultas = onSnapshot(qConsultas, (snapshot) => {
      setConsultas(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setDataLoading(false);
    });

    const unsubPagamentos = onSnapshot(
      qPagamentos,
      (snapshot) => {
        setPagamentos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        console.error("Erro ao carregar pagamentos:", error);
        setPagamentos([]);
      }
    );

    const unsubConsultorios = onSnapshot(qConsultorios, (snapshot) => {
      setConsultorios(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => {
      unsubPacientes();
      unsubConsultas();
      unsubPagamentos();
      unsubConsultorios();
      unsubUsers();
    };
  }, [firebaseUser]);

  async function criarUsuario(novoUsuario) {
    const username = novoUsuario.username.trim();
    const usernameLower = username.toLowerCase();
    const email = novoUsuario.email.trim().toLowerCase();

    const usuarioDuplicado = await getDocs(
      query(collection(db, "users"), where("usernameLower", "==", usernameLower), limit(1))
    );

    if (!usuarioDuplicado.empty) {
      throw new Error("USERNAME_DUPLICADO");
    }

    const emailDuplicado = await getDocs(
      query(collection(db, "users"), where("email", "==", email), limit(1))
    );

    if (!emailDuplicado.empty) {
      throw new Error("EMAIL_DUPLICADO");
    }

    const secondaryAppName = `SecondaryUserCreation-${Date.now()}`;
    const secondaryApp = initializeApp(auth.app.options, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        novoUsuario.senha
      );

      await setDoc(doc(db, "users", credential.user.uid), {
        nome: novoUsuario.nome,
        email,
        username,
        usernameLower,
        usuario: username,
        login: username,
        role: novoUsuario.role,
        ativo: novoUsuario.ativo,
        permissions: novoUsuario.permissions,
        crm: novoUsuario.crm || "",
        coren: novoUsuario.coren || "",
        especialidade: novoUsuario.especialidade || "",
        diasAtendimento: novoUsuario.diasAtendimento || [],
        horarios: novoUsuario.horarios || [],
        horaInicio: novoUsuario.horaInicio || "",
        horaFim: novoUsuario.horaFim || "",
        intervalo: novoUsuario.intervalo || 30,
        pausaInicio: novoUsuario.pausaInicio || "",
        pausaFim: novoUsuario.pausaFim || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await secondaryAuth.signOut();
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  async function atualizarUsuario(id, dados) {
    const payload = {
      ...dados,
      updatedAt: serverTimestamp(),
    };

    if (payload.username) {
      payload.username = payload.username.trim();
      payload.usernameLower = payload.username.toLowerCase();
      payload.usuario = payload.username;
      payload.login = payload.username;
    }

    if (payload.email) {
      payload.email = payload.email.trim().toLowerCase();
    }

    await updateDoc(doc(db, "users", id), payload);
  }

  async function excluirUsuario(usuario) {
    if (!usuario?.id) {
      throw new Error("Usuário inválido para exclusão.");
    }

    await deleteDoc(doc(db, "users", usuario.id));
  }

  async function selecionarConsultorio(numero) {
    if (!firebaseUser) return;

    const medicoNome =
      userData?.nome || userData?.name || firebaseUser?.displayName || firebaseUser?.email;

    await setDoc(doc(db, "consultorios", firebaseUser.uid), {
      numero,
      nome: `Consultório ${numero}`,
      medicoId: firebaseUser.uid,
      medicoNome,
      medicoEmail: firebaseUser.email || "",
      crm: userData?.crm || "",
      status: "ocupado",
      atualizadoEm: serverTimestamp(),
    });

    setConsultorioConfirmadoSessao(true);
    setView("medicos");
  }

  async function liberarConsultorio() {
    if (!firebaseUser) return;

    try {
      await deleteDoc(doc(db, "consultorios", firebaseUser.uid));
    } catch (error) {
      console.error("Erro ao liberar consultório:", error);
    }
  }

  async function adicionarPaciente(novoPaciente) {
    await addDoc(collection(db, "patients"), {
      ...novoPaciente,
      createdAt: serverTimestamp(),
    });
  }

  async function adicionarConsulta(novaConsulta) {
    await addDoc(collection(db, "appointments"), {
      ...novaConsulta,
      status: "agendado",
      prontuario: null,
      createdAt: serverTimestamp(),
    });
  }

  async function iniciarAtendimento(id) {
    await updateDoc(doc(db, "appointments", id), {
      status: "em_atendimento",
    });
  }

  async function salvarProntuario(id, prontuario) {
    await updateDoc(doc(db, "appointments", id), {
      prontuario,
    });
  }

  async function finalizarAtendimento(id, prontuarioFinal) {
    const prontuarioComProfissional = {
      ...prontuarioFinal,
      medicoNome: userData?.nome || userData?.name || firebaseUser?.email || "",
      crm: userData?.crm || "",
      coren: userData?.coren || "",
      profissionalRole: userData?.role || "",
    };

    await updateDoc(doc(db, "appointments", id), {
      status: "finalizado",
      prontuario: prontuarioComProfissional,
      finalizadoEm: serverTimestamp(),
    });
  }

  const indicadores = useMemo(() => {
    return {
      total: consultas.length,
      agendadas: consultas.filter((c) => c.status === "agendado").length,
      emAtendimento: consultas.filter((c) => c.status === "em_atendimento").length,
      altas: consultas.filter((c) => c.status === "finalizado").length,
      totalPacientes: pacientes.length,
      pagamentos: pagamentos.length,
    };
  }, [consultas, pacientes, pagamentos]);

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
      "telemedicina",
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
            onAdicionarPaciente={adicionarPaciente}
            onAdicionarConsulta={adicionarConsulta}
          />
        );

      case "pagamentos":
        return (
          <Pagamentos
            pacientes={pacientes}
            consultas={consultas}
            pagamentos={pagamentos}
          />
        );

      case "agendamentos":
        return (
          <Agendamentos
            consultas={consultas}
            users={users}
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
        return <Odonto pacientes={pacientes} users={users} />;

      case "faturamento":
        return <Faturamento />;

      case "financeiro":
        return (
          <Financeiro
            pagamentos={pagamentos}
            consultas={consultas}
            pacientes={pacientes}
          />
        );

      case "administracao":
        return (
          <Administracao
            users={users}
            onCriarUsuario={criarUsuario}
            onAtualizarUsuario={atualizarUsuario}
            onExcluirUsuario={excluirUsuario}
          />
        );

      case "normas":
        return <Normas />;

      case "prontuario":
        return <Prontuario consultas={consultas} />;

      case "estoque":
        return <Estoque />;

      case "relatorios":
        return (
          <Relatorios
            consultas={consultas}
            pagamentos={pagamentos}
            pacientes={pacientes}
            users={users}
          />
        );

      case "telemedicina":
        return <Telemedicina />;

      default:
        return (
          <Dashboard
            consultas={consultas}
            pagamentos={pagamentos}
            indicadores={indicadores}
            pacientes={pacientes}
            consultorios={consultorios}
            users={users}
          />
        );
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
    telemedicina: Video,
  };

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

  function toggleGrupo(grupo) {
    setMenuAberto((prev) => ({
      ...prev,
      [grupo]: !prev[grupo],
    }));
  }

  async function sairSistema() {
    try {
      if (isMedico) {
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

  if (!firebaseUser) {
    return <FirebaseLoginScreen />;
  }

  if (dataLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Carregando dados...</div>;
  }

  if (isMedico && !consultorioConfirmadoSessao) {
    return (
      <EscolherConsultorio
        consultorios={consultorios}
        firebaseUser={firebaseUser}
        userData={userData}
        onSelecionar={selecionarConsultorio}
        onSair={sairSistema}
      />
    );
  }

  return (
    <div className={`app-shell ${sidebarMinimizada ? "sidebar-collapsed-mode" : ""}`}>
      <aside className={`sidebar ${sidebarMinimizada ? "sidebar-collapsed" : ""}`}>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarMinimizada((prev) => !prev)}
          title={sidebarMinimizada ? "Expandir menu" : "Minimizar menu"}
        >
          {sidebarMinimizada ? "☰" : "‹"}
        </button>

        <h2 className="brand-title">NexusCare</h2>
        <p className="brand-subtitle">Healthcare System</p>

        <button
          className={`menu-section-toggle ${menuAberto.principal ? "open" : ""}`}
          onClick={() => toggleGrupo("principal")}
        >
          Principal <span>{menuAberto.principal ? "▾" : "▸"}</span>
        </button>

        {menuAberto.principal && (
          <div className="menu-group">
            {menu("Dashboard", "dashboard")}
            {menu("Recepção", "pacientes")}
            {menu("Pagamentos", "pagamentos")}
            {menu("Agendamentos", "agendamentos")}
            {menu("Prontuário", "prontuario")}
          </div>
        )}

        <button
          className={`menu-section-toggle ${menuAberto.assistencial ? "open" : ""}`}
          onClick={() => toggleGrupo("assistencial")}
        >
          Assistencial <span>{menuAberto.assistencial ? "▾" : "▸"}</span>
        </button>

        {menuAberto.assistencial && (
          <div className="menu-group">
            {menu("Médicos", "medicos")}
            {menu("Enfermagem", "enfermagem")}
            {menu("Odonto", "odonto")}
          </div>
        )}

        <button
          className={`menu-section-toggle ${menuAberto.gestao ? "open" : ""}`}
          onClick={() => toggleGrupo("gestao")}
        >
          Gestão <span>{menuAberto.gestao ? "▾" : "▸"}</span>
        </button>

        {menuAberto.gestao && (
          <div className="menu-group">
            {menu("Faturamento", "faturamento")}
            {menu("Financeiro", "financeiro")}
            {menu("Estoque", "estoque")}
            {menu("Relatórios", "relatorios")}
            {menu("Normas", "normas")}
            {menu("Administração", "administracao")}
            {menu("Telemedicina", "telemedicina")}
          </div>
        )}
      </aside>

      <div className="content-area">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="topbar-title">
              {view === "pacientes"
                ? "Recepção"
                : view === "pagamentos"
                ? "Pagamentos"
                : view === "odonto"
                ? "Odonto"
                : view === "relatorios"
                ? "Relatórios"
                : view === "administracao"
                ? "Administração"
                : view === "prontuario"
                ? "Prontuário"
                : view === "financeiro"
                ? "Financeiro"
                : view === "agendamentos"
                ? "Agendamentos"
                : view === "medicos"
                ? "Médicos"
                : view === "faturamento"
                ? "Faturamento"
                : view === "telemedicina"
                ? "Telemedicina"
                : view === "normas"
                ? "Normas"
                : view === "estoque"
                ? "Estoque"
                : view === "enfermagem"
                ? "Enfermagem"
                : view === "dashboard"
                ? "Dashboard"
                : view.charAt(0).toUpperCase() + view.slice(1)}
            </div>
            <div className="topbar-subtitle">
              {consultorioAtual
                ? `${consultorioAtual.nome} • ${consultorioAtual.medicoNome}`
                : "NexusCare Healthcare System"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="topbar-badge">
              {userData?.name || userData?.nome || firebaseUser?.email || "Usuário"}
            </div>

            <button className="secondary-btn" onClick={sairSistema}>
              Sair
            </button>
          </div>
        </div>

        <main className="main-content">{renderView()}</main>
      </div>
    </div>
  );
}