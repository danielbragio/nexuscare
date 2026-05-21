import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, UserCheck, UserX, ShieldCheck, X, Check, ExternalLink, AlertCircle } from "lucide-react";
import { PERMISSION_GROUPS, getDefaultPermissions } from "../config/permissions";
import { ESPECIALIDADES_MEDICO, ESPECIALIDADES_ODONTO } from "../config/especialidades";
import { useToast } from "../context/ToastContext";
import { useCadastros } from "../context/CadastrosContext";
import { parseConselho, descreverErroConselho, linkConselho } from "../utils/conselhos";
import api from "../services/api";

const POR_PAGINA = 10;
const ACCENT      = "#4f46e5"; // indigo-600 — paleta unificada
const ACCENT_SOFT = "#eef2ff";

const DIAS_ATENDIMENTO = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

const labelStyle = {
  fontSize: "12px", color: "#475569", fontWeight: 600,
  display: "block", marginBottom: "5px",
};

// ─── Campo CRM/CRO/COREN com validação inline ─────────────────────────────────
// Mostra mensagem de erro abaixo do input + botão para abrir o portal do
// conselho com a busca pré-preenchida (verificação manual pelo admin).
function CampoConselho({ tipo, value, onChange, label }) {
  const valido = value && parseConselho(value)?.tipo === tipo;
  const erro = value ? descreverErroConselho(value, tipo) : null;
  const link = valido ? linkConselho(value) : null;

  return (
    <div>
      <label style={labelStyle}>{label} *</label>
      <div style={{ position: "relative" }}>
        <input
          className="input"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Ex.: ${tipo}-SP 12345`}
          style={{
            paddingRight: 36,
            borderColor: !value ? undefined : (valido ? "#22c55e" : "#ef4444"),
          }}
        />
        {value && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            color: valido ? "#22c55e" : "#ef4444",
            display: "inline-flex", alignItems: "center",
          }}>
            {valido ? <Check size={16} /> : <AlertCircle size={16} />}
          </span>
        )}
      </div>
      {erro && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11} /> {erro}
        </div>
      )}
      {valido && link && (
        <a
          href={link} target="_blank" rel="noopener noreferrer"
          style={{
            marginTop: 6, fontSize: 11, color: ACCENT, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 4,
            textDecoration: "none",
          }}
          title="Abre o portal oficial do conselho em nova aba para verificação manual"
        >
          <ExternalLink size={11} />Verificar no conselho oficial
        </a>
      )}
    </div>
  );
}

// ─── Modal criar / editar usuário ─────────────────────────────────────────────
function ModalCriarEditar({
  usuario, onClose, onSalvar, consultorios = [],
  onToggleAtivo, onExcluir, onLiberarConsultorio,
}) {
  const editando = !!usuario;
  const toast = useToast();
  const { especialidadesExtras } = useCadastros();
  const todasEspecialidadesMedico = [
    ...ESPECIALIDADES_MEDICO,
    ...(especialidadesExtras?.medico || []).map((e) => e.nome || e),
  ];
  const todasEspecialidadesOdonto = [
    ...ESPECIALIDADES_ODONTO,
    ...(especialidadesExtras?.odonto || []).map((e) => e.nome || e),
  ];
  const [aba, setAba] = useState("dados");
  const [salvando, setSalvando] = useState(false);
  const [novoHorario, setNovoHorario] = useState("");

  const [form, setForm] = useState(() => ({
    nome:           usuario?.nome || "",
    email:          usuario?.email || "",
    username:       usuario?.username || usuario?.usuario || usuario?.login || "",
    senha:          "",
    confirmarSenha: "",
    role:           usuario?.role || "recepcao",
    cargo:          usuario?.cargo || "",
    crm:            usuario?.crm || "",
    cro:            usuario?.cro || "",
    coren:          usuario?.coren || "",
    especialidade:  usuario?.especialidade || "",
    ativo:          usuario?.ativo !== false,
    atendePacientes: Boolean(usuario?.atende_pacientes),
    permissions:
      Array.isArray(usuario?.permissions) && usuario.permissions.length > 0
        ? usuario.permissions
        : getDefaultPermissions(usuario?.role || "recepcao"),
    diasAtendimento: Array.isArray(usuario?.diasAtendimento) ? usuario.diasAtendimento : [],
    horarios:        Array.isArray(usuario?.horarios) ? usuario.horarios : [],
    horaInicio:      usuario?.horaInicio || "",
    horaFim:         usuario?.horaFim || "",
    intervalo:       usuario?.intervalo || 30,
    pausaInicio:     usuario?.pausaInicio || "",
    pausaFim:        usuario?.pausaFim || "",
  }));

  const exibirAgenda = form.role === "medico" || form.role === "enfermagem" || form.role === "odonto";
  const sala = consultorios.find((c) => c.medicoId === usuario?.id) || null;

  const abas = [
    { key: "dados",      label: "Dados" },
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
      ...prev, role,
      permissions:     getDefaultPermissions(role),
      atendePacientes: temAgenda,
      especialidade:   role === "medico" || role === "odonto" ? prev.especialidade : "",
      diasAtendimento: temAgenda ? prev.diasAtendimento : [],
      horarios:        temAgenda ? prev.horarios : [],
      horaInicio:      temAgenda ? prev.horaInicio : "",
      horaFim:         temAgenda ? prev.horaFim : "",
      intervalo:       temAgenda ? prev.intervalo : 30,
      pausaInicio:     temAgenda ? prev.pausaInicio : "",
      pausaFim:        temAgenda ? prev.pausaFim : "",
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
    if (form.horarios.includes(novoHorario)) { toast.warn("Horário já adicionado."); return; }
    setForm((prev) => ({ ...prev, horarios: [...prev.horarios, novoHorario].sort() }));
    setNovoHorario("");
  }

  function removerHorario(h) {
    setForm((prev) => ({ ...prev, horarios: prev.horarios.filter((x) => x !== h) }));
  }

  function gerarHorarios() {
    if (!form.horaInicio || !form.horaFim) { toast.warn("Preencha hora início e hora fim."); return; }
    const [hI, mI] = form.horaInicio.split(":").map(Number);
    const [hF, mF] = form.horaFim.split(":").map(Number);
    const inicio = new Date(); inicio.setHours(hI, mI, 0, 0);
    const fim    = new Date(); fim.setHours(hF, mF, 0, 0);
    if (inicio >= fim) { toast.warn("Hora inicial deve ser menor que hora final."); return; }
    const intervalo = Number(form.intervalo || 30);
    const gerados = [];
    const atual = new Date(inicio);
    while (atual < fim) {
      const h = String(atual.getHours()).padStart(2, "0");
      const m = String(atual.getMinutes()).padStart(2, "0");
      const hor = `${h}:${m}`;
      const naPausa = form.pausaInicio && form.pausaFim && hor >= form.pausaInicio && hor < form.pausaFim;
      if (!naPausa) gerados.push(hor);
      atual.setMinutes(atual.getMinutes() + intervalo);
    }
    setForm((prev) => ({ ...prev, horarios: Array.from(new Set(gerados)).sort() }));
  }

  async function salvar() {
    if (!form.nome || !form.email || !form.username) {
      toast.warn("Preencha nome, e-mail e usuário de login."); return;
    }
    if (!editando && !form.senha) { toast.warn("Preencha a senha."); return; }
    if (!editando && form.senha !== form.confirmarSenha) { toast.warn("As senhas não coincidem."); return; }
    // Validação rigorosa de conselhos (formato + UF + plausibilidade).
    // Validação online dos conselhos não é viável: CFM/CFO/COFEN não têm API
    // pública. O admin pode clicar em "Verificar no conselho" no campo
    // (abre o portal oficial em nova aba) para confirmar manualmente.
    if (form.role === "medico") {
      const erro = descreverErroConselho(form.crm, "CRM");
      if (erro) { toast.warn(`CRM: ${erro}`); return; }
    }
    if (form.role === "medico" && !form.especialidade) { toast.warn("Informe a especialidade do médico."); return; }
    if (form.role === "odonto") {
      const erro = descreverErroConselho(form.cro, "CRO");
      if (erro) { toast.warn(`CRO: ${erro}`); return; }
    }
    if (form.role === "enfermagem") {
      const erro = descreverErroConselho(form.coren, "COREN");
      if (erro) { toast.warn(`COREN: ${erro}`); return; }
    }
    if (exibirAgenda && form.diasAtendimento.length === 0) { toast.warn("Selecione pelo menos um dia de atendimento."); return; }
    if (exibirAgenda && form.horarios.length === 0) { toast.warn("Adicione pelo menos um horário de atendimento."); return; }
    if (form.permissions.length === 0) { toast.warn("Selecione pelo menos um módulo de acesso."); return; }

    try {
      setSalvando(true);
      await onSalvar({ ...form, editando, id: usuario?.id, profAgenda: exibirAgenda });
      onClose();
    } catch (error) {
      const msg = error?.data?.message || error.message || "";
      if (msg.includes("LOGIN_DUPLICADO") || msg.includes("USERNAME_DUPLICADO")) {
        toast.warn("Usuário de login já existe. Escolha outro."); return;
      }
      if (msg.includes("E-mail já cadastrado") || msg.includes("EMAIL_DUPLICADO")) {
        toast.warn("E-mail já cadastrado."); return;
      }
      toast.error(`Erro ao salvar: ${msg || "Verifique os dados e tente novamente."}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1001, width: "100%", maxWidth: "640px",
        background: "#fff", borderRadius: "20px",
        boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
        overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh",
      }}>
        {/* Header clean — sem gradient, paleta indigo */}
        <div style={{
          padding: "20px 24px", display: "flex",
          alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          borderBottom: "1px solid #f1f5f9",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: ACCENT_SOFT,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: ACCENT,
            }}>
              {editando ? <UserCheck size={20} /> : <Users size={20} />}
            </div>
            <div>
              <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 16, letterSpacing: "-.01em" }}>
                {editando ? "Editar usuário" : "Novo usuário"}
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {editando ? `Editando: ${usuario?.nome}` : "Cadastre um novo colaborador"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 6, display: "flex" }}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs underline */}
        <div style={{ display: "flex", gap: 24, padding: "0 24px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          {abas.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setAba(tab.key)}
              style={{
                padding: "12px 4px", background: "none", border: "none",
                borderBottom: aba === tab.key ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: aba === tab.key ? ACCENT : "#64748b",
                fontWeight: aba === tab.key ? 700 : 500, fontSize: 13, cursor: "pointer",
                marginBottom: -1,
                transition: "all .15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {/* Aba Dados */}
          {aba === "dados" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Nome completo *</label>
                <input className="input" name="nome" value={form.nome} onChange={handleChange} placeholder="Nome do colaborador" />
              </div>

              <div>
                <label style={labelStyle}>Usuário de login *</label>
                <input className="input" name="username" value={form.username} onChange={handleChange} placeholder="Ex.: dr.joao" />
              </div>

              <div>
                <label style={labelStyle}>E-mail *</label>
                <input className="input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@clinica.com" />
              </div>

              {!editando && (
                <>
                  <div>
                    <label style={labelStyle}>Senha *</label>
                    <input className="input" name="senha" type="password" value={form.senha} onChange={handleChange} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirmar senha *</label>
                    <input className="input" name="confirmarSenha" type="password" value={form.confirmarSenha} onChange={handleChange} placeholder="Repita a senha" autoComplete="new-password" />
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Perfil base *</label>
                <select className="select" value={form.role} onChange={(e) => alterarRole(e.target.value)}>
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
                <select className="select" value={form.ativo ? "true" : "false"} onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.value === "true" }))}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Cargo</label>
                <input className="input" name="cargo" value={form.cargo} onChange={handleChange} placeholder="Ex.: Médico Clínico, Enfermeira" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "22px" }}>
                <input type="checkbox" id="atendePacientes" checked={form.atendePacientes}
                  onChange={(e) => setForm((prev) => ({ ...prev, atendePacientes: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                <label htmlFor="atendePacientes" style={{ ...labelStyle, marginBottom: 0, cursor: "pointer" }}>
                  Atende pacientes (aparece na fila clínica)
                </label>
              </div>

              {form.role === "medico" && (
                <>
                  <CampoConselho
                    tipo="CRM"
                    label="CRM"
                    value={form.crm}
                    onChange={(v) => setForm((prev) => ({ ...prev, crm: v }))}
                  />
                  <div>
                    <label style={labelStyle}>Especialidade *</label>
                    <select className="select" name="especialidade" value={form.especialidade} onChange={handleChange}>
                      <option value="">Selecione a especialidade</option>
                      {todasEspecialidadesMedico.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </>
              )}

              {form.role === "odonto" && (
                <>
                  <CampoConselho
                    tipo="CRO"
                    label="CRO"
                    value={form.cro}
                    onChange={(v) => setForm((prev) => ({ ...prev, cro: v }))}
                  />
                  <div>
                    <label style={labelStyle}>Especialidade odontológica</label>
                    <select className="select" name="especialidade" value={form.especialidade} onChange={handleChange}>
                      <option value="">Selecione a especialidade</option>
                      {todasEspecialidadesOdonto.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </>
              )}

              {form.role === "enfermagem" && (
                <CampoConselho
                  tipo="COREN"
                  label="COREN"
                  value={form.coren}
                  onChange={(v) => setForm((prev) => ({ ...prev, coren: v }))}
                />
              )}

              {editando && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px", color: "#64748b", border: "1px solid #e2e8f0" }}>
                    Para alterar a senha, clique em "Redefinir senha" no rodapé desta janela.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aba Agenda */}
          {aba === "agenda" && exibirAgenda && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: "10px" }}>Dias de atendimento</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))", gap: "8px" }}>
                  {DIAS_ATENDIMENTO.map((dia) => (
                    <label key={dia} className="muted-box" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", textTransform: "capitalize", marginBottom: 0, fontSize: "13px" }}>
                      <input type="checkbox" checked={form.diasAtendimento.includes(dia)} onChange={() => toggleDia(dia)} />
                      <span>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Gerar horários automaticamente</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "8px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Hora início</label>
                    <input className="input" type="time" name="horaInicio" value={form.horaInicio} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Hora fim</label>
                    <input className="input" type="time" name="horaFim" value={form.horaFim} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Intervalo</label>
                    <select className="select" name="intervalo" value={form.intervalo} onChange={handleChange}>
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
                    <input className="input" type="time" name="pausaInicio" value={form.pausaInicio} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748b" }}>Pausa fim</label>
                    <input className="input" type="time" name="pausaFim" value={form.pausaFim} onChange={handleChange} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="button" className="secondary-btn" onClick={gerarHorarios}>Gerar horários</button>
                  <button type="button" className="secondary-btn" onClick={() => setForm((prev) => ({ ...prev, horarios: [] }))}>Limpar</button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Adicionar horário individual</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <input className="input" type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className="secondary-btn" onClick={adicionarHorario}>Adicionar</button>
                </div>
                <div className="muted-box" style={{ marginTop: "10px", minHeight: "44px" }}>
                  {form.horarios.length > 0 ? (
                    form.horarios.map((h) => (
                      <span key={h} className="badge" style={{ marginRight: "6px", marginBottom: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        {h}
                        <button type="button" onClick={() => removerHorario(h)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", fontWeight: 700, padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>Nenhum horário cadastrado.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Aba Permissões */}
          {aba === "permissoes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "10px 12px", background: "#f0fdf4", borderRadius: "8px", fontSize: "12px", color: "#15803d", border: "1px solid #bbf7d0" }}>
                As permissões são sugeridas pelo perfil base, mas podem ser personalizadas livremente.
              </div>

              {PERMISSION_GROUPS.map((grupo) => (
                <div key={grupo.grupo}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "8px" }}>
                    {grupo.grupo}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "6px" }}>
                    {grupo.permissoes.map((perm) => (
                      <label key={perm.key} className="muted-box" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: 0, padding: "7px 10px" }}>
                        <input type="checkbox" checked={form.permissions.includes(perm.key)} onChange={() => togglePermissao(perm.key)} />
                        <span style={{ fontSize: "13px" }}>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" }}>
                <strong style={{ color: "#1e293b" }}>{form.permissions.length}</strong> permissão(ões) selecionada(s)
              </div>
            </div>
          )}
        </div>

        {/* Ações administrativas — só ao editar */}
        {editando && (
          <div style={{ padding: "14px 24px", borderTop: "2px solid #f1f5f9", background: "#fafafa", flexShrink: 0 }}>
            <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
              Ações administrativas
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {onToggleAtivo && (
                <button className="secondary-btn" onClick={() => { onToggleAtivo(usuario); onClose(); }}>
                  {usuario?.ativo !== false ? "Inativar usuário" : "Ativar usuário"}
                </button>
              )}
              {sala && onLiberarConsultorio && (
                <button className="secondary-btn" style={{ borderColor: "#0ea5e9", color: "#0369a1", background: "#f0f9ff" }}
                  onClick={async () => {
                    if (await toast.confirm(`Liberar ${sala.nome} de ${usuario?.nome}?`)) {
                      onLiberarConsultorio(usuario.id);
                    }
                  }}>
                  Liberar {sala.nome}
                </button>
              )}
              {onExcluir && (
                <button className="danger-btn"
                  onClick={async () => {
                    if (await toast.confirm(`Excluir o usuário ${usuario?.nome || usuario?.email}?`)) {
                      onExcluir(usuario);
                      onClose();
                    }
                  }}>
                  Excluir usuário
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#f8fafc" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {abas.map((tab) => (
              <button key={tab.key} onClick={() => setAba(tab.key)} style={{
                width: "8px", height: "8px", borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                background: aba === tab.key ? "#7C3AED" : "#cbd5e1",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="secondary-btn" onClick={onClose}>Cancelar</button>
            <button className="primary-btn" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar usuário"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Modal redefinir senha ────────────────────────────────────────────────────
function ModalRedefinirSenha({ usuario, onClose, onSalvar }) {
  const [novaSenha, setNovaSenha]   = useState("");
  const [confirmar, setConfirmar]   = useState("");
  const [salvando, setSalvando]     = useState(false);
  const [erro, setErro]             = useState("");

  async function salvar() {
    setErro("");
    if (novaSenha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirmar) { setErro("As senhas não coincidem."); return; }
    try {
      setSalvando(true);
      await onSalvar(novaSenha);
      onClose();
    } catch {
      setErro("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", zIndex: 1010 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1011, width: "100%", maxWidth: "400px",
        background: "#fff", borderRadius: "16px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
      }}>
        <div style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>Redefinir senha</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px" }}>{usuario?.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px" }}>×</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Nova senha *</label>
            <input className="input" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Confirmar senha *</label>
            <input className="input" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && salvar()} />
          </div>
          {erro && (
            <div style={{ color: "#dc2626", fontSize: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px" }}>{erro}</div>
          )}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px", background: "#f8fafc" }}>
          <button className="secondary-btn" onClick={onClose}>Cancelar</button>
          <button className="primary-btn" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Redefinir senha"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Modal perfil do usuário (visão admin) ────────────────────────────────────
function ModalPerfilUsuario({ usuario, onClose, onEditar, onRedefinirSenha }) {
  const inicial = (usuario?.nome || usuario?.email || "U").charAt(0).toUpperCase();

  function formatarData(ts) {
    if (!ts) return "—";
    if (typeof ts === "string") return new Date(ts).toLocaleDateString("pt-BR");
    if (ts instanceof Date) return ts.toLocaleDateString("pt-BR");
    if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleDateString("pt-BR");
    return "—";
  }

  const infoRows = [
    { label: "Nome",           value: usuario?.nome || "—" },
    { label: "E-mail",         value: usuario?.email || "—" },
    { label: "Usuário de login", value: usuario?.username || usuario?.usuario || usuario?.login || "—" },
    { label: "Perfil",         value: usuario?.role || "—" },
    { label: "Cargo",          value: usuario?.cargo || null },
    { label: "Especialidade",  value: usuario?.especialidade || null },
    { label: "CRM",            value: usuario?.crm || null },
    { label: "COREN",          value: usuario?.coren || null },
    { label: "Atende pacientes", value: usuario?.atende_pacientes ? "Sim" : null },
    { label: "Status", value: usuario?.ativo !== false ? "Ativo" : "Inativo", destaque: usuario?.ativo !== false ? "#16a34a" : "#dc2626" },
    { label: "Cadastrado em",  value: formatarData(usuario?.createdAt) },
  ].filter((r) => r.value !== null && r.value !== undefined && r.value !== "");

  const agenda = Array.isArray(usuario?.diasAtendimento) && usuario.diasAtendimento.length > 0;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", zIndex: 1000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1001, width: "100%", maxWidth: "460px",
        background: "#fff", borderRadius: "16px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh",
      }}>
        <div style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)", padding: "22px 24px", display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: 62, height: 62, borderRadius: "50%", background: "rgba(255,255,255,0.18)", border: "3px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700, color: "#fff", overflow: "hidden" }}>
              {usuario?.photoURL
                ? <img src={usuario.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                : inicial}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuario?.nome}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuario?.email}</div>
            <div style={{ display: "inline-block", marginTop: "6px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, textTransform: "capitalize" }}>
              {usuario?.role || "Usuário"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px", alignSelf: "flex-start", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {infoRows.map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#f8fafc", borderRadius: "8px", gap: "12px", border: "1px solid #f0f4f8" }}>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: "13px", color: row.destaque || "#1e293b", fontWeight: 600, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
              </div>
            ))}
            {agenda && (
              <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f0f4f8", fontSize: "12px", color: "#64748b" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Agenda</div>
                <div>{usuario.diasAtendimento.join(", ")} — {Array.isArray(usuario.horarios) ? usuario.horarios.length : 0} horário(s)</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#f8fafc", gap: "8px" }}>
          <button className="secondary-btn" onClick={onRedefinirSenha} title="Definir nova senha para este usuário">Redefinir senha</button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="secondary-btn" onClick={onClose}>Fechar</button>
            <button className="primary-btn" onClick={onEditar}>Editar</button>
          </div>
        </div>
      </div>
    </>
  );
}

function summaryCard(label, value, color, icon, bg) {
  return (
    <div className="page-card" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
          <p style={{ margin: "4px 0 0", fontSize: "28px", fontWeight: 700, color }}>{value}</p>
        </div>
        <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Configuracoes({
  users = [],
  consultorios = [],
  salas = [],
  userData = null,
  onCriarUsuario,
  onAtualizarUsuario,
  onExcluirUsuario,
  onLiberarConsultorio,
  onCriarSala,
  onAtualizarSala,
  onExcluirSala,
}) {
  const isAdminOrMaster = userData?.role === "admin" || userData?.login === "master";
  const toast = useToast();

  const [abaAtiva, setAbaAtiva] = useState("usuarios");

  const [busca, setBusca]                       = useState("");
  const [pagina, setPagina]                     = useState(1);
  const [modalCriar, setModalCriar]             = useState(false);
  const [usuarioEditando, setUsuarioEditando]   = useState(null);
  const [usuarioPerfil, setUsuarioPerfil]       = useState(null);
  const [usuarioRedefinirSenha, setUsuarioRedefinirSenha] = useState(null);

  // Logs de auditoria
  const [logs, setLogs]                     = useState([]);
  const [logsCarregando, setLogsCarregando] = useState(false);
  const [logsBusca, setLogsBusca]           = useState("");
  const [logsModulo, setLogsModulo]         = useState("");

  // Informações do sistema
  const [sistemaInfo, setSistemaInfo]               = useState(null);
  const [sistemaCarregando, setSistemaCarregando]   = useState(false);

  // Salas — estado local do formulário de criação/edição
  const SALA_VAZIA = { numero: "", nome: "", descricao: "" };
  const [salaForm, setSalaForm]           = useState(SALA_VAZIA);
  const [salaEditando, setSalaEditando]   = useState(null);
  const [salvandoSala, setSalvandoSala]   = useState(false);

  // Fornecedores
  const [fornecedores, setFornecedores]     = useState([]);
  const [fornecedorSel, setFornecedorSel]   = useState(null);
  const [modoEdicaoForn, setModoEdicaoForn] = useState(false);
  const [salvandoForn, setSalvandoForn]     = useState(false);
  const FORN_VAZIO = { nome: "", cnpj: "", telefone: "", email: "", categoria: "", contato: "", endereco: "", observacoes: "" };
  const [novoForn, setNovoForn]             = useState(FORN_VAZIO);

  const recarregarFornecedores = useCallback(async () => {
    try {
      const res = await api.fornecedores.listar();
      setFornecedores(res.data || []);
    } catch { setFornecedores([]); }
  }, []);

  useEffect(() => { recarregarFornecedores(); }, [recarregarFornecedores]);

  function limparForn() {
    setFornecedorSel(null);
    setModoEdicaoForn(false);
    setNovoForn(FORN_VAZIO);
  }

  function editarForn(f) {
    setFornecedorSel(f);
    setModoEdicaoForn(true);
    setNovoForn({
      nome: f.nome || "", cnpj: f.cnpj || "", telefone: f.telefone || "",
      email: f.email || "", categoria: f.categoria || "", contato: f.contato || "",
      endereco: f.endereco || "", observacoes: f.observacoes || "",
    });
  }

  async function salvarForn() {
    if (!novoForn.nome.trim()) { toast.warn("Informe o nome do fornecedor."); return; }
    try {
      setSalvandoForn(true);
      const payload = {
        nome: novoForn.nome.trim(), cnpj: novoForn.cnpj.trim(),
        telefone: novoForn.telefone.trim(), email: novoForn.email.trim(),
        categoria: novoForn.categoria.trim(), contato: novoForn.contato.trim(),
        endereco: novoForn.endereco.trim(), observacoes: novoForn.observacoes.trim(),
      };
      if (modoEdicaoForn && fornecedorSel?.id) {
        await api.fornecedores.atualizar(fornecedorSel.id, payload);
        toast.success("Fornecedor atualizado.");
      } else {
        await api.fornecedores.criar(payload);
        toast.success("Fornecedor cadastrado.");
      }
      await recarregarFornecedores();
      limparForn();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar o fornecedor.");
    } finally {
      setSalvandoForn(false);
    }
  }

  async function excluirForn(f) {
    if (!await toast.confirm(`Excluir o fornecedor "${f.nome}"?`)) return;
    try {
      await api.fornecedores.excluir(f.id);
      if (fornecedorSel?.id === f.id) limparForn();
      await recarregarFornecedores();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir o fornecedor.");
    }
  }

  function iniciarEdicaoSala(sala) {
    setSalaEditando(sala);
    setSalaForm({ numero: String(sala.numero), nome: sala.nome, descricao: sala.descricao || "" });
  }

  function cancelarEdicaoSala() {
    setSalaEditando(null);
    setSalaForm(SALA_VAZIA);
  }

  async function salvarSala() {
    const numero = parseInt(salaForm.numero, 10);
    if (!numero || numero < 1) { toast.warn("Número da sala deve ser um inteiro positivo."); return; }
    if (!salaForm.nome.trim()) { toast.warn("Informe o nome da sala."); return; }
    try {
      setSalvandoSala(true);
      const payload = { numero, nome: salaForm.nome.trim(), descricao: salaForm.descricao.trim() };
      if (salaEditando) {
        await onAtualizarSala(salaEditando.id, payload);
        toast.success("Sala atualizada.");
      } else {
        await onCriarSala(payload);
        toast.success("Sala criada.");
      }
      cancelarEdicaoSala();
    } catch (err) {
      const msg = err?.data?.message || err.message || "";
      if (msg.includes("409") || err.status === 409 || msg.toLowerCase().includes("já existe")) {
        toast.warn("Já existe uma sala com esse número.");
      } else {
        toast.error("Não foi possível salvar a sala.");
      }
    } finally {
      setSalvandoSala(false);
    }
  }

  async function excluirSalaHandler(sala) {
    if (!await toast.confirm(`Excluir a sala "${sala.nome}"? Ela deixará de aparecer na seleção de consultórios.`)) return;
    try {
      await onExcluirSala(sala.id);
      if (salaEditando?.id === sala.id) cancelarEdicaoSala();
      toast.success("Sala removida.");
    } catch {
      toast.error("Não foi possível excluir a sala.");
    }
  }

  const carregarLogs = useCallback(async () => {
    setLogsCarregando(true);
    try {
      const params = { limit: 200 };
      if (logsBusca)  params.busca  = logsBusca;
      if (logsModulo) params.modulo = logsModulo;
      const res = await api.get("/logs", params);
      setLogs(res?.data || []);
    } catch {
      toast.error("Não foi possível carregar os logs.");
    } finally {
      setLogsCarregando(false);
    }
  }, [logsBusca, logsModulo, toast]);

  useEffect(() => {
    if (abaAtiva === "auditoria") carregarLogs();
  }, [abaAtiva, carregarLogs]);

  const carregarSistema = useCallback(async () => {
    setSistemaCarregando(true);
    try {
      const [healthRes, statusRes] = await Promise.all([api.health(), api.status()]);
      setSistemaInfo({ health: healthRes, status: statusRes });
    } catch {
      setSistemaInfo(null);
    } finally {
      setSistemaCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (abaAtiva === "sistema") carregarSistema();
  }, [abaAtiva, carregarSistema]);

  // Métricas
  const total    = users.length;
  const ativos   = users.filter((u) => u.ativo !== false).length;
  const inativos = users.filter((u) => u.ativo === false).length;
  const admins   = users.filter((u) => u.role === "admin").length;

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase();
    return users.filter((u) =>
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

  const totalPaginas   = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
  const usuariosPagina = usuariosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  useEffect(() => { setPagina(1); }, [busca]);

  async function handleSalvar(formData) {
    const { editando, id, profAgenda, senha, _confirmarSenha, ...payload } = formData;

    const cleanPayload = {
      nome:            payload.nome,
      email:           payload.email,
      username:        payload.username,
      role:            payload.role,
      cargo:           payload.cargo || null,
      crm:             payload.role === "medico" ? payload.crm : "",
      cro:             payload.role === "odonto" ? payload.cro : "",
      coren:           payload.role === "enfermagem" ? payload.coren : "",
      especialidade:   payload.role === "medico" || payload.role === "odonto" ? payload.especialidade : "",
      ativo:           payload.ativo,
      atendePacientes: payload.atendePacientes || false,
      permissions:     payload.permissions,
      diasAtendimento: profAgenda ? payload.diasAtendimento : [],
      horarios:        profAgenda ? payload.horarios : [],
      horaInicio:      profAgenda ? payload.horaInicio : "",
      horaFim:         profAgenda ? payload.horaFim : "",
      intervalo:       profAgenda ? Number(payload.intervalo || 30) : 30,
      pausaInicio:     profAgenda ? payload.pausaInicio : "",
      pausaFim:        profAgenda ? payload.pausaFim : "",
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

  async function redefinirSenha(novaSenha) {
    await api.usuarios.atualizar(usuarioRedefinirSenha.id, { senha: novaSenha });
  }

  async function excluirUsuario(usuario) {
    if (!onExcluirUsuario) return;
    const loginUsuario = (usuario.login || usuario.username || usuario.usuario || "").toLowerCase();
    if (loginUsuario === "master" || usuario.role === "master") {
      toast.warn("O usuário master não pode ser excluído.");
      return;
    }
    if (usuario.id === userData?.id) {
      toast.warn("Você não pode excluir sua própria conta.");
      return;
    }
    if (!await toast.confirm(`Excluir o usuário ${usuario.nome || usuario.email}?`)) return;
    try {
      await onExcluirUsuario(usuario);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir o usuário.");
    }
  }

  const ABAS = [
    { key: "usuarios",     label: "Usuários",     adminOnly: false },
    { key: "auditoria",    label: "Auditoria",    adminOnly: true  },
    { key: "consultorios", label: "Consultórios", adminOnly: false },
    { key: "sistema",      label: "Sistema",      adminOnly: false },
    { key: "fornecedores", label: "Fornecedores", adminOnly: true  },
  ].filter((a) => !a.adminOnly || isAdminOrMaster);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Navegação por abas ── */}
      <div className="page-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          {ABAS.map((aba) => (
            <button
              key={aba.key}
              onClick={() => setAbaAtiva(aba.key)}
              style={{
                padding: "14px 20px",
                background: "none",
                border: "none",
                borderBottom: abaAtiva === aba.key ? "2px solid #7C3AED" : "2px solid transparent",
                color: abaAtiva === aba.key ? "#7C3AED" : "#64748b",
                fontWeight: abaAtiva === aba.key ? 700 : 500,
                fontSize: "13px",
                cursor: "pointer",
                transition: "color .15s",
                marginBottom: "-1px",
              }}
            >
              {aba.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Aba: Usuários ── */}
      {abaAtiva === "usuarios" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
            {summaryCard("Total",    total,    "#7C3AED", <Users size={20} color="#7C3AED" />,       "#EDE9FE")}
            {summaryCard("Ativos",   ativos,   "#16a34a", <UserCheck size={20} color="#16a34a" />,   "#dcfce7")}
            {summaryCard("Inativos", inativos, "#dc2626", <UserX size={20} color="#dc2626" />,       "#fee2e2")}
            {summaryCard("Admins",   admins,   "#7C3AED", <ShieldCheck size={20} color="#7C3AED" />, "#EDE9FE")}
          </div>

          <div className="page-card module-admin">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <input
                className="input search-input"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, usuário, e-mail, perfil..."
                style={{ flex: 1 }}
              />
              <button className="primary-btn" onClick={() => { setUsuarioEditando(null); setModalCriar(true); }}>
                + Novo Usuário
              </button>
            </div>

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
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e2e8f0", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#475569" }}>
                              {usuario.photoURL
                                ? <img src={usuario.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : (usuario.nome || usuario.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <button
                              onClick={() => setUsuarioPerfil(usuario)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#1e293b", fontWeight: 600, fontSize: "13px", padding: 0, textAlign: "left", textDecoration: "underline", textDecorationColor: "transparent" }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "#7C3AED")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}
                            >
                              {usuario.nome}
                            </button>
                          </div>
                        </td>
                        <td style={{ fontSize: "13px" }}>{usuario.username || usuario.usuario || usuario.login || "-"}</td>
                        <td style={{ fontSize: "13px" }}>{usuario.email}</td>
                        <td>
                          <span className="badge" style={{ textTransform: "capitalize" }}>{usuario.role}</span>
                        </td>
                        <td style={{ fontSize: "13px" }}>
                          {usuario.role === "medico" ? usuario.crm || "-" : usuario.role === "odonto" ? usuario.cro || "-" : usuario.role === "enfermagem" ? usuario.coren || "-" : "-"}
                        </td>
                        <td>
                          <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: usuario.ativo !== false ? "#f0fdf4" : "#fef2f2", color: usuario.ativo !== false ? "#16a34a" : "#dc2626", border: `1px solid ${usuario.ativo !== false ? "#bbf7d0" : "#fecaca"}` }}>
                            {usuario.ativo !== false ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td>
                          {sala
                            ? <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>{sala.nome}</span>
                            : <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>}
                        </td>
                        <td style={{ fontSize: "13px" }}>
                          {Array.isArray(usuario.permissions) ? usuario.permissions.length : 0}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button className="secondary-btn" onClick={() => abrirEdicao(usuario)}>Editar</button>
                            {isAdminOrMaster && (
                              <button className="secondary-btn" onClick={() => setUsuarioRedefinirSenha(usuario)} style={{ color: "#0f766e", borderColor: "#0f766e" }}>
                                Senha
                              </button>
                            )}
                            {isAdminOrMaster && (usuario.login || usuario.username || usuario.usuario || "").toLowerCase() !== "master" && usuario.id !== userData?.id && (
                              <button
                                className="secondary-btn"
                                onClick={() => toggleAtivo(usuario)}
                                style={{
                                  color: usuario.ativo !== false ? "#dc2626" : "#16a34a",
                                  borderColor: usuario.ativo !== false ? "#dc2626" : "#16a34a",
                                }}
                              >
                                {usuario.ativo !== false ? "Inativar" : "Ativar"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {usuariosPagina.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: "center", color: "#94a3b8", padding: "28px" }}>
                        {busca ? "Nenhum usuário encontrado para esta busca." : "Nenhum usuário cadastrado."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "16px" }}>
                <button className="secondary-btn" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>‹ Anterior</button>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  Página {pagina} de {totalPaginas} — <strong>{usuariosFiltrados.length}</strong> usuário(s)
                </span>
                <button className="secondary-btn" disabled={pagina === totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima ›</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Aba: Auditoria ── */}
      {abaAtiva === "auditoria" && (
        <div className="page-card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Logs de Auditoria</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>Registro de ações dos usuários no sistema</p>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <input
              className="input search-input"
              value={logsBusca}
              onChange={(e) => setLogsBusca(e.target.value)}
              placeholder="Buscar por usuário, ação..."
              style={{ flex: 1, minWidth: 180 }}
            />
            <select className="select" value={logsModulo} onChange={(e) => setLogsModulo(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
              <option value="">Todos os módulos</option>
              {["auth", "usuarios", "pacientes", "atendimentos", "pagamentos", "estoque", "financeiro"].map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
            <button className="secondary-btn" onClick={carregarLogs}>↻ Atualizar</button>
          </div>

          {logsCarregando ? (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>Carregando logs...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>Nenhum log encontrado.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Módulo</th>
                    <th>IP</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const acaoCor = {
                      login:              "#16a34a",
                      login_falha:        "#dc2626",
                      logout:             "#6b7280",
                      usuario_criado:     "#2563eb",
                      usuario_atualizado: "#f59e0b",
                      usuario_excluido:   "#dc2626",
                      foto_atualizada:    "#6366f1",
                    }[log.acao] || "#374151";

                    const detalhesStr = log.detalhes
                      ? typeof log.detalhes === "object"
                        ? Object.entries(log.detalhes).map(([k, v]) => `${k}: ${v}`).join(", ")
                        : String(log.detalhes)
                      : "—";

                    return (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td>{log.nome_usuario || `ID ${log.usuario_id}` || "—"}</td>
                        <td>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: acaoCor, background: acaoCor + "18" }}>
                            {log.acao}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "#6b7280" }}>{log.modulo || "—"}</td>
                        <td style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{log.ip || "—"}</td>
                        <td style={{ fontSize: 12, color: "#6b7280", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detalhesStr}>
                          {detalhesStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Consultórios ── */}
      {abaAtiva === "consultorios" && (
        <>
          {/* Ocupação em tempo real */}
          <div className="page-card">
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Ocupação em tempo real</h3>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>Status atual das salas de atendimento</p>
            </div>
            {salas.length === 0 && consultorios.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>Nenhuma sala cadastrada ainda. Cadastre salas abaixo.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                {(salas.length > 0
                  ? salas.map((s) => ({ numero: Number(s.numero), nome: s.nome }))
                  : Array.from({ length: 7 }, (_, i) => ({ numero: i + 1, nome: `Consultório ${i + 1}` }))
                ).map(({ numero, nome }) => {
                  const ocupado = consultorios.find((c) => Number(c.numero) === numero);
                  const ativo = ocupado && ocupado.lastActive
                    ? (Date.now() - new Date(ocupado.lastActive).getTime()) < 60000
                    : false;
                  return (
                    <div key={numero} style={{
                      padding: "14px 16px", borderRadius: "10px",
                      border: `1px solid ${ativo ? "#bbf7d0" : "#e2e8f0"}`,
                      background: ativo ? "#f0fdf4" : "#f8fafc",
                      display: "flex", flexDirection: "column", gap: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{nome}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: ativo ? "#16a34a" : "#94a3b8", color: "#fff",
                        }}>
                          {ativo ? "Em uso" : "Livre"}
                        </span>
                      </div>
                      {ativo && ocupado ? (
                        <>
                          <div style={{ fontSize: 12, color: "#374151" }}>{ocupado.medicoNome || "—"}</div>
                          {isAdminOrMaster && onLiberarConsultorio && (
                            <button
                              className="secondary-btn"
                              style={{ fontSize: 11, padding: "4px 10px", marginTop: 4, color: "#dc2626", borderColor: "#fca5a5" }}
                              onClick={async () => {
                                if (await toast.confirm(`Liberar ${nome} de ${ocupado.medicoNome}?`)) {
                                  onLiberarConsultorio(ocupado.medicoId);
                                }
                              }}
                            >
                              Liberar sala
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>Disponível</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gerenciamento de salas — admin only */}
          {isAdminOrMaster && (
            <div className="page-card">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Gerenciar Salas</h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                  Defina quais salas aparecerão na seleção de consultório para os profissionais
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Formulário */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
                  <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>
                    {salaEditando ? `Editando: ${salaEditando.nome}` : "Nova sala"}
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Número *</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          value={salaForm.numero}
                          onChange={(e) => setSalaForm((p) => ({ ...p, numero: e.target.value }))}
                          placeholder="Ex: 1"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Nome da sala *</label>
                        <input
                          className="input"
                          value={salaForm.nome}
                          onChange={(e) => setSalaForm((p) => ({ ...p, nome: e.target.value }))}
                          placeholder="Ex: Consultório Médico 1"
                        />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Descrição</label>
                      <input
                        className="input"
                        value={salaForm.descricao}
                        onChange={(e) => setSalaForm((p) => ({ ...p, descricao: e.target.value }))}
                        placeholder="Ex: Térreo, ala direita (opcional)"
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button className="primary-btn" onClick={salvarSala} disabled={salvandoSala}>
                      {salvandoSala ? "Salvando..." : salaEditando ? "Salvar alterações" : "Criar sala"}
                    </button>
                    {salaEditando && (
                      <button className="secondary-btn" onClick={cancelarEdicaoSala}>Cancelar</button>
                    )}
                  </div>
                </div>

                {/* Lista */}
                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>
                    Salas cadastradas ({salas.length})
                  </h4>
                  {salas.length === 0 ? (
                    <div className="muted-box" style={{ fontSize: 13 }}>
                      Nenhuma sala cadastrada. Sem salas definidas, os profissionais verão os consultórios padrão (1 a 7).
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
                      {salas.map((sala) => (
                        <div key={sala.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", borderRadius: 10,
                          border: `1px solid ${salaEditando?.id === sala.id ? "rgba(124,58,237,0.4)" : "var(--border)"}`,
                          background: salaEditando?.id === sala.id ? "rgba(124,58,237,0.05)" : "var(--bg-card)",
                          gap: 8,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                minWidth: 28, height: 28, borderRadius: 6,
                                background: "#EDE9FE", color: "#7C3AED",
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 700,
                              }}>
                                {sala.numero}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{sala.nome}</span>
                            </div>
                            {sala.descricao && (
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, paddingLeft: 36 }}>{sala.descricao}</div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              className="secondary-btn"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() => iniciarEdicaoSala(sala)}
                            >
                              Editar
                            </button>
                            <button
                              className="secondary-btn"
                              style={{ padding: "4px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}
                              onClick={() => excluirSalaHandler(sala)}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Aba: Sistema ── */}
      {abaAtiva === "sistema" && (
        <div className="page-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Informações do Sistema</h3>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>Status dos serviços e dados de ambiente</p>
            </div>
            <button className="secondary-btn" onClick={carregarSistema} disabled={sistemaCarregando}>
              {sistemaCarregando ? "Carregando..." : "↻ Atualizar"}
            </button>
          </div>

          {sistemaCarregando ? (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>Carregando informações do sistema...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
              {[
                {
                  label: "Status da API",
                  value: sistemaInfo?.health?.status ?? "—",
                  cor: sistemaInfo?.health?.status === "ok" ? "#16a34a" : (sistemaInfo ? "#dc2626" : "#64748b"),
                },
                {
                  label: "Versão da Aplicação",
                  value: sistemaInfo?.status?.version ?? "—",
                  cor: "#7C3AED",
                },
                {
                  label: "Banco de dados",
                  value: sistemaInfo?.status?.database?.connected === true
                    ? "Conectado"
                    : sistemaInfo?.status?.database?.connected === false
                      ? "Desconectado"
                      : "—",
                  cor: sistemaInfo?.status?.database?.connected === true ? "#16a34a" : (sistemaInfo?.status?.database ? "#dc2626" : "#64748b"),
                },
                {
                  label: "Usuários registrados",
                  value: String(total),
                  cor: "#2563eb",
                },
                {
                  label: "Usuários ativos",
                  value: String(ativos),
                  cor: "#0f766e",
                },
                {
                  label: "Salas em uso",
                  value: String(consultorios.filter((c) => c.lastActive && (Date.now() - new Date(c.lastActive).getTime()) < 60000).length),
                  cor: "#d97706",
                },
              ].map(({ label, value, cor }) => (
                <div key={label} style={{ padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "5px", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: cor }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Fornecedores ── */}
      {abaAtiva === "fornecedores" && isAdminOrMaster && (
        <div className="page-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {modoEdicaoForn ? "Editar Fornecedor" : "Fornecedores"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                Gerencie os fornecedores vinculados às contas a pagar
              </p>
            </div>
            {modoEdicaoForn && (
              <button className="secondary-btn" onClick={limparForn}>Cancelar edição</button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Formulário */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
              <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>
                {modoEdicaoForn ? `Editando: ${fornecedorSel?.nome}` : "Novo fornecedor"}
              </h4>
              <div className="patients-form-grid">
                <div className="patients-full-width">
                  <label>Nome do fornecedor *</label>
                  <input className="input" value={novoForn.nome}
                    onChange={(e) => setNovoForn((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Razão social ou nome fantasia" />
                </div>
                <div>
                  <label>CNPJ</label>
                  <input className="input" value={novoForn.cnpj}
                    onChange={(e) => setNovoForn((p) => ({ ...p, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label>Categoria</label>
                  <select className="select" value={novoForn.categoria}
                    onChange={(e) => setNovoForn((p) => ({ ...p, categoria: e.target.value }))}>
                    <option value="">Selecionar categoria</option>
                    {["Material médico","Material odontológico","Equipamentos","Serviços","Manutenção","Limpeza","Aluguel","Tecnologia","Outros"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Telefone / WhatsApp</label>
                  <input className="input" value={novoForn.telefone}
                    onChange={(e) => setNovoForn((p) => ({ ...p, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label>E-mail</label>
                  <input className="input" type="email" value={novoForn.email}
                    onChange={(e) => setNovoForn((p) => ({ ...p, email: e.target.value }))}
                    placeholder="contato@fornecedor.com.br" />
                </div>
                <div>
                  <label>Nome do contato</label>
                  <input className="input" value={novoForn.contato}
                    onChange={(e) => setNovoForn((p) => ({ ...p, contato: e.target.value }))}
                    placeholder="Responsável pelo atendimento" />
                </div>
                <div className="patients-full-width">
                  <label>Endereço</label>
                  <input className="input" value={novoForn.endereco}
                    onChange={(e) => setNovoForn((p) => ({ ...p, endereco: e.target.value }))}
                    placeholder="Rua, número, cidade" />
                </div>
                <div className="patients-full-width">
                  <label>Observações</label>
                  <textarea className="textarea" rows={3} value={novoForn.observacoes}
                    onChange={(e) => setNovoForn((p) => ({ ...p, observacoes: e.target.value }))}
                    placeholder="Prazo de pagamento, condições especiais..." />
                </div>
              </div>
              <div className="patients-form-actions" style={{ marginTop: 16 }}>
                <button className="primary-btn" onClick={salvarForn} disabled={salvandoForn}>
                  {salvandoForn ? "Salvando..." : modoEdicaoForn ? "Atualizar fornecedor" : "Cadastrar fornecedor"}
                </button>
                <button className="secondary-btn" onClick={limparForn}>Limpar</button>
              </div>
            </div>

            {/* Lista */}
            <div>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>
                Fornecedores cadastrados ({fornecedores.length})
              </h4>
              <div style={{ display: "grid", gap: 10, maxHeight: 540, overflowY: "auto", paddingRight: 4 }}>
                {fornecedores.length === 0 && (
                  <div className="muted-box">Nenhum fornecedor cadastrado.</div>
                )}
                {fornecedores.map((f) => (
                  <div key={f.id} style={{
                    background: fornecedorSel?.id === f.id ? "rgba(99,102,241,0.07)" : "var(--bg-card)",
                    border: `1px solid ${fornecedorSel?.id === f.id ? "rgba(99,102,241,0.35)" : "var(--border)"}`,
                    borderRadius: 12, padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.nome}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                          {f.categoria && (
                            <span className="patients-badge patients-badge-blue" style={{ fontSize: 11 }}>{f.categoria}</span>
                          )}
                          {f.cnpj && (
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>CNPJ: {f.cnpj}</span>
                          )}
                        </div>
                        {(f.telefone || f.email) && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {f.telefone && <span>📞 {f.telefone}</span>}
                            {f.telefone && f.email && <span style={{ margin: "0 6px" }}>•</span>}
                            {f.email && <span>✉️ {f.email}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => editarForn(f)}>Editar</button>
                        <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => excluirForn(f)}>Excluir</button>
                      </div>
                    </div>
                    {f.observacoes && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", background: "var(--bg-muted)", borderRadius: 8, padding: "6px 10px" }}>
                        {f.observacoes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      {modalCriar && !usuarioEditando && (
        <ModalCriarEditar usuario={null} onClose={() => setModalCriar(false)} onSalvar={handleSalvar} />
      )}

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

      {usuarioPerfil && (
        <ModalPerfilUsuario
          usuario={usuarioPerfil}
          onClose={() => setUsuarioPerfil(null)}
          onEditar={() => abrirEdicao(usuarioPerfil)}
          onRedefinirSenha={() => { setUsuarioRedefinirSenha(usuarioPerfil); setUsuarioPerfil(null); }}
        />
      )}

      {usuarioRedefinirSenha && (
        <ModalRedefinirSenha
          usuario={usuarioRedefinirSenha}
          onClose={() => setUsuarioRedefinirSenha(null)}
          onSalvar={redefinirSenha}
        />
      )}
    </div>
  );
}
