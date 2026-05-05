import { useEffect, useMemo, useRef, useState } from "react";
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
import ModalPerfil from "./components/ModalPerfil";

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
  const [pagamentoCheckout, setPagamentoCheckout] = useState(null);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [fotoURLPerfil, setFotoURLPerfil] = useState(userData?.photoURL || "");

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
  const [atendimentosOdonto, setAtendimentosOdonto] = useState([]);
  const [procedimentosOdonto, setProcedimentosOdonto] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

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
    if (!firebaseUser) return null;
    return consultorios.find((item) => item.medicoId === firebaseUser.uid) || null;
  }, [consultorios, firebaseUser]);

  useEffect(() => {
    setFotoURLPerfil(userData?.photoURL || "");
  }, [userData?.photoURL]);

  useEffect(() => {
    setConsultorioConfirmadoSessao(false);
    setConsultaSelecionadaExterna(null);
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!consultorioConfirmadoSessao || !firebaseUser) return;
    const interval = setInterval(async () => {
      try {
        await updateDoc(doc(db, "consultorios", firebaseUser.uid), {
          lastActive: serverTimestamp(),
        });
      } catch (_) {}
    }, 10000);
    return () => clearInterval(interval);
  }, [consultorioConfirmadoSessao, firebaseUser]);

  useEffect(() => {
    if (!consultorioConfirmadoSessao || !firebaseUser) return;
    const handleUnload = () => {
      try {
        deleteDoc(doc(db, "consultorios", firebaseUser.uid));
      } catch (_) {}
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [consultorioConfirmadoSessao, firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      setPacientes([]);
      setConsultas([]);
      setPagamentos([]);
      setConsultorios([]);
      setUsers([]);
      setAtendimentosOdonto([]);
      setProcedimentosOdonto([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    const uid = firebaseUser.uid;
    const role = userData?.role || "";
    const podeVerTodos =
      role === "admin" ||
      role === "recepcao" ||
      role === "financeiro" ||
      role === "estoque" ||
      role === "enfermagem" ||
      (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));

    const qPacientes = query(collection(db, "patients"), orderBy("createdAt", "desc"));

    const qConsultas = podeVerTodos
      ? query(collection(db, "appointments"), orderBy("createdAt", "desc"))
      : query(collection(db, "appointments"), where("profissionalId", "==", uid));

    const qPagamentos = query(collection(db, "pagamentos"), orderBy("createdAt", "desc"));
    const qConsultorios = query(collection(db, "consultorios"), orderBy("numero", "asc"));
    const qUsers = query(collection(db, "users"), orderBy("nome", "asc"));

    const qAtendimentosOdonto = podeVerTodos
      ? query(collection(db, "atendimentosOdonto"), orderBy("createdAt", "desc"))
      : query(collection(db, "atendimentosOdonto"), where("profissionalId", "==", uid));

    const unsubPacientes = onSnapshot(qPacientes, (snapshot) => {
      setPacientes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubConsultas = onSnapshot(qConsultas, (snapshot) => {
      const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (!podeVerTodos) docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setConsultas(docs);
      setDataLoading(false);
    }, (err) => { console.error("appointments:", err); setConsultas([]); setDataLoading(false); });

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

    const unsubAtendimentosOdonto = onSnapshot(
      qAtendimentosOdonto,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!podeVerTodos) docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAtendimentosOdonto(docs);
      },
      (err) => { console.error("atendimentosOdonto:", err); setAtendimentosOdonto([]); }
    );

    const unsubProcedimentosOdonto = onSnapshot(
      query(collection(db, "procedimentosOdonto"), orderBy("nome", "asc")),
      (snap) => setProcedimentosOdonto(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error("procedimentosOdonto:", err); setProcedimentosOdonto([]); }
    );

    return () => {
      unsubPacientes();
      unsubConsultas();
      unsubPagamentos();
      unsubConsultorios();
      unsubUsers();
      unsubAtendimentosOdonto();
      unsubProcedimentosOdonto();
    };
  }, [firebaseUser, userData?.role, userData?.permissions]);

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
      lastActive: serverTimestamp(),
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

  async function liberarConsultorioDeUsuario(usuarioId) {
    try {
      await deleteDoc(doc(db, "consultorios", usuarioId));
    } catch (error) {
      console.error("Erro ao liberar consultório do usuário:", error);
    }
  }

  function encaminharParaPagamento(checkoutData) {
    setPagamentoCheckout(checkoutData);
    setView("pagamentos");
  }

  async function adicionarPaciente(novoPaciente) {
    await addDoc(collection(db, "patients"), {
      ...novoPaciente,
      createdAt: serverTimestamp(),
    });
  }

  async function adicionarConsulta(novaConsulta) {
    const docRef = await addDoc(collection(db, "appointments"), {
      ...novaConsulta,
      status: "agendado",
      prontuario: null,
      createdAt: serverTimestamp(),
    });
    return docRef;
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
        return <Prontuario consultas={consultas} atendimentosOdonto={atendimentosOdonto} />;

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

      default:
        return (
          <Dashboard
            consultas={consultas}
            pagamentos={pagamentos}
            indicadores={indicadores}
            pacientes={pacientes}
            consultorios={consultorios}
            users={users}
            atendimentosOdonto={atendimentosOdonto}
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
              {menu("Consulta", "medicos")}
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
            </div>
          )}
        </div>

        <div
          className="sidebar-footer"
          onClick={() => setMostrarPerfil(true)}
          style={{ cursor: "pointer" }}
          title="Meu Perfil"
        >
          <div className="sidebar-user-avatar" style={{ overflow: "hidden", padding: 0 }}>
            {fotoURLPerfil ? (
              <img
                src={fotoURLPerfil}
                alt="Foto"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              (userData?.nome || userData?.name || firebaseUser?.email || "U").charAt(0).toUpperCase()
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {userData?.nome || userData?.name || firebaseUser?.email}
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
              {view === "pacientes"
                ? "Recepção"
                : view === "pagamentos"
                ? "Pagamentos"
                : view === "odonto"
                ? "Odontologia"
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
                ? "Consulta"
                : view === "faturamento"
                ? "Faturamento"
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

            <button className="secondary-btn" onClick={sairSistema}>
              Sair
            </button>
          </div>
        </div>

        <main className="main-content">{renderView()}</main>
      </div>

      {mostrarPerfil && (
        <ModalPerfil
          firebaseUser={firebaseUser}
          userData={userData}
          onClose={() => setMostrarPerfil(false)}
          onPhotoUpdate={(url) => setFotoURLPerfil(url)}
        />
      )}
    </div>
  );
}