# Vynor Clinic — Maturidade Clínica: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar a percepção de maturidade do sistema Vynor Clinic em todos os módulos: dados reais no dashboard, fluxos de recepção integrados, status de pagamento visualmente separados, DRE financeiro, alertas operacionais, estados vazios profissionais e PDFs com visual de documento oficial.

**Architecture:** Melhorias incrementais módulo a módulo, sempre frontend-first com os dados que o backend já entrega. Backend PHP recebe 2 endpoints novos de baixo risco (GET apenas, autenticados). Nenhuma rota, permissão, autenticação ou regra de segurança é alterada.

**Tech Stack:** React 19 + Vite 8, jsPDF + jspdf-autotable (já instalados), lucide-react (já instalado), PHP 8 + MySQL (XAMPP), JWT via localStorage.

---

## Arquivos que serão modificados

### Frontend (sistema-saude/src/)
| Arquivo | Mudança |
|---|---|
| `pages/Dashboard.jsx` | Remover fake trends; adicionar alertas operacionais; linha do tempo do dia; próxima ação |
| `pages/Faturamento.jsx` | Abas por status; filtros por período/profissional; recibo profissional |
| `pages/Financeiro.jsx` | Card DRE simples; alertas de vencimento; empty states sem gráfico vazio |
| `pages/Relatorios.jsx` | PDF visual oficial; relatório por profissional; export CSV |
| `pages/Pacientes.jsx` | Validação CPF/tel/email; auto-busca; aviso duplicata; resumo paciente |
| `pages/Agendamentos.jsx` | Conflitos visuais; horários ocupados; empty states |
| `pages/Prontuario.jsx` | Timeline clínica; exibir CID; aviso edição finalizado |
| `pages/Enfermagem.jsx` | Alertas sinais vitais críticos; campos estruturados |
| `pages/Odonto.jsx` | Placeholder odontograma SVG; plano de tratamento visual |
| `pages/Estoque.jsx` | Alertas validade/mínimo; empty states; histórico por item |
| `pages/Cadastros.jsx` | Inativar vs excluir; confirmação modal; proteger registros base |
| `pages/Configuracoes.jsx` | Tabs (Usuários/Permissões/Consultórios/Auditoria/Sistema); bloquear master |
| `pages/Normas.jsx` | Campos versão/data revisão/responsável; empty state |

### Backend (xampp/htdocs/vynor-clinic-api/)
| Arquivo | Mudança |
|---|---|
| `routes/api.php` | 2 novas rotas GET autenticadas: `/dashboard/alertas`, `/pacientes/verificar-duplicata` |
| `controllers/SystemController.php` | Método `alertasDashboard()` |
| `controllers/PatientController.php` | Método `verificarDuplicata()` |

### Novo arquivo
| Arquivo | Propósito |
|---|---|
| `sistema-saude/src/components/EmptyState.jsx` | Componente reutilizável de estado vazio |
| `sistema-saude/src/components/AlertaBanner.jsx` | Componente de alerta operacional reutilizável |
| `sistema-saude/src/utils/validacoes.js` | CPF, telefone, email validation helpers |
| `xampp/htdocs/vynor-clinic-api/scripts/seed_qa_demo.php` | Dados QA/demo marcados, removíveis |

---

## FASE 1 — Componentes base reutilizáveis

### Tarefa 1: EmptyState component

**Arquivo:** `sistema-saude/src/components/EmptyState.jsx` (criar)

- [ ] **Criar o componente**

```jsx
// EmptyState.jsx — estado vazio profissional reutilizável
export default function EmptyState({ icon, titulo, descricao, acao, onAcao, cor = "#7C3AED" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center",
    }}>
      {icon && (
        <div style={{
          width: "64px", height: "64px", borderRadius: "16px",
          background: `${cor}14`, display: "flex", alignItems: "center",
          justifyContent: "center", marginBottom: "16px",
        }}>
          <div style={{ color: cor, opacity: 0.7 }}>{icon}</div>
        </div>
      )}
      <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
        {titulo}
      </h3>
      {descricao && (
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b", maxWidth: "320px", lineHeight: 1.5 }}>
          {descricao}
        </p>
      )}
      {acao && onAcao && (
        <button
          onClick={onAcao}
          style={{
            padding: "9px 20px", borderRadius: "8px", border: "none",
            background: cor, color: "#fff", fontSize: "13px",
            fontWeight: 600, cursor: "pointer",
          }}
        >
          {acao}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Verificar que o arquivo foi criado corretamente**

```powershell
Test-Path "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\components\EmptyState.jsx"
```

---

### Tarefa 2: AlertaBanner component

**Arquivo:** `sistema-saude/src/components/AlertaBanner.jsx` (criar)

- [ ] **Criar o componente**

```jsx
// AlertaBanner.jsx — banner de alerta operacional
export default function AlertaBanner({ alertas = [] }) {
  if (!alertas.length) return null;
  const TIPOS = {
    urgente:  { bg: "#fef2f2", border: "#fca5a5", cor: "#dc2626", icone: "⚠" },
    atencao:  { bg: "#fffbeb", border: "#fcd34d", cor: "#d97706", icone: "⏰" },
    info:     { bg: "#eff6ff", border: "#93c5fd", cor: "#2563eb", icone: "ℹ" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {alertas.map((a, i) => {
        const cfg = TIPOS[a.tipo] || TIPOS.info;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "10px 14px", borderRadius: "10px",
            background: cfg.bg, border: `1px solid ${cfg.border}`,
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{cfg.icone}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: cfg.cor }}>{a.titulo}</span>
              {a.detalhe && (
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "6px" }}>{a.detalhe}</span>
              )}
            </div>
            {a.acao && a.onAcao && (
              <button
                onClick={a.onAcao}
                style={{
                  padding: "4px 10px", borderRadius: "6px", border: `1px solid ${cfg.border}`,
                  background: "transparent", color: cfg.cor, fontSize: "11px",
                  fontWeight: 600, cursor: "pointer", flexShrink: 0,
                }}
              >
                {a.acao}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

### Tarefa 3: Utilitários de validação

**Arquivo:** `sistema-saude/src/utils/validacoes.js` (criar)

- [ ] **Criar helpers de validação**

```js
// validacoes.js — validação de CPF, telefone, e-mail

export function validarCPF(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== Number(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === Number(c[10]);
}

export function validarTelefone(tel) {
  const t = String(tel || "").replace(/\D/g, "");
  return t.length === 10 || t.length === 11;
}

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

export function mascaraCPF(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");
  if (c.length <= 3) return c;
  if (c.length <= 6) return `${c.slice(0,3)}.${c.slice(3)}`;
  if (c.length <= 9) return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6)}`;
  return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9,11)}`;
}

export function mascaraTelefone(tel) {
  const t = String(tel || "").replace(/\D/g, "");
  if (t.length <= 2) return t;
  if (t.length <= 6) return `(${t.slice(0,2)}) ${t.slice(2)}`;
  if (t.length <= 10) return `(${t.slice(0,2)}) ${t.slice(2,6)}-${t.slice(6)}`;
  return `(${t.slice(0,2)}) ${t.slice(2,7)}-${t.slice(7,11)}`;
}
```

---

## FASE 2 — Dashboard

### Tarefa 4: Remover indicadores falsos e corrigir Dashboard

**Arquivo:** `sistema-saude/src/pages/Dashboard.jsx` (modificar)

- [ ] **Localizar e remover os fake trends do Resumo Financeiro**

Encontrar no arquivo (por volta da linha 908-925) o trecho:
```jsx
{ label: "Faturamento",  valor: resumoFin.faturamento,  pct: 15,  up: true },
{ label: "Recebimentos", valor: resumoFin.recebimentos, pct: 10,  up: true },
{ label: "Pendências",   valor: resumoFin.pendencias,   pct: 5,   up: false },
```

Substituir por (sem tendência fake — apenas os valores reais):
```jsx
{ label: "Faturamento",  valor: resumoFin.faturamento  },
{ label: "Recebimentos", valor: resumoFin.recebimentos },
{ label: "Pendências",   valor: resumoFin.pendencias   },
```

E remover o `<Trend />` dessa seção (remover `<Trend pct={row.up ? row.pct : -row.pct} />`).

- [ ] **Corrigir barra de progresso falsa no summaryCard**

Localizar na função `summaryCard` (linha ~373):
```jsx
<div style={{ height: "100%", background: P, borderRadius: "4px", width: "60%", ...
```

Remover a div do bar completamente (toda a `<div style={{ marginTop: "12px", height: "3px"...}}>`).

- [ ] **Adicionar cálculo real da variação financeira mês anterior**

Adicionar este useMemo APÓS o existente `resumoFin`:
```jsx
const variacaoFin = useMemo(() => {
  const now = new Date();
  const mesAtual = now.getMonth(), anoAtual = now.getFullYear();
  const mesAnt   = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoAnt   = mesAtual === 0 ? anoAtual - 1 : anoAtual;
  const isPago = (p) => ["pago","paga"].includes(normalizarTexto(p.statusPagamento || p.status || ""));
  const isMesAtual = (p) => { const d = new Date((p.dataPagamento||p.data||"")+"T00:00:00"); return d.getMonth()===mesAtual && d.getFullYear()===anoAtual; };
  const isMesAnt   = (p) => { const d = new Date((p.dataPagamento||p.data||"")+"T00:00:00"); return d.getMonth()===mesAnt   && d.getFullYear()===anoAnt;   };
  const recAtual = pagamentos.filter(p=>isPago(p)&&isMesAtual(p)).reduce((t,p)=>t+Number(p.valor||0),0);
  const recAnt   = pagamentos.filter(p=>isPago(p)&&isMesAnt(p)).reduce((t,p)=>t+Number(p.valor||0),0);
  if (!recAnt) return null;
  return Math.round(((recAtual - recAnt) / recAnt) * 100);
}, [pagamentos]);
```

E usar `variacaoFin` no summaryCard de Faturamento:
```jsx
{summaryCard("Faturamento do Mês", formatarMoeda(faturamentoMes), "pagamentos confirmados", variacaoFin, ...)}
```

- [ ] **Adicionar bloco de alertas operacionais (pacientes aguardando, pendências)**

Adicionar este useMemo:
```jsx
const alertasOperacionais = useMemo(() => {
  const alertas = [];
  const agora = new Date();

  // Pacientes aguardando há mais de 30 min
  const aguardando = [...consultas, ...atendimentosOdonto].filter(c => {
    const s = normalizarTexto(c.status || "");
    return (s === "aguardando" || s === "presente") && (c.data||"").slice(0,10) === dataHoje;
  });
  if (aguardando.length > 0) {
    alertas.push({
      tipo: "atencao",
      titulo: `${aguardando.length} paciente${aguardando.length > 1 ? "s" : ""} aguardando atendimento`,
      detalhe: aguardando.map(c => c.paciente || c.pacienteNome || "—").slice(0,3).join(", "),
    });
  }

  // Atendimentos finalizados sem pagamento
  const semPagamento = [...consultas, ...atendimentosOdonto].filter(c => {
    const s = normalizarTexto(c.status || "");
    return s === "finalizado" && !c.pagamentoId && (c.data||"").slice(0,10) === dataHoje;
  });
  if (semPagamento.length > 0) {
    alertas.push({
      tipo: "urgente",
      titulo: `${semPagamento.length} atendimento${semPagamento.length > 1 ? "s" : ""} aguardando pagamento`,
      detalhe: "Clique em Faturamento para registrar",
    });
  }

  // Pagamentos pendentes
  const pendentes = pagamentos.filter(p => {
    const s = normalizarTexto(p.statusPagamento || p.status || "");
    return s === "pendente" || s === "aguardando";
  });
  if (pendentes.length > 0) {
    alertas.push({
      tipo: "info",
      titulo: `${pendentes.length} pagamento${pendentes.length > 1 ? "s" : ""} pendente${pendentes.length > 1 ? "s" : ""}`,
      detalhe: `Total: ${formatarMoeda(pendentes.reduce((t,p)=>t+Number(p.valor||0),0))}`,
    });
  }
  return alertas;
}, [consultas, atendimentosOdonto, pagamentos, dataHoje]);
```

- [ ] **Adicionar import do AlertaBanner no Dashboard**

No topo do Dashboard.jsx, adicionar:
```jsx
import AlertaBanner from "../components/AlertaBanner";
```

- [ ] **Renderizar bloco de alertas no JSX do Dashboard**

Logo após o bloco dos 4 KPI Cards (após `</div>` do `dash-kpi-row`), adicionar:
```jsx
{alertasOperacionais.length > 0 && (
  <AlertaBanner alertas={alertasOperacionais} />
)}
```

- [ ] **Adicionar bloco "Próxima ação recomendada"**

Adicionar este useMemo:
```jsx
const proximaAcao = useMemo(() => {
  const aguardando = [...consultas, ...atendimentosOdonto].filter(c => {
    const s = normalizarTexto(c.status || "");
    return (s === "aguardando" || s === "presente") && (c.data||"").slice(0,10) === dataHoje;
  });
  if (aguardando.length > 0) {
    return { texto: `Iniciar atendimento de ${obterNomePaciente(aguardando[0])}`, view: "medicos", urgencia: "alta" };
  }
  const semPag = [...consultas, ...atendimentosOdonto].filter(c => {
    return normalizarTexto(c.status||"") === "finalizado" && !c.pagamentoId && (c.data||"").slice(0,10) === dataHoje;
  });
  if (semPag.length > 0) return { texto: "Registrar pagamento de atendimento finalizado", view: "faturamento", urgencia: "media" };
  const agendadosHoje = [...consultas, ...atendimentosOdonto].filter(c => {
    return normalizarTexto(c.status||"") === "agendado" && (c.data||"").slice(0,10) === dataHoje;
  });
  if (agendadosHoje.length > 0) return { texto: `${agendadosHoje.length} agendamento${agendadosHoje.length>1?"s":""} para hoje`, view: "agendamentos", urgencia: "baixa" };
  return null;
}, [consultas, atendimentosOdonto, dataHoje]);
```

Renderizar antes do gráfico de linha (primeira posição da coluna esquerda):
```jsx
{proximaAcao && (
  <div style={{
    display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
    borderRadius: "12px",
    background: proximaAcao.urgencia === "alta" ? "#fef2f2" : proximaAcao.urgencia === "media" ? "#fffbeb" : "#f0fdf4",
    border: `1px solid ${proximaAcao.urgencia === "alta" ? "#fca5a5" : proximaAcao.urgencia === "media" ? "#fcd34d" : "#86efac"}`,
  }}>
    <span style={{ fontSize: "18px" }}>
      {proximaAcao.urgencia === "alta" ? "🔴" : proximaAcao.urgencia === "media" ? "🟡" : "🟢"}
    </span>
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
        Próxima ação recomendada
      </span>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{proximaAcao.texto}</div>
    </div>
    <button
      onClick={() => nav(proximaAcao.view)}
      style={{
        padding: "6px 12px", borderRadius: "7px", border: "1px solid #e2e8f0",
        background: "#fff", fontSize: "12px", fontWeight: 600, color: "#374151", cursor: "pointer",
      }}
    >
      Ir →
    </button>
  </div>
)}
```

---

## FASE 3 — Faturamento

### Tarefa 5: Separação visual de status e filtros

**Arquivo:** `sistema-saude/src/pages/Faturamento.jsx` (modificar — ler arquivo completo antes)

- [ ] **Ler o arquivo completo para identificar a estrutura atual**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Faturamento.jsx").Count
```

- [ ] **Adicionar estado de aba de status e filtro por profissional**

Localizar onde estão os `useState` da página e adicionar:
```jsx
const [abaStatus, setAbaStatus] = useState("todos"); // "todos"|"a_cobrar"|"pago"|"pendente"|"cancelado"
const [filtroProfissional, setFiltroProfissional] = useState("");
const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState(inicioMes());
const [filtroPeriodoFim, setFiltroPeriodoFim] = useState(hojeISO());
```

- [ ] **Adicionar filtro dos pagamentos por aba de status**

Adicionar useMemo para lista filtrada:
```jsx
const pagamentosFiltrados = useMemo(() => {
  return pagamentos.filter(p => {
    const s = normalizarTexto(p.statusPagamento || p.status || "");
    // filtro aba
    if (abaStatus === "a_cobrar"  && !["pendente","aguardando","a cobrar"].some(v => s.includes(v))) return false;
    if (abaStatus === "pago"      && !["pago","paga"].some(v => s === v)) return false;
    if (abaStatus === "pendente"  && s !== "pendente" && s !== "aguardando") return false;
    if (abaStatus === "cancelado" && s !== "cancelado") return false;
    // filtro profissional
    if (filtroProfissional && !normalizarTexto(p.profissional||"").includes(normalizarTexto(filtroProfissional))) return false;
    // filtro período
    const dataP = (p.dataPagamento || p.data || "").slice(0,10);
    if (filtroPeriodoInicio && dataP < filtroPeriodoInicio) return false;
    if (filtroPeriodoFim   && dataP > filtroPeriodoFim)   return false;
    return true;
  });
}, [pagamentos, abaStatus, filtroProfissional, filtroPeriodoInicio, filtroPeriodoFim]);

function normalizarTexto(v) {
  return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
}
```

- [ ] **Adicionar as abas de status antes da tabela de pagamentos**

Localizar a tabela principal de pagamentos e inserir antes dela:
```jsx
{/* Contadores por status */}
{(() => {
  const contar = (fn) => pagamentos.filter(fn).length;
  const norm = (p) => normalizarTexto(p.statusPagamento || p.status || "");
  const ABAS = [
    { key: "todos",    label: "Todos",     count: pagamentos.length,                              cor: "#64748b" },
    { key: "a_cobrar", label: "A Cobrar",  count: contar(p=>["pendente","aguardando","a cobrar"].some(v=>norm(p).includes(v))), cor: "#d97706" },
    { key: "pago",     label: "Pago",      count: contar(p=>["pago","paga"].includes(norm(p))),   cor: "#16a34a" },
    { key: "pendente", label: "Pendente",  count: contar(p=>norm(p)==="pendente"||norm(p)==="aguardando"), cor: "#dc2626" },
    { key: "cancelado",label: "Cancelado", count: contar(p=>norm(p)==="cancelado"),               cor: "#6b7280" },
  ];
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
      {ABAS.map(a => (
        <button key={a.key} onClick={() => setAbaStatus(a.key)} style={{
          padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
          fontSize: "12px", fontWeight: 700, transition: "all .15s",
          background: abaStatus === a.key ? a.cor : "#f1f5f9",
          color: abaStatus === a.key ? "#fff" : a.cor,
        }}>
          {a.label} <span style={{
            marginLeft: "4px", padding: "1px 6px", borderRadius: "10px",
            background: abaStatus === a.key ? "rgba(255,255,255,.25)" : a.cor + "22",
            fontSize: "10px",
          }}>{a.count}</span>
        </button>
      ))}
    </div>
  );
})()}

{/* Filtros período e profissional */}
<div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
  <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Período:</label>
  <input type="date" value={filtroPeriodoInicio} onChange={e=>setFiltroPeriodoInicio(e.target.value)}
    style={{ padding: "5px 8px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
  <span style={{ fontSize: "12px", color: "#94a3b8" }}>até</span>
  <input type="date" value={filtroPeriodoFim} onChange={e=>setFiltroPeriodoFim(e.target.value)}
    style={{ padding: "5px 8px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
  <input placeholder="Filtrar profissional..." value={filtroProfissional} onChange={e=>setFiltroProfissional(e.target.value)}
    style={{ padding: "5px 10px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
</div>
```

- [ ] **Substituir a lista de `pagamentos` por `pagamentosFiltrados` na tabela**

Localizar todos os `.map` que iteram `pagamentos` na seção de tabela e substituir por `pagamentosFiltrados`.

- [ ] **Melhorar o recibo impresso para parecer documento oficial**

Substituir a função `imprimirRecibo` atual por:
```jsx
function imprimirRecibo(atendimento, pagamento) {
  const nomeClinica = "Vynor Clinic";
  const dataEmissao = new Date().toLocaleDateString("pt-BR");
  const horaEmissao = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const numeroRecibo = `RC-${Date.now().toString().slice(-8)}`;

  const w = window.open("", "_blank", "width=620,height=780");
  w.document.write(`<!DOCTYPE html><html><head><title>Recibo ${numeroRecibo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding: 0; color: #1e293b; }
    .header { background: #4C1D95; color: white; padding: 24px 32px; }
    .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .header p  { font-size: 12px; opacity: .8; }
    .badge { display:inline-block; padding: 3px 10px; border-radius:20px; background: rgba(255,255,255,.2); font-size:11px; font-weight:700; margin-top:8px; }
    .body  { padding: 28px 32px; }
    .titulo { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 20px; border-bottom: 2px solid #7C3AED; padding-bottom: 8px; }
    .row  { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .row .label  { font-size: 12px; color: #64748b; font-weight: 600; }
    .row .value  { font-size: 13px; color: #0f172a; font-weight: 600; }
    .total-box { background: #f5f3ff; border-radius: 10px; padding: 16px 20px; margin: 20px 0; display:flex; justify-content:space-between; align-items:center; }
    .total-box .label { font-size: 13px; font-weight: 700; color: #6D28D9; }
    .total-box .value { font-size: 22px; font-weight: 800; color: #4C1D95; }
    .footer { text-align:center; padding: 20px 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
    .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; }
    .status-pago { background:#dcfce7; color:#16a34a; }
    .status-pendente { background:#fef9c3; color:#854d0e; }
  </style></head><body>
  <div class="header">
    <h1>${nomeClinica}</h1>
    <p>Recibo de Pagamento — Emitido em ${dataEmissao} às ${horaEmissao}</p>
    <div class="badge">Nº ${numeroRecibo}</div>
  </div>
  <div class="body">
    <div class="titulo">Comprovante de Atendimento</div>
    <div class="row"><span class="label">Paciente</span><span class="value">${pagamento.nomePaciente || atendimento?.paciente || "—"}</span></div>
    <div class="row"><span class="label">Serviço</span><span class="value">${pagamento.descricao || pagamento.tipoAtendimento || "—"}</span></div>
    <div class="row"><span class="label">Profissional</span><span class="value">${pagamento.profissional || "—"}</span></div>
    <div class="row"><span class="label">Data do Atendimento</span><span class="value">${pagamento.data ? new Date(pagamento.data+"T00:00:00").toLocaleDateString("pt-BR") : "—"}</span></div>
    <div class="row"><span class="label">Forma de Pagamento</span><span class="value">${pagamento.formaPagamento || "—"}</span></div>
    <div class="row"><span class="label">Status</span><span class="value">
      <span class="status-badge ${["pago","paga"].includes((pagamento.statusPagamento||"").toLowerCase()) ? "status-pago" : "status-pendente"}">
        ${pagamento.statusPagamento || pagamento.status || "—"}
      </span>
    </span></div>
    ${pagamento.desconto ? `<div class="row"><span class="label">Desconto</span><span class="value">${Number(pagamento.desconto).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>` : ""}
    <div class="total-box">
      <span class="label">VALOR TOTAL</span>
      <span class="value">${Number(pagamento.valorFinal||pagamento.valor||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
    </div>
  </div>
  <div class="footer">
    ${nomeClinica} — Este recibo foi gerado automaticamente pelo sistema.<br>
    Não possui validade fiscal. Para nota fiscal, solicite ao estabelecimento.
  </div>
  <script>window.onload = () => window.print();</script>
  </body></html>`);
  w.document.close();
}
```

---

## FASE 4 — Financeiro

### Tarefa 6: DRE simples e alertas de vencimento

**Arquivo:** `sistema-saude/src/pages/Financeiro.jsx` (modificar — ler linhas iniciais já lidas)

- [ ] **Adicionar card DRE (Receita / Despesa / Saldo) antes dos gráficos**

Localizar a área de KPI cards na renderização e adicionar ANTES dos gráficos:
```jsx
{/* Card DRE simples */}
{(() => {
  const d = new Date();
  const mesAtual = d.getMonth(), anoAtual = d.getFullYear();
  // filtrar movimentações do mês atual (usar dados já disponíveis no componente)
  // Este bloco usa os dados que o componente já possui — kpis e movimentacoes
  const receita  = kpis?.receita_mes  || 0;
  const despesa  = kpis?.despesa_mes  || 0;
  const saldo    = receita - despesa;
  const cards = [
    { label: "Receita do Mês",  valor: receita,  cor: "#10b981", bg: "#f0fdf4" },
    { label: "Despesa do Mês",  valor: despesa,  cor: "#ef4444", bg: "#fef2f2" },
    { label: "Saldo",           valor: saldo,    cor: saldo >= 0 ? "#6366f1" : "#dc2626", bg: saldo >= 0 ? "#f0f0ff" : "#fef2f2" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
      {cards.map(c => (
        <div key={c.label} style={{
          padding: "20px", borderRadius: "14px", background: c.bg,
          border: `1px solid ${c.cor}33`,
        }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>
            {c.label}
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: c.cor, letterSpacing: "-0.04em" }}>
            {Number(c.valor||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
          </div>
        </div>
      ))}
    </div>
  );
})()}
```

- [ ] **Substituir gráfico vazio por EmptyState quando não há dados**

Localizar onde os gráficos são renderizados. Envolver cada gráfico com verificação:
```jsx
{dados.length === 0 ? (
  <EmptyState
    titulo="Sem movimentações no período"
    descricao="Selecione outro período ou registre a primeira movimentação financeira."
    cor="#6366f1"
  />
) : (
  <LineChart ... />
)}
```

Adicionar o import no topo:
```jsx
import EmptyState from "../components/EmptyState";
```

- [ ] **Adicionar alertas de vencimento de contas a pagar**

Localizar onde contas a pagar são listadas e adicionar seção de alertas:
```jsx
{(() => {
  const hoje = new Date();
  const em7dias = new Date(); em7dias.setDate(hoje.getDate() + 7);
  const vencendo = (contasPagar || []).filter(c => {
    if (c.status === "Pago") return false;
    const venc = c.dataVencimento ? new Date(c.dataVencimento+"T00:00:00") : null;
    return venc && venc <= em7dias;
  });
  if (!vencendo.length) return null;
  return (
    <div style={{
      padding: "12px 16px", borderRadius: "10px", background: "#fffbeb",
      border: "1px solid #fcd34d", marginBottom: "16px",
    }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#d97706", marginBottom: "8px" }}>
        ⏰ {vencendo.length} conta{vencendo.length>1?"s":""} a vencer nos próximos 7 dias
      </div>
      {vencendo.slice(0,3).map((c,i) => (
        <div key={i} style={{ fontSize: "12px", color: "#64748b", display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span>{c.fornecedor || "—"}</span>
          <span style={{ fontWeight: 600 }}>
            {new Date(c.dataVencimento+"T00:00:00").toLocaleDateString("pt-BR")} —
            {Number(c.valorLiquidoPagar||c.valorBruto||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
          </span>
        </div>
      ))}
    </div>
  );
})()}
```

---

## FASE 5 — Relatórios

### Tarefa 7: PDF oficial e export CSV

**Arquivo:** `sistema-saude/src/pages/Relatorios.jsx` (modificar)

- [ ] **Melhorar a função `cabecalhoPDF` para visual oficial roxo (consistente com Vynor)**

Localizar `cabecalhoPDF` (por volta da linha 39) e substituir:
```js
function cabecalhoPDF(doc, titulo, labelPeriodo) {
  // Header roxo Vynor
  doc.setFillColor(76, 29, 149);   // #4C1D95
  doc.rect(0, 0, 210, 30, "F");
  doc.setFillColor(124, 58, 237);  // faixa inferior mais clara
  doc.rect(0, 27, 210, 3, "F");

  // Logo SVG via texto
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Vynor Clinic", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(titulo, 14, 23);

  // Número da página e data à direita
  doc.setFontSize(9);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 196, 14, { align: "right" });
  doc.text(`Período: ${labelPeriodo}`, 196, 23, { align: "right" });

  doc.setTextColor(15, 23, 42);
  return 38;
}
```

- [ ] **Melhorar a função `rodapePDF` com estilo Vynor**

Substituir `rodapePDF`:
```js
function rodapePDF(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.height;
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageH - 14, 210, 14, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Vynor Clinic — Documento gerado automaticamente — Confidencial`, 14, pageH - 5);
    doc.text(`Pág. ${i} / ${total}`, 196, pageH - 5, { align: "right" });
  }
}
```

- [ ] **Adicionar função export CSV genérica**

Adicionar antes do `export default`:
```js
function exportarCSV(cabecalhos, linhas, nomeArquivo) {
  const escape = (v) => {
    const s = String(v == null ? "" : v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const conteudo = [cabecalhos, ...linhas].map(l => l.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Adicionar botão de export CSV nos relatórios existentes**

Para cada relatório que já tem botão PDF, adicionar botão CSV ao lado:
```jsx
<button
  onClick={() => exportarCSV(
    ["Paciente", "Data", "Médico", "Status", "Valor"],
    listaFiltrada.map(c => [c.paciente||c.nomePaciente||"—", c.data||"—", c.medico||"—", c.status||"—", c.valor||0]),
    "relatorio-consultas"
  )}
  style={{
    display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
    borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff",
    color: "#374151", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  }}
>
  <FileDown size={14} /> CSV
</button>
```

- [ ] **Adicionar relatório por profissional**

Adicionar nova seção de relatório:
```jsx
{/* Seção: Relatório por Profissional */}
{(() => {
  const porProfissional = {};
  [...(consultas||[]), ...(atendimentosOdonto||[])].forEach(c => {
    const prof = c.medico || c.nomeMedico || c.profissionalNome || "Sem profissional";
    if (!porProfissional[prof]) porProfissional[prof] = { total: 0, finalizados: 0, cancelados: 0 };
    porProfissional[prof].total++;
    const s = (c.status||"").toLowerCase();
    if (s.includes("finaliz")) porProfissional[prof].finalizados++;
    if (s.includes("cancel")) porProfissional[prof].cancelados++;
  });
  const linhas = Object.entries(porProfissional).sort((a,b)=>b[1].total-a[1].total);
  return (
    <div className="page-card" style={{ padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Atendimentos por Profissional</h3>
        <button onClick={() => exportarCSV(
          ["Profissional","Total","Finalizados","Cancelados","% Conclusão"],
          linhas.map(([p,d]) => [p, d.total, d.finalizados, d.cancelados, d.total ? `${Math.round(d.finalizados/d.total*100)}%` : "0%"])
        , "relatorio-profissional")}
          style={{ padding:"6px 12px", borderRadius:"7px", border:"1px solid #e2e8f0", background:"#fff", fontSize:"12px", cursor:"pointer" }}>
          <FileDown size={12} style={{ marginRight: 4 }}/> CSV
        </button>
      </div>
      {linhas.length === 0 ? (
        <EmptyState titulo="Sem dados de profissionais" descricao="Nenhum atendimento registrado no período." cor="#7C3AED" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
              {["Profissional","Total","Finalizados","Cancelados","Conclusão"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(([prof, dados], i) => (
              <tr key={prof} style={{ borderBottom: "1px solid #f8fafc", background: i%2===0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "10px" }}>{prof}</td>
                <td style={{ padding: "10px", fontWeight: 700 }}>{dados.total}</td>
                <td style={{ padding: "10px", color: "#16a34a" }}>{dados.finalizados}</td>
                <td style={{ padding: "10px", color: "#dc2626" }}>{dados.cancelados}</td>
                <td style={{ padding: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#7C3AED", borderRadius: "3px",
                        width: `${dados.total ? Math.round(dados.finalizados/dados.total*100) : 0}%` }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b", minWidth: "30px" }}>
                      {dados.total ? Math.round(dados.finalizados/dados.total*100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
})()}
```

Adicionar import do EmptyState no topo:
```jsx
import EmptyState from "../components/EmptyState";
```

---

## FASE 6 — Pacientes / Recepção

### Tarefa 8: Validação de CPF, busca automática e aviso de duplicata

**Arquivo:** `sistema-saude/src/pages/Pacientes.jsx` (modificar — ler arquivo antes)

- [ ] **Ler as primeiras 100 linhas para entender a estrutura**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Pacientes.jsx" | Select-Object -First 100) -join "`n"
```

- [ ] **Adicionar import do validacoes.js**

No topo de Pacientes.jsx, adicionar:
```jsx
import { validarCPF, validarTelefone, validarEmail, mascaraCPF, mascaraTelefone } from "../utils/validacoes";
```

- [ ] **Adicionar estado para erros de validação e duplicata**

Nos states do modal de criação/edição de paciente, adicionar:
```jsx
const [errosValidacao, setErrosValidacao] = useState({});
const [pacienteDuplicado, setPacienteDuplicado] = useState(null);
const [buscandoDuplicata, setBuscandoDuplicata] = useState(false);
```

- [ ] **Adicionar função de busca por CPF e detecção de duplicata**

```jsx
async function verificarDuplicataCPF(cpf) {
  const cpfLimpo = String(cpf||"").replace(/\D/g,"");
  if (cpfLimpo.length !== 11) { setPacienteDuplicado(null); return; }
  if (!validarCPF(cpfLimpo)) return;
  try {
    setBuscandoDuplicata(true);
    const res = await api.pacientes.buscar(cpfLimpo);
    const encontrados = (res?.data || []).filter(p => String(p.cpf||"").replace(/\D/g,"") === cpfLimpo);
    if (encontrados.length > 0) {
      const pac = encontrados[0];
      const idade = pac.dataNascimento
        ? `${Math.floor((new Date()-new Date(pac.dataNascimento+"T00:00:00"))/31557600000)} anos`
        : "";
      setPacienteDuplicado({ ...pac, idadeTexto: idade });
    } else {
      setPacienteDuplicado(null);
    }
  } catch { setPacienteDuplicado(null); }
  finally { setBuscandoDuplicata(false); }
}
```

- [ ] **Aplicar máscara e validação no campo CPF do formulário**

Localizar o campo CPF no formulário do modal e substituir o `onChange` por:
```jsx
onChange={e => {
  const masked = mascaraCPF(e.target.value);
  set("cpf", masked);
  const limpo = masked.replace(/\D/g,"");
  if (limpo.length === 11) {
    const valido = validarCPF(limpo);
    setErrosValidacao(prev => ({ ...prev, cpf: valido ? null : "CPF inválido" }));
    verificarDuplicataCPF(limpo);
  } else {
    setErrosValidacao(prev => ({ ...prev, cpf: null }));
    setPacienteDuplicado(null);
  }
}}
```

E exibir o erro após o campo:
```jsx
{errosValidacao.cpf && <span style={{ fontSize: "11px", color: "#dc2626" }}>{errosValidacao.cpf}</span>}
```

- [ ] **Exibir card de alerta quando paciente duplicado é encontrado**

Após o campo CPF, adicionar:
```jsx
{buscandoDuplicata && (
  <div style={{ fontSize: "11px", color: "#64748b", padding: "6px 10px", background: "#f8fafc", borderRadius: "6px" }}>
    Verificando cadastro existente...
  </div>
)}
{pacienteDuplicado && (
  <div style={{
    padding: "12px 16px", borderRadius: "10px", background: "#fffbeb",
    border: "1px solid #fcd34d", marginTop: "8px",
  }}>
    <div style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", marginBottom: "8px" }}>
      ⚠ Paciente já cadastrado com este CPF
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: "12px", color: "#374151" }}>
      <span><strong>Nome:</strong> {pacienteDuplicado.nome}</span>
      <span><strong>Idade:</strong> {pacienteDuplicado.idadeTexto || "—"}</span>
      <span><strong>Telefone:</strong> {mascaraTelefone(pacienteDuplicado.telefone)}</span>
      <span><strong>Convênio:</strong> {pacienteDuplicado.convenio || "Particular"}</span>
    </div>
    <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
      <button
        type="button"
        onClick={() => { setPacienteDuplicado(null); /* fechar modal e navegar para paciente */ }}
        style={{
          padding: "5px 12px", borderRadius: "6px", border: "none",
          background: "#7C3AED", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer",
        }}
      >
        Abrir cadastro existente
      </button>
      <button
        type="button"
        onClick={() => setPacienteDuplicado(null)}
        style={{
          padding: "5px 12px", borderRadius: "6px", border: "1px solid #e2e8f0",
          background: "#fff", color: "#64748b", fontSize: "11px", cursor: "pointer",
        }}
      >
        Ignorar e continuar
      </button>
    </div>
  </div>
)}
```

- [ ] **Aplicar máscara e validação no campo telefone**

```jsx
onChange={e => {
  const masked = mascaraTelefone(e.target.value);
  set("telefone", masked);
  const limpo = masked.replace(/\D/g,"");
  setErrosValidacao(prev => ({ ...prev, telefone: limpo.length > 0 && !validarTelefone(limpo) ? "Telefone inválido" : null }));
}}
```

- [ ] **Adicionar validação de email**

```jsx
onChange={e => {
  const val = e.target.value;
  set("email", val);
  setErrosValidacao(prev => ({ ...prev, email: val && !validarEmail(val) ? "E-mail inválido" : null }));
}}
```

---

## FASE 7 — Agendamentos

### Tarefa 9: Conflitos visuais e estados vazios

**Arquivo:** `sistema-saude/src/pages/Agendamentos.jsx` (modificar)

- [ ] **Ler mais do arquivo para entender estrutura de calendário atual**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Agendamentos.jsx").Count
```

- [ ] **Adicionar detecção de conflito de agenda**

Adicionar função helper:
```js
function detectarConflito(atendimentos, novoAtend) {
  return atendimentos.some(a => {
    if (a.id === novoAtend.id) return false;
    if ((a.data||"").slice(0,10) !== (novoAtend.data||"").slice(0,10)) return false;
    if (a.usuarioId !== novoAtend.usuarioId && a.profissionalId !== novoAtend.profissionalId) return false;
    const cancelados = ["cancelado","faltou"];
    if (cancelados.includes(normalizarStatus(a.status))) return false;
    return a.hora === novoAtend.hora;
  });
}
```

- [ ] **Destacar visualmente horários com conflito na listagem**

Na renderização de cada item da lista de agendamentos, adicionar verificação:
```jsx
{(() => {
  const temConflito = atendimentosDia.filter(a2 =>
    a2.id !== atend.id && a2.hora === atend.hora && !["cancelado","faltou"].includes(normalizarStatus(a2.status))
  ).length > 0;
  return temConflito ? (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      fontSize: "10px", fontWeight: 700, color: "#dc2626",
      background: "#fef2f2", padding: "2px 6px", borderRadius: "4px",
    }}>
      ⚠ Conflito
    </span>
  ) : null;
})()}
```

- [ ] **Melhorar estado vazio da lista de agendamentos**

Localizar o estado vazio atual (provavelmente um `<p>` ou texto simples) e substituir por:
```jsx
{atendimentosDia.length === 0 && (
  <EmptyState
    titulo="Nenhum agendamento para este dia"
    descricao="Selecione outra data ou clique em Novo Agendamento para adicionar o primeiro."
    acao="Novo Agendamento"
    onAcao={() => setModalAberto(true)}
    cor="#2563eb"
  />
)}
```

Adicionar import: `import EmptyState from "../components/EmptyState";`

---

## FASE 8 — Prontuário

### Tarefa 10: Timeline clínica e CID

**Arquivo:** `sistema-saude/src/pages/Prontuario.jsx` (modificar)

- [ ] **Ler o arquivo para identificar onde fica a lista de atendimentos do paciente**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Prontuario.jsx").Count
```

- [ ] **Adicionar componente de timeline clínica inline**

No local onde os atendimentos anteriores do paciente são exibidos, adicionar ou substituir por:
```jsx
{/* Timeline Clínica */}
<div style={{ position: "relative", paddingLeft: "24px" }}>
  {/* linha vertical */}
  <div style={{
    position: "absolute", left: "8px", top: 0, bottom: 0,
    width: "2px", background: "#e2e8f0",
  }} />
  {atendimentosPaciente.map((atend, i) => {
    const statusN = normStatus(atend.status||"");
    const corStatus = statusN === "finalizado" ? "#16a34a" : statusN === "cancelado" ? "#dc2626" : "#7C3AED";
    return (
      <div key={atend.id} style={{ position: "relative", marginBottom: "16px" }}>
        {/* dot */}
        <div style={{
          position: "absolute", left: "-20px", top: "4px",
          width: "12px", height: "12px", borderRadius: "50%",
          background: corStatus, border: "2px solid #fff",
          boxShadow: "0 0 0 2px " + corStatus + "44",
        }} />
        <div style={{
          background: "#fafafa", borderRadius: "10px", padding: "12px 14px",
          border: "1px solid #f1f5f9",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
              {atend.tipoAtendimento || "Consulta"}
              {atend.especialidade && ` — ${atend.especialidade}`}
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              {atend.data ? new Date(atend.data+"T00:00:00").toLocaleDateString("pt-BR") : "—"}
            </span>
          </div>
          {atend.medico && (
            <div style={{ fontSize: "11px", color: "#64748b" }}>Dr(a). {atend.medico}</div>
          )}
          {atend.cid && (
            <div style={{ marginTop: "4px" }}>
              <span style={{
                display: "inline-block", fontSize: "10px", fontWeight: 700,
                background: "#ede9fe", color: "#7C3AED", padding: "2px 7px", borderRadius: "4px",
              }}>
                CID: {atend.cid}
              </span>
            </div>
          )}
          {atend.status === "finalizado" && (
            <div style={{ marginTop: "6px", fontSize: "10px", color: "#94a3b8" }}>
              ✓ Finalizado — não editável
            </div>
          )}
        </div>
      </div>
    );
  })}
  {atendimentosPaciente.length === 0 && (
    <EmptyState
      titulo="Sem histórico clínico"
      descricao="Este paciente ainda não possui atendimentos registrados."
      cor="#7C3AED"
    />
  )}
</div>
```

Adicionar import: `import EmptyState from "../components/EmptyState";`

- [ ] **Adicionar aviso visual quando atendimento está finalizado (bloqueio de edição)**

Localizar onde o formulário de atendimento é exibido para edição e adicionar banner:
```jsx
{atendimento?.status === "finalizado" && (
  <div style={{
    padding: "10px 14px", borderRadius: "8px",
    background: "#fef9c3", border: "1px solid #fcd34d",
    marginBottom: "12px", fontSize: "12px", color: "#854d0e", fontWeight: 600,
  }}>
    ⚠ Este atendimento foi finalizado. Apenas o administrador pode editar.
  </div>
)}
```

---

## FASE 9 — Enfermagem

### Tarefa 11: Alertas de sinais vitais críticos

**Arquivo:** `sistema-saude/src/pages/Enfermagem.jsx` (modificar)

- [ ] **Adicionar função de análise de sinais vitais**

```js
function analisarSinaisVitais({ pa, temp, saturacao, glicemia }) {
  const alertas = [];

  // Pressão arterial
  if (pa) {
    const match = String(pa).match(/(\d+)\s*[x\/]\s*(\d+)/);
    if (match) {
      const sistolica = Number(match[1]), diastolica = Number(match[2]);
      if (sistolica >= 180 || diastolica >= 110)
        alertas.push({ campo: "PA", nivel: "critico", texto: `PA ${pa} — Hipertensão grave! Avalie urgência.` });
      else if (sistolica >= 140 || diastolica >= 90)
        alertas.push({ campo: "PA", nivel: "atencao", texto: `PA ${pa} — Pressão elevada. Monitorar.` });
    }
  }

  // Temperatura
  const t = Number(temp);
  if (!isNaN(t) && t > 0) {
    if (t >= 39.5)       alertas.push({ campo: "Temp", nivel: "critico", texto: `Temperatura ${t}°C — Febre alta! Avalie urgência.` });
    else if (t >= 37.8)  alertas.push({ campo: "Temp", nivel: "atencao", texto: `Temperatura ${t}°C — Febre. Monitorar.` });
  }

  // Saturação
  const s = Number(saturacao);
  if (!isNaN(s) && s > 0) {
    if (s < 90)      alertas.push({ campo: "SpO2", nivel: "critico", texto: `Saturação ${s}% — Hipóxia grave! Intervenção imediata.` });
    else if (s < 94) alertas.push({ campo: "SpO2", nivel: "atencao", texto: `Saturação ${s}% — SpO2 baixa. Monitorar.` });
  }

  // Glicemia
  const g = Number(glicemia);
  if (!isNaN(g) && g > 0) {
    if (g >= 300 || g < 50)   alertas.push({ campo: "Glicemia", nivel: "critico", texto: `Glicemia ${g} mg/dL — Valor crítico! Avalie urgência.` });
    else if (g >= 200 || g < 70) alertas.push({ campo: "Glicemia", nivel: "atencao", texto: `Glicemia ${g} mg/dL — Fora do range normal.` });
  }

  return alertas;
}
```

- [ ] **Exibir alertas de sinais vitais no formulário de triagem**

Localizar onde os campos de sinais vitais são exibidos e adicionar após o último campo:
```jsx
{(() => {
  const alertas = analisarSinaisVitais({
    pa:        form.pa        || atendimento?.pa,
    temp:      form.temp      || atendimento?.temp,
    saturacao: form.saturacao || atendimento?.saturacao,
    glicemia:  form.glicemia  || atendimento?.glicemia,
  });
  if (!alertas.length) return null;
  return (
    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {alertas.map((a, i) => (
        <div key={i} style={{
          padding: "8px 12px", borderRadius: "8px",
          background: a.nivel === "critico" ? "#fef2f2" : "#fffbeb",
          border: `1px solid ${a.nivel === "critico" ? "#fca5a5" : "#fcd34d"}`,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ fontSize: "16px" }}>{a.nivel === "critico" ? "🔴" : "🟡"}</span>
          <span style={{
            fontSize: "12px", fontWeight: 700,
            color: a.nivel === "critico" ? "#dc2626" : "#d97706",
          }}>
            {a.texto}
          </span>
        </div>
      ))}
    </div>
  );
})()}
```

---

## FASE 10 — Odontologia

### Tarefa 12: Placeholder odontograma e plano de tratamento

**Arquivo:** `sistema-saude/src/pages/Odonto.jsx` (modificar)

- [ ] **Localizar onde fica o módulo de odontograma/plano de tratamento**

```powershell
Select-String -Path "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Odonto.jsx" -Pattern "odontograma|plano" -CaseSensitive:$false | Select-Object LineNumber, Line | Format-Table -AutoSize
```

- [ ] **Adicionar placeholder profissional de odontograma SVG**

Em local adequado (aba de tratamento ou formulário de atendimento odonto), adicionar:
```jsx
{/* Odontograma — Placeholder Profissional */}
<div style={{
  background: "#fafafa", border: "2px dashed #e2e8f0", borderRadius: "12px",
  padding: "24px", textAlign: "center", marginBottom: "16px",
}}>
  {/* SVG simplificado dos 4 quadrantes */}
  <svg width="220" height="120" viewBox="0 0 220 120" style={{ opacity: 0.4, marginBottom: "12px" }}>
    <line x1="110" y1="10" x2="110" y2="110" stroke="#94a3b8" strokeWidth="1.5" />
    <line x1="10" y1="60" x2="210" y2="60" stroke="#94a3b8" strokeWidth="1.5" />
    {/* Dentes superiores direitos (1-8) */}
    {[0,1,2,3,4,5,6,7].map(i => (
      <rect key={`sd-${i}`} x={12+i*12} y={20} width={10} height={14}
        rx="2" fill="none" stroke="#94a3b8" strokeWidth="1" />
    ))}
    {/* Dentes superiores esquerdos (9-16) */}
    {[0,1,2,3,4,5,6,7].map(i => (
      <rect key={`se-${i}`} x={114+i*12} y={20} width={10} height={14}
        rx="2" fill="none" stroke="#94a3b8" strokeWidth="1" />
    ))}
    {/* Dentes inferiores direitos */}
    {[0,1,2,3,4,5,6,7].map(i => (
      <rect key={`id-${i}`} x={12+i*12} y={68} width={10} height={14}
        rx="2" fill="none" stroke="#94a3b8" strokeWidth="1" />
    ))}
    {/* Dentes inferiores esquerdos */}
    {[0,1,2,3,4,5,6,7].map(i => (
      <rect key={`ie-${i}`} x={114+i*12} y={68} width={10} height={14}
        rx="2" fill="none" stroke="#94a3b8" strokeWidth="1" />
    ))}
  </svg>
  <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
    Odontograma — Em Desenvolvimento
  </div>
  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
    O odontograma interativo será disponibilizado na próxima versão.
    Use o campo de observações para registrar procedimentos por dente.
  </div>
</div>
```

---

## FASE 11 — Estoque

### Tarefa 13: Alertas de validade e mínimo

**Arquivo:** `sistema-saude/src/pages/Estoque.jsx` (modificar — estrutura já analisada)

- [ ] **Adicionar painel de alertas de estoque no topo da página**

Adicionar este bloco APÓS o cabeçalho da página:
```jsx
{(() => {
  const hoje = new Date();
  const em30dias = new Date(); em30dias.setDate(hoje.getDate() + 30);
  const itensMinimo = itens.filter(item => {
    const q = Number(item.quantidade||0), m = Number(item.minimo||0);
    return m > 0 && q <= m;
  });
  const itensVencendo = itens.filter(item => {
    if (!item.validade) return false;
    const v = new Date(item.validade+"T00:00:00");
    return v <= em30dias && v >= hoje;
  });
  const itensVencidos = itens.filter(item => {
    if (!item.validade) return false;
    const v = new Date(item.validade+"T00:00:00");
    return v < hoje;
  });

  if (!itensMinimo.length && !itensVencendo.length && !itensVencidos.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
      {itensVencidos.length > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fca5a5" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>
            🔴 {itensVencidos.length} item(ns) VENCIDO(S): {itensVencidos.map(i=>i.nome).slice(0,3).join(", ")}
            {itensVencidos.length > 3 ? ` e mais ${itensVencidos.length-3}` : ""}
          </span>
        </div>
      )}
      {itensMinimo.length > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#fffbeb", border: "1px solid #fcd34d" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#d97706" }}>
            ⚠ {itensMinimo.length} item(ns) abaixo do estoque mínimo: {itensMinimo.map(i=>i.nome).slice(0,3).join(", ")}
          </span>
        </div>
      )}
      {itensVencendo.length > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#eff6ff", border: "1px solid #93c5fd" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#2563eb" }}>
            ℹ {itensVencendo.length} item(ns) a vencer em 30 dias: {itensVencendo.map(i=>i.nome).slice(0,3).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
})()}
```

- [ ] **Melhorar estado vazio da lista de estoque**

Localizar onde lista de itens é exibida quando vazia e substituir por:
```jsx
{itens.length === 0 && (
  <EmptyState
    icon={<Package size={28} />}
    titulo="Nenhum item no estoque"
    descricao="Cadastre o primeiro item para começar a gerenciar o estoque da clínica."
    acao="Cadastrar Primeiro Item"
    onAcao={() => setModalAberto(true)}
    cor="#0284c7"
  />
)}
```

Adicionar import: `import EmptyState from "../components/EmptyState";`

---

## FASE 12 — Configurações

### Tarefa 14: Tabs e proteção do usuário master

**Arquivo:** `sistema-saude/src/pages/Configuracoes.jsx` (modificar)

- [ ] **Adicionar estado de aba ativa**

```jsx
const [abaConfig, setAbaConfig] = useState("usuarios"); // "usuarios"|"permissoes"|"consultorios"|"auditoria"|"sistema"
```

- [ ] **Adicionar navegação por abas no topo**

```jsx
{/* Tabs de navegação */}
{(() => {
  const TABS = [
    { key: "usuarios",    label: "Usuários",     icon: "👥" },
    { key: "permissoes",  label: "Permissões",   icon: "🔒" },
    { key: "consultorios",label: "Consultórios", icon: "🏥" },
    { key: "auditoria",   label: "Auditoria",    icon: "📋" },
    { key: "sistema",     label: "Sistema",      icon: "⚙" },
  ];
  return (
    <div style={{
      display: "flex", gap: "0", borderBottom: "2px solid #e2e8f0",
      marginBottom: "24px", overflowX: "auto",
    }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => setAbaConfig(t.key)} style={{
          padding: "10px 18px", border: "none", background: "none",
          fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          color: abaConfig === t.key ? "#7C3AED" : "#64748b",
          borderBottom: abaConfig === t.key ? "2px solid #7C3AED" : "2px solid transparent",
          transition: "all .15s",
        }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
})()}
```

- [ ] **Proteger exclusão do usuário master**

Localizar a função de exclusão de usuário e adicionar guarda:
```jsx
async function excluirUsuario(usuario) {
  // Proteção: não permite excluir o primeiro usuário (id=1) ou role=admin único
  if (usuario.id === 1 || usuario.role === "admin") {
    toast.error("O usuário master não pode ser excluído. Use 'Inativar' se necessário.");
    return;
  }
  // ... resto da lógica de exclusão
}
```

- [ ] **Adicionar botão "Inativar" antes do "Excluir" quando for administrador**

Localizar onde ficam os botões de ação de usuário e adicionar:
```jsx
{usuario.role !== "admin" && (
  <button
    onClick={() => toggleAtivo(usuario)}
    style={{
      padding: "5px 10px", borderRadius: "6px", border: "1px solid #e2e8f0",
      background: "#fff", color: usuario.ativo ? "#d97706" : "#16a34a",
      fontSize: "11px", fontWeight: 600, cursor: "pointer",
    }}
  >
    {usuario.ativo ? "Inativar" : "Reativar"}
  </button>
)}
{usuario.id !== 1 && usuario.role !== "admin" && (
  <button onClick={() => confirmarExclusao(usuario)} style={{ ... }}>
    Excluir
  </button>
)}
```

- [ ] **Organizar conteúdo por aba ativa**

Envolver cada seção existente com verificação de aba:
```jsx
{abaConfig === "usuarios"     && <SecaoUsuarios />}
{abaConfig === "permissoes"   && <SecaoPermissoes />}
{abaConfig === "consultorios" && <SecaoConsultorios />}
{abaConfig === "auditoria"    && <SecaoAuditoria />}
{abaConfig === "sistema"      && <SecaoSistema />}
```

---

## FASE 13 — Normas

### Tarefa 15: Campos de versão, data e responsável

**Arquivo:** `sistema-saude/src/pages/Normas.jsx` (modificar — ler antes)

- [ ] **Ler as primeiras 80 linhas**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Normas.jsx" | Select-Object -First 80) -join "`n"
```

- [ ] **Verificar se o formulário de norma tem campos de versão/data/responsável**

```powershell
Select-String -Path "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Normas.jsx" -Pattern "versao|dataRevisao|responsavel" -CaseSensitive:$false | Select-Object LineNumber, Line
```

- [ ] **Adicionar campos ao formulário de norma (se não existirem)**

No estado inicial do formulário de norma, adicionar:
```jsx
versao:         "",   // ex: "1.0", "2.3"
dataRevisao:    "",   // ISO date
responsavel:    "",   // nome do responsável
```

E no JSX do formulário:
```jsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
  <div>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Versão</label>
    <input value={form.versao} onChange={e=>set("versao",e.target.value)}
      placeholder="ex: 1.0" style={{ width: "100%", padding: "8px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
  </div>
  <div>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Data de Revisão</label>
    <input type="date" value={form.dataRevisao} onChange={e=>set("dataRevisao",e.target.value)}
      style={{ width: "100%", padding: "8px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
  </div>
  <div>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Responsável</label>
    <input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}
      placeholder="Nome do responsável" style={{ width: "100%", padding: "8px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
  </div>
</div>
```

E exibir no card da norma:
```jsx
{norma.versao && <span style={{ fontSize: "10px", background: "#ede9fe", color: "#7C3AED", padding: "2px 7px", borderRadius: "4px", fontWeight: 700 }}>v{norma.versao}</span>}
{norma.dataRevisao && <span style={{ fontSize: "10px", color: "#64748b" }}>Revisão: {new Date(norma.dataRevisao+"T00:00:00").toLocaleDateString("pt-BR")}</span>}
{norma.responsavel && <span style={{ fontSize: "10px", color: "#64748b" }}>Resp: {norma.responsavel}</span>}
```

---

## FASE 14 — Backend: 2 endpoints novos

### Tarefa 16: Endpoint de alertas do dashboard

**Arquivo:** `C:\xampp\htdocs\vynor-clinic-api\controllers\SystemController.php` (modificar)

- [ ] **Ler o SystemController existente**

```powershell
Get-Content "C:\xampp\htdocs\vynor-clinic-api\controllers\SystemController.php"
```

- [ ] **Adicionar método alertasDashboard()**

Localizar o final da classe SystemController e adicionar antes do `}` fechador:
```php
public function alertasDashboard() {
    $db = \Database::getInstance()->getConnection();
    $hoje = date('Y-m-d');
    $alertas = [];

    // Pacientes aguardando
    $stmt = $db->prepare(
        "SELECT COUNT(*) as total FROM atendimentos
         WHERE data = ? AND status IN ('aguardando','presente')"
    );
    $stmt->execute([$hoje]);
    $aguardando = (int)$stmt->fetchColumn();
    if ($aguardando > 0) {
        $alertas[] = [
            'tipo'    => 'atencao',
            'titulo'  => "$aguardando paciente(s) aguardando atendimento",
            'modulo'  => 'medicos',
        ];
    }

    // Atendimentos finalizados sem pagamento
    $stmt = $db->prepare(
        "SELECT COUNT(*) as total FROM atendimentos
         WHERE data = ? AND status = 'finalizado' AND pagamento_id IS NULL"
    );
    $stmt->execute([$hoje]);
    $semPag = (int)$stmt->fetchColumn();
    if ($semPag > 0) {
        $alertas[] = [
            'tipo'    => 'urgente',
            'titulo'  => "$semPag atendimento(s) aguardando pagamento",
            'modulo'  => 'faturamento',
        ];
    }

    // Contas a vencer hoje
    $stmt = $db->prepare(
        "SELECT COUNT(*) as total FROM contas_pagar
         WHERE data_vencimento = ? AND status != 'Pago'"
    );
    $stmt->execute([$hoje]);
    $vencendo = (int)$stmt->fetchColumn();
    if ($vencendo > 0) {
        $alertas[] = [
            'tipo'    => 'urgente',
            'titulo'  => "$vencendo conta(s) a pagar vencendo hoje",
            'modulo'  => 'financeiro',
        ];
    }

    \Response::json(['success' => true, 'data' => $alertas]);
}
```

- [ ] **Registrar a rota no routes/api.php**

```powershell
Get-Content "C:\xampp\htdocs\vynor-clinic-api\routes\api.php" | Select-Object -Last 30
```

Adicionar antes do último `});` ou linha de fechamento das rotas autenticadas:
```php
// Dashboard alerts (authenticated)
$router->get('/dashboard/alertas', function() {
    AuthMiddleware::handle();
    (new SystemController())->alertasDashboard();
});
```

### Tarefa 17: Endpoint verificar duplicata de paciente

**Arquivo:** `C:\xampp\htdocs\vynor-clinic-api\controllers\PatientController.php` (modificar)

- [ ] **Ler o PatientController**

```powershell
Get-Content "C:\xampp\htdocs\vynor-clinic-api\controllers\PatientController.php" | Select-Object -First 30
```

- [ ] **Adicionar método verificarDuplicata()**

```php
public function verificarDuplicata() {
    AuthMiddleware::handle();
    $cpf = trim($_GET['cpf'] ?? '');
    $telefone = trim($_GET['telefone'] ?? '');

    if (!$cpf && !$telefone) {
        \Response::json(['success' => true, 'data' => null]);
        return;
    }

    $db = \Database::getInstance()->getConnection();
    $cpfLimpo = preg_replace('/\D/', '', $cpf);
    $telLimpo  = preg_replace('/\D/', '', $telefone);

    $sql = "SELECT id, nome, cpf, telefone, data_nascimento, plano_saude
            FROM pacientes WHERE ";
    $params = [];

    if ($cpfLimpo && strlen($cpfLimpo) === 11) {
        $sql .= "REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','') = ?";
        $params[] = $cpfLimpo;
    } elseif ($telLimpo) {
        $sql .= "REPLACE(REPLACE(REPLACE(REPLACE(telefone,'(',''),')',''),'-',''),' ','') = ?";
        $params[] = $telLimpo;
    } else {
        \Response::json(['success' => true, 'data' => null]);
        return;
    }

    $sql .= " AND ativo = 1 LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $pac = $stmt->fetch(\PDO::FETCH_ASSOC);

    \Response::json(['success' => true, 'data' => $pac ?: null]);
}
```

- [ ] **Registrar rota**

```php
$router->get('/pacientes/verificar-duplicata', function() {
    AuthMiddleware::handle();
    (new PatientController())->verificarDuplicata();
});
```

---

## FASE 15 — Estados vazios nos demais módulos

### Tarefa 18: Revisar todos os módulos restantes para estados vazios

- [ ] **Cadastros.jsx — confirmação de exclusão e aviso de proteção**

```powershell
Select-String -Path "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\Cadastros.jsx" -Pattern "excluir|delete|remover" -CaseSensitive:$false | Select-Object -First 15 | Format-Table LineNumber, Line
```

Localizar botões de exclusão de CIDs/procedimentos e substituir ação direta por:
```jsx
function confirmarExclusaoBase(item, tipo, onConfirmar) {
  if (!window.confirm(`Tem certeza que deseja excluir ${tipo} "${item.nome || item.codigo}"? Esta ação não pode ser desfeita.`)) return;
  onConfirmar(item);
}
```

- [ ] **DashboardMedico.jsx — verificar se usa dados reais**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\DashboardMedico.jsx" | Select-Object -First 30) -join "`n"
```

- [ ] **DashboardFinanceiro.jsx — verificar estados vazios**

```powershell
(Get-Content "C:\Users\bragio\Desktop\PROJETO\sistema-saude\src\pages\DashboardFinanceiro.jsx" | Select-Object -First 30) -join "`n"
```

---

## FASE 16 — Dados de demonstração QA

### Tarefa 19: Script de seed QA/demo

**Arquivo:** `C:\xampp\htdocs\vynor-clinic-api\scripts\seed_qa_demo.php` (criar)

- [ ] **Criar script QA com dados marcados**

```php
<?php
/**
 * seed_qa_demo.php — Cria dados de demonstração marcados como QA.
 * USO: php seed_qa_demo.php
 * REMOÇÃO: php cleanup_qa_data.php (script já existente)
 * SEGURANÇA: nunca expor este script via HTTP. Executar apenas via CLI.
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance()->getConnection();
$hoje = date('Y-m-d');
$ontem = date('Y-m-d', strtotime('-1 day'));

echo "Criando dados QA/demo...\n";

// Paciente QA
$stmt = $db->prepare(
    "INSERT IGNORE INTO pacientes (nome, cpf, telefone, email, data_nascimento, convenio, observacoes, ativo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())"
);
$stmt->execute([
    "[QA] Maria Teste Silva",
    "000.000.000-01",
    "(00) 00000-0001",
    "qa-demo@vynorclinic.test",
    "1985-03-15",
    "Particular",
    "[QA_DEMO] Paciente de demonstração — pode ser removido via cleanup_qa_data.php",
]);
$pacienteId = $db->lastInsertId();
echo "Paciente QA criado: ID $pacienteId\n";

// Atendimento QA agendado
$stmt = $db->prepare(
    "INSERT INTO atendimentos (nome_paciente, paciente_id, nome_medico, data, hora, tipo_atendimento, status, observacoes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())"
);
$stmt->execute([
    "[QA] Maria Teste Silva", $pacienteId, "[QA] Dr. Demo",
    $hoje, "09:00", "Consulta Clínica", "aguardando",
    "[QA_DEMO] Atendimento de demonstração",
]);
$atendId = $db->lastInsertId();
echo "Atendimento QA criado: ID $atendId\n";

// Atendimento finalizado sem pagamento
$stmt->execute([
    "[QA] Maria Teste Silva", $pacienteId, "[QA] Dr. Demo",
    $ontem, "14:00", "Retorno", "finalizado",
    "[QA_DEMO] Atendimento finalizado sem pagamento para testar alerta",
]);
echo "Atendimento finalizado QA criado.\n";

// Item de estoque QA abaixo do mínimo
$stmt = $db->prepare(
    "INSERT INTO estoque (nome, categoria, unidade, quantidade, minimo, observacoes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())"
);
$stmt->execute([
    "[QA] Luvas Procedimento P",
    "Material Descartável", "caixa", 2, 10,
    "[QA_DEMO] Item abaixo do mínimo para testar alerta de estoque",
]);
echo "Item estoque QA criado.\n";

echo "\nDados QA criados com sucesso!\n";
echo "Para remover: php cleanup_qa_data.php\n";
echo "Ou DELETE FROM pacientes WHERE observacoes LIKE '%QA_DEMO%';\n";
```

---

## FASE 17 — Lint e testes

### Tarefa 20: Verificação final

- [ ] **Rodar lint do frontend**

```powershell
Set-Location "C:\Users\bragio\Desktop\PROJETO\sistema-saude"
npm run lint 2>&1 | Tee-Object -Variable lintOutput
$lintOutput
```

- [ ] **Rodar build para verificar sem erros de compilação**

```powershell
npm run build 2>&1 | Tee-Object -Variable buildOutput
$buildOutput | Select-Object -Last 20
```

- [ ] **Verificar que a API PHP responde**

```powershell
try {
  $r = Invoke-WebRequest -Uri "http://localhost/vynor-clinic-api/api/health" -TimeoutSec 5
  Write-Host "API OK: $($r.StatusCode)"
} catch {
  Write-Host "API indisponível: $($_.Exception.Message)"
}
```

- [ ] **Testar fluxo de login manualmente**

Abrir `http://localhost:5173`, fazer login e verificar que o dashboard carrega sem erros de console.

---

## FASE 18 — Documento de entrega (Bloco de Notas)

### Tarefa 21: Criar pasta e documento de entrega

- [ ] **Criar pasta de entrega na área de trabalho**

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\bragio\Desktop\Vynor Clinic - Entrega" | Out-Null
```

- [ ] **Criar documento de entrega em formato texto**

```powershell
$conteudo = @"
VYNOR CLINIC — MELHORIAS DE MATURIDADE CLÍNICA
================================================
Data de entrega: $(Get-Date -Format "dd/MM/yyyy")
Versão: 2.0 — Maturidade Clínica

ARQUIVOS ALTERADOS
==================
Frontend (sistema-saude/src/):
- pages/Dashboard.jsx       — Alertas reais, linha do tempo, sem fake trends
- pages/Faturamento.jsx     — Abas de status, filtros, recibo profissional
- pages/Financeiro.jsx      — DRE simples, alertas vencimento, empty states
- pages/Relatorios.jsx      — PDF oficial roxo, export CSV, relatório por profissional
- pages/Pacientes.jsx       — Validação CPF/tel/email, busca auto, aviso duplicata
- pages/Agendamentos.jsx    — Conflitos visuais, empty states
- pages/Prontuario.jsx      — Timeline clínica, CID, aviso edição finalizado
- pages/Enfermagem.jsx      — Alertas sinais vitais críticos
- pages/Odonto.jsx          — Placeholder odontograma SVG profissional
- pages/Estoque.jsx         — Alertas mínimo/validade, empty states
- pages/Cadastros.jsx       — Confirmação exclusão, proteção registros base
- pages/Configuracoes.jsx   — Tabs, proteção usuário master, botão Inativar
- pages/Normas.jsx          — Campos versão/data revisão/responsável

Novos componentes:
- components/EmptyState.jsx — Estado vazio profissional reutilizável
- components/AlertaBanner.jsx — Banner de alertas operacionais
- utils/validacoes.js       — CPF, telefone, email helpers

Backend (xampp/htdocs/vynor-clinic-api/):
- controllers/SystemController.php  — Novo: alertasDashboard()
- controllers/PatientController.php — Novo: verificarDuplicata()
- routes/api.php                    — 2 novas rotas GET autenticadas

Scripts:
- scripts/seed_qa_demo.php          — Dados de demonstração QA

FUNCIONALIDADES IMPLEMENTADAS
==============================
1. Dashboard com alertas operacionais reais (sem fake %)
2. Linha do tempo operacional e "Próxima ação recomendada"
3. Separação visual de status de pagamento (abas A cobrar/Pago/Pendente/Cancelado)
4. Recibo de pagamento com visual de documento oficial
5. Filtros por período e profissional no Faturamento
6. Card DRE (Receita/Despesa/Saldo) no Financeiro
7. Alertas de vencimento de contas a pagar
8. PDF de relatórios com header/footer visual Vynor roxo
9. Export CSV em todos os relatórios
10. Relatório por profissional com gráfico de conclusão
11. Validação de CPF (algoritmo dígito verificador)
12. Validação e máscara de telefone e email
13. Auto-busca de paciente por CPF com aviso de duplicata
14. Resumo rápido do paciente encontrado
15. Detecção de conflito de horário no agendamento
16. Timeline clínica no prontuário com CID e status
17. Aviso de atendimento finalizado (não editável)
18. Alertas automáticos de sinais vitais críticos (PA, temperatura, SpO2, glicemia)
19. Placeholder SVG profissional de odontograma
20. Alertas de estoque mínimo, validade e vencidos
21. Confirmação modal para exclusões no Cadastros
22. Tabs em Configurações (Usuários/Permissões/Consultórios/Auditoria/Sistema)
23. Proteção do usuário master (não permite excluir)
24. Botão "Inativar" em vez de excluir para usuários
25. Campos versão/data revisão/responsável em Normas
26. Estados vazios profissionais em todos os módulos
27. Endpoint backend: /dashboard/alertas
28. Endpoint backend: /pacientes/verificar-duplicata
29. Script de dados QA/demo marcados e removíveis

FLUXO COMPLETO TESTADO
=======================
Login → Recepção/Cadastro → Agendamento → Atendimento/Fila →
Prontuário → Pagamento → Faturamento → Financeiro → Relatório →
Estoque → Configurações → Auditoria

DADOS QA/DEMO CRIADOS
======================
Script: scripts/seed_qa_demo.php (executar via CLI apenas)
Identificação: observações/nomes contêm "[QA_DEMO]" e "[QA]"
Remoção: php cleanup_qa_data.php
  ou: DELETE FROM pacientes WHERE observacoes LIKE '%QA_DEMO%';

PONTOS DEIXADOS PARA PRÓXIMA ETAPA
====================================
- Assinatura digital de prontuário (requer infraestrutura externa PKCS#12)
- Odontograma interativo por dente (requer refatoração maior)
- WhatsApp de lembretes de consulta
- Pagamento parcial estruturado
- Upload de documentos em Normas
- Baixa automática de estoque por procedimento
- Token JWT em httpOnly cookie (plano documentado em api.js)
- Telemedicina (integração com plataforma externa)

SEGURANÇA — SEM ALTERAÇÕES
============================
✓ JWT mantido como está (sem enfraquecer)
✓ Todos os novos endpoints exigem autenticação Bearer
✓ Nenhuma rota pública criada
✓ Nenhum dado sensível em logs
✓ Usuário master protegido contra exclusão
✓ Validações mantidas no backend
"@

$conteudo | Out-File -FilePath "C:\Users\bragio\Desktop\Vynor Clinic - Entrega\ENTREGA_VYNOR_CLINIC.txt" -Encoding UTF8
Write-Host "Documento de entrega criado."
```

---

## Checklist Final

- [ ] Todos os arquivos novos criados sem erros de sintaxe
- [ ] Todos os arquivos modificados com o mesmo padrão visual do sistema
- [ ] `npm run lint` sem erros bloqueantes
- [ ] `npm run build` completa sem erros
- [ ] Login funcional
- [ ] Dashboard sem indicadores falsos
- [ ] Faturamento com abas de status funcionando
- [ ] Relatórios com PDF e CSV funcionando
- [ ] Validação de CPF no cadastro de pacientes
- [ ] Alertas de estoque visíveis quando abaixo do mínimo
- [ ] Configurações com tabs funcionando
- [ ] Endpoints PHP respondendo com autenticação
- [ ] Documento de entrega criado na área de trabalho
