import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarData, calcularIdade, dateToLocalISO } from "../utils/dateUtils";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function normStatus(s) {
  const t = (s || "").toLowerCase().trim();
  if (t === "finalizado" || t === "finalizada") return "finalizado";
  return t;
}

function normText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function val(v) {
  return v && String(v).trim() ? String(v).trim() : "—";
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarTimestamp(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

// ── Estilos ─────────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.05)",
    padding: "20px",
  },
  pill: (ativo, cor) => ({
    padding: "7px 16px",
    borderRadius: "999px",
    border: "none",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    background: ativo ? (cor || "#0f172a") : "transparent",
    color: ativo ? "#fff" : "#64748b",
    transition: "all .15s",
    whiteSpace: "nowrap",
  }),
  label: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: ".06em",
    display: "block",
    marginBottom: "3px",
  },
  input: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "13px",
    outline: "none",
    color: "#0f172a",
    background: "#fafafa",
    boxSizing: "border-box",
  },
};

function Campo({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <span style={S.label}>{label}</span>
      <div style={{ fontSize: "14px", color: "#334155", padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────────

export default function Prontuario({ consultas = [], atendimentosOdonto = [], pacientes = [] }) {
  const { userData } = useAuth();
  const toast = useToast();
  const isAdmin = userData?.role === "admin" || (Array.isArray(userData?.permissions) && (userData.permissions.includes("administracao") || userData.permissions.includes("configuracoes")));
  const isMedico = userData?.role === "medico" || userData?.role === "médico";

  const [busca, setBusca] = useState("");
  const [filtroProfissional, setFiltroProfissional] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [selecionado, setSelecionado] = useState(null);
  const [aba, setAba] = useState("resumo");
  const [visiveis, setVisiveis] = useState(20);

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Prontuários finalizados (base) — never show future dates
  const prontuarios = useMemo(() => {
    const base = consultas
      .filter((c) => normStatus(c.status) === "finalizado" && c.prontuario && (c.data || "") <= hoje)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    if (isAdmin) return base;
    if (isMedico && userData?.id) {
      const meuId = String(userData.id);
      const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
      return base.filter((c) =>
        String(c.usuarioId) === meuId || (c.medico || "").toLowerCase().trim() === nome
      );
    }
    return base;
  }, [consultas, isAdmin, isMedico, userData, hoje]);

  const profissionais = useMemo(() =>
    [...new Set(prontuarios.map((c) => c.medico).filter(Boolean))].sort(),
    [prontuarios]);

  const especialidades = useMemo(() =>
    [...new Set(prontuarios.map((c) => c.especialidade).filter(Boolean))].sort(),
    [prontuarios]);

  const filtrados = useMemo(() => {
    const t = normText(busca);
    return prontuarios.filter((c) => {
      const buscaOk = !t || normText(c.paciente).includes(t) || normText(c.medico).includes(t) || normText(c.prontuario?.cid).includes(t) || normText(c.especialidade).includes(t);
      const profOk = !filtroProfissional || c.medico === filtroProfissional;
      const espOk = !filtroEspecialidade || c.especialidade === filtroEspecialidade;
      const inicioOk = !filtroInicio || (c.data || "") >= filtroInicio;
      const fimOk = !filtroFim || (c.data || "") <= filtroFim;
      return buscaOk && profOk && espOk && inicioOk && fimOk;
    });
  }, [prontuarios, busca, filtroProfissional, filtroEspecialidade, filtroInicio, filtroFim]);

  useEffect(() => { setVisiveis(20); }, [prontuarios, busca, filtroProfissional, filtroEspecialidade, filtroInicio, filtroFim]); // eslint-disable-line react-hooks/set-state-in-effect

  // Dados do paciente selecionado
  const dadosPaciente = useMemo(() => {
    if (!selecionado) return null;
    const nome = (selecionado.paciente || "").toLowerCase();
    return pacientes.find((p) => (p.nome || "").toLowerCase() === nome) || null;
  }, [pacientes, selecionado]);

  // Histórico médico completo do paciente
  const historicoPaciente = useMemo(() => {
    if (!selecionado) return [];
    const nome = (selecionado.paciente || "").toLowerCase();
    return prontuarios
      .filter((c) => (c.paciente || "").toLowerCase() === nome)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [prontuarios, selecionado]);

  // Histórico odonto do paciente
  const historicoOdonto = useMemo(() => {
    if (!selecionado) return [];
    const nome = (selecionado.paciente || "").toLowerCase();
    return atendimentosOdonto
      .filter((a) => normStatus(a.status) === "finalizado" && (a.pacienteNome || a.paciente || "").toLowerCase() === nome)
      .sort((a, b) => {
        const tA = formatarTimestamp(a.finalizadoEm)?.getTime() || 0;
        const tB = formatarTimestamp(b.finalizadoEm)?.getTime() || 0;
        return tB - tA;
      });
  }, [atendimentosOdonto, selecionado]);

  // Timeline unificada (médico + odonto)
  const timeline = useMemo(() => {
    if (!selecionado) return [];
    const eventos = [];
    historicoPaciente.forEach((c) => {
      eventos.push({
        id: `med-${c.id}`,
        tipo: "medico",
        data: c.data || "",
        hora: c.hora || "",
        titulo: c.especialidade || "Consulta médica",
        subtitulo: c.medico || "—",
        diagnostico: c.prontuario?.hipoteseDiagnostica || "",
        cid: c.prontuario?.cid || "",
        conduta: c.prontuario?.conduta || "",
        receita: c.prontuario?.receita || "",
        sinaisVitais: {
          pa: c.prontuario?.pressaoSistolica ? `${c.prontuario.pressaoSistolica}/${c.prontuario.pressaoDiastolica} mmHg` : "",
          fc: c.prontuario?.frequenciaCardiaca ? `${c.prontuario.frequenciaCardiaca} bpm` : "",
          temp: c.prontuario?.temperatura ? `${c.prontuario.temperatura}°C` : "",
          peso: c.prontuario?.peso ? `${c.prontuario.peso} kg` : "",
          spo2: c.prontuario?.saturacaoO2 ? `${c.prontuario.saturacaoO2}%` : "",
        },
        exames: c.prontuario?.examesSolicitados || [],
        original: c,
      });
    });
    historicoOdonto.forEach((a) => {
      const ts = formatarTimestamp(a.finalizadoEm);
      const dataISO = ts ? dateToLocalISO(ts) : a.data || "";
      const procs = (a.procedimentosRealizados || []).map((p) => p.nome).join(", ");
      eventos.push({
        id: `odo-${a.id}`,
        tipo: "odonto",
        data: dataISO,
        hora: ts ? ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
        titulo: "Odontologia",
        subtitulo: a.profissionalNome || "—",
        diagnostico: procs,
        cid: "",
        conduta: procs,
        valorFinal: a.valorFinal,
        statusPag: a.statusPagamento,
        original: a,
      });
    });
    return eventos.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [historicoPaciente, historicoOdonto, selecionado]);

  // Alertas clínicos inteligentes
  const alertas = useMemo(() => {
    if (!historicoPaciente.length) return null;
    const cidsMap = {};
    const medFq = {};
    let alergias = "";
    historicoPaciente.forEach((c) => {
      const p = c.prontuario || {};
      if (p.cid) { const k = p.cid.trim().toUpperCase(); cidsMap[k] = (cidsMap[k] || 0) + 1; }
      if (p.alergias && !alergias) alergias = p.alergias;
      (p.medicamentos || []).forEach((m) => {
        if (m.nome) medFq[m.nome] = (medFq[m.nome] || 0) + 1;
      });
      if (p.receita) {
        const linhas = p.receita.split("\n").filter((l) => l.trim() && !l.startsWith("Paciente"));
        linhas.forEach((l) => {
          const nome = l.replace(/^\d+\.\s*/, "").split("–")[0].split("-")[0].trim();
          if (nome && nome.length > 3) medFq[nome] = (medFq[nome] || 0) + 1;
        });
      }
    });
    const cids = Object.entries(cidsMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cod, n]) => ({ cod, n }));
    const meds = Object.entries(medFq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nome, n]) => ({ nome, n }));
    return { cids, meds, alergias, totalConsultas: historicoPaciente.length };
  }, [historicoPaciente]);

  // métricas reservadas para uso futuro
  // const totalPacientes = new Set(prontuarios.map((c) => c.paciente)).size;
  // const totalProfissionais = new Set(prontuarios.map((c) => c.medico).filter(Boolean)).size;
  // const totalEspecialidades = new Set(prontuarios.map((c) => c.especialidade).filter(Boolean)).size;

  function copiar(texto) {
    navigator.clipboard.writeText(texto || "")
      .then(() => toast.success("Copiado com sucesso."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function gerarDeclaracao(c) {
    return `DECLARAÇÃO DE COMPARECIMENTO\n\nDeclaramos que ${c.paciente || "—"} compareceu a esta unidade em ${formatarData(c.data)} às ${c.hora || "—"} para atendimento (${c.tipoAtendimento || "consulta"}).\n\nProfissional: ${c.medico || "—"}  |  Especialidade: ${c.especialidade || "—"}\n\nEmitido para fins de comprovação de comparecimento.`;
  }

  function imprimirProntuario(c) {
    const p = c.prontuario || {};

    const CORES_RISCO = {
      vermelho: "#dc2626", laranja: "#ea580c", amarelo: "#ca8a04",
      verde: "#16a34a", azul: "#2563eb",
    };
    const LABELS_RISCO = {
      vermelho: "Vermelho — Emergência", laranja: "Laranja — Muito urgente",
      amarelo: "Amarelo — Urgente", verde: "Verde — Pouco urgente", azul: "Azul — Não urgente",
    };

    const vitais = [
      (c.pa || p.pa)               && `PA: ${c.pa || p.pa} mmHg`,
      (c.temp || p.temperatura)    && `Temp: ${c.temp || p.temperatura}°C`,
      (c.saturacao || p.saturacaoO2) && `SpO₂: ${c.saturacao || p.saturacaoO2}%`,
      (c.peso || p.peso)           && `Peso: ${c.peso || p.peso} kg`,
      (c.altura || p.altura)       && `Altura: ${c.altura || p.altura} cm`,
      p.freq_cardiaca              && `FC: ${p.freq_cardiaca} bpm`,
      p.freq_respiratoria          && `FR: ${p.freq_respiratoria} irpm`,
      p.glicemia                   && `Glicemia: ${p.glicemia} mg/dL`,
      p.frequenciaCardiaca         && !p.freq_cardiaca && `FC: ${p.frequenciaCardiaca} bpm`,
      p.pressaoSistolica           && !c.pa && `PA: ${p.pressaoSistolica}/${p.pressaoDiastolica || "?"} mmHg`,
    ].filter(Boolean).join("   &nbsp;&nbsp;");

    const riscoHtml = p.classificacao_risco
      ? `<div style="margin:6px 0 0;display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;color:${CORES_RISCO[p.classificacao_risco] || "#374151"};border:1px solid ${CORES_RISCO[p.classificacao_risco] || "#e5e7eb"}">${LABELS_RISCO[p.classificacao_risco] || p.classificacao_risco}</div>`
      : "";

    const triagem = [
      p.queixa_principal && `<h2>Queixa Principal</h2><p>${p.queixa_principal.replace(/\n/g, "<br>")}</p>`,
      p.alergias         && `<h2>Alergias</h2><p>${p.alergias}</p>`,
      p.medicamentos_uso && `<h2>Medicamentos em Uso</h2><p>${p.medicamentos_uso}</p>`,
    ].filter(Boolean).join("");

    const html = `<!DOCTYPE html>
<html><head><title>Prontuário — ${c.paciente || "Paciente"}</title>
<meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;padding:36px 48px;color:#111;font-size:13px;max-width:800px;margin:0 auto}
  h1{font-size:20px;font-weight:800;margin:0 0 2px}
  h2{font-size:12px;font-weight:700;color:#334155;margin:18px 0 5px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0;padding-bottom:3px}
  p{margin:0 0 8px;line-height:1.5}
  ul{margin:0;padding-left:18px}
  li{margin-bottom:3px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:14px}
  .field strong{display:block;font-size:10px;text-transform:uppercase;color:#94a3b8;margin-bottom:2px}
  .vitais{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;font-size:12px;margin-bottom:4px}
  .header-line{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px 28px}@page{margin:16mm}}
</style>
</head><body>

<div class="header-line">
  <div>
    <h1>Prontuário Clínico</h1>
    <p style="color:#64748b;font-size:11px;margin-top:2px">Vynor Clinic · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
  </div>
  ${riscoHtml ? `<div>${riscoHtml}</div>` : ""}
</div>

<div class="row">
  <div class="field"><strong>Paciente</strong>${c.paciente || "—"}</div>
  <div class="field"><strong>Data do atendimento</strong>${formatarData(c.data)} às ${c.hora || "—"}</div>
  <div class="field"><strong>Profissional</strong>${c.medico || "—"}</div>
  <div class="field"><strong>Especialidade</strong>${c.especialidade || "—"}</div>
  ${p.triagem_por ? `<div class="field"><strong>Triagem realizada por</strong>${p.triagem_por}</div>` : ""}
  ${c.observacoes ? `<div class="field"><strong>Observações da recepção</strong>${c.observacoes}</div>` : ""}
</div>

${triagem}

${vitais ? `<h2>Sinais Vitais</h2><div class="vitais">${vitais}</div>` : ""}

${p.anamnese ? `<h2>Anamnese</h2><p>${p.anamnese.replace(/\n/g, "<br>")}</p>` : ""}
${p.exameFisico ? `<h2>Exame Físico</h2><p>${p.exameFisico.replace(/\n/g, "<br>")}</p>` : ""}
${p.hipoteseDiagnostica ? `<h2>Hipótese Diagnóstica / CID</h2><p>${p.hipoteseDiagnostica}${p.cid ? ` <span class="badge" style="background:#eff6ff;color:#2563eb">CID: ${p.cid}</span>` : ""}</p>` : ""}
${p.conduta ? `<h2>Conduta</h2><p>${p.conduta.replace(/\n/g, "<br>")}</p>` : ""}
${p.receita ? `<h2>Prescrição</h2><p style="font-family:monospace">${p.receita.replace(/\n/g, "<br>")}</p>` : ""}
${p.examesSolicitados?.length ? `<h2>Exames Solicitados</h2><ul>${p.examesSolicitados.map((e) => `<li>${e.nome}${e.justificativa ? ` — ${e.justificativa}` : ""}</li>`).join("")}</ul>` : ""}
${p.retorno ? `<h2>Orientação de Retorno</h2><p>${p.retorno}</p>` : ""}
${p.observacoes_enfermagem ? `<h2>Observações de Enfermagem</h2><p>${p.observacoes_enfermagem.replace(/\n/g, "<br>")}</p>` : ""}

<div class="footer">
  Documento gerado pelo sistema Vynor Clinic · Uso exclusivo da equipe de saúde · Não substitui laudo médico oficial
</div>

<script>window.onload = () => window.print();</script>
</body></html>`;

    const w = window.open("", "_blank", "width=800,height=700");
    w.document.write(html);
    w.document.close();
  }

  // ── DETALHE DO PRONTUÁRIO ──────────────────────────────────────────────────────

  if (selecionado) {
    const p = selecionado.prontuario || {};
    const idade = dadosPaciente?.dataNascimento ? calcularIdade(dadosPaciente.dataNascimento) : null;

    const vitaisPreenchidos = [p.pressaoSistolica, p.frequenciaCardiaca, p.temperatura, p.peso, p.saturacaoO2].filter(Boolean);

    const isOdonto = /odont|dental/i.test(selecionado.especialidade || "");

    const abas = [
      { key: "resumo", label: "Resumo" },
      { key: "clinico", label: "Ficha Clínica" },
      { key: "vitais", label: "Sinais Vitais", badge: vitaisPreenchidos.length },
      { key: "exames", label: "Exames", badge: (p.examesSolicitados || []).length },
      { key: "documentos", label: "Documentos" },
      { key: "timeline", label: "Timeline" },
      ...(isOdonto ? [{ key: "odonto", label: "🦷 Odonto", badge: historicoOdonto.length }] : []),
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Header do paciente */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
          <button onClick={() => { setSelecionado(null); setAba("resumo"); }} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, cursor: "pointer", fontSize: "16px" }}>←</button>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
              {selecionado.paciente}
            </h1>
            <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
              {idade !== null && <span style={{ fontSize: "12px", color: "#64748b" }}>🎂 {idade} anos</span>}
              {dadosPaciente?.sexo && <span style={{ fontSize: "12px", color: "#64748b" }}>· {dadosPaciente.sexo}</span>}
              {dadosPaciente?.convenio && <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: 600 }}>💳 {dadosPaciente.convenio}</span>}
              <span style={{ fontSize: "12px", color: "#64748b" }}>📅 {formatarData(selecionado.data)} às {selecionado.hora || "—"}</span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>👨‍⚕️ {selecionado.medico || "—"}</span>
              {selecionado.especialidade && <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: 600 }}>🏥 {selecionado.especialidade}</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => imprimirProntuario(selecionado)} style={{ padding: "8px 14px", borderRadius: "9px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
              🖨️ Imprimir
            </button>
            <button onClick={() => copiar(`Paciente: ${selecionado.paciente}\nData: ${formatarData(selecionado.data)}\nDiagnóstico: ${val(p.hipoteseDiagnostica)} CID: ${val(p.cid)}\nConduta: ${val(p.conduta)}`)} style={{ padding: "8px 14px", borderRadius: "9px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
              📋 Copiar resumo
            </button>
          </div>
        </div>

        {/* Alertas clínicos inteligentes */}
        {alertas && (alertas.cids.length > 0 || alertas.alergias) && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {alertas.alergias && (
              <div style={{ padding: "10px 16px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".05em" }}>Alergias</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#dc2626" }}>{alertas.alergias}</div>
                </div>
              </div>
            )}
            {alertas.cids.length > 0 && (
              <div style={{ padding: "10px 16px", borderRadius: "10px", background: "#fffbeb", border: "1px solid #fde68a", flex: 1, minWidth: "200px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "6px" }}>
                  CIDs mais frequentes — {alertas.totalConsultas} consulta(s)
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {alertas.cids.map((c) => (
                    <span key={c.cod} style={{ padding: "3px 10px", borderRadius: "999px", background: "#fef9c3", border: "1px solid #fde68a", fontSize: "12px", fontWeight: 700, color: "#92400e" }}>
                      {c.cod} {c.n > 1 ? `(${c.n}×)` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {alertas.meds.length > 0 && (
              <div style={{ padding: "10px 16px", borderRadius: "10px", background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "6px" }}>Medicamentos recorrentes</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {alertas.meds.map((m) => (
                    <span key={m.nome} style={{ padding: "3px 10px", borderRadius: "999px", background: "#dbeafe", border: "1px solid #bfdbfe", fontSize: "12px", color: "#1d4ed8", fontWeight: 600 }}>
                      {m.nome.length > 30 ? m.nome.slice(0, 30) + "..." : m.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aviso de prontuário finalizado */}
        {normStatus(selecionado.status) === "finalizado" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: "#fafafa", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>🔒</span>
            <div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151" }}>Atendimento finalizado</span>
              <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "6px" }}>Este prontuário está encerrado. Alterações requerem justificativa clínica.</span>
            </div>
          </div>
        )}

        {/* CID em destaque se presente */}
        {p.cid && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "999px", background: "#eff6ff", border: "1px solid #bfdbfe", alignSelf: "flex-start" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8" }}>CID-10</span>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "#1e40af" }}>{p.cid}</span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: "2px", padding: "8px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", overflowX: "auto" }}>
            {abas.map((a) => (
              <button key={a.key} onClick={() => setAba(a.key)} style={{ ...S.pill(aba === a.key), position: "relative", display: "flex", alignItems: "center", gap: "6px" }}>
                {a.label}
                {a.badge > 0 && (
                  <span style={{ padding: "1px 6px", borderRadius: "999px", background: aba === a.key ? "rgba(255,255,255,.25)" : "#e2e8f0", fontSize: "10px", fontWeight: 700, color: aba === a.key ? "#fff" : "#475569" }}>
                    {a.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: "20px" }}>

            {/* RESUMO */}
            {aba === "resumo" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Campo label="Paciente">{val(selecionado.paciente)}</Campo>
                <Campo label="Profissional">{val(selecionado.medico)}</Campo>
                <Campo label="Especialidade">{val(selecionado.especialidade)}</Campo>
                <Campo label="Data / Hora">{formatarData(selecionado.data)} às {val(selecionado.hora)}</Campo>
                <Campo label="Tipo de atendimento">{val(selecionado.tipoAtendimento)}</Campo>
                <Campo label="Status">{val(selecionado.status)}</Campo>
                <Campo label="Hipótese diagnóstica / CID" span={2}>
                  {val(p.hipoteseDiagnostica)}{p.cid ? ` — CID: ${p.cid}` : ""}
                </Campo>
                <Campo label="Conduta" span={2}>{val(p.conduta)}</Campo>
                {p.retorno && <Campo label="Retorno" span={2}>{p.retorno}</Campo>}
                {p.alergias && (
                  <div style={{ gridColumn: "span 2", padding: "10px 14px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>⚠ Alergias registradas</span>
                    <div style={{ fontSize: "13px", color: "#dc2626", fontWeight: 600, marginTop: "2px" }}>{p.alergias}</div>
                  </div>
                )}
              </div>
            )}

            {/* FICHA CLÍNICA */}
            {aba === "clinico" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  ["Anamnese", p.anamnese],
                  ["Exame Físico", p.exameFisico],
                  ["Hipótese Diagnóstica", p.hipoteseDiagnostica],
                  ["CID-10", p.cid],
                  ["Conduta", p.conduta],
                  ["Evolução", p.evolucao],
                  ["Exames solicitados (texto)", p.exames],
                  ["Observações", p.observacoes],
                  ["Orientação de retorno", p.retorno],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l}>
                    <span style={S.label}>{l}</span>
                    <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.7, padding: "10px 12px", background: "#f8fafc", borderRadius: "10px", whiteSpace: "pre-wrap" }}>{v}</div>
                  </div>
                ))}
                {!p.anamnese && !p.exameFisico && !p.conduta && (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <div style={{ fontSize: "28px" }}>📋</div>
                    <p style={{ margin: "8px 0 0" }}>Ficha clínica não preenchida neste atendimento.</p>
                  </div>
                )}
              </div>
            )}

            {/* SINAIS VITAIS */}
            {aba === "vitais" && (
              <div>
                {vitaisPreenchidos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <div style={{ fontSize: "28px" }}>💓</div>
                    <p style={{ margin: "8px 0 0" }}>Sinais vitais não foram registrados neste atendimento.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
                    {[
                      ["Pressão Arterial", p.pressaoSistolica ? `${p.pressaoSistolica}/${p.pressaoDiastolica} mmHg` : null, "🫀"],
                      ["Freq. Cardíaca", p.frequenciaCardiaca ? `${p.frequenciaCardiaca} bpm` : null, "💓"],
                      ["Freq. Respiratória", p.frequenciaRespiratoria ? `${p.frequenciaRespiratoria} irpm` : null, "🫁"],
                      ["Temperatura", p.temperatura ? `${p.temperatura}°C` : null, "🌡️"],
                      ["SpO2", p.saturacaoO2 ? `${p.saturacaoO2}%` : null, "💧"],
                      ["Peso", p.peso ? `${p.peso} kg` : null, "⚖️"],
                      ["Altura", p.altura ? `${p.altura} cm` : null, "📏"],
                      ["Glicemia", p.glicemia ? `${p.glicemia} mg/dL` : null, "🩸"],
                      ["Escala de Dor", p.escalaDor ? `${p.escalaDor}/10` : null, "😣"],
                    ].filter(([, v]) => v).map(([l, v, ic]) => (
                      <div key={l} style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <div style={{ fontSize: "22px", marginBottom: "6px" }}>{ic}</div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* EXAMES */}
            {aba === "exames" && (
              <div>
                {(!p.examesSolicitados || p.examesSolicitados.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <div style={{ fontSize: "28px" }}>🔬</div>
                    <p style={{ margin: "8px 0 0" }}>Nenhum exame estruturado solicitado neste atendimento.</p>
                    {p.exames && (
                      <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", background: "#f8fafc", textAlign: "left" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>Exames anotados no campo de texto</div>
                        <div style={{ fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap" }}>{p.exames}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {p.examesSolicitados.map((e) => (
                      <div key={e.key || e.nome} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "16px" }}>🔬</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{e.nome}</div>
                          {e.categoria && <div style={{ fontSize: "11px", color: "#94a3b8" }}>{e.categoria}</div>}
                        </div>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: e.urgencia === "Urgente" ? "#fef2f2" : "#f0fdf4", color: e.urgencia === "Urgente" ? "#dc2626" : "#16a34a" }}>
                          {e.urgencia || "Eletivo"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENTOS */}
            {aba === "documentos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {p.receita && (
                  <div style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>💊 Prescrição médica</span>
                      <button onClick={() => copiar(p.receita)} style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#475569" }}>Copiar</button>
                    </div>
                    <pre style={{ margin: 0, fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit" }}>{p.receita}</pre>
                  </div>
                )}
                {p.atestado && (
                  <div style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>📄 Atestado médico</span>
                      <button onClick={() => copiar(p.atestado)} style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#475569" }}>Copiar</button>
                    </div>
                    <pre style={{ margin: 0, fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit" }}>{p.atestado}</pre>
                  </div>
                )}
                <div style={{ padding: "16px", borderRadius: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#15803d" }}>✅ Declaração de comparecimento</span>
                    <button onClick={() => copiar(gerarDeclaracao(selecionado))} style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #bbf7d0", background: "#dcfce7", fontSize: "12px", cursor: "pointer", color: "#15803d" }}>Copiar</button>
                  </div>
                  <pre style={{ margin: 0, fontSize: "12px", color: "#15803d", whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit" }}>{gerarDeclaracao(selecionado)}</pre>
                </div>
              </div>
            )}

            {/* TIMELINE */}
            {aba === "timeline" && (
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", marginBottom: "16px" }}>
                  Linha do tempo clínica de {selecionado.paciente}
                </div>
                {timeline.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <div style={{ fontSize: "28px" }}>📅</div>
                    <p style={{ margin: "8px 0 0" }}>Sem histórico encontrado.</p>
                  </div>
                ) : (
                  <div style={{ position: "relative", paddingLeft: "28px" }}>
                    <div style={{ position: "absolute", left: "10px", top: 0, bottom: 0, width: "2px", background: "#e2e8f0" }} />
                    {timeline.map((ev) => {
                      const isMed = ev.tipo === "medico";
                      const isAtual = ev.original?.id === selecionado?.id;
                      return (
                        <div key={ev.id} style={{ position: "relative", marginBottom: "16px" }}>
                          <div style={{
                            position: "absolute", left: "-22px", top: "12px",
                            width: "14px", height: "14px", borderRadius: "50%",
                            background: isAtual ? "#6366f1" : isMed ? "#2563eb" : "#0f766e",
                            border: `3px solid ${isAtual ? "#c7d2fe" : "#fff"}`,
                            boxShadow: "0 0 0 1px #e2e8f0",
                            zIndex: 1,
                          }} />
                          <div style={{
                            padding: "12px 16px",
                            borderRadius: "12px",
                            background: isAtual ? "#eef2ff" : "#f8fafc",
                            border: `1px solid ${isAtual ? "#c7d2fe" : "#f1f5f9"}`,
                            cursor: isMed && !isAtual ? "pointer" : "default",
                          }}
                            onClick={() => isMed && !isAtual && setSelecionado(ev.original)}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "16px" }}>{isMed ? "🏥" : "🦷"}</span>
                              <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{ev.titulo}</span>
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                {formatarData(ev.data)}{ev.hora ? " às " + ev.hora : ""}
                              </span>
                              {isAtual && <span style={{ padding: "1px 8px", borderRadius: "999px", background: "#6366f1", color: "#fff", fontSize: "10px", fontWeight: 700 }}>Este atendimento</span>}
                              {isMed && !isAtual && <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 600 }}>Clique para abrir →</span>}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>👨‍⚕️ {ev.subtitulo}</div>
                            {ev.cid && <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: 700, marginTop: "4px" }}>CID: {ev.cid}</div>}
                            {ev.conduta && (
                              <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                                {ev.conduta.slice(0, 120)}{ev.conduta.length > 120 ? "..." : ""}
                              </div>
                            )}
                            {ev.valorFinal && (
                              <div style={{ fontSize: "12px", color: "#0f766e", fontWeight: 600, marginTop: "4px" }}>
                                💰 {formatarMoeda(ev.valorFinal)}
                              </div>
                            )}
                            {Object.values(ev.sinaisVitais || {}).some(Boolean) && (
                              <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
                                {Object.entries(ev.sinaisVitais).filter(([, v]) => v).map(([k, v]) => (
                                  <span key={k} style={{ fontSize: "11px", color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "999px" }}>{v}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ODONTO */}
            {aba === "odonto" && (
              <div>
                {historicoOdonto.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <div style={{ fontSize: "28px" }}>🦷</div>
                    <p style={{ margin: "8px 0 0" }}>Nenhum atendimento odontológico registrado.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {historicoOdonto.map((a) => {
                      const ts = formatarTimestamp(a.finalizadoEm);
                      const dataStr = ts ? ts.toLocaleDateString("pt-BR") : a.data || "—";
                      const procs = (a.procedimentosRealizados || []).map((p) => p.nome).join(", ") || "Procedimentos não especificados";
                      const pago = (a.statusPagamento || "").toLowerCase() === "pago";
                      return (
                        <div key={a.id} style={{ padding: "14px 16px", borderRadius: "12px", background: "#f0fdf9", border: "1px solid #99f6e4" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontSize: "16px" }}>🦷</span>
                            <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f766e" }}>{dataStr}</span>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>· {a.profissionalNome || "—"}</span>
                            <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: pago ? "#dcfce7" : "#fef9c3", color: pago ? "#15803d" : "#854d0e" }}>
                              {a.statusPagamento || "pendente"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#334155" }}>{procs}</div>
                          {a.valorFinal && (
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f766e", marginTop: "4px" }}>
                              Total: {formatarMoeda(a.valorFinal)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ── LISTA DE PRONTUÁRIOS ───────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>Prontuário</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Histórico clínico completo — consultas finalizadas com registro.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ ...S.card, display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", padding: "14px 18px" }}>
        <input
          style={{ ...S.input, minWidth: "200px", flex: 1 }}
          placeholder="Buscar por paciente, médico, CID..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select style={{ ...S.input, minWidth: "170px" }} value={filtroProfissional} onChange={(e) => setFiltroProfissional(e.target.value)}>
          <option value="">Todos os profissionais</option>
          {profissionais.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select style={{ ...S.input, minWidth: "150px" }} value={filtroEspecialidade} onChange={(e) => setFiltroEspecialidade(e.target.value)}>
          <option value="">Todas especialidades</option>
          {especialidades.map((e) => <option key={e}>{e}</option>)}
        </select>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input type="date" style={{ ...S.input, minWidth: "130px" }} value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} title="Data inicial" />
          <span style={{ color: "#94a3b8", fontSize: "12px" }}>até</span>
          <input type="date" style={{ ...S.input, minWidth: "130px" }} value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} title="Data final" />
        </div>
        {(busca || filtroProfissional || filtroEspecialidade || filtroInicio || filtroFim) && (
          <button onClick={() => { setBusca(""); setFiltroProfissional(""); setFiltroEspecialidade(""); setFiltroInicio(""); setFiltroFim(""); }} style={{ ...S.input, cursor: "pointer", color: "#dc2626", fontWeight: 700, border: "1px solid #fca5a5", background: "#fef2f2", padding: "8px 14px", minWidth: "auto" }}>
            ✕ Limpar
          </button>
        )}
        <span style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>{filtrados.length} de {prontuarios.length}</span>
      </div>

      {/* Lista de cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtrados.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📋</div>
            <p style={{ margin: 0, fontWeight: 600, color: "#475569" }}>
              {prontuarios.length === 0 ? "Nenhum prontuário registrado" : "Nenhum resultado com os filtros atuais"}
            </p>
          </div>
        ) : (
          filtrados.slice(0, visiveis).map((c) => {
            const p = c.prontuario || {};
            // const idMed = dadosPaciente?.dataNascimento ? calcularIdade(dadosPaciente.dataNascimento) : null;
            return (
              <div
                key={c.id}
                style={{ ...S.card, padding: "16px 20px", cursor: "pointer", transition: "box-shadow .15s" }}
                onClick={() => { setSelecionado(c); setAba("resumo"); }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 0 0 2px #6366f1, 0 4px 16px rgba(99,102,241,.1)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = S.card.boxShadow}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: "12px",
                    background: "linear-gradient(135deg, #6366f1, #2563eb)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: "16px", flexShrink: 0,
                  }}>
                    {(c.paciente || "?")[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "15px", color: "#0f172a" }}>{c.paciente || "—"}</span>
                      {c.especialidade && (
                        <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#eef2ff", color: "#6366f1", fontSize: "11px", fontWeight: 700 }}>
                          {c.especialidade}
                        </span>
                      )}
                      {p.cid && (
                        <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#fef2f2", color: "#dc2626", fontSize: "11px", fontWeight: 700 }}>
                          CID {p.cid}
                        </span>
                      )}
                      {p.alergias && (
                        <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#fef9c3", color: "#d97706", fontSize: "11px", fontWeight: 700 }}>
                          ⚠ Alergia
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span>📅 {formatarData(c.data)} às {c.hora || "—"}</span>
                      {c.medico && <span>👨‍⚕️ {c.medico}</span>}
                    </div>
                    {p.hipoteseDiagnostica && (
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px" }}>
                        <strong style={{ color: "#0f172a" }}>Diagnóstico:</strong> {p.hipoteseDiagnostica.slice(0, 120)}{p.hipoteseDiagnostica.length > 120 ? "..." : ""}
                      </div>
                    )}
                    {p.conduta && (
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px" }}>
                        <strong style={{ color: "#0f172a" }}>Conduta:</strong> {p.conduta.slice(0, 100)}{p.conduta.length > 100 ? "..." : ""}
                      </div>
                    )}
                  </div>

                  <button style={{ padding: "7px 14px", borderRadius: "9px", border: "1px solid #e2e8f0", background: "#fff", color: "#6366f1", fontWeight: 700, fontSize: "12px", cursor: "pointer", flexShrink: 0 }}>
                    Abrir →
                  </button>
                </div>
              </div>
            );
          })
        )}
        {filtrados.length > visiveis && (
          <button
            onClick={() => setVisiveis((v) => v + 20)}
            style={{
              marginTop: 4, padding: "12px", borderRadius: "12px",
              border: "1px dashed #cbd5e1", background: "#f8fafc",
              color: "#475569", fontWeight: 600, fontSize: "13px",
              cursor: "pointer", width: "100%",
            }}
          >
            Carregar mais {Math.min(20, filtrados.length - visiveis)} de {filtrados.length - visiveis} restantes
          </button>
        )}
        {filtrados.length > 0 && visiveis >= filtrados.length && filtrados.length > 20 && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>
            Todos os {filtrados.length} prontuários exibidos.
          </p>
        )}
      </div>
    </div>
  );
}
