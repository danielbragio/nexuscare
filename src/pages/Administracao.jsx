import { useEffect, useMemo, useRef, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db, storage } from "../services/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { allModules, rolePermissions } from "../config/permissions";
import { ESPECIALIDADES_MEDICO, ESPECIALIDADES_ODONTO } from "../config/especialidades";

const DIAS_ATENDIMENTO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const POR_PAGINA = 10;

const labelStyle = {
  fontSize: "12px",
  color: "#475569",
  fontWeight: 600,
  display: "block",
  marginBottom: "5px",
};

// ─── Modal criar / editar usuário ──────────────────────────────────────────────

function ModalCriarEditar({
  usuario,
  onClose,
  onSalvar,
  consultorios = [],
  onToggleAtivo,
  onExcluir,
  onLiberarConsultorio,
}) {
  const editando = !!usuario;
  const [aba, setAba] = useState("dados");
  const [salvando, setSalvando] = useState(false);
  const [novoHorario, setNovoHorario] = useState("");

  const [form, setForm] = useState(() => ({
    nome: usuario?.nome || "",
    email: usuario?.email || "",
    username: usuario?.username || usuario?.usuario || usuario?.login || "",
    senha: "",
    confirmarSenha: "",
    role: usuario?.role || "recepcao",
    crm: usuario?.crm || "",
    coren: usuario?.coren || "",
    especialidade: usuario?.especialidade || "",
    ativo: usuario?.ativo !== false,
    permissions:
      Array.isArray(usuario?.permissions) && usuario.permissions.length > 0
        ? usuario.permissions
        : rolePermissions[usuario?.role || "recepcao"] || [],
    diasAtendimento: Array.isArray(usuario?.diasAtendimento) ? usuario.diasAtendimento : [],
    horarios: Array.isArray(usuario?.horarios) ? usuario.horarios : [],
    horaInicio: usuario?.horaInicio || "",
    horaFim: usuario?.horaFim || "",
    intervalo: usuario?.intervalo || 30,
    pausaInicio: usuario?.pausaInicio || "",
    pausaFim: usuario?.pausaFim || "",
  }));

  const exibirAgenda =
    form.role === "medico" || form.role === "enfermagem" || form.role === "odonto";

  const sala = consultorios.find((c) => c.medicoId === usuario?.id) || null;

  const abas = [
    { key: "dados", label: "Dados" },
    ...(exibirAgenda ? [{ key: "agenda", label: "Agenda" }] : []),
    { key: "permissoes", label: "Permissões" },
  ];

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function alterarRole(role) {
    const temAgenda = role === "medico" || role === "enfermagem" || role === "odonto";
    setForm((prev) => ({
      ...prev,
      role,
      permissions: rolePermissions[role] || [],
      especialidade: role === "medico" || role === "odonto" ? prev.especialidade : "",
      diasAtendimento: temAgenda ? prev.diasAtendimento : [],
      horarios: temAgenda ? prev.horarios : [],
      horaInicio: temAgenda ? prev.horaInicio : "",
      horaFim: temAgenda ? prev.horaFim : "",
      intervalo: temAgenda ? prev.intervalo : 30,
      pausaInicio: temAgenda ? prev.pausaInicio : "",
      pausaFim: temAgenda ? prev.pausaFim : "",
    }));
    if (!temAgenda && aba === "agenda") setAba("dados");
  }

  function togglePermissao(modulo) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(modulo)
        ? prev.permissions.filter((m) => m !== modulo)
        : [...prev.permissions, modulo],
    }));
  }

  function toggleDia(dia) {
    setForm((prev) => ({
      ...prev,
      diasAtendimento: prev.diasAtendimento.includes(dia)
        ? prev.diasAtendimento.filter((d) => d !== dia)
        : [...prev.diasAtendimento, dia],
    }));
  }

  function adicionarHorario() {
    if (!novoHorario) return;
    if (form.horarios.includes(novoHorario)) { alert("Horário já adicionado."); return; }
    setForm((prev) => ({ ...prev, horarios: [...prev.horarios, novoHorario].sort() }));
    setNovoHorario("");
  }

  function removerHorario(h) {
    setForm((prev) => ({ ...prev, horarios: prev.horarios.filter((x) => x !== h) }));
  }

  function gerarHorarios() {
    if (!form.horaInicio || !form.horaFim) { alert("Preencha hora início e hora fim."); return; }
    const [hI, mI] = form.horaInicio.split(":").map(Number);
    const [hF, mF] = form.horaFim.split(":").map(Number);
    const inicio = new Date(); inicio.setHours(hI, mI, 0, 0);
    const fim = new Date(); fim.setHours(hF, mF, 0, 0);
    if (inicio >= fim) { alert("Hora inicial deve ser menor que hora final."); return; }
    const intervalo = Number(form.intervalo || 30);
    const gerados = [];
    const atual = new Date(inicio);
    while (atual < fim) {
      const h = String(atual.getHours()).padStart(2, "0");
      const m = String(atual.getMinutes()).padStart(2, "0");
      const hor = `${h}:${m}`;
      const naPausa =
        form.pausaInicio && form.pausaFim && hor >= form.pausaInicio && hor < form.pausaFim;
      if (!naPausa) gerados.push(hor);
      atual.setMinutes(atual.getMinutes() + intervalo);
    }
    setForm((prev) => ({ ...prev, horarios: Array.from(new Set(gerados)).sort() }));
  }

  async function salvar() {
    if (!form.nome || !form.email || !form.username) {
      alert("Preencha nome, e-mail e usuário de login.");
      return;
    }
    if (!editando && !form.senha) { alert("Preencha a senha."); return; }
    if (!editando && form.senha !== form.confirmarSenha) {
      alert("As senhas não coincidem.");
      return;
    }
    if (form.role === "medico" && !form.crm) { alert("Informe o CRM do médico."); return; }
    if (form.role === "medico" && !form.especialidade) {
      alert("Informe a especialidade do médico.");
      return;
    }
    if (form.role === "enfermagem" && !form.coren) { alert("Informe o COREN."); return; }
    if (exibirAgenda && form.diasAtendimento.length === 0) {
      alert("Selecione pelo menos um dia de atendimento.");
      return;
    }
    if (exibirAgenda && form.horarios.length === 0) {
      alert("Adicione pelo menos um horário de atendimento.");
      return;
    }
    if (form.permissions.length === 0) {
      alert("Selecione pelo menos um módulo de acesso.");
      return;
    }

    try {
      setSalvando(true);
      await onSalvar({ ...form, editando, id: usuario?.id, profAgenda: exibirAgenda });
      onClose();
    } catch (error) {
      console.error(error);
      if (error.message === "USERNAME_DUPLICADO") { alert("Usuário de login já existe. Escolha outro."); return; }
      if (error.message === "EMAIL_DUPLICADO") { alert("E-mail já cadastrado."); return; }
      if (error.code === "auth/email-already-in-use") { alert("E-mail já existe no Firebase Auth."); return; }
      alert("Erro ao salvar. Verifique os dados e tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", zIndex: 1000 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "100%",
          maxWidth: "620px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0C2218 0%, #1F7A63 100%)",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>
              {editando ? "Editar usuário" : "Novo usuário"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px" }}>
              {editando
                ? `Editando: ${usuario?.nome}`
                : "Preencha os dados do novo colaborador"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          {abas.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setAba(tab.key)}
              style={{
                flex: 1,
                padding: "11px 16px",
                background: "none",
                border: "none",
                borderBottom: aba === tab.key ? "2px solid #1F7A63" : "2px solid transparent",
                color: aba === tab.key ? "#1F7A63" : "#64748b",
                fontWeight: aba === tab.key ? 700 : 400,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {/* ── Aba Dados ── */}
          {aba === "dados" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Nome completo *</label>
                <input
                  className="input"
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  placeholder="Nome do colaborador"
                />
              </div>

              <div>
                <label style={labelStyle}>Usuário de login *</label>
                <input
                  className="input"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Ex.: dr.joao"
                />
              </div>

              <div>
                <label style={labelStyle}>E-mail *</label>
                <input
                  className="input"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@clinica.com"
                />
              </div>

              {!editando && (
                <>
                  <div>
                    <label style={labelStyle}>Senha *</label>
                    <input
                      className="input"
                      name="senha"
                      type="password"
                      value={form.senha}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirmar senha *</label>
                    <input
                      className="input"
                      name="confirmarSenha"
                      type="password"
                      value={form.confirmarSenha}
                      onChange={handleChange}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Perfil base *</label>
                <select
                  className="select"
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

              <div>
                <label style={labelStyle}>Status</label>
                <select
                  className="select"
                  value={form.ativo ? "true" : "false"}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ativo: e.target.value === "true" }))
                  }
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              {form.role === "medico" && (
                <>
                  <div>
                    <label style={labelStyle}>CRM *</label>
                    <input
                      className="input"
                      name="crm"
                      value={form.crm}
                      onChange={handleChange}
                      placeholder="Ex.: CRM-ES 00000"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Especialidade *</label>
                    <select
                      className="select"
                      name="especialidade"
                      value={form.especialidade}
                      onChange={handleChange}
                    >
                      <option value="">Selecione a especialidade</option>
                      {ESPECIALIDADES_MEDICO.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {form.role === "odonto" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Especialidade odontológica</label>
                  <select
                    className="select"
                    name="especialidade"
                    value={form.especialidade}
                    onChange={handleChange}
                  >
                    <option value="">Selecione a especialidade</option>
                    {ESPECIALIDADES_ODONTO.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.role === "enfermagem" && (
                <div>
                  <label style={labelStyle}>COREN *</label>
                  <input
                    className="input"
                    name="coren"
                    value={form.coren}
                    onChange={handleChange}
                    placeholder="Ex.: COREN-ES 000000"
                  />
                </div>
              )}

              {editando && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    Para alterar a senha, use o botão "Resetar senha" no perfil do usuário —
                    será enviado um e-mail de redefinição.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Aba Agenda ── */}
          {aba === "agenda" && exibirAgenda && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: "10px" }}>
                  Dias de atendimento
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {DIAS_ATENDIMENTO.map((dia) => (
                    <label
                      key={dia}
                      className="muted-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        marginBottom: 0,
                        fontSize: "13px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.diasAtendimento.includes(dia)}
                        onChange={() => toggleDia(dia)}
                      />
                      <span>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Gerar horários automaticamente</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "10px",
                    marginTop: "8px",
                  }}
                >
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Hora início</label>
                    <input
                      className="input"
                      type="time"
                      name="horaInicio"
                      value={form.horaInicio}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Hora fim</label>
                    <input
                      className="input"
                      type="time"
                      name="horaFim"
                      value={form.horaFim}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Intervalo</label>
                    <select
                      className="select"
                      name="intervalo"
                      value={form.intervalo}
                      onChange={handleChange}
                    >
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min</option>
                      <option value={40}>40 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Pausa início</label>
                    <input
                      className="input"
                      type="time"
                      name="pausaInicio"
                      value={form.pausaInicio}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Pausa fim</label>
                    <input
                      className="input"
                      type="time"
                      name="pausaFim"
                      value={form.pausaFim}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="button" className="secondary-btn" onClick={gerarHorarios}>
                    Gerar horários
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setForm((prev) => ({ ...prev, horarios: [] }))}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Adicionar horário individual</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <input
                    className="input"
                    type="time"
                    value={novoHorario}
                    onChange={(e) => setNovoHorario(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="secondary-btn" onClick={adicionarHorario}>
                    Adicionar
                  </button>
                </div>
                <div className="muted-box" style={{ marginTop: "10px", minHeight: "44px" }}>
                  {form.horarios.length > 0 ? (
                    form.horarios.map((h) => (
                      <span
                        key={h}
                        className="badge"
                        style={{
                          marginRight: "6px",
                          marginBottom: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {h}
                        <button
                          type="button"
                          onClick={() => removerHorario(h)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "inherit",
                            fontWeight: 700,
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Nenhum horário cadastrado.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Aba Permissões ── */}
          {aba === "permissoes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f0fdf4",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                }}
              >
                Os módulos são sugeridos automaticamente pelo perfil escolhido, mas podem ser
                personalizados livremente.
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: "10px" }}>Módulos de acesso</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {allModules.map((modulo) => (
                    <label
                      key={modulo.key}
                      className="muted-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        marginBottom: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(modulo.key)}
                        onChange={() => togglePermissao(modulo.key)}
                      />
                      <span style={{ fontSize: "13px" }}>{modulo.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  Módulos selecionados:{" "}
                  <strong style={{ color: "#1e293b" }}>{form.permissions.length}</strong>
                </div>
                <div>
                  {form.permissions.map((p) => (
                    <span
                      key={p}
                      className="badge"
                      style={{ marginRight: "6px", marginBottom: "6px" }}
                    >
                      {p}
                    </span>
                  ))}
                  {form.permissions.length === 0 && (
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Nenhum módulo selecionado.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ações administrativas – só ao editar */}
        {editando && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "2px solid #f1f5f9",
              background: "#fafafa",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#94a3b8",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                marginBottom: "10px",
              }}
            >
              Ações administrativas
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {onToggleAtivo && (
                <button
                  className="secondary-btn"
                  onClick={() => { onToggleAtivo(usuario); onClose(); }}
                >
                  {usuario?.ativo !== false ? "Inativar usuário" : "Ativar usuário"}
                </button>
              )}

              {sala && onLiberarConsultorio && (
                <button
                  className="secondary-btn"
                  style={{ borderColor: "#0ea5e9", color: "#0369a1", background: "#f0f9ff" }}
                  onClick={() => {
                    if (window.confirm(`Liberar ${sala.nome} de ${usuario?.nome}?`)) {
                      onLiberarConsultorio(usuario.id);
                    }
                  }}
                >
                  Liberar {sala.nome}
                </button>
              )}

              {onExcluir && (
                <button
                  className="danger-btn"
                  onClick={() => {
                    if (window.confirm(`Excluir o usuário ${usuario?.nome || usuario?.email}?`)) {
                      onExcluir(usuario);
                      onClose();
                    }
                  }}
                >
                  Excluir usuário
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            {abas.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setAba(tab.key)}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  background: aba === tab.key ? "#1F7A63" : "#cbd5e1",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="secondary-btn" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-btn" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar usuário"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Modal perfil do usuário (visão admin) ─────────────────────────────────────

function ModalPerfilUsuario({ usuario, onClose, onEditar, onResetarSenha }) {
  const [uploadando, setUploadando] = useState(false);
  const [fotoURL, setFotoURL] = useState(usuario?.photoURL || "");
  const fileRef = useRef(null);
  const inicial = (usuario?.nome || usuario?.email || "U").charAt(0).toUpperCase();

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Selecione um arquivo de imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("A imagem deve ter menos de 5 MB."); return; }
    try {
      setUploadando(true);
      const storageRef = ref(storage, `profilePhotos/${usuario.id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", usuario.id), {
        photoURL: url,
        updatedAt: serverTimestamp(),
      });
      setFotoURL(url);
    } catch (err) {
      console.error("Erro ao salvar foto:", err);
      alert("Não foi possível salvar a foto. Verifique as permissões do Storage.");
    } finally {
      setUploadando(false);
    }
  }

  function formatarData(ts) {
    if (!ts) return "—";
    let d;
    if (ts?.toDate) d = ts.toDate();
    else if (typeof ts === "string") d = new Date(ts);
    else return "—";
    return d.toLocaleDateString("pt-BR");
  }

  const infoRows = [
    { label: "Nome", value: usuario?.nome || "—" },
    { label: "E-mail", value: usuario?.email || "—" },
    { label: "Usuário de login", value: usuario?.username || usuario?.usuario || usuario?.login || "—" },
    { label: "Perfil", value: usuario?.role || "—" },
    { label: "Especialidade", value: usuario?.especialidade || null },
    { label: "CRM", value: usuario?.crm || null },
    { label: "COREN", value: usuario?.coren || null },
    { label: "CRO", value: usuario?.cro || null },
    {
      label: "Status",
      value: usuario?.ativo !== false ? "Ativo" : "Inativo",
      destaque: usuario?.ativo !== false ? "#16a34a" : "#dc2626",
    },
    { label: "Cadastrado em", value: formatarData(usuario?.createdAt) },
  ].filter((r) => r.value !== null && r.value !== undefined && r.value !== "");

  const agenda =
    Array.isArray(usuario?.diasAtendimento) && usuario.diasAtendimento.length > 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", zIndex: 1000 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "100%",
          maxWidth: "460px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0C2218 0%, #1F7A63 100%)",
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            {fotoURL ? (
              <img
                src={fotoURL}
                alt="Foto"
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid rgba(255,255,255,0.3)",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.18)",
                  border: "3px solid rgba(255,255,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {inicial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadando}
              title={uploadando ? "Enviando..." : "Alterar foto"}
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#1F7A63",
                border: "2px solid #fff",
                cursor: uploadando ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                color: "#fff",
                padding: 0,
              }}
            >
              {uploadando ? "…" : "✏"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFoto}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "16px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {usuario?.nome}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: "12px",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {usuario?.email}
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: "6px",
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.9)",
                padding: "2px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {usuario?.role || "Usuário"}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px",
              alignSelf: "flex-start",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {infoRows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  gap: "12px",
                  border: "1px solid #f0f4f8",
                }}
              >
                <span
                  style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, flexShrink: 0 }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: row.destaque || "#1e293b",
                    fontWeight: 600,
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}

            {agenda && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #f0f4f8",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Agenda</div>
                <div>
                  {usuario.diasAtendimento.join(", ")} —{" "}
                  {Array.isArray(usuario.horarios) ? usuario.horarios.length : 0} horário(s)
                </div>
              </div>
            )}

            <div
              style={{
                padding: "10px 12px",
                background: "#f0fdf4",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#15803d",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                border: "1px solid #bbf7d0",
              }}
            >
              <span>📷</span>
              <span>
                Clique no ícone de lápis para alterar a foto do colaborador.
                Formatos aceitos: JPG, PNG, WEBP (máx. 5 MB).
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "#f8fafc",
            gap: "8px",
          }}
        >
          <button
            className="secondary-btn"
            onClick={onResetarSenha}
            title="Enviar e-mail de redefinição de senha"
          >
            Resetar senha
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="secondary-btn" onClick={onClose}>
              Fechar
            </button>
            <button className="primary-btn" onClick={onEditar}>
              Editar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function Administracao({
  users = [],
  consultorios = [],
  onCriarUsuario,
  onAtualizarUsuario,
  onExcluirUsuario,
  onLiberarConsultorio,
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalCriar, setModalCriar] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [usuarioPerfil, setUsuarioPerfil] = useState(null);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase();
    return users.filter(
      (u) =>
        u.nome?.toLowerCase().includes(termo) ||
        u.email?.toLowerCase().includes(termo) ||
        u.username?.toLowerCase().includes(termo) ||
        u.usuario?.toLowerCase().includes(termo) ||
        u.login?.toLowerCase().includes(termo) ||
        u.role?.toLowerCase().includes(termo) ||
        u.crm?.toLowerCase().includes(termo) ||
        u.coren?.toLowerCase().includes(termo) ||
        u.especialidade?.toLowerCase().includes(termo)
    );
  }, [users, busca]);

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
  const usuariosPagina = usuariosFiltrados.slice(
    (pagina - 1) * POR_PAGINA,
    pagina * POR_PAGINA
  );

  useEffect(() => { setPagina(1); }, [busca]);

  async function handleSalvar(formData) {
    const { editando, id, profAgenda, senha, confirmarSenha, ...payload } = formData;

    const cleanPayload = {
      nome: payload.nome,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      crm: payload.role === "medico" ? payload.crm : "",
      coren: payload.role === "enfermagem" ? payload.coren : "",
      especialidade:
        payload.role === "medico" || payload.role === "odonto" ? payload.especialidade : "",
      ativo: payload.ativo,
      permissions: payload.permissions,
      diasAtendimento: profAgenda ? payload.diasAtendimento : [],
      horarios: profAgenda ? payload.horarios : [],
      horaInicio: profAgenda ? payload.horaInicio : "",
      horaFim: profAgenda ? payload.horaFim : "",
      intervalo: profAgenda ? Number(payload.intervalo || 30) : 30,
      pausaInicio: profAgenda ? payload.pausaInicio : "",
      pausaFim: profAgenda ? payload.pausaFim : "",
    };

    if (editando) {
      await onAtualizarUsuario(id, cleanPayload);
    } else {
      await onCriarUsuario({ ...cleanPayload, senha });
    }
  }

  function abrirEdicao(usuario) {
    setUsuarioPerfil(null);
    setUsuarioEditando(usuario);
  }

  function toggleAtivo(usuario) {
    onAtualizarUsuario(usuario.id, { ativo: !usuario.ativo });
  }

  async function resetarSenha(usuario) {
    if (!usuario?.email) { alert("Este usuário não possui e-mail."); return; }
    try {
      await sendPasswordResetEmail(auth, usuario.email);
      alert("E-mail de redefinição enviado com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Não foi possível enviar o e-mail.");
    }
  }

  async function excluirUsuario(usuario) {
    if (!onExcluirUsuario) return;
    if (!window.confirm(`Excluir o usuário ${usuario.nome || usuario.email}?`)) return;
    try {
      await onExcluirUsuario(usuario);
    } catch (err) {
      console.error(err);
      alert("Não foi possível excluir o usuário.");
    }
  }

  const totalUsuarios = users.length;
  const ativos = users.filter((u) => u.ativo !== false).length;
  const inativos = users.filter((u) => u.ativo === false).length;
  const admins = users.filter((u) => u.role === "admin").length;

  return (
    <div>
      <div className="page-header">
        <h1>Administração</h1>
        <p className="page-subtitle">
          Gerencie usuários, defina perfis de acesso e controle os módulos disponíveis para
          cada colaborador.
        </p>
      </div>

      {/* Cards de estatísticas */}
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

      {/* Tabela de usuários */}
      <div className="page-card module-admin" style={{ marginTop: "20px" }}>
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <input
            className="input search-input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, usuário, e-mail, perfil..."
            style={{ flex: 1 }}
          />
          <button
            className="primary-btn"
            onClick={() => { setUsuarioEditando(null); setModalCriar(true); }}
          >
            + Novo Usuário
          </button>
        </div>

        {/* Tabela com scroll interno */}
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Login</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Registro</th>
                <th>Status</th>
                <th>Sala ativa</th>
                <th>Módulos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosPagina.map((usuario) => {
                const sala = consultorios.find((c) => c.medicoId === usuario.id);
                return (
                  <tr key={usuario.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#e2e8f0",
                            overflow: "hidden",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#475569",
                          }}
                        >
                          {usuario.photoURL ? (
                            <img
                              src={usuario.photoURL}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            (usuario.nome || usuario.email || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        <button
                          onClick={() => setUsuarioPerfil(usuario)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#1e293b",
                            fontWeight: 600,
                            fontSize: "13px",
                            padding: 0,
                            textAlign: "left",
                            textDecoration: "underline",
                            textDecorationColor: "transparent",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.textDecorationColor = "#1F7A63")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.textDecorationColor = "transparent")
                          }
                        >
                          {usuario.nome}
                        </button>
                      </div>
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {usuario.username || usuario.usuario || usuario.login || "-"}
                    </td>
                    <td style={{ fontSize: "13px" }}>{usuario.email}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ textTransform: "capitalize" }}
                      >
                        {usuario.role}
                      </span>
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {usuario.role === "medico"
                        ? usuario.crm || "-"
                        : usuario.role === "enfermagem"
                        ? usuario.coren || "-"
                        : "-"}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "20px",
                          background: usuario.ativo !== false ? "#f0fdf4" : "#fef2f2",
                          color: usuario.ativo !== false ? "#16a34a" : "#dc2626",
                          border: `1px solid ${usuario.ativo !== false ? "#bbf7d0" : "#fecaca"}`,
                        }}
                      >
                        {usuario.ativo !== false ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      {sala ? (
                        <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>
                          {sala.nome}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {Array.isArray(usuario.permissions) ? usuario.permissions.length : 0}
                    </td>
                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() => abrirEdicao(usuario)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {usuariosPagina.length === 0 && (
                <tr>
                  <td
                    colSpan="9"
                    style={{ textAlign: "center", color: "#94a3b8", padding: "28px" }}
                  >
                    {busca
                      ? "Nenhum usuário encontrado para esta busca."
                      : "Nenhum usuário cadastrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <button
              className="secondary-btn"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              ‹ Anterior
            </button>
            <span style={{ fontSize: "13px", color: "#64748b" }}>
              Página {pagina} de {totalPaginas} —{" "}
              <strong>{usuariosFiltrados.length}</strong> usuário(s)
            </span>
            <button
              className="secondary-btn"
              disabled={pagina === totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima ›
            </button>
          </div>
        )}
      </div>

      {/* Modal: criar usuário */}
      {modalCriar && !usuarioEditando && (
        <ModalCriarEditar
          usuario={null}
          onClose={() => setModalCriar(false)}
          onSalvar={handleSalvar}
        />
      )}

      {/* Modal: editar usuário */}
      {usuarioEditando && (
        <ModalCriarEditar
          usuario={usuarioEditando}
          onClose={() => setUsuarioEditando(null)}
          onSalvar={handleSalvar}
          consultorios={consultorios}
          onToggleAtivo={toggleAtivo}
          onExcluir={excluirUsuario}
          onLiberarConsultorio={onLiberarConsultorio}
        />
      )}

      {/* Modal: perfil do usuário */}
      {usuarioPerfil && (
        <ModalPerfilUsuario
          usuario={usuarioPerfil}
          onClose={() => setUsuarioPerfil(null)}
          onEditar={() => abrirEdicao(usuarioPerfil)}
          onResetarSenha={() => resetarSenha(usuarioPerfil)}
        />
      )}
    </div>
  );
}
