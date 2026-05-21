import { useState, useMemo } from "react";
import { useCadastros } from "../context/CadastrosContext";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import {
  Database, Star, Smile, Sparkles, Stethoscope,
  Search, Plus, Pencil, Trash2, X, Filter,
  Activity, DollarSign, BookOpen, ChevronRight,
} from "lucide-react";

const CAT_BADGE = {
  Respiratório:   "badge-info",
  Cardiovascular: "badge-danger",
  Digestivo:      "badge-warning",
  Endócrino:      "badge-purple",
  Mental:         "badge-info",
  Neurológico:    "badge-teal",
  Osteomuscular:  "badge-success",
  Infecciosas:    "badge-orange",
  Geniturinário:  "badge-orange",
  Gestação:       "badge-purple",
  Pele:           "badge-success",
  Olhos:          "badge-teal",
  Sintomas:       "badge-neutral",
  "Z-Codes":      "badge-neutral",
  Neoplasias:     "badge-danger",
  Hematologia:    "badge-warning",
  Facial:          "badge-purple",
  Corporal:        "badge-info",
  Capilar:         "badge-teal",
  Injeções:        "badge-orange",
  Laser:           "badge-danger",
  Preenchimento:   "badge-purple",
  Bioestimuladores:"badge-success",
};

const CAT_DOT = {
  Respiratório:   "#3b82f6",
  Cardiovascular: "#ef4444",
  Digestivo:      "#f59e0b",
  Endócrino:      "#8b5cf6",
  Mental:         "#6366f1",
  Neurológico:    "#14b8a6",
  Osteomuscular:  "#22c55e",
  Infecciosas:    "#f97316",
  Geniturinário:  "#f97316",
  Gestação:       "#a855f7",
  Pele:           "#10b981",
  Olhos:          "#0d9488",
  Sintomas:       "#94a3b8",
  "Z-Codes":      "#94a3b8",
  Neoplasias:     "#ef4444",
  Hematologia:    "#f59e0b",
};

const CATS_CID = [
  "Respiratório","Cardiovascular","Digestivo","Endócrino","Mental",
  "Neurológico","Osteomuscular","Infecciosas","Geniturinário","Gestação",
  "Pele","Olhos","Sintomas","Z-Codes","Neoplasias","Hematologia","Outros",
];
const CATS_ESTETICO = ["Facial","Corporal","Capilar","Injeções","Laser","Preenchimento","Bioestimuladores","Outros"];

export default function Cadastros({ procedimentosOdonto = [], onRefreshProcedimentosOdonto }) {
  const toast = useToast();
  const {
    cids, procedimentosEsteticos, especialidadesExtras,
    adicionarCid, atualizarCid, removerCid,
    adicionarEstetico, atualizarEstetico, removerEstetico,
    adicionarEspecialidadeExtra, removerEspecialidadeExtra,
  } = useCadastros();

  const [aba, setAba]           = useState("cids");
  const [busca, setBusca]       = useState("");
  const [catFiltro, setCatFiltro] = useState("");

  // CID
  const [cidForm, setCidForm]         = useState({ codigo: "", descricao: "", categoria: "Respiratório" });
  const [cidEditando, setCidEditando] = useState(null);
  const [showCidForm, setShowCidForm] = useState(false);

  // Especialidades
  const [espTipo, setEspTipo] = useState("medico");
  const [espNome, setEspNome] = useState("");

  // Odonto
  const [odoForm, setOdoForm]         = useState({ nome: "", categoria: "", valor: "" });
  const [odoEditando, setOdoEditando] = useState(null);
  const [showOdoForm, setShowOdoForm] = useState(false);
  const [odoLoading, setOdoLoading]   = useState(false);

  // Estético
  const [estForm, setEstForm]         = useState({ nome: "", categoria: "Facial", valor: "" });
  const [estEditando, setEstEditando] = useState(null);
  const [showEstForm, setShowEstForm] = useState(false);
  const [buscaEst, setBuscaEst]       = useState("");

  // Categorias únicas presentes nos CIDs
  const catsCidPresentes = useMemo(() => {
    const s = new Set(cids.map((c) => c.categoria).filter(Boolean));
    return [...s].sort();
  }, [cids]);

  const cidsFiltrados = useMemo(() => {
    let lista = cids;
    if (catFiltro) lista = lista.filter((c) => c.categoria === catFiltro);
    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter((c) =>
        c.codigo.toLowerCase().includes(t) ||
        c.descricao.toLowerCase().includes(t) ||
        (c.categoria || "").toLowerCase().includes(t)
      );
    }
    return lista;
  }, [cids, busca, catFiltro]);

  const estFiltrados = useMemo(() => {
    if (!buscaEst.trim()) return procedimentosEsteticos;
    const t = buscaEst.toLowerCase();
    return procedimentosEsteticos.filter((p) =>
      p.nome.toLowerCase().includes(t) ||
      (p.categoria || "").toLowerCase().includes(t)
    );
  }, [procedimentosEsteticos, buscaEst]);

  const totalEsteticos = useMemo(() =>
    procedimentosEsteticos.reduce((s, p) => s + Number(p.valor || 0), 0),
  [procedimentosEsteticos]);

  // ── CID CRUD ────────────────────────────────────────────────────────────────
  function salvarCid() {
    if (!cidForm.codigo.trim() || !cidForm.descricao.trim()) return;
    if (cidEditando) {
      atualizarCid(cidEditando, { descricao: cidForm.descricao, categoria: cidForm.categoria });
      setCidEditando(null);
    } else {
      if (cids.some((c) => c.codigo === cidForm.codigo.trim().toUpperCase())) return;
      adicionarCid({ ...cidForm, codigo: cidForm.codigo.trim().toUpperCase() });
    }
    setCidForm({ codigo: "", descricao: "", categoria: "Respiratório" });
    setShowCidForm(false);
  }

  function editarCid(c) {
    setCidForm({ codigo: c.codigo, descricao: c.descricao, categoria: c.categoria || "Respiratório" });
    setCidEditando(c.id);
    setShowCidForm(true);
  }

  // ── Odonto CRUD (API) ───────────────────────────────────────────────────────
  async function salvarOdonto() {
    if (!odoForm.nome.trim()) return;
    try {
      setOdoLoading(true);
      const payload = {
        nome:      odoForm.nome.trim(),
        categoria: odoForm.categoria.trim(),
        valor:     odoForm.valor ? Number(odoForm.valor) : null,
      };
      if (odoEditando) {
        await api.procedimentosOdonto.atualizar(odoEditando, payload);
        setOdoEditando(null);
      } else {
        await api.procedimentosOdonto.criar(payload);
      }
      await onRefreshProcedimentosOdonto?.();
      setOdoForm({ nome: "", categoria: "", valor: "" });
      setShowOdoForm(false);
    } catch (e) {
      console.error("Erro ao salvar procedimento odonto:", e);
    } finally {
      setOdoLoading(false);
    }
  }

  async function excluirOdonto(id) {
    if (!await toast.confirm("Excluir este procedimento odontológico?")) return;
    try {
      setOdoLoading(true);
      await api.procedimentosOdonto.excluir(id);
      await onRefreshProcedimentosOdonto?.();
    } catch (e) {
      console.error("Erro ao excluir procedimento odonto:", e);
    } finally {
      setOdoLoading(false);
    }
  }

  function editarOdonto(p) {
    setOdoForm({ nome: p.nome || "", categoria: p.categoria || "", valor: p.valor != null ? String(p.valor) : "" });
    setOdoEditando(p.id);
    setShowOdoForm(true);
  }

  // ── Estético CRUD ───────────────────────────────────────────────────────────
  function salvarEstetico() {
    if (!estForm.nome.trim()) return;
    if (estEditando) {
      atualizarEstetico(estEditando, estForm);
      setEstEditando(null);
    } else {
      adicionarEstetico({ ...estForm });
    }
    setEstForm({ nome: "", categoria: "Facial", valor: "" });
    setShowEstForm(false);
  }

  function editarEstetico(p) {
    setEstForm({ nome: p.nome, categoria: p.categoria || "Facial", valor: p.valor || "" });
    setEstEditando(p.id);
    setShowEstForm(true);
  }

  function trocarAba(key) { setAba(key); setBusca(""); setCatFiltro(""); setBuscaEst(""); }

  const TABS = [
    { key: "cids",           label: "CIDs",            count: cids.length,                   icon: <Database size={14}/>,    color: "var(--primary)" },
    { key: "especialidades", label: "Especialidades",  count: null,                           icon: <Star size={14}/>,        color: "var(--secondary)" },
    { key: "odonto",         label: "Proc. Odonto",    count: procedimentosOdonto.length,     icon: <Smile size={14}/>,       color: "var(--primary)" },
    { key: "esteticos",      label: "Proc. Estéticos", count: procedimentosEsteticos.length,  icon: <Sparkles size={14}/>,    color: "var(--purple)" },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1140px", margin: "0 auto" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, var(--sidebar-bg) 0%, #2D1B69 55%, var(--primary) 100%)",
        borderRadius: "var(--r-xl)",
        padding: "24px 28px",
        marginBottom: "24px",
        color: "#fff",
        boxShadow: "var(--sh-lg)",
        display: "flex",
        alignItems: "center",
        gap: "18px",
      }}>
        <div style={{
          width: "54px", height: "54px",
          borderRadius: "var(--r-lg)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Database size={24} color="#C4B5FD" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}>Cadastros</h1>
          <p style={{ margin: "3px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.72)" }}>
            Gerencie CIDs, procedimentos e especialidades disponíveis no sistema
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flexShrink: 0 }}>
          {[
            { label: `${cids.length} CIDs`,                  color: "#C4B5FD", sub: `${catsCidPresentes.length} categorias` },
            { label: `${procedimentosOdonto.length} Odonto`,  color: "#60a5fa", sub: "procedimentos" },
            { label: `${procedimentosEsteticos.length} Estéticos`, color: "#c084fc", sub: "procedimentos" },
          ].map((chip) => (
            <div key={chip.label} style={{
              padding: "8px 14px",
              borderRadius: "var(--r-md)",
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: chip.color }}>{chip.label}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginTop: "1px" }}>{chip.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="patients-tabs" style={{ marginBottom: "20px" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`patients-tab${aba === t.key ? " active" : ""}`}
            onClick={() => trocarAba(t.key)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            {t.icon}
            {t.label}
            {t.count !== null && (
              <span style={{
                fontSize: "10px", fontWeight: 700,
                background: aba === t.key ? "var(--primary)" : "#e2e8f0",
                color: aba === t.key ? "#fff" : "#64748b",
                borderRadius: "var(--r-full)", padding: "1px 7px",
                minWidth: "20px", textAlign: "center",
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════ ABA CIDs ══════════════════ */}
      {aba === "cids" && (
        <div className="page-card" style={{ padding: 0, overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "#fff",
            borderTop: "3px solid var(--primary)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "var(--r-md)",
                  background: "var(--primary-light)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Database size={16} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>Catálogo CID-10</div>
                  <div style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: "1px" }}>
                    {cidsFiltrados.length} de {cids.length} código{cids.length !== 1 ? "s" : ""} · {catsCidPresentes.length} categorias
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                  <input
                    className="input"
                    style={{ paddingLeft: "30px", width: "220px", height: "34px", fontSize: "13px" }}
                    placeholder="Buscar código ou descrição..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setCidEditando(null); setCidForm({ codigo: "", descricao: "", categoria: "Respiratório" }); setShowCidForm(true); }}
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <Plus size={13} /> Adicionar CID
                </button>
              </div>
            </div>

            {/* Filtros por categoria */}
            <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <Filter size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <button
                onClick={() => setCatFiltro("")}
                style={{
                  padding: "3px 10px", borderRadius: "var(--r-full)", fontSize: "11px", fontWeight: 600,
                  border: "1px solid",
                  borderColor: catFiltro === "" ? "var(--primary)" : "var(--border)",
                  background: catFiltro === "" ? "var(--primary)" : "#fff",
                  color: catFiltro === "" ? "#fff" : "var(--text-soft)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                Todas ({cids.length})
              </button>
              {catsCidPresentes.map((cat) => {
                const count = cids.filter((c) => c.categoria === cat).length;
                const isAtivo = catFiltro === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCatFiltro(isAtivo ? "" : cat)}
                    style={{
                      padding: "3px 10px", borderRadius: "var(--r-full)", fontSize: "11px", fontWeight: 600,
                      border: "1px solid",
                      borderColor: isAtivo ? (CAT_DOT[cat] || "var(--primary)") : "var(--border)",
                      background: isAtivo ? (CAT_DOT[cat] || "var(--primary)") : "#fff",
                      color: isAtivo ? "#fff" : "var(--text-soft)",
                      cursor: "pointer", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}
                  >
                    <span style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: isAtivo ? "rgba(255,255,255,0.7)" : (CAT_DOT[cat] || "#94a3b8"),
                      flexShrink: 0,
                    }} />
                    {cat} <span style={{ opacity: 0.75 }}>({count})</span>
                  </button>
                );
              })}
              {catFiltro && (
                <button
                  onClick={() => setCatFiltro("")}
                  style={{
                    padding: "3px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                    border: "1px solid var(--border)", background: "#fff", color: "var(--text-soft)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "3px",
                  }}
                >
                  <X size={10} /> Limpar
                </button>
              )}
            </div>
          </div>

          {/* Form inline */}
          {showCidForm && (
            <div style={{
              padding: "20px",
              background: "var(--primary-light)",
              borderBottom: "1px solid var(--border)",
              borderLeft: "4px solid var(--primary)",
            }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <BookOpen size={14} />
                {cidEditando ? "Editar CID" : "Novo CID"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 200px", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Código CID-10 *</label>
                  <input
                    className="input"
                    placeholder="Ex: J06.9"
                    value={cidForm.codigo}
                    disabled={!!cidEditando}
                    style={cidEditando ? { background: "#e8f5f1", color: "#64748b" } : {}}
                    onChange={(e) => setCidForm((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Descrição *</label>
                  <input
                    className="input"
                    placeholder="Descrição do diagnóstico"
                    value={cidForm.descricao}
                    onChange={(e) => setCidForm((p) => ({ ...p, descricao: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Categoria</label>
                  <select className="select" value={cidForm.categoria} onChange={(e) => setCidForm((p) => ({ ...p, categoria: e.target.value }))}>
                    {CATS_CID.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-primary btn-sm" onClick={salvarCid}>
                  {cidEditando ? "Salvar alterações" : "Adicionar CID"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowCidForm(false); setCidEditando(null); }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "110px" }}>Código</th>
                  <th>Descrição</th>
                  <th style={{ width: "160px" }}>Categoria</th>
                  <th style={{ textAlign: "right", width: "130px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cidsFiltrados.length === 0 ? (
                  <tr><td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <p className="empty-state-title">Nenhum CID encontrado</p>
                      <p className="empty-state-text">Tente outro termo ou remova os filtros.</p>
                    </div>
                  </td></tr>
                ) : cidsFiltrados.map((c) => (
                  <tr key={c.codigo}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                          background: CAT_DOT[c.categoria] || "#94a3b8", flexShrink: 0,
                        }} />
                        <span style={{
                          fontWeight: 800, fontFamily: "monospace", fontSize: "12px",
                          color: "var(--primary)", letterSpacing: "0.04em",
                          background: "var(--primary-light)", padding: "2px 7px", borderRadius: "5px",
                        }}>
                          {c.codigo}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--text)" }}>{c.descricao}</td>
                    <td>
                      <span className={`badge ${CAT_BADGE[c.categoria] || "badge-neutral"}`} style={{ fontSize: "11px" }}>
                        {c.categoria || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => editarCid(c)}
                          style={{ display: "flex", alignItems: "center", gap: "3px" }}
                        >
                          <Pencil size={10} /> Editar
                        </button>
                        <button
                          className="btn btn-xs"
                          onClick={async () => {
                            if (!window.confirm(`Remover CID ${c.codigo}?`)) return;
                            try { await removerCid(c.id); }
                            catch (err) { toast.error(err.message || 'Não foi possível remover o CID.'); }
                          }}
                          style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", display: "flex", alignItems: "center", gap: "3px" }}
                        >
                          <Trash2 size={10} /> Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ ABA Especialidades ══════════════════ */}
      {aba === "especialidades" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {(["medico", "odonto"]).map((tipo) => {
            const lista = especialidadesExtras[tipo] || [];
            const isMedico = tipo === "medico";
            const label = isMedico ? "Especialidades Médicas Extras" : "Especialidades Odontológicas Extras";
            const ph    = isMedico ? "Ex: Medicina Esportiva" : "Ex: Implantodontia";
            const accent = isMedico ? "var(--secondary)" : "var(--primary)";
            const accentLight = isMedico ? "var(--secondary-light)" : "var(--primary-light)";
            return (
              <div key={tipo} className="page-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  background: "#fff",
                  borderTop: `3px solid ${accent}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "38px", height: "38px", borderRadius: "var(--r-md)",
                      background: accentLight,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isMedico ? <Stethoscope size={16} color={accent}/> : <Smile size={16} color={accent}/>}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{label}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: "1px" }}>
                        {lista.length} especialidade{lista.length !== 1 ? "s" : ""} extra{lista.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder={ph}
                      value={espTipo === tipo ? espNome : ""}
                      onChange={(e) => { setEspTipo(tipo); setEspNome(e.target.value); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && espNome.trim() && espTipo === tipo) {
                          adicionarEspecialidadeExtra(tipo, espNome.trim());
                          setEspNome("");
                        }
                      }}
                    />
                    <button
                      className="btn btn-sm"
                      style={{ background: accent, color: "#fff", display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}
                      onClick={() => {
                        if (espNome.trim()) {
                          adicionarEspecialidadeExtra(tipo, espNome.trim());
                          setEspTipo(tipo); setEspNome("");
                        }
                      }}
                    >
                      <Plus size={13} /> Adicionar
                    </button>
                  </div>

                  {lista.length === 0 ? (
                    <div style={{
                      textAlign: "center", padding: "32px 16px",
                      background: accentLight, borderRadius: "var(--r-md)",
                    }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>✨</div>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-soft)", fontWeight: 500 }}>
                        Nenhuma especialidade cadastrada
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                        Digite acima e pressione Enter ou clique em Adicionar
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto" }}>
                      {lista.map((item, idx) => (
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "#fff",
                          borderRadius: "var(--r-md)",
                          border: "1px solid var(--border)",
                          boxShadow: "var(--sh-xs)",
                          transition: "box-shadow 0.15s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{
                              width: "26px", height: "26px", borderRadius: "50%",
                              background: accentLight,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "11px", fontWeight: 700, color: accent,
                              flexShrink: 0,
                            }}>
                              {idx + 1}
                            </div>
                            <span style={{ fontSize: "13px", color: "var(--text)", fontWeight: 500 }}>{item.nome}</span>
                          </div>
                          <button
                            className="btn btn-xs"
                            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", display: "flex", alignItems: "center", gap: "3px" }}
                            onClick={async () => {
                              if (!window.confirm(`Remover especialidade "${item.nome}"?`)) return;
                              try { await removerEspecialidadeExtra(tipo, item.id); }
                              catch (err) { toast.error(err.message || 'Não foi possível remover a especialidade.'); }
                            }}
                          >
                            <Trash2 size={10} /> Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════ ABA Proc. Odonto ══════════════════ */}
      {aba === "odonto" && (
        <div className="page-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "#fff",
            borderTop: "3px solid var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "var(--r-md)",
                background: "var(--primary-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Smile size={16} color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>Procedimentos Odontológicos</div>
                <div style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: "1px" }}>
                  {procedimentosOdonto.length} procedimento{procedimentosOdonto.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setOdoEditando(null); setOdoForm({ nome: "", categoria: "", valor: "" }); setShowOdoForm(true); }}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <Plus size={13} /> Novo Procedimento
            </button>
          </div>

          {showOdoForm && (
            <div style={{
              padding: "20px",
              background: "var(--primary-light)",
              borderBottom: "1px solid var(--border)",
              borderLeft: "4px solid var(--primary)",
            }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Smile size={14} />
                {odoEditando ? "Editar procedimento" : "Novo procedimento odontológico"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 160px", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Nome *</label>
                  <input className="input" placeholder="Ex: Extração dentária simples" value={odoForm.nome} onChange={(e) => setOdoForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Categoria</label>
                  <input className="input" placeholder="Ex: Cirurgia" value={odoForm.categoria} onChange={(e) => setOdoForm((p) => ({ ...p, categoria: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Valor (R$)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0,00" value={odoForm.valor} onChange={(e) => setOdoForm((p) => ({ ...p, valor: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-primary btn-sm" onClick={salvarOdonto} disabled={odoLoading} style={{ opacity: odoLoading ? 0.6 : 1 }}>
                  {odoLoading ? "Salvando..." : odoEditando ? "Salvar alterações" : "Adicionar procedimento"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowOdoForm(false); setOdoEditando(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Procedimento</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {procedimentosOdonto.length === 0 ? (
                  <tr><td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🦷</div>
                      <p className="empty-state-title">Nenhum procedimento cadastrado</p>
                      <p className="empty-state-text">Adicione o primeiro procedimento odontológico.</p>
                    </div>
                  </td></tr>
                ) : procedimentosOdonto.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.nome}</div>
                    </td>
                    <td>
                      {p.categoria
                        ? <span className="badge badge-teal" style={{ fontSize: "11px" }}>{p.categoria}</span>
                        : <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>—</span>}
                    </td>
                    <td>
                      {p.valor != null ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          fontWeight: 700, fontSize: "13px", color: "var(--primary)",
                          background: "var(--primary-light)", padding: "3px 10px",
                          borderRadius: "var(--r-full)",
                        }}>
                          <DollarSign size={11} />
                          {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => editarOdonto(p)} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <Pencil size={10} /> Editar
                        </button>
                        <button className="btn btn-xs" onClick={() => excluirOdonto(p.id)} style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Trash2 size={10} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ ABA Proc. Estéticos ══════════════════ */}
      {aba === "esteticos" && (
        <div className="page-card" style={{ padding: 0, overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "#fff",
            borderTop: "3px solid var(--purple)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "var(--r-md)",
                  background: "var(--purple-light)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={16} color="var(--purple)" />
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>Procedimentos Estéticos</div>
                  <div style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: "1px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{procedimentosEsteticos.length} procedimento{procedimentosEsteticos.length !== 1 ? "s" : ""}</span>
                    {totalEsteticos > 0 && (
                      <>
                        <span style={{ color: "var(--border)" }}>·</span>
                        <span style={{ color: "var(--purple)", fontWeight: 600 }}>
                          Total tabela: R$ {totalEsteticos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                  <input
                    className="input"
                    style={{ paddingLeft: "30px", width: "200px", height: "34px", fontSize: "13px" }}
                    placeholder="Buscar procedimento..."
                    value={buscaEst}
                    onChange={(e) => setBuscaEst(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--purple)", color: "#fff", display: "flex", alignItems: "center", gap: "5px" }}
                  onClick={() => { setEstEditando(null); setEstForm({ nome: "", categoria: "Facial", valor: "" }); setShowEstForm(true); }}
                >
                  <Plus size={13} /> Novo Procedimento
                </button>
              </div>
            </div>

            {/* Mini stats por categoria */}
            {procedimentosEsteticos.length > 0 && (
              <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                {CATS_ESTETICO.map((cat) => {
                  const count = procedimentosEsteticos.filter((p) => p.categoria === cat).length;
                  if (count === 0) return null;
                  return (
                    <div key={cat} style={{
                      padding: "4px 10px", borderRadius: "var(--r-full)",
                      background: "var(--purple-light)",
                      border: "1px solid rgba(155,81,224,0.2)",
                      fontSize: "11px", fontWeight: 600, color: "var(--purple)",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}>
                      <span className={`badge ${CAT_BADGE[cat] || "badge-neutral"}`} style={{ padding: "1px 6px", fontSize: "10px" }}>{cat}</span>
                      {count}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showEstForm && (
            <div style={{
              padding: "20px",
              background: "var(--purple-light)",
              borderBottom: "1px solid var(--border)",
              borderLeft: "4px solid var(--purple)",
            }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--purple)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} />
                {estEditando ? "Editar procedimento" : "Novo procedimento estético"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 160px", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Nome *</label>
                  <input className="input" placeholder="Ex: Botox / Toxina Botulínica" value={estForm.nome} onChange={(e) => setEstForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Categoria</label>
                  <select className="select" value={estForm.categoria} onChange={(e) => setEstForm((p) => ({ ...p, categoria: e.target.value }))}>
                    {CATS_ESTETICO.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)", display: "block", marginBottom: "4px" }}>Valor (R$)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0,00" value={estForm.valor} onChange={(e) => setEstForm((p) => ({ ...p, valor: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-sm" style={{ background: "var(--purple)", color: "#fff" }} onClick={salvarEstetico}>
                  {estEditando ? "Salvar alterações" : "Adicionar procedimento"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowEstForm(false); setEstEditando(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Procedimento</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {estFiltrados.length === 0 ? (
                  <tr><td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">✨</div>
                      <p className="empty-state-title">Nenhum procedimento encontrado</p>
                      <p className="empty-state-text">
                        {buscaEst ? "Tente outro termo de busca." : "Adicione o primeiro procedimento estético."}
                      </p>
                    </div>
                  </td></tr>
                ) : estFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, fontSize: "13px" }}>{p.nome}</td>
                    <td>
                      <span className={`badge ${CAT_BADGE[p.categoria] || "badge-neutral"}`} style={{ fontSize: "11px" }}>
                        {p.categoria || "—"}
                      </span>
                    </td>
                    <td>
                      {p.valor ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          fontWeight: 700, fontSize: "13px", color: "var(--purple)",
                          background: "var(--purple-light)", padding: "3px 10px",
                          borderRadius: "var(--r-full)",
                        }}>
                          <DollarSign size={11} />
                          {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => editarEstetico(p)} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <Pencil size={10} /> Editar
                        </button>
                        <button className="btn btn-xs" onClick={async () => {
                          if (!window.confirm(`Excluir procedimento "${p.nome}"?`)) return;
                          try { await removerEstetico(p.id); }
                          catch (err) { toast.error(err.message || 'Não foi possível excluir o procedimento.'); }
                        }} style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Trash2 size={10} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer com total */}
          {estFiltrados.length > 0 && (
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--background)",
              display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>Valor total da tabela:</span>
              <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--purple)" }}>
                R$ {totalEsteticos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
