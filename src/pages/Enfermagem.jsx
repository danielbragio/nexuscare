import { useCallback, useMemo, useState } from "react";
import { Check, Sparkles, Stethoscope, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { hojeISO, normalizarFormaPagamento, calcularIdade } from "../utils/dateUtils";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatarHora(t) {
  if (!t) return "—";
  return String(t).slice(0, 5);
}

const CLASSIFICACOES_RISCO = [
  { label: "Vermelho — Emergência",   cor: "#dc2626", bg: "#fef2f2", valor: "vermelho" },
  { label: "Laranja — Muito urgente", cor: "#ea580c", bg: "#fff7ed", valor: "laranja" },
  { label: "Amarelo — Urgente",       cor: "#ca8a04", bg: "#fefce8", valor: "amarelo" },
  { label: "Verde — Pouco urgente",   cor: "#16a34a", bg: "#f0fdf4", valor: "verde" },
  { label: "Azul — Não urgente",      cor: "#2563eb", bg: "#eff6ff", valor: "azul" },
];

const ORDEM_RISCO = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Convênio", "Cortesia"];

// ── Sub-componentes ────────────────────────────────────────────────────────────

function BadgeRisco({ valor }) {
  const c = CLASSIFICACOES_RISCO.find((r) => r.valor === valor);
  if (!c) return null;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 12, fontWeight: 600, color: c.cor, background: c.bg,
      border: `1px solid ${c.cor}`,
    }}>
      {c.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const mapa = {
    agendado:       { label: "Agendado",       bg: "#eff6ff", cor: "#2563eb" },
    confirmado:     { label: "Confirmado",     bg: "#ecfdf5", cor: "#059669" },
    aguardando:     { label: "Aguardando",     bg: "#fffbeb", cor: "#d97706" },
    presente:       { label: "Presente",       bg: "#fff7ed", cor: "#ea580c" },
    em_atendimento: { label: "Em atendimento", bg: "#f0fdf4", cor: "#16a34a" },
    finalizado:     { label: "Finalizado",     bg: "#f3f4f6", cor: "#6b7280" },
  };
  const s = mapa[status] || { label: status, bg: "#f3f4f6", cor: "#374151" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 12, fontWeight: 600, color: s.cor, background: s.bg,
    }}>
      {s.label}
    </span>
  );
}

// ── Modal Triagem ──────────────────────────────────────────────────────────────

function ModalTriagem({ atendimento, paciente, onFechar, onSalvar }) {
  const [form, setForm] = useState(() => {
    // Mescla legado (raiz do prontuario) com novo formato (prontuario.triagem).
    // Sempre prioriza o novo se existir.
    const raiz = atendimento.prontuario || {};
    const t    = raiz.triagem || {};
    const get  = (k) => t[k] ?? raiz[k] ?? "";
    return {
      peso:                   String(atendimento.peso   || raiz.peso   || ""),
      altura:                 String(atendimento.altura || raiz.altura || ""),
      pa:                     atendimento.pa        || raiz.pa        || "",
      temp:                   String(atendimento.temp   || raiz.temp   || ""),
      saturacao:              String(atendimento.saturacao || raiz.saturacao || ""),
      freq_cardiaca:          get("freq_cardiaca"),
      freq_respiratoria:      get("freq_respiratoria"),
      glicemia:               get("glicemia"),
      queixa_principal:       get("queixa_principal"),
      alergias:               get("alergias") || paciente?.alergias || "",
      medicamentos_uso:       get("medicamentos_uso"),
      classificacao_risco:    get("classificacao_risco") || "verde",
      observacoes_enfermagem: get("observacoes_enfermagem"),
    };
  });
  const [salvando, setSalvando] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar(atendimento.id, form);
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  const inp = {
    width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
    borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "min(700px,95vw)",
        maxHeight: "92vh", overflowY: "auto", padding: 28,
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
              Triagem — {atendimento.paciente || atendimento.nomePaciente}
            </h2>
            {paciente?.dataNascimento && (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                {calcularIdade(paciente.dataNascimento)} anos
                {paciente.tipoSanguineo ? ` · Tipo sang.: ${paciente.tipoSanguineo}` : ""}
              </p>
            )}
          </div>
          <button onClick={onFechar} style={{
            background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center",
          }}><X size={20} /></button>
        </div>

        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: "#374151", padding: "0 6px" }}>Sinais Vitais</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
            {[
              { field: "peso",              label: "Peso (kg)",        placeholder: "ex: 70.5" },
              { field: "altura",            label: "Altura (cm)",      placeholder: "ex: 170" },
              { field: "pa",                label: "PA (mmHg)",        placeholder: "ex: 120/80" },
              { field: "temp",              label: "Temp (°C)",        placeholder: "ex: 36.5" },
              { field: "saturacao",         label: "SpO₂ (%)",         placeholder: "ex: 98" },
              { field: "freq_cardiaca",     label: "FC (bpm)",         placeholder: "ex: 72" },
              { field: "freq_respiratoria", label: "FR (irpm)",        placeholder: "ex: 16" },
              { field: "glicemia",          label: "Glicemia (mg/dL)", placeholder: "ex: 95" },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label style={lbl}>{label}</label>
                <input
                  type="text"
                  value={form[field]}
                  onChange={(e) => set(field, e.target.value)}
                  placeholder={placeholder}
                  style={inp}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: "#374151", padding: "0 6px" }}>Anamnese de Enfermagem</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={lbl}>Queixa principal <span style={{ color: "#dc2626" }}>*</span></label>
              <textarea
                value={form.queixa_principal}
                onChange={(e) => set("queixa_principal", e.target.value)}
                rows={3}
                placeholder="Descreva o motivo da visita..."
                style={{ ...inp, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Alergias conhecidas</label>
                <input type="text" value={form.alergias} onChange={(e) => set("alergias", e.target.value)} placeholder="Nenhuma / listar..." style={inp} />
              </div>
              <div>
                <label style={lbl}>Medicamentos em uso</label>
                <input type="text" value={form.medicamentos_uso} onChange={(e) => set("medicamentos_uso", e.target.value)} placeholder="Ex: Losartana 50mg..." style={inp} />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: "#374151", padding: "0 6px" }}>Classificação de Risco (Manchester)</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 8 }}>
            {CLASSIFICACOES_RISCO.map((r) => (
              <label key={r.valor} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                border: `2px solid ${form.classificacao_risco === r.valor ? r.cor : "#e5e7eb"}`,
                borderRadius: 8, cursor: "pointer",
                background: form.classificacao_risco === r.valor ? r.bg : "#fff",
              }}>
                <input
                  type="radio" name="risco" value={r.valor}
                  checked={form.classificacao_risco === r.valor}
                  onChange={() => set("classificacao_risco", r.valor)}
                  style={{ accentColor: r.cor, cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: r.cor }}>{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Observações de enfermagem</label>
          <textarea
            value={form.observacoes_enfermagem}
            onChange={(e) => set("observacoes_enfermagem", e.target.value)}
            rows={2}
            placeholder="Anotações adicionais..."
            style={{ ...inp, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onFechar} style={{
            padding: "9px 20px", borderRadius: 8, border: "1px solid #d1d5db",
            background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151",
          }}>
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !form.queixa_principal.trim()}
            style={{
              padding: "9px 20px", borderRadius: 8, border: "none",
              background: form.queixa_principal.trim() ? "#2563eb" : "#93c5fd",
              color: "#fff",
              cursor: form.queixa_principal.trim() && !salvando ? "pointer" : "not-allowed",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {salvando ? "Salvando…" : "Salvar Triagem"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Procedimento ─────────────────────────────────────────────────────────

function ModalProcedimento({ procedimentosDisponiveis, onFechar, onFinalizar }) {
  const [nomePaciente, setNomePaciente] = useState("");
  const [cpf, setCpf] = useState("");
  const [selecionados, setSelecionados] = useState([]);
  const [evolucao, setEvolucao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Dinheiro");
  const [buscaProc, setBuscaProc] = useState("");
  const [salvando, setSalvando] = useState(false);

  const procFiltrados = useMemo(() => {
    if (!buscaProc.trim()) return procedimentosDisponiveis;
    const t = buscaProc.toLowerCase();
    return procedimentosDisponiveis.filter((p) =>
      (p.nome || p.name || "").toLowerCase().includes(t) ||
      (p.categoria || p.descricao || "").toLowerCase().includes(t)
    );
  }, [procedimentosDisponiveis, buscaProc]);

  function toggleProc(proc) {
    setSelecionados((prev) => {
      const exists = prev.find((p) => p.id === proc.id);
      return exists ? prev.filter((p) => p.id !== proc.id) : [...prev, proc];
    });
  }

  const valorTotal = selecionados.reduce((s, p) => s + Number(p.valor || p.preco || 0), 0);

  async function finalizar() {
    if (!nomePaciente.trim()) return;
    setSalvando(true);
    try {
      await onFinalizar({
        nomePaciente: nomePaciente.trim(),
        cpf: cpf.trim(),
        selecionados,
        evolucao,
        formaPagamento: normalizarFormaPagamento(formaPagamento),
        valorTotal,
      });
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  const inp = {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db",
    borderRadius: 7, fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, width: "min(720px,96vw)",
        maxHeight: "94vh", overflowY: "auto", padding: 28,
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
              Procedimento / Estética
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6b7280" }}>
              Registre os procedimentos realizados e finalize enviando para pagamento.
            </p>
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center" }}><X size={20} /></button>
        </div>

        {/* Paciente */}
        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: "#374151", padding: "0 6px" }}>Paciente</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Nome do paciente <span style={{ color: "#dc2626" }}>*</span></label>
              <input
                type="text" value={nomePaciente}
                onChange={(e) => setNomePaciente(e.target.value)}
                placeholder="Nome completo..."
                style={inp}
                autoFocus
              />
            </div>
            <div>
              <label style={lbl}>CPF (opcional)</label>
              <input
                type="text" value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                style={inp}
              />
            </div>
          </div>
        </fieldset>

        {/* Procedimentos */}
        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: "#374151", padding: "0 6px" }}>
            Procedimentos {selecionados.length > 0 && `(${selecionados.length} selecionados)`}
          </legend>
          <input
            type="text" value={buscaProc}
            onChange={(e) => setBuscaProc(e.target.value)}
            placeholder="Buscar procedimento..."
            style={{ ...inp, marginBottom: 10 }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {procFiltrados.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "12px 0" }}>
                Nenhum procedimento encontrado.
              </p>
            ) : procFiltrados.map((proc) => {
              const sel = selecionados.some((p) => p.id === proc.id);
              return (
                <label key={proc.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                  border: sel ? "2px solid #0f766e" : "1px solid #e5e7eb",
                  background: sel ? "#f0fdf9" : "#fff",
                  gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox" checked={sel}
                      onChange={() => toggleProc(proc)}
                      style={{ accentColor: "#0f766e", width: 15, height: 15, cursor: "pointer", flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {proc.nome || proc.name}
                      </div>
                      {proc.descricao && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{proc.descricao}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", flexShrink: 0 }}>
                    {Number(proc.valor || proc.preco || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </label>
              );
            })}
          </div>

          {selecionados.length > 0 && (
            <div style={{
              marginTop: 10, padding: "8px 12px", background: "#f0fdf9",
              borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "#374151" }}>
                {selecionados.map((p) => p.nome || p.name).join(", ")}
              </span>
              <strong style={{ color: "#0f766e", fontSize: 15 }}>
                {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </div>
          )}
        </fieldset>

        {/* Evolução e pagamento */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Evolução / Observações</label>
            <textarea
              value={evolucao}
              onChange={(e) => setEvolucao(e.target.value)}
              rows={4}
              placeholder="Descreva os procedimentos realizados, intercorrências, orientações..."
              style={{ ...inp, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={lbl}>Forma de pagamento</label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              style={{ ...inp }}
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Total dos procedimentos</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#0f766e" }}>
                {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onFechar} style={{
            padding: "9px 20px", borderRadius: 8, border: "1px solid #d1d5db",
            background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151",
          }}>Cancelar</button>
          <button
            onClick={finalizar}
            disabled={salvando || !nomePaciente.trim() || selecionados.length === 0}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: nomePaciente.trim() && selecionados.length > 0 ? "#0f766e" : "#d1d5db",
              color: "#fff", cursor: nomePaciente.trim() && selecionados.length > 0 && !salvando ? "pointer" : "not-allowed",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {salvando ? "Salvando…" : "Finalizar e enviar para pagamento →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Análise de sinais vitais críticos ─────────────────────────────────────────

function analisarSinaisVitais(at) {
  const alertas = [];
  // Triagem nova fica em prontuario.triagem; legado fica na raiz.
  // Mescla os dois com prioridade para o novo formato.
  const p = { ...(at.prontuario || {}), ...(at.prontuario?.triagem || {}) };

  const temp = Number(at.temp || p.temp || 0);
  if (temp > 0) {
    if (temp >= 39.5) alertas.push({ label: `Febre alta ${temp}°C`, cor: "#dc2626" });
    else if (temp >= 37.8) alertas.push({ label: `Febre ${temp}°C`, cor: "#d97706" });
    else if (temp < 35.5) alertas.push({ label: `Hipotermia ${temp}°C`, cor: "#2563eb" });
  }

  const spo2 = Number(at.saturacao || p.saturacao || 0);
  if (spo2 > 0) {
    if (spo2 < 90) alertas.push({ label: `SpO₂ ${spo2}%`, cor: "#dc2626" });
    else if (spo2 < 95) alertas.push({ label: `SpO₂ ${spo2}%`, cor: "#d97706" });
  }

  const fc = Number(p.freq_cardiaca || 0);
  if (fc > 0) {
    if (fc > 120 || fc < 50) alertas.push({ label: `FC ${fc} bpm`, cor: "#dc2626" });
    else if (fc > 100 || fc < 60) alertas.push({ label: `FC ${fc} bpm`, cor: "#d97706" });
  }

  const pa = String(at.pa || p.pa || "");
  const match = pa.match(/^(\d{2,3})\s*[/x]\s*(\d{2,3})$/);
  if (match) {
    const [, sis, dia] = match.map(Number);
    if (sis >= 180 || dia >= 110) alertas.push({ label: `PA ${pa} (crise)`, cor: "#dc2626" });
    else if (sis >= 140 || dia >= 90) alertas.push({ label: `PA ${pa} (alta)`, cor: "#d97706" });
    else if (sis < 90) alertas.push({ label: `PA ${pa} (baixa)`, cor: "#2563eb" });
  }

  const gli = Number(p.glicemia || 0);
  if (gli > 0) {
    if (gli > 300 || gli < 60) alertas.push({ label: `Glicemia ${gli}`, cor: "#dc2626" });
    else if (gli > 200 || gli < 70) alertas.push({ label: `Glicemia ${gli}`, cor: "#d97706" });
  }

  return alertas;
}

// ── Principal ──────────────────────────────────────────────────────────────────

export default function Enfermagem({
  consultas = [],
  pacientes = [],
  procedimentosOdonto = [],
  onRefresh,
  onEncaminharParaPagamento,
}) {
  const { userData } = useAuth();
  const toast = useToast();

  const [aba, setAba] = useState("triagem");
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [modalProcAberto, setModalProcAberto] = useState(false);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("aguardando");

  const hoje = hojeISO();

  // Fluxo Enfermagem/Triagem (Fase 6):
  //
  //   1) Recepção move o atendimento para `aguardando` (após pagamento confirmado).
  //      Esse já é o gate atual do sistema — não há mudança no fluxo da recepção.
  //   2) Enfermagem vê todos os atendimentos clínicos do dia com status
  //      `aguardando`/`presente` — não filtra por tipo. Aqui a enfermagem decide
  //      se vai triagar, registrar sinais vitais ou apenas encaminhar.
  //   3) Após registrar a triagem, o atendimento permanece `aguardando` (visível
  //      para o médico já com sinais vitais preenchidos) ou pode ser
  //      explicitamente liberado pelo botão "Liberar para consulta".
  //   4) Procedimentos de enfermagem/estética (tipoAtendimento começa com
  //      "procedimento" ou contém "enfermagem") aparecem na aba "Procedimentos".
  const atendimentos = useMemo(
    () => consultas.filter((c) => {
      if (c.data !== hoje) return false;
      const tipo = (c.tipoAtendimento || "").toLowerCase();
      if (aba === "procedimentos") {
        return tipo.startsWith("procedimento") || tipo.includes("enfermagem");
      }
      // Aba "triagem": atendimentos clínicos normais aguardando/presente.
      return ["aguardando", "confirmado", "presente", "em_atendimento", "finalizado"].includes(c.status);
    }),
    [consultas, hoje, aba]
  );

  const pacienteMap = useMemo(() => {
    const map = {};
    pacientes.forEach((p) => { map[p.id] = p; });
    return map;
  }, [pacientes]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      await onRefresh?.();
    } catch {
      toast.error("Não foi possível atualizar os atendimentos.");
    } finally {
      setCarregando(false);
    }
  }, [onRefresh, toast]);

  async function salvarTriagem(id, dadosTriagem) {
    // Endpoint dedicado de triagem (F6) — não bate no gate clínico do médico.
    await api.atendimentos.triagem(id, {
      peso:      dadosTriagem.peso      ? Number(dadosTriagem.peso)      : null,
      altura:    dadosTriagem.altura    ? Number(dadosTriagem.altura)    : null,
      pa:        dadosTriagem.pa        || null,
      temp:      dadosTriagem.temp      ? Number(dadosTriagem.temp)      : null,
      saturacao: dadosTriagem.saturacao ? Number(dadosTriagem.saturacao) : null,
      freq_cardiaca:          dadosTriagem.freq_cardiaca,
      freq_respiratoria:      dadosTriagem.freq_respiratoria,
      glicemia:               dadosTriagem.glicemia,
      queixa_principal:       dadosTriagem.queixa_principal,
      alergias:               dadosTriagem.alergias,
      medicamentos_uso:       dadosTriagem.medicamentos_uso,
      classificacao_risco:    dadosTriagem.classificacao_risco,
      observacoes_enfermagem: dadosTriagem.observacoes_enfermagem,
    });

    toast.success("Triagem salva com sucesso.");
    await carregar();
  }

  async function finalizarProcedimento({ nomePaciente, cpf, selecionados, evolucao, formaPagamento, valorTotal }) {
    const descricao = selecionados.map((p) => p.nome || p.name).join(", ") || "Procedimento de enfermagem";

    const pagRes = await api.pagamentos.criar({
      nome_paciente:    nomePaciente,
      descricao,
      servico:          "Procedimento/Estética",
      valor:            valorTotal,
      desconto:         0,
      valor_final:      valorTotal,
      status:           "pago",
      status_pagamento: "Pago",
      forma_pagamento:  formaPagamento,
      tipo:             "Entrada",
      origem:           "enfermagem",
      profissional:     userData?.nome || "",
      data:             hoje,
      data_pagamento:   hoje,
      observacoes:      evolucao || "",
      cpf_paciente:     cpf || "",
    });

    const pagId = pagRes?.data?.id;

    toast.success(`Procedimento finalizado. Pagamento de ${valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} registrado.`);

    if (onEncaminharParaPagamento && pagId) {
      onEncaminharParaPagamento({
        pagamentoId:     pagId,
        atendimentoId:   null,
        paciente:        nomePaciente,
        cpf:             cpf || "",
        tipoAtendimento: `Procedimento/Estética — ${descricao.slice(0, 60)}`,
        profissional:    userData?.nome || "",
        valor:           valorTotal,
        descricao,
        tipo:            "enfermagem",
      });
    }
  }

  // Triagem registrada: backend grava em prontuario.triagem.triagem_em (objeto aninhado).
  // Fallback ao formato antigo (raiz) caso existam registros legados.
  const foiTriado = (a) => !!(a.prontuario?.triagem?.triagem_em || a.prontuario?.triagem_em);
  // Classificação de risco: backend novo grava em prontuario.triagem.classificacao_risco.
  const classifRisco = (a) => a.prontuario?.triagem?.classificacao_risco || a.prontuario?.classificacao_risco;
  // Queixa principal: backend novo grava em prontuario.triagem.queixa_principal.
  const queixaPrincipal = (a) => a.prontuario?.triagem?.queixa_principal || a.prontuario?.queixa_principal;

  const filtrados = atendimentos.filter((a) => {
    const nome = (a.paciente || a.nomePaciente || "").toLowerCase();
    if (filtroBusca && !nome.includes(filtroBusca.toLowerCase())) return false;
    if (filtroStatus === "aguardando")     return ["aguardando", "confirmado", "presente"].includes(a.status);
    if (filtroStatus === "em_atendimento") return a.status === "em_atendimento";
    if (filtroStatus === "finalizado")     return a.status === "finalizado";
    if (filtroStatus === "triados")        return foiTriado(a);
    return true;
  });

  const ordenados = [...filtrados].sort((a, b) => {
    const ra = ORDEM_RISCO[classifRisco(a)] ?? 99;
    const rb = ORDEM_RISCO[classifRisco(b)] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.hora || "").localeCompare(b.hora || "");
  });

  const contadores = {
    total:         atendimentos.length,
    aguardando:    atendimentos.filter((a) => ["aguardando", "confirmado", "presente"].includes(a.status)).length,
    emAtendimento: atendimentos.filter((a) => a.status === "em_atendimento").length,
    finalizados:   atendimentos.filter((a) => a.status === "finalizado").length,
    triados:       atendimentos.filter(foiTriado).length,
  };

  const atendimentoSelecionado = selecionado
    ? atendimentos.find((a) => a.id === selecionado)
    : null;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1040, margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Enfermagem</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
          {hoje.split("-").reverse().join("/")}
        </p>
      </div>

      {/* Seletor de modo */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        background: "#f1f5f9", borderRadius: 10, padding: 4, width: "fit-content",
      }}>
        {[
          { valor: "triagem",       label: "Triagem de pacientes",   Icone: Stethoscope },
          { valor: "procedimentos", label: "Procedimentos / Estética", Icone: Sparkles },
        ].map((t) => (
          <button
            key={t.valor}
            onClick={() => setAba(t.valor)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: aba === t.valor ? "#fff" : "transparent",
              color: aba === t.valor ? "#0f172a" : "#64748b",
              fontWeight: aba === t.valor ? 700 : 500,
              fontSize: 13, cursor: "pointer",
              boxShadow: aba === t.valor ? "0 1px 4px rgba(0,0,0,.1)" : "none",
              transition: "all .15s",
            }}
          >
            <t.Icone size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── ABA TRIAGEM ────────────────────────────────────────────────────── */}
      {aba === "triagem" && (
        <>
          {/* KPIs — clicáveis para alinhar contador com a lista filtrada */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total hoje",     valor: contadores.total,         cor: "#6366f1", bg: "#eef2ff", filtro: "todos" },
              { label: "Aguardando",     valor: contadores.aguardando,    cor: "#f59e0b", bg: "#fffbeb", filtro: "aguardando" },
              { label: "Em atendimento", valor: contadores.emAtendimento, cor: "#10b981", bg: "#ecfdf5", filtro: "em_atendimento" },
              { label: "Triados",        valor: contadores.triados,       cor: "#2563eb", bg: "#eff6ff", filtro: "triados" },
            ].map((k) => {
              const ativo = filtroStatus === k.filtro;
              return (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => setFiltroStatus(k.filtro)}
                  style={{
                    textAlign: "left",
                    background: k.bg, borderRadius: 10, padding: "14px 18px",
                    borderLeft: `4px solid ${k.cor}`,
                    border: ativo ? `2px solid ${k.cor}` : `1px solid ${k.cor}30`,
                    borderLeftWidth: 4, borderLeftColor: k.cor,
                    boxShadow: ativo ? `0 0 0 3px ${k.cor}22` : "none",
                    cursor: "pointer", transition: "all .15s",
                  }}
                  title={`Filtrar por ${k.label}`}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: k.cor }}>{k.label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: "#111827" }}>{k.valor}</p>
                </button>
              );
            })}
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              type="text" value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar paciente..."
              style={{ flex: 1, minWidth: 180, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none" }}
            />
            {[
              { valor: "aguardando",     label: `Aguardando (${contadores.aguardando})` },
              { valor: "em_atendimento", label: `Em atendimento (${contadores.emAtendimento})` },
              { valor: "triados",        label: `Triados (${contadores.triados})` },
              { valor: "finalizado",     label: `Finalizados (${contadores.finalizados})` },
              { valor: "todos",          label: `Todos (${contadores.total})` },
            ].map((f) => (
              <button key={f.valor} onClick={() => setFiltroStatus(f.valor)} style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: filtroStatus === f.valor ? "2px solid #2563eb" : "1px solid #d1d5db",
                background: filtroStatus === f.valor ? "#eff6ff" : "#fff",
                color: filtroStatus === f.valor ? "#2563eb" : "#374151",
              }}>{f.label}</button>
            ))}
            <button onClick={carregar} style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db",
              background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151",
            }}>↻ Atualizar</button>
          </div>

          {/* Lista */}
          {carregando ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 15 }}>Carregando atendimentos...</div>
          ) : ordenados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🏥</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                {filtroStatus === "aguardando" && contadores.aguardando === 0
                  ? "0 aguardando triagem"
                  : "Nenhum atendimento encontrado"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                {filtroBusca
                  ? `Nenhum resultado para "${filtroBusca}".`
                  : contadores.total === 0
                  ? "Os atendimentos chegam da recepção e aparecerão aqui."
                  : `Distribuição de hoje: ${contadores.aguardando} aguardando · ${contadores.emAtendimento} em atendimento · ${contadores.triados} triados · ${contadores.finalizados} finalizados.`}
              </div>
              {/* Atalhos para abas com pacientes — não obriga o usuário a achar onde tem gente. */}
              {contadores.total > 0 && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
                  {[
                    { v: "aguardando",     l: `Ver aguardando (${contadores.aguardando})`,         n: contadores.aguardando },
                    { v: "em_atendimento", l: `Ver em atendimento (${contadores.emAtendimento})`, n: contadores.emAtendimento },
                    { v: "finalizado",     l: `Ver finalizados (${contadores.finalizados})`,       n: contadores.finalizados },
                    { v: "todos",          l: `Ver todos (${contadores.total})`,                   n: contadores.total },
                  ].filter((b) => b.n > 0 && b.v !== filtroStatus).map((b) => (
                    <button key={b.v} onClick={() => setFiltroStatus(b.v)} style={{
                      padding: "6px 14px", borderRadius: 8, border: "1px solid #2563eb",
                      background: "#eff6ff", color: "#1e40af", cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                    }}>{b.l}</button>
                  ))}
                </div>
              )}
              <button
                onClick={carregar}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}
              >
                ↻ Atualizar lista
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ordenados.map((at) => {
                const pac = pacienteMap[at.pacienteId];
                const triado = foiTriado(at);
                const risco = classifRisco(at);
                const queixa = queixaPrincipal(at);
                const riscoInfo = CLASSIFICACOES_RISCO.find((r) => r.valor === risco);
                const alertasVitais = triado ? analisarSinaisVitais(at) : [];

                return (
                  <div key={at.id} style={{
                    background: "#fff", borderRadius: 10,
                    border: `1px solid ${riscoInfo ? riscoInfo.cor + "40" : "#e5e7eb"}`,
                    borderLeft: `4px solid ${riscoInfo ? riscoInfo.cor : "#e5e7eb"}`,
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 16,
                    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                  }}>
                    <div style={{ minWidth: 48, textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#374151" }}>
                        {formatarHora(at.hora)}
                      </p>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                          {at.paciente || at.nomePaciente || "—"}
                        </span>
                        <StatusBadge status={at.status} />
                        {triado && <BadgeRisco valor={risco} />}
                        {triado && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#10b981", fontWeight: 600 }}><Check size={11} />Triado</span>}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280", display: "flex", gap: 14, flexWrap: "wrap" }}>
                        {at.tipoAtendimento && <span>{at.tipoAtendimento}</span>}
                        {at.medico && <span>Dr(a). {at.medico}</span>}
                        {pac && calcularIdade(pac.dataNascimento) != null && (
                          <span>{calcularIdade(pac.dataNascimento)} anos</span>
                        )}
                        {queixa && (
                          <span style={{ fontStyle: "italic" }}>
                            Queixa: {queixa.slice(0, 60)}{queixa.length > 60 ? "…" : ""}
                          </span>
                        )}
                      </div>
                      {triado && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#374151", display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {at.pa        && <span>PA: {at.pa}</span>}
                          {at.temp      && <span>Temp: {at.temp}°C</span>}
                          {at.saturacao && <span>SpO₂: {at.saturacao}%</span>}
                          {at.peso      && <span>Peso: {at.peso} kg</span>}
                          {(at.prontuario?.triagem?.freq_cardiaca || at.prontuario?.freq_cardiaca) && (
                            <span>FC: {at.prontuario?.triagem?.freq_cardiaca || at.prontuario?.freq_cardiaca} bpm</span>
                          )}
                        </div>
                      )}
                      {alertasVitais.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {alertasVitais.map((a, i) => (
                            <span key={i} style={{ fontSize: 11, fontWeight: 700, color: a.cor, background: a.cor + "18", border: `1px solid ${a.cor}50`, padding: "2px 8px", borderRadius: 999 }}>
                              ⚠ {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <button onClick={() => setSelecionado(at.id)} style={{
                        padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: triado ? "#e0e7ff" : "#2563eb",
                        color: triado ? "#4338ca" : "#fff",
                        fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                      }}>
                        {triado ? "Editar triagem" : "Realizar triagem"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {atendimentoSelecionado && (
            <ModalTriagem
              atendimento={atendimentoSelecionado}
              paciente={pacienteMap[atendimentoSelecionado.pacienteId]}
              onFechar={() => setSelecionado(null)}
              onSalvar={salvarTriagem}
            />
          )}
        </>
      )}

      {/* ── ABA PROCEDIMENTOS / ESTÉTICA ───────────────────────────────────── */}
      {aba === "procedimentos" && (
        <div>
          <div style={{
            background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
            borderRadius: 14, padding: "18px 22px", marginBottom: 24,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,.65)" }}>
                Procedimentos / Estética
              </p>
              <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "#fff" }}>
                Registrar atendimento de enfermagem
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,.8)" }}>
                Selecione os procedimentos realizados, informe a evolução e finalize enviando para pagamento.
              </p>
            </div>
            <button
              onClick={() => setModalProcAberto(true)}
              style={{
                padding: "10px 22px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,.4)",
                background: "rgba(255,255,255,.18)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              + Novo procedimento
            </button>
          </div>

          {procedimentosOdonto.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 24px",
              background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db",
            }}>
              <Sparkles size={40} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>
                Nenhum procedimento cadastrado
              </p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "6px 0 0" }}>
                Cadastre procedimentos no módulo de Odontologia ou em Configurações para disponibilizá-los aqui.
              </p>
              <button
                onClick={() => setModalProcAberto(true)}
                style={{
                  marginTop: 16, padding: "9px 22px", borderRadius: 8, border: "none",
                  background: "#0f766e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Registrar procedimento manual
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  Procedimentos disponíveis ({procedimentosOdonto.length})
                </h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
                {procedimentosOdonto.slice(0, 12).map((proc) => (
                  <div key={proc.id} style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                    padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{proc.nome || proc.name}</p>
                      {proc.descricao && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{proc.descricao}</p>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", marginLeft: 8 }}>
                      {Number(proc.valor || proc.preco || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setModalProcAberto(true)}
                style={{
                  marginTop: 16, width: "100%", padding: "10px", borderRadius: 9,
                  border: "2px dashed #0f766e", background: "transparent",
                  color: "#0f766e", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                + Registrar novo atendimento
              </button>
            </div>
          )}
        </div>
      )}

      {modalProcAberto && (
        <ModalProcedimento
          procedimentosDisponiveis={procedimentosOdonto}
          onFechar={() => setModalProcAberto(false)}
          onFinalizar={async (dados) => {
            try {
              await finalizarProcedimento(dados);
            } catch (e) {
              toast.error(e?.data?.detail || e?.message || "Não foi possível registrar o procedimento.");
              throw e;
            }
          }}
        />
      )}
    </div>
  );
}
