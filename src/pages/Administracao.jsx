import { useEffect, useMemo, useState } from "react";
import {
  allModules,
  rolePermissions,
} from "../config/permissions";

export default function Administracao({
  users = [],
  onCriarUsuario,
  onAtualizarUsuario,
}) {
  const [abaAtiva, setAbaAtiva] = useState("usuarios");
  const [busca, setBusca] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    username: "",
    senha: "",
    role: "recepcao",
    crm: "",
    coren: "",
    ativo: true,
    permissions: rolePermissions.recepcao,
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
        item.coren?.toLowerCase().includes(termo)
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
      role: usuario.role || "recepcao",
      crm: usuario.crm || "",
      coren: usuario.coren || "",
      ativo: usuario.ativo !== false,
      permissions:
        Array.isArray(usuario.permissions) && usuario.permissions.length > 0
          ? usuario.permissions
          : rolePermissions[usuario.role] || [],
    });
  }, [editandoId, users]);

  function limparFormulario() {
    setEditandoId(null);
    setForm({
      nome: "",
      email: "",
      username: "",
      senha: "",
      role: "recepcao",
      crm: "",
      coren: "",
      ativo: true,
      permissions: rolePermissions.recepcao,
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

  async function salvarUsuario() {
    if (!form.nome || !form.email || !form.username) {
      alert("Preencha nome, e-mail e usuário de login.");
      return;
    }

    if (!editandoId && !form.senha) {
      alert("Preencha a senha para criar o usuário.");
      return;
    }

    if (form.role === "medico" && !form.crm) {
      alert("Informe o CRM do médico.");
      return;
    }

    if (form.role === "enfermagem" && !form.coren) {
      alert("Informe o COREN da enfermagem.");
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
        ativo: form.ativo,
        permissions: form.permissions,
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

  const totalUsuarios = users.length;
  const ativos = users.filter((item) => item.ativo !== false).length;
  const inativos = users.filter((item) => item.ativo === false).length;
  const admins = users.filter((item) => item.role === "admin").length;

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
                      Defina usuário de login, perfil, registro profissional e permissões
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
                      <option value="telemedicina">Telemedicina</option>
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

                {form.role === "enfermagem" && (
                  <div className="muted-box" style={{ marginBottom: "12px" }}>
                    <strong>COREN</strong>
                    <div>{form.coren || "—"}</div>
                  </div>
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
                        </div>
                      </td>
                    </tr>
                  ))}

                  {usuariosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="8">Nenhum usuário encontrado.</td>
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