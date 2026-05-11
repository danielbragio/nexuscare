import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

function normalizarTexto(valor) {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function obterDataISO(valor) {
  if (!valor) return "";
  if (typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
      const [dia, mes, ano] = valor.split("/");
      return `${ano}-${mes}-${dia}`;
    }
    return valor;
  }
  if (valor?.toDate) {
    const data = valor.toDate();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  }
  return "";
}

function formatarDataBr(dataISO) {
  if (!dataISO) return "Sem data";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function normalizarStatus(status) {
  const texto = normalizarTexto(status);
  if (texto === "finalizado" || texto === "finalizada") return "finalizado";
  if (texto === "em atendimento" || texto === "em_atendimento") return "em_atendimento";
  if (texto === "agendada" || texto === "agendado") return "agendado";
  if (texto === "aguardando" || texto === "aguardando atendimento") return "agendado";
  return texto || "agendado";
}

function labelStatus(status, tipoConsulta) {
  const s = normalizarStatus(status);
  if (s === "finalizado") return "Finalizado";
  if (s === "em_atendimento") return "Em atendimento";
  if (tipoConsulta === "odonto" && status === "aguardando") return "Aguardando";
  return "Agendado";
}

function obterMesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function gerarDiasDoMes(mesSelecionado) {
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return Array.from({ length: ultimoDia }, (_, i) => {
    const dia = String(i + 1).padStart(2, "0");
    return `${ano}-${String(mes).padStart(2, "0")}-${dia}`;
  });
}

function nomeDoDia(dataISO) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { weekday: "short" });
}

function nomeDoMes(mesSelecionado) {
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function Agendamentos({
  consultas = [],
  agendamentosOdonto = [],
  onAbrirAtendimento,
}) {
  const { userData } = useAuth();

  const [mesSelecionado, setMesSelecionado] = useState(obterMesAtual());
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const role = userData?.role || "";
  const podeVerTodos =
    role === "admin" ||
    role === "recepcao" ||
    role === "financeiro" ||
    role === "estoque" ||
    role === "enfermagem" ||
    (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
  const isMedico = !podeVerTodos;

  const identificadoresUsuario = useMemo(() => {
    return [
      userData?.nome,
      userData?.name,
      userData?.username,
      userData?.usuario,
      userData?.login,
      userData?.email,
    ]
      .filter(Boolean)
      .map(normalizarTexto);
  }, [userData]);

  // Normalize medical consultas
  const consultasMedNorm = useMemo(() => {
    return consultas.map((c) => ({
      ...c,
      dataNormalizada: obterDataISO(c.data || c.dataAgendamento || c.createdAt),
      pacienteNormalizado: c.paciente || c.nomePaciente || c.nome || "Paciente",
      medicoNormalizado: c.medico || c.profissional || c.nomeMedico || c.profissionalNome || "—",
      especialidadeNormalizada: c.especialidade || c.servico || "—",
      telefoneNormalizado: c.telefone || c.celular || "—",
      horaNormalizada: c.hora || c.horario || c.horaAgendamento || "—",
      tipoConsulta: "medico",
    }));
  }, [consultas]);

  // Normalize odonto agendamentos
  const consultasOdontoNorm = useMemo(() => {
    return agendamentosOdonto.map((a) => ({
      ...a,
      dataNormalizada: obterDataISO(a.data || a.createdAt),
      pacienteNormalizado: a.pacienteNome || a.paciente || "Paciente",
      medicoNormalizado: a.profissionalNome || a.profissional || "—",
      especialidadeNormalizada: "Odontologia",
      telefoneNormalizado: a.telefone || "—",
      horaNormalizada: a.hora || "—",
      tipoConsulta: "odonto",
    }));
  }, [agendamentosOdonto]);

  function pertenceAoProfissionalLogado(consulta) {
    const role = userData?.role || "";
    const podeVerTodos =
      role === "admin" ||
      role === "recepcao" ||
      role === "financeiro" ||
      role === "estoque" ||
      role === "enfermagem" ||
      (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
    if (podeVerTodos) return true;
    const meuId = String(userData?.id || "");
    if (!meuId) return false;
    const idConsulta = consulta.usuarioId != null
      ? String(consulta.usuarioId)
      : (consulta.profissionalId || "").trim();
    if (idConsulta) return idConsulta === meuId;
    // Name-based fallback — exact match only, for legacy entries without IDs
    const nomes = [
      consulta.medico,
      consulta.profissional,
      consulta.profissionalNome,
      consulta.medicoNome,
    ]
      .filter(Boolean)
      .map(normalizarTexto);
    return nomes.some((v) => identificadoresUsuario.some((u) => v === u));
  }

  // Combine and filter
  const todasConsultas = useMemo(() => {
    const todas = [...consultasMedNorm, ...consultasOdontoNorm];
    return todas.filter(pertenceAoProfissionalLogado);
  }, [consultasMedNorm, consultasOdontoNorm, identificadoresUsuario, userData]);

  const consultasAtivas = useMemo(() => {
    return todasConsultas.filter((c) => normalizarStatus(c.status) !== "finalizado");
  }, [todasConsultas]);

  const consultasFinalizadas = useMemo(() => {
    return todasConsultas.filter((c) => normalizarStatus(c.status) === "finalizado");
  }, [todasConsultas]);

  const consultasAgendadas = useMemo(() => {
    return todasConsultas.filter((c) => normalizarStatus(c.status) === "agendado");
  }, [todasConsultas]);

  const consultasOrdenadas = useMemo(() => {
    return [...consultasAtivas].sort(
      (a, b) =>
        (a.dataNormalizada || "").localeCompare(b.dataNormalizada || "") ||
        (a.horaNormalizada || "").localeCompare(b.horaNormalizada || "")
    );
  }, [consultasAtivas]);

  const diasDoMes = useMemo(() => gerarDiasDoMes(mesSelecionado), [mesSelecionado]);

  const consultasDoMes = useMemo(() => {
    return consultasOrdenadas.filter((c) =>
      String(c.dataNormalizada || "").startsWith(mesSelecionado)
    );
  }, [consultasOrdenadas, mesSelecionado]);

  const consultasFiltradasDoMes = useMemo(() => {
    return consultasDoMes.filter((c) => {
      const termo = normalizarTexto(busca);
      if (filtroTipo !== "todos" && c.tipoConsulta !== filtroTipo) return false;
      if (!termo) return true;
      return (
        normalizarTexto(c.pacienteNormalizado).includes(termo) ||
        normalizarTexto(c.medicoNormalizado).includes(termo) ||
        normalizarTexto(c.especialidadeNormalizada).includes(termo) ||
        normalizarTexto(c.telefoneNormalizado).includes(termo)
      );
    });
  }, [consultasDoMes, busca, filtroTipo]);

  const consultasDoDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return [];
    return consultasFiltradasDoMes.filter((c) => c.dataNormalizada === diaSelecionado);
  }, [consultasFiltradasDoMes, diaSelecionado]);

  const agrupadasPorDia = useMemo(() => {
    return consultasFiltradasDoMes.reduce((acc, c) => {
      const data = c.dataNormalizada;
      if (!data) return acc;
      if (!acc[data]) acc[data] = [];
      acc[data].push(c);
      return acc;
    }, {});
  }, [consultasFiltradasDoMes]);

  const diasComAgenda = Object.keys(agrupadasPorDia);

  function voltarMes() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const d = new Date(ano, mes - 2, 1);
    setMesSelecionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDiaSelecionado("");
  }

  function avancarMes() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const d = new Date(ano, mes, 1);
    setMesSelecionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDiaSelecionado("");
  }

  function corEvento(item) {
    if (item.tipoConsulta === "odonto") return "#0f766e";
    const s = normalizarStatus(item.status);
    if (s === "em_atendimento") return "#2563eb";
    return "#16a34a";
  }

  return (
    <div>
      <div className="page-header">
        <h1>Agendamentos</h1>
        <p className="page-subtitle">
          Calendário integrado — consultas médicas e odontológicas.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box" style={{ borderTop: "4px solid #7c3aed" }}>
          <div className="stat-label">Total de consultas</div>
          <div className="stat-value">{todasConsultas.length}</div>
          <div className="stat-info">{isMedico ? "Sua agenda" : "Todos os setores"}</div>
        </div>
        <div className="stat-box" style={{ borderTop: "4px solid #2563eb" }}>
          <div className="stat-label">Dias com agenda</div>
          <div className="stat-value">{diasComAgenda.length}</div>
          <div className="stat-info">No mês selecionado</div>
        </div>
        <div className="stat-box" style={{ borderTop: "4px solid #16a34a" }}>
          <div className="stat-label">Agendadas</div>
          <div className="stat-value">{consultasAgendadas.length}</div>
          <div className="stat-info">Aguardando atendimento</div>
        </div>
        <div className="stat-box" style={{ borderTop: "4px solid #dc2626" }}>
          <div className="stat-label">Finalizadas</div>
          <div className="stat-value">{consultasFinalizadas.length}</div>
          <div className="stat-info">Atendimentos concluídos</div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: "20px" }}>
        <div className="card-title-row">
          <div>
            <h3 style={{ marginBottom: 0 }}>Calendário de agendamentos</h3>
            <p className="page-subtitle" style={{ marginTop: "4px" }}>
              {isMedico
                ? "Mostrando apenas os agendamentos vinculados ao profissional logado."
                : "Mostrando todos os agendamentos do sistema."}
            </p>
          </div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="secondary-btn" onClick={voltarMes}>‹</button>
            <strong style={{ textTransform: "capitalize" }}>{nomeDoMes(mesSelecionado)}</strong>
            <button className="secondary-btn" onClick={avancarMes}>›</button>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: "16px", flexWrap: "wrap" }}>
          <input
            className="input"
            type="month"
            value={mesSelecionado}
            onChange={(e) => { setMesSelecionado(e.target.value); setDiaSelecionado(""); }}
          />
          <input
            className="input search-input"
            placeholder="Buscar paciente, profissional, especialidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="select"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ width: "auto", minWidth: "160px" }}
          >
            <option value="todos">Todos os setores</option>
            <option value="medico">Médico / Clínica</option>
            <option value="odonto">Odontologia</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "12px", fontSize: "12px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#16a34a", display: "inline-block" }} />
            Consulta médica
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0f766e", display: "inline-block" }} />
            Odontologia
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#2563eb", display: "inline-block" }} />
            Em atendimento
          </span>
        </div>

        <div style={{ marginTop: "20px", overflowX: "auto", paddingBottom: "8px" }}>
          <div
            style={{
              minWidth: "980px",
              border: "1px solid #d8e2ef",
              borderRadius: "14px",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                background: "#f8fafc",
                borderBottom: "1px solid #d8e2ef",
              }}
            >
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => (
                <div
                  key={dia}
                  style={{
                    padding: "10px",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "#334155",
                    borderRight: "1px solid #e2e8f0",
                  }}
                >
                  {dia}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {Array.from({
                length: new Date(
                  Number(mesSelecionado.split("-")[0]),
                  Number(mesSelecionado.split("-")[1]) - 1,
                  1
                ).getDay(),
              }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  style={{
                    minHeight: "125px",
                    padding: "8px",
                    borderRight: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                />
              ))}

              {diasDoMes.map((data) => {
                const consultasDia = agrupadasPorDia[data] || [];
                const ativo = diaSelecionado === data;

                return (
                  <button
                    key={data}
                    onClick={() => setDiaSelecionado(data)}
                    style={{
                      minHeight: "125px",
                      padding: "8px",
                      border: "none",
                      borderRight: "1px solid #e2e8f0",
                      borderBottom: "1px solid #e2e8f0",
                      background: ativo ? "#eef6ff" : consultasDia.length > 0 ? "#f0fdf4" : "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <strong style={{ fontSize: "13px" }}>
                        {String(Number(data.split("-")[2])).padStart(2, "0")}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{nomeDoDia(data)}</span>
                    </div>

                    {consultasDia.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onAbrirAtendimento && item.tipoConsulta === "medico") {
                            onAbrirAtendimento(item);
                          }
                        }}
                        style={{
                          background: corEvento(item),
                          color: "#fff",
                          borderRadius: "7px",
                          padding: "5px 6px",
                          marginBottom: "5px",
                          fontSize: "11px",
                          lineHeight: "1.25",
                          overflow: "hidden",
                          cursor: (onAbrirAtendimento && item.tipoConsulta === "medico") ? "pointer" : "default",
                        }}
                        title={`${item.horaNormalizada || "—"} - ${item.pacienteNormalizado || "—"}${item.tipoConsulta === "odonto" ? " (Odonto)" : ""}`}
                      >
                        <strong>{item.horaNormalizada || "—"}</strong>{" "}
                        {item.pacienteNormalizado || "Paciente"}
                        {item.tipoConsulta === "odonto" && (
                          <span style={{ opacity: 0.8, marginLeft: 4, fontSize: "10px" }}>🦷</span>
                        )}
                      </div>
                    ))}

                    {consultasDia.length > 4 && (
                      <small style={{ color: "#64748b" }}>
                        + {consultasDia.length - 4} agendamento(s)
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {diaSelecionado && (
          <div style={{ marginTop: "20px" }}>
            <div className="muted-box" style={{ marginBottom: "12px" }}>
              <strong>{formatarDataBr(diaSelecionado)}</strong>
              <div>{consultasDoDiaSelecionado.length} consulta(s) neste dia</div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Setor</th>
                  <th>Paciente</th>
                  <th>Telefone</th>
                  <th>Especialidade</th>
                  <th>Profissional</th>
                  <th>Hora</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {consultasDoDiaSelecionado.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: item.tipoConsulta === "odonto" ? "#f0fdf9" : "#eff6ff",
                          color: item.tipoConsulta === "odonto" ? "#0f766e" : "#2563eb",
                        }}
                      >
                        {item.tipoConsulta === "odonto" ? "Odonto" : "Médico"}
                      </span>
                    </td>
                    <td
                      onClick={(e) => {
                        if (onAbrirAtendimento && item.tipoConsulta === "medico") {
                          e.stopPropagation();
                          onAbrirAtendimento(item);
                        }
                      }}
                      style={{ cursor: (onAbrirAtendimento && item.tipoConsulta === "medico") ? "pointer" : "default" }}
                    >
                      {item.pacienteNormalizado}
                    </td>
                    <td>{item.telefoneNormalizado}</td>
                    <td>{item.especialidadeNormalizada}</td>
                    <td>{item.medicoNormalizado}</td>
                    <td>{item.horaNormalizada}</td>
                    <td>{labelStatus(item.status, item.tipoConsulta)}</td>
                  </tr>
                ))}
                {consultasDoDiaSelecionado.length === 0 && (
                  <tr>
                    <td colSpan="7">Nenhuma consulta agendada neste dia.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!diaSelecionado && consultasFiltradasDoMes.length === 0 && (
          <p style={{ marginTop: "20px" }}>Nenhum paciente agendado neste mês.</p>
        )}
      </div>
    </div>
  );
}
