import { useEffect, useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebase";
import {
  allModules,
  rolePermissions,
} from "../config/permissions";

const DIAS_ATENDIMENTO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const ESPECIALIDADES_MEDICO = [
  "Clínico Geral",
  "Cardiologia",
  "Dermatologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Geriatria",
  "Ginecologia e Obstetrícia",
  "Neurologia",
  "Oftalmologia",
  "Ortopedia e Traumatologia",
  "Otorrinolaringologia",
  "Pediatria",
  "Psiquiatria",
  "Reumatologia",
  "Urologia",
  "Medicina de Família e Comunidade",
  "Medicina do Trabalho",
  "Medicina de Emergência",
  "Infectologia",
  "Oncologia",
  "Pneumologia",
  "Cirurgia Geral",
];

const ESPECIALIDADES_ODONTO = [
  "Clínico Geral",
  "Ortodontia",
  "Endodontia",
  "Periodontia",
  "Implantodontia",
  "Cirurgia Bucomaxilofacial",
  "Odontopediatria",
  "Prótese Dentária",
  "Dentística",
  "Radiologia Odontológica",
];

export default function Administracao({
  users = [],
  consultorios = [],
  onCriarUsuario,
  onAtualizarUsuario,
  onExcluirUsuario,
  onLiberarConsultorio,
}) {
  const [abaAtiva, setAbaAtiva] = useState("usuarios");
  const [busca, setBusca] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [novoHorario, setNovoHorario] = useState("");

  const [form, setForm] = useState({
    nome: "",
    email: "",
    username: "",
    senha: "",
    confirmarSenha: "",
    role: "recepcao",
    crm: "",
    coren: "",
    especialidade: "",
    ativo: true,
    permissions: rolePermissions.recepcao,
    diasAtendimento: [],
    horarios: [],
    horaInicio: "",
    horaFim: "",
    intervalo: 30,
    pausaInicio: "",
    pausaFim: "",
  });

  const usuariosFiltrados = useMemo(() => {
    return users.filter((item) => {
      const termo = busca.toLowerCase();
      return (
        item.nome?.toLowerCase().includes(termo) ||
        item.email?.toLowerCase().includes(termo) ||
        item.username?.toLowerCase().includes(termo) ||
        item.usuario?.toLowerCase().includes(termo) ||
        item.login?.toLowerCase().includes(termo) ||
        item.role?.toLowerCase().includes(termo) ||
        item.crm?.toLowerCase().includes(termo) ||
        item.coren?.toLowerCase().includes(termo) ||
        item.especialidade?.toLowerCase().includes(termo)
      );
    });
  }, [users, busca]);

  useEffect(() => {
    if (!editandoId) return;

    const usuario = users.find((item) => item.id === editandoId);
    if (!usuario) return;

    setForm({
      nome: usuario.nome || "",
      email: usuario.email || "",
      username: usuario.username || usuario.usuario || usuario.login || "",
      senha: "",
      confirmarSenha: "",
      role: usuario.role || "recepcao",
      crm: usuario.crm || "",
      coren: usuario.coren || "",
      especialidade: usuario.especialidade || "",
      ativo: usuario.ativo !== false,
      permissions:
        Array.isArray(usuario.permissions) && usuario.permissions.length > 0
          ? usuario.permissions
          : rolePermissions[usuario.role] || [],
      diasAtendimento: Array.isArray(usuario.diasAtendimento)
        ? usuario.diasAtendimento
        : [],
      horarios: Array.isArray(usuario.horarios) ? usuario.horarios : [],
      horaInicio: usuario.horaInicio || "",
      horaFim: usuario.horaFim || "",
      intervalo: usuario.intervalo || 30,
      pausaInicio: usuario.pausaInicio || "",
      pausaFim: usuario.pausaFim || "",
    });
  }, [editandoId, users]);

  function limparFormulario() {
    setEditandoId(null);
    setNovoHorario("");
    setForm({
      nome: "",
      email: "",
      username: "",
      senha: "",
      confirmarSenha: "",
      role: "recepcao",
      crm: "",
      coren: "",
      especialidade: "",
      ativo: true,
      permissions: rolePermissions.recepcao,
      diasAtendimento: [],
      horarios: [],
      horaInicio: "",
      horaFim: "",
      intervalo: 30,
      pausaInicio: "",
      pausaFim: "",
    });
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function alterarRole(role) {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: rolePermissions[role] || [],
      especialidade: role === "medico" ? prev.especialidade : "",
      diasAtendimento:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.diasAtendimento
          : [],
      horarios:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.horarios
          : [],
      horaInicio:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.horaInicio
          : "",
      horaFim:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.horaFim
          : "",
      intervalo:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.intervalo
          : 30,
      pausaInicio:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.pausaInicio
          : "",
      pausaFim:
        role === "medico" || role === "enfermagem" || role === "odonto"
          ? prev.pausaFim
          : "",
    }));
  }

  function togglePermissao(modulo) {
    setForm((prev) => {
      const existe = prev.permissions.includes(modulo);

      if (existe) {
        return {
          ...prev,
          permissions: prev.permissions.filter((item) => item !== modulo),
        };
      }

      return {
        ...prev,
        permissions: [...prev.permissions, modulo],
      };
    });
  }

  function toggleDiaAtendimento(dia) {
    setForm((prev) => {
      const existe = prev.diasAtendimento.includes(dia);

      if (existe) {
        return {
          ...prev,
          diasAtendimento: prev.diasAtendimento.filter((item) => item !== dia),
        };
      }

      return {
        ...prev,
        diasAtendimento: [...prev.diasAtendimento, dia],
      };
    });
  }

  function adicionarHorario() {
    if (!novoHorario) {
      alert("Informe um horário.");
      return;
    }

    if (form.horarios.includes(novoHorario)) {
      alert("Este horário já foi adicionado.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      horarios: [...prev.horarios, novoHorario].sort(),
    }));

    setNovoHorario("");
  }

  function removerHorario(horario) {
    setForm((prev) => ({
      ...prev,
      horarios: prev.horarios.filter((item) => item !== horario),
    }));
  }

  function gerarHorariosAutomaticos() {
    if (!form.horaInicio || !form.horaFim) {
      alert("Preencha hora início e hora fim.");
      return;
    }

    const [horaInicio, minutoInicio] = form.horaInicio.split(":").map(Number);
    const [horaFim, minutoFim] = form.horaFim.split(":").map(Number);

    if (
      Number.isNaN(horaInicio) ||
      Number.isNaN(minutoInicio) ||
      Number.isNaN(horaFim) ||
      Number.isNaN(minutoFim)
    ) {
      alert("Horário inválido.");
      return;
    }

    const inicio = new Date();
    inicio.setHours(horaInicio, minutoInicio, 0, 0);

    const fim = new Date();
    fim.setHours(horaFim, minutoFim, 0, 0);

    if (inicio >= fim) {
      alert("A hora inicial deve ser menor que a hora final.");
      return;
    }

    const intervalo = Number(form.intervalo || 30);

    if (!intervalo || intervalo <= 0) {
      alert("Informe um intervalo válido.");
      return;
    }

    const horariosGerados = [];
    const atual = new Date(inicio);

    while (atual < fim) {
      const hora = String(atual.getHours()).padStart(2, "0");
      const minuto = String(atual.getMinutes()).padStart(2, "0");
      const horario = `${hora}:${minuto}`;

      const dentroDaPausa =
        form.pausaInicio &&
        form.pausaFim &&
        horario >= form.pausaInicio &&
        horario < form.pausaFim;

      if (!dentroDaPausa) {
        horariosGerados.push(horario);
      }

      atual.setMinutes(atual.getMinutes() + intervalo);
    }

    setForm((prev) => ({
      ...prev,
      horarios: Array.from(new Set(horariosGerados)).sort(),
    }));
  }

  function limparHorariosGerados() {
    setForm((prev) => ({
      ...prev,
      horarios: [],
    }));
  }

  async function salvarUsuario() {
    if (!form.nome || !form.email || !form.username) {
      alert("Preencha nome, e-mail e usuário de login.");
      return;
    }

    if (!editandoId && !form.senha) {
      alert("Preencha a senha para criar o usuário.");
      return;
    }

    if (!editandoId && !form.confirmarSenha) {
      alert("Confirme a senha do usuário.");
      return;
    }

    if (!editandoId && form.senha !== form.confirmarSenha) {
      alert("As senhas não coincidem.");
      return;
    }

    if (form.role === "medico" && !form.crm) {
      alert("Informe o CRM do médico.");
      return;
    }

    if (form.role === "medico" && !form.especialidade) {
      alert("Informe a especialidade do médico.");
      return;
    }

    if (form.role === "enfermagem" && !form.coren) {
      alert("Informe o COREN da enfermagem.");
      return;
    }

    const profissionalAgenda =
      form.role === "medico" || form.role === "enfermagem" || form.role === "odonto";

    if (profissionalAgenda && form.diasAtendimento.length === 0) {
      alert("Selecione pelo menos um dia de atendimento.");
      return;
    }

    if (profissionalAgenda && form.horarios.length === 0) {
      alert("Adicione ou gere pelo menos um horário de atendimento.");
      return;
    }

    if (form.permissions.length === 0) {
      alert("Selecione pelo menos um módulo.");
      return;
    }

    try {
      const payload = {
        nome: form.nome,
        email: form.email,
        username: form.username,
        role: form.role,
        crm: form.role === "medico" ? form.crm : "",
        coren: form.role === "enfermagem" ? form.coren : "",
        especialidade:
          form.role === "medico" || form.role === "odonto"
            ? form.especialidade
            : "",
        ativo: form.ativo,
        permissions: form.permissions,
        diasAtendimento: profissionalAgenda ? form.diasAtendimento : [],
        horarios: profissionalAgenda ? form.horarios : [],
        horaInicio: profissionalAgenda ? form.horaInicio : "",
        horaFim: profissionalAgenda ? form.horaFim : "",
        intervalo: profissionalAgenda ? Number(form.intervalo || 30) : 30,
        pausaInicio: profissionalAgenda ? form.pausaInicio : "",
        pausaFim: profissionalAgenda ? form.pausaFim : "",
      };

      if (editandoId) {
        await onAtualizarUsuario(editandoId, payload);
        alert("Usuário atualizado com sucesso.");
      } else {
        await onCriarUsuario({
          ...payload,
          senha: form.senha,
        });

        alert("Usuário criado com sucesso.");
      }

      limparFormulario();
      setAbaAtiva("lista");
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);

      if (error.message === "USERNAME_DUPLICADO") {
        alert("Esse usuário de login já existe. Escolha outro.");
        return;
      }

      if (error.message === "EMAIL_DUPLICADO") {
        alert("Esse e-mail já está cadastrado.");
        return;
      }

      if (error.code === "auth/email-already-in-use") {
        alert("Esse e-mail já existe no Firebase Authentication.");
        return;
      }

      alert("Erro ao salvar usuário. Verifique os dados e tente novamente.");
    }
  }

  function carregarParaEdicao(usuario) {
    setEditandoId(usuario.id);
    setAbaAtiva("usuarios");
  }

  function toggleAtivo(usuario) {
    onAtualizarUsuario(usuario.id, {
      ativo: !usuario.ativo,
    });
  }

  async function redefinirSenha(usuario) {
    if (!usuario?.email) {
      alert("Este usuário não possui e-mail cadastrado.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, usuario.email);
      alert("E-mail de redefinição de senha enviado com sucesso.");
    } catch (error) {
      console.error("Erro ao enviar redefinição de senha:", error);
      alert("Não foi possível enviar o e-mail de redefinição de senha.");
    }
  }

  async function excluirUsuario(usuario) {
    if (!onExcluirUsuario) {
      alert("Função de exclusão ainda não configurada.");
      return;
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o usuário ${usuario.nome || usuario.email}?`
    );

    if (!confirmar) return;

    try {
      await onExcluirUsuario(usuario);
      alert("Usuário excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      alert("Não foi possível excluir o usuário.");
    }
  }

  const totalUsuarios = users.length;
  const ativos = users.filter((item) => item.ativo !== false).length;
  const inativos = users.filter((item) => item.ativo === false).length;
  const admins = users.filter((item) => item.role === "admin").length;

  const exibirAgenda =
    form.role === "medico" || form.role === "enfermagem" || form.role === "odonto";

  return (
    <div>
      <div className="page-header">
        <h1>Administração</h1>
        <p className="page-subtitle">
          Crie usuários dentro do sistema e defina manualmente os módulos que
          cada um pode acessar.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Total de usuários</div>
          <div className="stat-value">{totalUsuarios}</div>
          <div className="stat-info">Usuários cadastrados</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Ativos</div>
          <div className="stat-value">{ativos}</div>
          <div className="stat-info">Com acesso liberado</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Inativos</div>
          <div className="stat-value">{inativos}</div>
          <div className="stat-info">Com acesso bloqueado</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Administradores</div>
          <div className="stat-value">{admins}</div>
          <div className="stat-info">Perfil de gestão total</div>
        </div>
      </div>

      <div className="page-card module-admin" style={{ marginTop: "20px" }}>
        <div className="patients-tabs">
          <button
            className={`patients-tab ${abaAtiva === "usuarios" ? "active" : ""}`}
            onClick={() => setAbaAtiva("usuarios")}
          >
            Cadastro de usuário
          </button>

          <button
            className={`patients-tab ${abaAtiva === "lista" ? "active" : ""}`}
            onClick={() => setAbaAtiva("lista")}
          >
            Lista de usuários
          </button>
        </div>

        <div style={{ marginTop: "20px" }}>
          {abaAtiva === "usuarios" && (
            <div className="two-columns">
              <div className="page-card module-admin">
                <div className="card-title-row">
                  <div>
                    <h3 style={{ marginBottom: "4px" }}>
                      {editandoId ? "Editar usuário" : "Criar usuário"}
                    </h3>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>
                      Defina usuário de login, perfil, registro profissional,
                      agenda e permissões
                    </p>
                  </div>

                  <button className="secondary-btn" onClick={limparFormulario}>
                    Novo
                  </button>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Nome</label>
                    <input
                      className="input"
                      name="nome"
                      value={form.nome}
                      onChange={handleChange}
                      placeholder="Nome do usuário"
                    />
                  </div>

                  <div>
                    <label>Usuário de login</label>
                    <input
                      className="input"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      placeholder="Ex.: dr.joao"
                    />
                  </div>

                  <div>
                    <label>E-mail</label>
                    <input
                      className="input"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="email@clinica.com"
                    />
                  </div>

                  {!editandoId && (
                    <div>
                      <label>Senha</label>
                      <input
                        className="input"
                        name="senha"
                        type="password"
                        value={form.senha}
                        onChange={handleChange}
                        placeholder="Digite uma senha"
                      />
                    </div>
                  )}

                  {!editandoId && (
                    <div>
                      <label>Confirmar senha</label>
                      <input
                        className="input"
                        name="confirmarSenha"
                        type="password"
                        value={form.confirmarSenha}
                        onChange={handleChange}
                        placeholder="Confirme a senha"
                      />
                    </div>
                  )}

                  <div>
                    <label>Perfil base</label>
                    <select
                      className="select"
                      name="role"
                      value={form.role}
                      onChange={(e) => alterarRole(e.target.value)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="recepcao">Recepção</option>
                      <option value="medico">Médico</option>
                      <option value="enfermagem">Enfermagem</option>
                      <option value="odonto">Odonto</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="estoque">Estoque</option>
                    </select>
                  </div>

                  {form.role === "medico" && (
                    <div>
                      <label>CRM do médico</label>
                      <input
                        className="input"
                        name="crm"
                        value={form.crm}
                        onChange={handleChange}
                        placeholder="Ex.: CRM-ES 00000"
                      />
                    </div>
                  )}

                  {form.role === "medico" && (
                    <div>
                      <label>Especialidade médica</label>
                      <select
                        className="select"
                        name="especialidade"
                        value={form.especialidade}
                        onChange={handleChange}
                      >
                        <option value="">Selecione a especialidade</option>
                        {ESPECIALIDADES_MEDICO.map((esp) => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.role === "odonto" && (
                    <div>
                      <label>Especialidade odontológica</label>
                      <select
                        className="select"
                        name="especialidade"
                        value={form.especialidade}
                        onChange={handleChange}
                      >
                        <option value="">Selecione a especialidade</option>
                        {ESPECIALIDADES_ODONTO.map((esp) => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.role === "enfermagem" && (
                    <div>
                      <label>COREN da enfermagem</label>
                      <input
                        className="input"
                        name="coren"
                        value={form.coren}
                        onChange={handleChange}
                        placeholder="Ex.: COREN-ES 000000"
                      />
                    </div>
                  )}

                  {editandoId && (
                    <div>
                      <label>Senha</label>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => redefinirSenha(form)}
                      >
                        Enviar redefinição de senha
                      </button>
                    </div>
                  )}

                  {exibirAgenda && (
                    <div className="full-width">
                      <label style={{ marginBottom: "12px" }}>
                        Dias de atendimento
                      </label>

                      <div className="info-grid-4">
                        {DIAS_ATENDIMENTO.map((dia) => (
                          <label
                            key={dia}
                            className="muted-box"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: 0,
                              cursor: "pointer",
                              textTransform: "capitalize",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.diasAtendimento.includes(dia)}
                              onChange={() => toggleDiaAtendimento(dia)}
                            />
                            <span>{dia}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {exibirAgenda && (
                    <div className="full-width">
                      <label>Gerar horários automaticamente</label>

                      <div className="form-grid-2" style={{ marginTop: "8px" }}>
                        <div>
                          <label>Hora início</label>
                          <input
                            className="input"
                            type="time"
                            name="horaInicio"
                            value={form.horaInicio}
                            onChange={handleChange}
                          />
                        </div>

                        <div>
                          <label>Hora fim</label>
                          <input
                            className="input"
                            type="time"
                            name="horaFim"
                            value={form.horaFim}
                            onChange={handleChange}
                          />
                        </div>

                        <div>
                          <label>Intervalo</label>
                          <select
                            className="select"
                            name="intervalo"
                            value={form.intervalo}
                            onChange={handleChange}
                          >
                            <option value={10}>10 minutos</option>
                            <option value={15}>15 minutos</option>
                            <option value={20}>20 minutos</option>
                            <option value={30}>30 minutos</option>
                            <option value={40}>40 minutos</option>
                            <option value={60}>60 minutos</option>
                          </select>
                        </div>

                        <div>
                          <label>Pausa início</label>
                          <input
                            className="input"
                            type="time"
                            name="pausaInicio"
                            value={form.pausaInicio}
                            onChange={handleChange}
                          />
                        </div>

                        <div>
                          <label>Pausa fim</label>
                          <input
                            className="input"
                            type="time"
                            name="pausaFim"
                            value={form.pausaFim}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="toolbar" style={{ marginTop: "10px" }}>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={gerarHorariosAutomaticos}
                        >
                          Gerar horários
                        </button>

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={limparHorariosGerados}
                        >
                          Limpar horários
                        </button>
                      </div>
                    </div>
                  )}

                  {exibirAgenda && (
                    <div className="full-width">
                      <label>Horários de atendimento</label>

                      <div className="toolbar" style={{ marginTop: "8px" }}>
                        <input
                          className="input"
                          type="time"
                          value={novoHorario}
                          onChange={(e) => setNovoHorario(e.target.value)}
                        />

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={adicionarHorario}
                        >
                          Adicionar horário
                        </button>
                      </div>

                      <div className="muted-box" style={{ marginTop: "10px" }}>
                        {form.horarios.length > 0 ? (
                          form.horarios.map((horario) => (
                            <span
                              key={horario}
                              className="badge"
                              style={{
                                marginRight: "8px",
                                marginBottom: "8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              {horario}
                              <button
                                type="button"
                                onClick={() => removerHorario(horario)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  color: "inherit",
                                  fontWeight: 700,
                                }}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span>Nenhum horário cadastrado.</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="full-width">
                    <label style={{ marginBottom: "12px" }}>Permissões de acesso</label>

                    <div className="info-grid-4">
                      {allModules.map((modulo) => (
                        <label
                          key={modulo.key}
                          className="muted-box"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: 0,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(modulo.key)}
                            onChange={() => togglePermissao(modulo.key)}
                          />
                          <span>{modulo.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="full-width">
                    <label
                      className="muted-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="ativo"
                        checked={form.ativo}
                        onChange={handleChange}
                      />
                      <span>Usuário ativo</span>
                    </label>
                  </div>
                </div>

                <div className="toolbar" style={{ marginTop: "18px" }}>
                  <button className="primary-btn" onClick={salvarUsuario}>
                    {editandoId ? "Salvar alterações" : "Criar usuário"}
                  </button>

                  <button className="secondary-btn" onClick={limparFormulario}>
                    Limpar
                  </button>
                </div>
              </div>

              <div className="page-card module-admin">
                <h3>Resumo das permissões</h3>

                <div className="muted-box" style={{ marginBottom: "12px" }}>
                  <strong>Usuário de login</strong>
                  <div>{form.username || "—"}</div>
                </div>

                <div className="muted-box" style={{ marginBottom: "12px" }}>
                  <strong>Perfil</strong>
                  <div>{form.role}</div>
                </div>

                {form.role === "medico" && (
                  <div className="muted-box" style={{ marginBottom: "12px" }}>
                    <strong>CRM</strong>
                    <div>{form.crm || "—"}</div>
                  </div>
                )}

                {(form.role === "medico" || form.role === "odonto") && (
                  <div className="muted-box" style={{ marginBottom: "12px" }}>
                    <strong>Especialidade</strong>
                    <div>{form.especialidade || "—"}</div>
                  </div>
                )}

                {form.role === "enfermagem" && (
                  <div className="muted-box" style={{ marginBottom: "12px" }}>
                    <strong>COREN</strong>
                    <div>{form.coren || "—"}</div>
                  </div>
                )}

                {exibirAgenda && (
                  <>
                    <div className="muted-box" style={{ marginBottom: "12px" }}>
                      <strong>Dias de atendimento</strong>
                      <div>{form.diasAtendimento.length}</div>
                    </div>

                    <div className="muted-box" style={{ marginBottom: "12px" }}>
                      <strong>Horários cadastrados</strong>
                      <div>{form.horarios.length}</div>
                    </div>
                  </>
                )}

                <div className="muted-box" style={{ marginBottom: "12px" }}>
                  <strong>Módulos liberados</strong>
                  <div>{form.permissions.length}</div>
                </div>

                <div className="muted-box">
                  <strong>Lista</strong>
                  <div style={{ marginTop: "10px" }}>
                    {form.permissions.length > 0 ? (
                      form.permissions.map((item) => (
                        <span
                          key={item}
                          className="badge"
                          style={{ marginRight: "8px", marginBottom: "8px" }}
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span>Nenhum módulo selecionado.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === "lista" && (
            <div>
              <div className="toolbar">
                <input
                  className="input search-input"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, usuário, e-mail, perfil, CRM ou COREN"
                />
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Registro</th>
                    <th>Status</th>
                    <th>Sala ativa</th>
                    <th>Agenda</th>
                    <th>Módulos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>{usuario.nome}</td>
                      <td>{usuario.username || usuario.usuario || usuario.login || "-"}</td>
                      <td>{usuario.email}</td>
                      <td>{usuario.role}</td>
                      <td>
                        {usuario.role === "medico"
                          ? usuario.crm || "-"
                          : usuario.role === "enfermagem"
                            ? usuario.coren || "-"
                            : "-"}
                      </td>
                      <td>{usuario.ativo === false ? "Inativo" : "Ativo"}</td>
                      <td>
                        {(() => {
                          const sala = consultorios.find((c) => c.medicoId === usuario.id);
                          return sala ? (
                            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>
                              {sala.nome}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                          );
                        })()}
                      </td>
                      <td>
                        {Array.isArray(usuario.diasAtendimento) &&
                        usuario.diasAtendimento.length > 0
                          ? `${usuario.diasAtendimento.length} dia(s) / ${
                              Array.isArray(usuario.horarios)
                                ? usuario.horarios.length
                                : 0
                            } horário(s)`
                          : "-"}
                      </td>
                      <td>{Array.isArray(usuario.permissions) ? usuario.permissions.length : 0}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            className="secondary-btn"
                            onClick={() => carregarParaEdicao(usuario)}
                          >
                            Editar
                          </button>

                          <button
                            className="secondary-btn"
                            onClick={() => toggleAtivo(usuario)}
                          >
                            {usuario.ativo === false ? "Ativar" : "Inativar"}
                          </button>

                          <button
                            className="secondary-btn"
                            onClick={() => redefinirSenha(usuario)}
                          >
                            Senha
                          </button>

                          {consultorios.some((c) => c.medicoId === usuario.id) && onLiberarConsultorio && (
                            <button
                              className="secondary-btn"
                              style={{ borderColor: "#f59e0b", color: "#92400e", background: "#fffbeb" }}
                              onClick={() => {
                                const sala = consultorios.find((c) => c.medicoId === usuario.id);
                                if (window.confirm(`Liberar ${sala?.nome || "consultório"} de ${usuario.nome}?`)) {
                                  onLiberarConsultorio(usuario.id);
                                }
                              }}
                            >
                              Liberar sala
                            </button>
                          )}

                          <button
                            className="danger-btn"
                            onClick={() => excluirUsuario(usuario)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {usuariosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="10">Nenhum usuário encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}