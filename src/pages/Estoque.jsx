import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const CATEGORIAS = [
  "Medicamento",
  "Material Descartável",
  "Insumo Odonto",
  "EPI",
  "Limpeza",
  "Outros",
];

const UNIDADES = [
  "unidade",
  "caixa",
  "frasco",
  "ampola",
  "par",
  "rolo",
  "litro",
  "kg",
  "g",
  "ml",
  "pacote",
];

const FORM_INICIAL = {
  nome: "",
  categoria: "Material Descartável",
  unidade: "unidade",
  quantidade: "",
  minimo: "",
  fornecedor: "",
  codigoInterno: "",
  validade: "",
  precoUnitario: "",
  localizacao: "",
  observacoes: "",
};

const MOV_INICIAL = {
  tipo: "entrada",
  quantidade: "",
  motivo: "",
  estoqueId: "",
  nomeItem: "",
};

function statusItem(qtd, min) {
  const q = Number(qtd ?? 0);
  const m = Number(min ?? 0);
  if (m <= 0) return "ok";
  if (q <= m) return "critico";
  if (q <= m * 2) return "alerta";
  return "ok";
}

function badgeInfo(status) {
  const map = {
    critico: { label: "Crítico", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    alerta: { label: "Alerta", bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    ok: { label: "OK", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  };
  return map[status] || map.ok;
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diasParaVencer(validade) {
  if (!validade) return null;
  return Math.round((new Date(validade + "T00:00:00") - new Date()) / 86400000);
}

function normText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function Estoque({ estoque = [], onRefresh = () => {} }) {
  const { userData } = useAuth();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [aba, setAba] = useState("itens");
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [modalItem, setModalItem] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [modalMov, setModalMov] = useState(false);
  const [movForm, setMovForm] = useState(MOV_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    async function carregar() {
      try {
        const r = await api.estoque.listarMovimentacoes();
        setMovimentacoes(r.data || []);
      } catch { setMovimentacoes([]); }
    }
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);

  const kpis = useMemo(() => {
    const criticos = estoque.filter((i) => statusItem(i.quantidade, i.minimo) === "critico");
    const alertas = estoque.filter((i) => statusItem(i.quantidade, i.minimo) === "alerta");
    const valorTotal = estoque.reduce(
      (acc, i) => acc + Number(i.quantidade || 0) * Number(i.precoUnitario || 0),
      0
    );
    const proximosVencer = estoque.filter((i) => {
      const d = diasParaVencer(i.validade);
      return d !== null && d >= 0 && d <= 30;
    });
    return { total: estoque.length, criticos, alertas, valorTotal, proximosVencer };
  }, [estoque]);

  const itensFiltrados = useMemo(() => {
    const t = normText(busca);
    return estoque
      .filter((i) => {
        const match =
          !t ||
          normText(i.nome).includes(t) ||
          normText(i.fornecedor).includes(t) ||
          normText(i.codigoInterno).includes(t) ||
          normText(i.localizacao).includes(t);
        const catOk = filtroCategoria === "Todas" || i.categoria === filtroCategoria;
        const st = statusItem(i.quantidade, i.minimo);
        const stOk =
          filtroStatus === "Todos" ||
          (filtroStatus === "Crítico" && st === "critico") ||
          (filtroStatus === "Alerta" && st === "alerta") ||
          (filtroStatus === "OK" && st === "ok");
        return match && catOk && stOk;
      })
      .sort((a, b) => {
        const order = { critico: 0, alerta: 1, ok: 2 };
        const sa = order[statusItem(a.quantidade, a.minimo)] ?? 2;
        const sb = order[statusItem(b.quantidade, b.minimo)] ?? 2;
        if (sa !== sb) return sa - sb;
        return normText(a.nome).localeCompare(normText(b.nome));
      });
  }, [estoque, busca, filtroCategoria, filtroStatus]);

  function handleForm(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function abrirNovoItem() {
    setItemEditando(null);
    setForm(FORM_INICIAL);
    setModalItem(true);
  }

  function abrirEditarItem(item) {
    setItemEditando(item);
    setForm({
      nome: item.nome || "",
      categoria: item.categoria || "Material Descartável",
      unidade: item.unidade || "unidade",
      quantidade: String(item.quantidade ?? ""),
      minimo: String(item.minimo ?? ""),
      fornecedor: item.fornecedor || "",
      codigoInterno: item.codigoInterno || "",
      validade: item.validade || "",
      precoUnitario: item.precoUnitario != null ? String(item.precoUnitario) : "",
      localizacao: item.localizacao || "",
      observacoes: item.observacoes || "",
    });
    setModalItem(true);
  }

  async function salvarItem() {
    if (!form.nome.trim()) { alert("Informe o nome do item."); return; }
    if (form.quantidade === "" || isNaN(Number(form.quantidade))) { alert("Informe a quantidade atual."); return; }
    if (form.minimo === "" || isNaN(Number(form.minimo))) { alert("Informe o estoque mínimo."); return; }
    try {
      setSalvando(true);
      const dados = {
        nome:          form.nome.trim(),
        categoria:     form.categoria,
        unidade:       form.unidade,
        quantidade:    Number(form.quantidade),
        minimo:        Number(form.minimo),
        fornecedor:    form.fornecedor.trim(),
        codigoInterno: form.codigoInterno.trim(),
        validade:      form.validade || null,
        precoUnitario: form.precoUnitario !== "" ? Number(form.precoUnitario) : 0,
        localizacao:   form.localizacao.trim(),
        observacoes:   form.observacoes.trim(),
      };
      if (itemEditando) {
        await api.estoque.atualizar(itemEditando.id, dados);
      } else {
        await api.estoque.criar(dados);
      }
      setModalItem(false);
      await onRefresh();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar item.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirItem(item) {
    if (!window.confirm(`Excluir "${item.nome}" do estoque?`)) return;
    try {
      await api.estoque.excluir(item.id);
      await onRefresh();
    } catch (e) {
      alert("Erro ao excluir item.");
    }
  }

  function abrirMovimentacao(item, tipo = "saida") {
    setMovForm({ tipo, quantidade: "", motivo: "", estoqueId: item.id, nomeItem: item.nome });
    setModalMov(true);
  }

  async function salvarMovimentacao() {
    const qtd = Number(movForm.quantidade);
    if (!qtd || qtd <= 0) { alert("Informe uma quantidade válida."); return; }
    const item = estoque.find((i) => i.id === movForm.estoqueId);
    if (!item) { alert("Item não encontrado."); return; }
    if (movForm.tipo === "saida" && Number(item.quantidade || 0) - qtd < 0) {
      alert("Quantidade resultante seria negativa. Verifique o valor informado.");
      return;
    }
    try {
      setSalvando(true);
      await api.estoque.registrarMovimentacao({
        estoque_id:     movForm.estoqueId,
        tipo:           movForm.tipo,
        quantidade:     qtd,
        motivo:         movForm.motivo || "",
        registrado_por: userData?.nome || "Usuário",
      });
      setModalMov(false);
      await onRefresh();
    } catch (e) {
      console.error(e);
      alert("Erro ao registrar movimentação.");
    } finally {
      setSalvando(false);
    }
  }

  const pill = (label, ativo, onClick) => (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: "999px",
        border: "none",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        background: ativo ? "#0f172a" : "transparent",
        color: ativo ? "#fff" : "#64748b",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
            Estoque
          </h1>
          <p className="page-subtitle" style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Controle de materiais, medicamentos e insumos da clínica.
          </p>
        </div>
        <button
          onClick={abrirNovoItem}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(135deg, #0f172a, #1e40af)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          + Novo Item
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        {[
          {
            label: "TOTAL DE ITENS",
            valor: kpis.total,
            sub: "Itens cadastrados",
            cor: "#6366f1",
            bg: "#eef2ff",
          },
          {
            label: "ITENS CRÍTICOS",
            valor: kpis.criticos.length,
            sub: "Abaixo do mínimo",
            cor: "#dc2626",
            bg: "#fef2f2",
            destaque: kpis.criticos.length > 0,
          },
          {
            label: "ITENS EM ALERTA",
            valor: kpis.alertas.length,
            sub: "Próximos ao mínimo",
            cor: "#d97706",
            bg: "#fffbeb",
          },
          {
            label: "VALOR EM ESTOQUE",
            valor: formatarMoeda(kpis.valorTotal),
            sub: "Custo total calculado",
            cor: "#16a34a",
            bg: "#f0fdf4",
          },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "18px 20px",
              boxShadow: k.destaque
                ? "0 0 0 2px #fca5a5, 0 4px 14px rgba(220,38,38,.1)"
                : "0 0 0 1px rgba(0,0,0,.05), 0 2px 8px rgba(0,0,0,.04)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "10px",
              background: k.bg,
              marginBottom: 4,
            }}>
              <span style={{ fontSize: "18px", color: k.cor }}>
                {k.label.includes("TOTAL") && !k.label.includes("VALOR") ? "📦" :
                  k.label.includes("CRÍTI") ? "🚨" :
                    k.label.includes("ALERTA") ? "⚠️" : "💰"}
              </span>
            </div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".06em", color: "#94a3b8", textTransform: "uppercase" }}>
              {k.label}
            </span>
            <span style={{ fontSize: "26px", fontWeight: 800, color: k.cor, lineHeight: 1 }}>
              {k.valor}
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Alertas críticos ── */}
      {kpis.criticos.length > 0 && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "14px",
          padding: "14px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontSize: "16px" }}>🚨</span>
            <span style={{ fontWeight: 700, fontSize: "13px", color: "#dc2626" }}>
              {kpis.criticos.length} {kpis.criticos.length === 1 ? "item abaixo" : "itens abaixo"} do estoque mínimo — reposição necessária
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {kpis.criticos.map((i) => (
              <span
                key={i.id}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#fff",
                  border: "1px solid #fca5a5",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#dc2626",
                }}
              >
                {i.nome} — {i.quantidade} {i.unidade || "un"} (mín. {i.minimo})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="page-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "flex",
          gap: "2px",
          padding: "8px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}>
          {pill("Itens", aba === "itens", () => setAba("itens"))}
          {pill("Movimentações", aba === "movimentacoes", () => setAba("movimentacoes"))}
          {pill("Próximos a Vencer", aba === "validade", () => setAba("validade"))}
        </div>

        <div style={{ padding: "20px" }}>

          {/* ── ABA ITENS ── */}
          {aba === "itens" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Filtros */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  placeholder="Buscar por nome, fornecedor, código..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", color: "#475569" }}
                >
                  <option>Todas</option>
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", color: "#475569" }}
                >
                  <option>Todos</option>
                  <option>Crítico</option>
                  <option>Alerta</option>
                  <option>OK</option>
                </select>
                <span style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {itensFiltrados.length} de {estoque.length} itens
                </span>
              </div>

              {/* Lista de itens */}
              {itensFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📦</div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Nenhum item encontrado</p>
                  <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                    {estoque.length === 0
                      ? "Cadastre o primeiro item clicando em \"+ Novo Item\""
                      : "Tente ajustar os filtros"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {itensFiltrados.map((item) => {
                    const st = statusItem(item.quantidade, item.minimo);
                    const badge = badgeInfo(st);
                    const dias = diasParaVencer(item.validade);
                    const pct = item.minimo > 0 ? Math.min(100, (item.quantidade / (item.minimo * 3)) * 100) : 100;
                    const isExp = expandido === item.id;

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: st === "critico" ? "#fef9f9" : st === "alerta" ? "#fffdf5" : "#fff",
                          border: `1px solid ${st === "critico" ? "#fecaca" : st === "alerta" ? "#fde68a" : "#e2e8f0"}`,
                          borderRadius: "12px",
                          padding: "14px 16px",
                          cursor: "pointer",
                          transition: "box-shadow .15s",
                        }}
                        onClick={() => setExpandido(isExp ? null : item.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {/* Status bar */}
                          <div style={{
                            width: "4px",
                            height: "42px",
                            borderRadius: "999px",
                            background: st === "critico" ? "#dc2626" : st === "alerta" ? "#d97706" : "#16a34a",
                            flexShrink: 0,
                          }} />

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>{item.nome}</span>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}>{badge.label}</span>
                              {item.categoria && (
                                <span style={{ fontSize: "11px", color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: "999px" }}>
                                  {item.categoria}
                                </span>
                              )}
                              {dias !== null && dias <= 30 && (
                                <span style={{ fontSize: "11px", color: dias <= 7 ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                                  ⏰ Vence em {dias}d
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px" }}>
                              <span style={{ fontSize: "13px", color: "#475569" }}>
                                <strong style={{ color: st === "critico" ? "#dc2626" : "#0f172a", fontSize: "15px" }}>
                                  {item.quantidade}
                                </strong> {item.unidade || "un"} · mín. {item.minimo}
                              </span>
                              {item.localizacao && (
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>📍 {item.localizacao}</span>
                              )}
                              {item.fornecedor && (
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>🏭 {item.fornecedor}</span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div style={{ marginTop: "8px", height: "4px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                borderRadius: "999px",
                                width: `${pct}%`,
                                background: st === "critico" ? "#dc2626" : st === "alerta" ? "#f59e0b" : "#22c55e",
                                transition: "width .3s",
                              }} />
                            </div>
                          </div>

                          {/* Ações */}
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => abrirMovimentacao(item, "entrada")}
                              title="Registrar entrada"
                              style={btnAcao("#dcfce7", "#16a34a")}
                            >+ Entrada</button>
                            <button
                              onClick={() => abrirMovimentacao(item, "saida")}
                              title="Registrar saída"
                              style={btnAcao("#fef9c3", "#ca8a04")}
                            >- Saída</button>
                            <button
                              onClick={() => abrirEditarItem(item)}
                              style={btnAcao("#eff6ff", "#2563eb")}
                            >Editar</button>
                            <button
                              onClick={() => excluirItem(item)}
                              style={btnAcao("#fef2f2", "#dc2626")}
                            >✕</button>
                          </div>
                        </div>

                        {/* Detalhes expandidos */}
                        {isExp && (
                          <div style={{
                            marginTop: "12px",
                            paddingTop: "12px",
                            borderTop: "1px solid #e2e8f0",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "8px",
                          }}>
                            {[
                              ["Código interno", item.codigoInterno || "—"],
                              ["Preço unitário", item.precoUnitario ? formatarMoeda(item.precoUnitario) : "—"],
                              ["Valor em estoque", item.precoUnitario ? formatarMoeda(item.quantidade * item.precoUnitario) : "—"],
                              ["Validade", formatarData(item.validade)],
                              ["Localização", item.localizacao || "—"],
                              ["Observações", item.observacoes || "—"],
                            ].map(([l, v]) => (
                              <div key={l}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</div>
                                <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ABA MOVIMENTAÇÕES ── */}
          {aba === "movimentacoes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                  Histórico de movimentações
                </span>
                <button
                  onClick={() => setModalMov(true)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0f172a",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  + Movimentação manual
                </button>
              </div>

              {movimentacoes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
                  <p style={{ margin: 0 }}>Nenhuma movimentação registrada</p>
                </div>
              ) : (
                movimentacoes.slice(0, 50).map((m) => {
                  const tipoInfo = {
                    entrada: { cor: "#16a34a", bg: "#f0fdf4", icone: "↑", label: "Entrada" },
                    saida: { cor: "#dc2626", bg: "#fef2f2", icone: "↓", label: "Saída" },
                    ajuste: { cor: "#6366f1", bg: "#eef2ff", icone: "⟳", label: "Ajuste" },
                  }[m.tipo] || { cor: "#64748b", bg: "#f8fafc", icone: "•", label: m.tipo };

                  const ts = m.criadoEm ? new Date(m.criadoEm) : null;
                  const dataFmt = ts && !isNaN(ts)
                    ? ts.toLocaleDateString("pt-BR") + " " + ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—";

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: "#fafafa",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{
                        width: 36, height: 36,
                        borderRadius: "8px",
                        background: tipoInfo.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "16px",
                        color: tipoInfo.cor,
                        flexShrink: 0,
                      }}>{tipoInfo.icone}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{m.nomeItem}</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {m.motivo || tipoInfo.label} · {m.registradoPor} · {dataFmt}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: tipoInfo.cor }}>
                          {m.tipo === "entrada" ? "+" : m.tipo === "saida" ? "-" : ""}
                          {m.quantidade} {m.unidade || "un"}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {m.quantidadeAnterior ?? "?"} → {m.quantidadeNova ?? "?"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── ABA VALIDADE ── */}
          {aba === "validade" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", marginBottom: "4px" }}>
                Itens com vencimento nos próximos 30 dias
              </span>
              {kpis.proximosVencer.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
                  <p style={{ margin: 0 }}>Nenhum item com vencimento próximo</p>
                </div>
              ) : (
                kpis.proximosVencer
                  .sort((a, b) => new Date(a.validade) - new Date(b.validade))
                  .map((item) => {
                    const dias = diasParaVencer(item.validade);
                    const urgente = dias !== null && dias <= 7;
                    return (
                      <div key={item.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: urgente ? "#fef2f2" : "#fffbeb",
                        border: `1px solid ${urgente ? "#fecaca" : "#fde68a"}`,
                      }}>
                        <span style={{ fontSize: "20px" }}>{urgente ? "🚨" : "⏰"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{item.nome}</div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {item.categoria} · {item.quantidade} {item.unidade || "un"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: urgente ? "#dc2626" : "#d97706" }}>
                            {dias === 0 ? "Vence hoje" : `${dias} dia${dias !== 1 ? "s" : ""}`}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Validade: {formatarData(item.validade)}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── MODAL ITEM ── */}
      {modalItem && (
        <ModalOverlay onClose={() => setModalItem(false)}>
          <h2 style={{ margin: "0 0 20px", fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
            {itemEditando ? "Editar Item" : "Novo Item"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Campo label="Nome do item *" span={2}>
              <input name="nome" value={form.nome} onChange={handleForm} placeholder="Ex: Luva Descartável" style={inputStyle} />
            </Campo>
            <Campo label="Categoria">
              <select name="categoria" value={form.categoria} onChange={handleForm} style={inputStyle}>
                {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo label="Unidade">
              <select name="unidade" value={form.unidade} onChange={handleForm} style={inputStyle}>
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Campo>
            <Campo label="Quantidade atual *">
              <input name="quantidade" type="number" min="0" value={form.quantidade} onChange={handleForm} placeholder="0" style={inputStyle} />
            </Campo>
            <Campo label="Estoque mínimo *">
              <input name="minimo" type="number" min="0" value={form.minimo} onChange={handleForm} placeholder="0" style={inputStyle} />
            </Campo>
            <Campo label="Fornecedor">
              <input name="fornecedor" value={form.fornecedor} onChange={handleForm} placeholder="Nome do fornecedor" style={inputStyle} />
            </Campo>
            <Campo label="Código interno">
              <input name="codigoInterno" value={form.codigoInterno} onChange={handleForm} placeholder="SKU / código" style={inputStyle} />
            </Campo>
            <Campo label="Preço unitário (R$)">
              <input name="precoUnitario" type="number" min="0" step="0.01" value={form.precoUnitario} onChange={handleForm} placeholder="0,00" style={inputStyle} />
            </Campo>
            <Campo label="Validade">
              <input name="validade" type="date" value={form.validade} onChange={handleForm} style={inputStyle} />
            </Campo>
            <Campo label="Localização" span={2}>
              <input name="localizacao" value={form.localizacao} onChange={handleForm} placeholder="Ex: Armário A, Prateleira 2" style={inputStyle} />
            </Campo>
            <Campo label="Observações" span={2}>
              <textarea name="observacoes" value={form.observacoes} onChange={handleForm} rows={2} placeholder="Notas adicionais..." style={{ ...inputStyle, resize: "vertical" }} />
            </Campo>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button onClick={() => setModalItem(false)} style={btnSecundario}>Cancelar</button>
            <button onClick={salvarItem} disabled={salvando} style={btnPrimario}>
              {salvando ? "Salvando..." : itemEditando ? "Salvar alterações" : "Cadastrar item"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── MODAL MOVIMENTAÇÃO ── */}
      {modalMov && (
        <ModalOverlay onClose={() => setModalMov(false)}>
          <h2 style={{ margin: "0 0 20px", fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
            Registrar Movimentação
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {!movForm.estoqueId && (
              <Campo label="Item do estoque">
                <select
                  value={movForm.estoqueId}
                  onChange={(e) => {
                    const item = estoque.find((i) => i.id === e.target.value);
                    setMovForm((p) => ({ ...p, estoqueId: e.target.value, nomeItem: item?.nome || "" }));
                  }}
                  style={inputStyle}
                >
                  <option value="">Selecione um item...</option>
                  {estoque.map((i) => (
                    <option key={i.id} value={i.id}>{i.nome} ({i.quantidade} {i.unidade || "un"})</option>
                  ))}
                </select>
              </Campo>
            )}
            {movForm.nomeItem && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                📦 {movForm.nomeItem}
              </div>
            )}
            <Campo label="Tipo de movimentação">
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { val: "entrada", label: "Entrada", cor: "#16a34a", bg: "#f0fdf4" },
                  { val: "saida", label: "Saída", cor: "#dc2626", bg: "#fef2f2" },
                  { val: "ajuste", label: "Ajuste de inventário", cor: "#6366f1", bg: "#eef2ff" },
                ].map((t) => (
                  <button
                    key={t.val}
                    onClick={() => setMovForm((p) => ({ ...p, tipo: t.val }))}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "8px",
                      border: `1px solid ${movForm.tipo === t.val ? t.cor : "#e2e8f0"}`,
                      background: movForm.tipo === t.val ? t.bg : "#fff",
                      color: movForm.tipo === t.val ? t.cor : "#64748b",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo label={movForm.tipo === "ajuste" ? "Nova quantidade total" : "Quantidade"}>
              <input
                type="number"
                min="1"
                value={movForm.quantidade}
                onChange={(e) => setMovForm((p) => ({ ...p, quantidade: e.target.value }))}
                placeholder="Informe a quantidade"
                style={inputStyle}
              />
            </Campo>
            <Campo label="Motivo / Observação">
              <input
                value={movForm.motivo}
                onChange={(e) => setMovForm((p) => ({ ...p, motivo: e.target.value }))}
                placeholder="Ex: Compra de reposição, uso em procedimento..."
                style={inputStyle}
              />
            </Campo>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button onClick={() => setModalMov(false)} style={btnSecundario}>Cancelar</button>
            <button onClick={salvarMovimentacao} disabled={salvando} style={btnPrimario}>
              {salvando ? "Registrando..." : "Confirmar"}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "28px",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined, display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function btnAcao(bg, color) {
  return {
    padding: "5px 10px",
    borderRadius: "7px",
    border: "none",
    background: bg,
    color,
    fontWeight: 600,
    fontSize: "11px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  color: "#0f172a",
};

const btnPrimario = {
  padding: "9px 20px",
  borderRadius: "9px",
  border: "none",
  background: "linear-gradient(135deg, #0f172a, #1e40af)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const btnSecundario = {
  padding: "9px 20px",
  borderRadius: "9px",
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#475569",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};
