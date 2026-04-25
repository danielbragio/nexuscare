import { useEffect, useMemo, useState } from "react";
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

    if (termo.includes("@")) return termo;

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
        return snapshot.docs[0].data().email;
      }
    }

    return null;
  }

  async function entrar() {
    if (!usuario || !senha) {
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
      console.error("Erro no login:", error);
      setErro("Não foi possível entrar. Verifique usuário e senha.");
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
              <span>Cadastro, agendamento e pronto atendimento conectados.</span>
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
            <p>Informe seu usuário e senha para acessar o NexusCare.</p>
          </div>

          <div className="login-form-v2">
            <div className="login-field-v2">
              <label>Usuário</label>
              <input
                className="login-input-v2"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Digite seu usuário"
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

  const [menuAberto, setMenuAberto] = useState({
    principal: true,
    assistencial: false,
    gestao: false,
  });

  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
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
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser) {
      setPacientes([]);
      setConsultas([]);
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

    const unsubConsultorios = onSnapshot(qConsultorios, (snapshot) => {
      setConsultorios(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => {
      unsubPacientes();
      unsubConsultas();
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
      status: "Agendada",
      prontuario: null,
      createdAt: serverTimestamp(),
    });
  }

  async function iniciarAtendimento(id) {
    await updateDoc(doc(db, "appointments", id), {
      status: "Em atendimento",
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
      status: "Finalizado",
      prontuario: prontuarioComProfissional,
      finalizadoEm: serverTimestamp(),
    });
  }

  const indicadores = useMemo(() => {
    return {
      total: consultas.length,
      agendadas: consultas.filter((c) => c.status === "Agendada").length,
      emAtendimento: consultas.filter((c) => c.status === "Em atendimento").length,
      altas: consultas.filter((c) => c.status === "Finalizado").length,
      totalPacientes: pacientes.length,
    };
  }, [consultas, pacientes]);

  function getFirstAllowedView() {
    const orderedViews = [
      "dashboard",
      "pacientes",
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
            onAdicionarPaciente={adicionarPaciente}
            onAdicionarConsulta={adicionarConsulta}
          />
        );

      case "agendamentos":
        return <Agendamentos consultas={consultas} />;

      case "medicos":
        return (
          <Medicos
            consultas={consultas}
            consultorioAtual={consultorioAtual}
            onIniciarAtendimento={iniciarAtendimento}
            onSalvarProntuario={salvarProntuario}
            onFinalizarAtendimento={finalizarAtendimento}
          />
        );

      case "enfermagem":
        return <Enfermagem />;

      case "odonto":
        return <Odonto />;

      case "faturamento":
        return <Faturamento />;

      case "financeiro":
        return <Financeiro />;

      case "administracao":
        return (
          <Administracao
            users={users}
            onCriarUsuario={criarUsuario}
            onAtualizarUsuario={atualizarUsuario}
          />
        );

      case "normas":
        return <Normas />;

      case "prontuario":
        return <Prontuario consultas={consultas} />;

      case "estoque":
        return <Estoque />;

      case "relatorios":
        return <Relatorios />;

      case "telemedicina":
        return <Telemedicina />;

      default:
        return (
          <Dashboard
            consultas={consultas}
            indicadores={indicadores}
            pacientes={pacientes}
            consultorios={consultorios}
          />
        );
    }
  }

  function menu(label, value) {
    if (!hasPermission(userData, value)) return null;

    return (
      <button
        className={`sidebar-btn ${view === value ? "active" : ""}`}
        onClick={() => setView(value)}
        title={label}
      >
        {label}
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
          <div>
            <div className="topbar-title">
              {view === "pacientes" ? "Recepção" : view.charAt(0).toUpperCase() + view.slice(1)}
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