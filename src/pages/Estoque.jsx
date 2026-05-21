import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Building2, CheckCircle, ClipboardList, Clock, DollarSign, MapPin, Package, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { formatarData } from "../utils/dateUtils";
import EmptyState from "../components/EmptyState";
import AlertaBanner from "../components/AlertaBanner";

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

const POR_PAGINA_ITENS = 25;
const POR_PAGINA_MOV = 30;

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

function diasParaVencer(validade) {
  if (!validade) return null;
  return Math.round((new Date(validade + "T00:00:00") - new Date()) / 86400000);
}

function normText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function Estoque({ estoque = [], onRefresh = () => {} }) {
  const { userData } = useAuth();
  const toast = useToast();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [movCarregadas, setMovCarregadas] = useState(false);
  const [aba, setAba] = useState("itens");
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [paginaItens, setPaginaItens] = useState(1);
  const [paginaMov, setPaginaMov] = useState(1);
  const [modalItem, setModalItem] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [modalMov, setModalMov] = useState(false);
  const [movForm, setMovForm] = useState(MOV_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [carregandoMov, setCarregandoMov] = useState(false);
  const [expandido, setExpandido] = useState(null);
  // KPIs do estoque vindos do backend (fonte de verdade do "Valor em estoque" — Fase 5)
  const [kpisBackend, setKpisBackend] = useState(null);

  const recarregarKpis = useCallback(async () => {
    try {
      const r = await api.estoque.kpis();
      if (r?.data) setKpisBackend(r.data);
    } catch {
      setKpisBackend(null);
    }
  }, []);

  // Recarrega sempre que a lista de itens muda (criação/edição/exclusão/movimentação).
  // useEffect dispara após cada onRefresh() — KPI fica sempre alinhado com o banco.
  useEffect(() => {
    let cancel = false;
    api.estoque.kpis()
      .then((r) => { if (!cancel && r?.data) setKpisBackend(r.data); })
      .catch(() => { if (!cancel) setKpisBackend(null); });
    return () => { cancel = true; };
  }, [estoque]);

  const carregarMovimentacoes = useCallback(async () => {
    setCarregandoMov(true);
    try {
      const r = await api.estoque.listarMovimentacoes({ limit: 100 });
      setMovimentacoes(r.data || []);
      setMovCarregadas(true);
    } catch { setMovimentacoes([]); }
    finally { setCarregandoMov(false); }
  }, []);

  useEffect(() => {
    if (aba === "movimentacoes" && !movCarregadas) carregarMovimentacoes();
  }, [aba, movCarregadas, carregarMovimentacoes]);

  const kpis = useMemo(() => {
    const criticos = estoque.filter((i) => statusItem(i.quantidade, i.minimo) === "critico");
    const alertas = estoque.filter((i) => statusItem(i.quantidade, i.minimo) === "alerta");
    // Fonte de verdade do "Valor em estoque": backend (SUM(quantidade*preco_unitario) onde ativo=1).
    // Fallback local SÓ quando o backend ainda não respondeu (kpisBackend === null);
    // se o backend respondeu 0 legítimo, mostramos 0 — não vale calcular local divergente.
    const valorBackend = Number(kpisBackend?.valor_em_estoque);
    const backendRespondeu = kpisBackend !== null && Number.isFinite(valorBackend);
    const valorTotal = backendRespondeu
      ? valorBackend
      : estoque.reduce(
          (acc, i) => acc + Number(i.quantidade || 0) * Number(i.precoUnitario || i.preco_unitario || 0),
          0
        );
    const proximosVencer = estoque.filter((i) => {
      const d = diasParaVencer(i.validade);
      return d !== null && d >= 0 && d <= 30;
    });
    return { total: estoque.length, criticos, alertas, valorTotal, proximosVencer };
  }, [estoque, kpisBackend]);

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

  useEffect(() => { setPaginaItens(1); }, [busca, filtroCategoria, filtroStatus]);
  useEffect(() => { setPaginaMov(1); }, [movimentacoes]);

  const totalPaginasItens = Math.max(1, Math.ceil(itensFiltrados.length / POR_PAGINA_ITENS));
  const itensPagina = itensFiltrados.slice((paginaItens - 1) * POR_PAGINA_ITENS, paginaItens * POR_PAGINA_ITENS);
  const totalPaginasMov = Math.max(1, Math.ceil(movimentacoes.length / POR_PAGINA_MOV));
  const movPagina = movimentacoes.slice((paginaMov - 1) * POR_PAGINA_MOV, paginaMov * POR_PAGINA_MOV);

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
    if (!form.nome.trim()) { toast.warn("Informe o nome do item."); return; }
    if (form.quantidade === "" || isNaN(Number(form.quantidade))) { toast.warn("Informe a quantidade atual."); return; }
    if (form.minimo === "" || isNaN(Number(form.minimo))) { toast.warn("Informe o estoque mínimo."); return; }
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
      toast.error("Erro ao salvar item.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirItem(item) {
    if (!await toast.confirm(`Excluir "${item.nome}" do estoque?`)) return;
    try {
      await api.estoque.excluir(item.id);
      await onRefresh();
    } catch {
      toast.error("Erro ao excluir item.");
    }
  }

  function abrirMovimentacao(item, tipo = "saida") {
    setMovForm({ tipo, quantidade: "", motivo: "", estoqueId: item.id, nomeItem: item.nome });
    setModalMov(true);
  }

  async function salvarMovimentacao() {
    const qtd = Number(movForm.quantidade);
    if (!qtd || qtd <= 0) { toast.warn("Informe uma quantidade válida."); return; }
    const item = estoque.find((i) => i.id === movForm.estoqueId);
    if (!item) { toast.warn("Item não encontrado."); return; }
    if (movForm.tipo === "saida" && Number(item.quantidade || 0) - qtd < 0) {
      toast.warn("Quantidade resultante seria negativa. Verifique o valor informado.");
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
      await carregarMovimentacoes();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar movimentação.");
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
              <span style={{ color: k.cor, display: "flex", alignItems: "center" }}>
                {k.label.includes("TOTAL") && !k.label.includes("VALOR") ? <Package size={18} /> :
                  k.label.includes("CRÍTI") ? <AlertCircle size={18} /> :
                    k.label.includes("ALERTA") ? <AlertTriangle size={18} /> : <DollarSign size={18} />}
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
            <AlertCircle size={16} color="#dc2626" />
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

              {/* Alertas de estoque */}
              {(kpis.criticos.length > 0 || kpis.proximosVencer.length > 0) && (
                <AlertaBanner alertas={[
                  ...(kpis.criticos.length > 0 ? [{
                    tipo: "urgente",
                    titulo: `${kpis.criticos.length} item(s) com estoque crítico`,
                    detalhe: kpis.criticos.slice(0, 3).map((i) => i.nome).join(", ") + (kpis.criticos.length > 3 ? "..." : ""),
                  }] : []),
                  ...(kpis.proximosVencer.length > 0 ? [{
                    tipo: "atencao",
                    titulo: `${kpis.proximosVencer.length} item(s) com validade nos próximos 30 dias`,
                    detalhe: kpis.proximosVencer.slice(0, 3).map((i) => i.nome).join(", ") + (kpis.proximosVencer.length > 3 ? "..." : ""),
                    acao: "Ver validades",
                    onAcao: () => setAba("validade"),
                  }] : []),
                ]} />
              )}

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
                  {totalPaginasItens > 1 && ` · pág. ${paginaItens}/${totalPaginasItens}`}
                </span>
              </div>

              {/* Lista de itens */}
              {itensFiltrados.length === 0 ? (
                <EmptyState
                  icon={<Package size={32} />}
                  titulo="Nenhum item encontrado"
                  descricao={estoque.length === 0 ? "Cadastre o primeiro item clicando em \"+ Novo Item\"." : "Tente ajustar os filtros de busca."}
                  acao={estoque.length === 0 ? "+ Novo Item" : undefined}
                  onAcao={estoque.length === 0 ? () => setModalItem(true) : undefined}
                  cor="#7C3AED"
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {itensPagina.map((item) => {
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
                                <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", color: dias <= 7 ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                                  <Clock size={11} />Vence em {dias}d
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
                                <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#94a3b8" }}><MapPin size={11} />{item.localizacao}</span>
                              )}
                              {item.fornecedor && (
                                <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#94a3b8" }}><Building2 size={11} />{item.fornecedor}</span>
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
                            ><X size={13} /></button>
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

              {/* Paginação itens */}
              {totalPaginasItens > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", paddingTop: "8px" }}>
                  <button
                    onClick={() => setPaginaItens((p) => Math.max(1, p - 1))}
                    disabled={paginaItens === 1}
                    style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", background: paginaItens === 1 ? "#f8fafc" : "#fff", color: paginaItens === 1 ? "#cbd5e1" : "#374151", fontWeight: 600, fontSize: "12px", cursor: paginaItens === 1 ? "default" : "pointer" }}
                  >Anterior</button>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Página {paginaItens} de {totalPaginasItens} · {itensPagina.length} de {itensFiltrados.length} itens
                  </span>
                  <button
                    onClick={() => setPaginaItens((p) => Math.min(totalPaginasItens, p + 1))}
                    disabled={paginaItens === totalPaginasItens}
                    style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", background: paginaItens === totalPaginasItens ? "#f8fafc" : "#fff", color: paginaItens === totalPaginasItens ? "#cbd5e1" : "#374151", fontWeight: 600, fontSize: "12px", cursor: paginaItens === totalPaginasItens ? "default" : "pointer" }}
                  >Próxima</button>
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
                  {movimentacoes.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>
                      ({movimentacoes.length} registros · últimos 100)
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={carregarMovimentacoes}
                    disabled={carregandoMov}
                    title="Atualizar lista"
                    style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: carregandoMov ? "#f8fafc" : "#fff", color: carregandoMov ? "#94a3b8" : "#374151", fontWeight: 600, fontSize: "12px", cursor: carregandoMov ? "default" : "pointer" }}
                  >{carregandoMov ? "..." : "↻ Atualizar"}</button>
                  <button
                    onClick={() => setModalMov(true)}
                    style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
                  >+ Movimentação manual</button>
                </div>
              </div>

              {carregandoMov ? (
                <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8", fontSize: 13 }}>Carregando movimentações...</div>
              ) : movimentacoes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db" }}>
                  <ClipboardList size={36} color="#cbd5e1" style={{ marginBottom: "8px" }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 6 }}>Nenhuma movimentação registrada</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>As movimentações aparecem aqui ao registrar entradas e saídas de estoque.</div>
                </div>
              ) : (
                movPagina.map((m) => {
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

              {/* Paginação movimentações */}
              {totalPaginasMov > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", paddingTop: "4px" }}>
                  <button
                    onClick={() => setPaginaMov((p) => Math.max(1, p - 1))}
                    disabled={paginaMov === 1}
                    style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", background: paginaMov === 1 ? "#f8fafc" : "#fff", color: paginaMov === 1 ? "#cbd5e1" : "#374151", fontWeight: 600, fontSize: "12px", cursor: paginaMov === 1 ? "default" : "pointer" }}
                  >Anterior</button>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Página {paginaMov} de {totalPaginasMov} · {movPagina.length} de {movimentacoes.length} registros
                  </span>
                  <button
                    onClick={() => setPaginaMov((p) => Math.min(totalPaginasMov, p + 1))}
                    disabled={paginaMov === totalPaginasMov}
                    style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", background: paginaMov === totalPaginasMov ? "#f8fafc" : "#fff", color: paginaMov === totalPaginasMov ? "#cbd5e1" : "#374151", fontWeight: 600, fontSize: "12px", cursor: paginaMov === totalPaginasMov ? "default" : "pointer" }}
                  >Próxima</button>
                </div>
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
                <EmptyState
                  icon={<CheckCircle size={32} />}
                  titulo="Nenhum item com vencimento próximo"
                  descricao="Todos os itens em estoque têm validade superior a 30 dias."
                  cor="#16a34a"
                />
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
                        <span style={{ color: urgente ? "#dc2626" : "#d97706", display: "flex" }}>{urgente ? <AlertCircle size={20} /> : <Clock size={20} />}</span>
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
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                <Package size={14} />{movForm.nomeItem}
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
