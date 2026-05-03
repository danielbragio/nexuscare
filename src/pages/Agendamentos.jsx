import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

function normalizarTexto(valor) {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obterDataISO(valor) {
  if (!valor) return "";

  if (typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
      return valor.slice(0, 10);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
      const [dia, mes, ano] = valor.split("/");
      return `${ano}-${mes}-${dia}`;
    }

    return valor;
  }

  if (valor?.toDate) {
    const data = valor.toDate();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  return "";
}

function obterNomePaciente(consulta) {
  return (
    consulta.paciente ||
    consulta.nomePaciente ||
    consulta.nome ||
    consulta.patientName ||
    "Paciente"
  );
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

function labelStatus(status) {
  const statusNormalizado = normalizarStatus(status);

  if (statusNormalizado === "finalizado") return "Finalizado";
  if (statusNormalizado === "em_atendimento") return "Em atendimento";
  return "Agendado";
}

function obterMesAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function gerarDiasDoMes(mesSelecionado) {
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();

  return Array.from({ length: ultimoDia }, (_, index) => {
    const dia = String(index + 1).padStart(2, "0");
    return `${ano}-${String(mes).padStart(2, "0")}-${dia}`;
  });
}

function nomeDoDia(dataISO) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);

  return data.toLocaleDateString("pt-BR", {
    weekday: "short",
  });
}

function nomeDoMes(mesSelecionado) {
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const data = new Date(ano, mes - 1, 1);

  return data.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export default function Agendamentos({ consultas = [], onAbrirAtendimento }) {
  const { userData, firebaseUser } = useAuth();

  const [mesSelecionado, setMesSelecionado] = useState(obterMesAtual());
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const [busca, setBusca] = useState("");

  const isMedico =
    userData?.role === "medico" ||
    userData?.role === "médico" ||
    userData?.permissions?.includes?.("medicos");

  const identificadoresUsuario = useMemo(() => {
    return [
      userData?.nome,
      userData?.name,
      userData?.username,
      userData?.usuario,
      userData?.login,
      userData?.email,
      firebaseUser?.displayName,
      firebaseUser?.email,
    ]
      .filter(Boolean)
      .map(normalizarTexto);
  }, [userData, firebaseUser]);

  const consultasNormalizadas = useMemo(() => {
    return consultas.map((consulta) => ({
      ...consulta,
      dataNormalizada: obterDataISO(consulta.data || consulta.dataAgendamento || consulta.createdAt),
      pacienteNormalizado: obterNomePaciente(consulta),
      medicoNormalizado:
        consulta.medico ||
        consulta.profissional ||
        consulta.nomeMedico ||
        consulta.profissionalNome ||
        "—",
      especialidadeNormalizada: consulta.especialidade || consulta.servico || "—",
      telefoneNormalizado: consulta.telefone || consulta.celular || "—",
      horaNormalizada: consulta.hora || consulta.horario || consulta.horaAgendamento || "—",
    }));
  }, [consultas]);

  function pertenceAoProfissionalLogado(consulta) {
    if (!isMedico) return true;

    const identificadoresConsulta = [
      consulta.medico,
      consulta.profissional,
      consulta.profissionalNome,
      consulta.medicoNome,
      consulta.medicoEmail,
      consulta.profissionalEmail,
      consulta.responsavel,
      consulta.responsavelNome,
    ]
      .filter(Boolean)
      .map(normalizarTexto);

    return identificadoresConsulta.some((valorConsulta) =>
      identificadoresUsuario.some(
        (valorUsuario) =>
          valorConsulta === valorUsuario ||
          valorConsulta.includes(valorUsuario) ||
          valorUsuario.includes(valorConsulta)
      )
    );
  }

  function abrirAtendimentoPeloAgendamento(item, event) {
    if (event) {
      event.stopPropagation();
    }

    if (onAbrirAtendimento) {
      onAbrirAtendimento(item);
    }
  }

  const consultasPermitidas = useMemo(() => {
    return consultasNormalizadas.filter((consulta) => pertenceAoProfissionalLogado(consulta));
  }, [consultasNormalizadas, identificadoresUsuario, isMedico]);

  const consultasAtivas = useMemo(() => {
    return consultasPermitidas.filter(
      (consulta) => normalizarStatus(consulta.status) !== "finalizado"
    );
  }, [consultasPermitidas]);

  const consultasFinalizadas = useMemo(() => {
    return consultasPermitidas.filter(
      (consulta) => normalizarStatus(consulta.status) === "finalizado"
    );
  }, [consultasPermitidas]);

  const consultasAgendadas = useMemo(() => {
    return consultasPermitidas.filter(
      (consulta) => normalizarStatus(consulta.status) === "agendado"
    );
  }, [consultasPermitidas]);

  const consultasOrdenadas = useMemo(() => {
    return [...consultasAtivas].sort(
      (a, b) =>
        (a.dataNormalizada || "").localeCompare(b.dataNormalizada || "") ||
        (a.horaNormalizada || "").localeCompare(b.horaNormalizada || "")
    );
  }, [consultasAtivas]);

  const diasDoMes = useMemo(() => {
    return gerarDiasDoMes(mesSelecionado);
  }, [mesSelecionado]);

  const consultasDoMes = useMemo(() => {
    return consultasOrdenadas.filter((consulta) =>
      String(consulta.dataNormalizada || "").startsWith(mesSelecionado)
    );
  }, [consultasOrdenadas, mesSelecionado]);

  const consultasFiltradasDoMes = useMemo(() => {
    return consultasDoMes.filter((consulta) => {
      const termo = normalizarTexto(busca);

      if (!termo) return true;

      return (
        normalizarTexto(consulta.pacienteNormalizado).includes(termo) ||
        normalizarTexto(consulta.medicoNormalizado).includes(termo) ||
        normalizarTexto(consulta.especialidadeNormalizada).includes(termo) ||
        normalizarTexto(consulta.telefoneNormalizado).includes(termo)
      );
    });
  }, [consultasDoMes, busca]);

  const consultasDoDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return [];

    return consultasFiltradasDoMes.filter(
      (consulta) => consulta.dataNormalizada === diaSelecionado
    );
  }, [consultasFiltradasDoMes, diaSelecionado]);

  const agrupadasPorDia = useMemo(() => {
    return consultasFiltradasDoMes.reduce((acc, consulta) => {
      const data = consulta.dataNormalizada;

      if (!data) return acc;

      if (!acc[data]) {
        acc[data] = [];
      }

      acc[data].push(consulta);
      return acc;
    }, {});
  }, [consultasFiltradasDoMes]);

  const diasComAgenda = Object.keys(agrupadasPorDia);

  function voltarMes() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const data = new Date(ano, mes - 2, 1);
    const novoMes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

    setMesSelecionado(novoMes);
    setDiaSelecionado("");
  }

  function avancarMes() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const data = new Date(ano, mes, 1);
    const novoMes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

    setMesSelecionado(novoMes);
    setDiaSelecionado("");
  }

  return (
    <div>
      <div className="page-header">
        <h1>Agendamentos</h1>
        <p className="page-subtitle">
          Visualização dos pacientes agendados por dia, com dados salvos no banco.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box" style={{ borderTop: "4px solid #7c3aed" }}>
          <div className="stat-label">Total de consultas</div>
          <div className="stat-value">{consultasPermitidas.length}</div>
          <div className="stat-info">
            {isMedico ? "Sua agenda" : "Registros na agenda"}
          </div>
        </div>

        <div className="stat-box" style={{ borderTop: "4px solid #2563eb" }}>
          <div className="stat-label">Dias com agenda</div>
          <div className="stat-value">{diasComAgenda.length}</div>
          <div className="stat-info">Datas com pacientes marcados</div>
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
            <button className="secondary-btn" onClick={voltarMes}>
              ‹
            </button>

            <strong style={{ textTransform: "capitalize" }}>
              {nomeDoMes(mesSelecionado)}
            </strong>

            <button className="secondary-btn" onClick={avancarMes}>
              ›
            </button>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: "16px", flexWrap: "wrap" }}>
          <input
            className="input"
            type="month"
            value={mesSelecionado}
            onChange={(e) => {
              setMesSelecionado(e.target.value);
              setDiaSelecionado("");
            }}
          />

          <input
            className="input search-input"
            placeholder="Buscar paciente, profissional, especialidade ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div
          style={{
            marginTop: "20px",
            overflowX: "auto",
            paddingBottom: "8px",
          }}
        >
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
              }}
            >
              {Array.from({
                length: new Date(
                  Number(mesSelecionado.split("-")[0]),
                  Number(mesSelecionado.split("-")[1]) - 1,
                  1
                ).getDay(),
              }).map((_, index) => (
                <div
                  key={`empty-${index}`}
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
                      background: ativo
                        ? "#eef6ff"
                        : consultasDia.length > 0
                        ? "#f0fdf4"
                        : "#fff",
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

                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {nomeDoDia(data)}
                      </span>
                    </div>

                    {consultasDia.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        onClick={(event) => abrirAtendimentoPeloAgendamento(item, event)}
                        style={{
                          background:
                            normalizarStatus(item.status) === "em_atendimento"
                              ? "#2563eb"
                              : "#16a34a",
                          color: "#fff",
                          borderRadius: "7px",
                          padding: "5px 6px",
                          marginBottom: "5px",
                          fontSize: "11px",
                          lineHeight: "1.25",
                          overflow: "hidden",
                          cursor: onAbrirAtendimento ? "pointer" : "default",
                        }}
                        title={`${item.horaNormalizada || "—"} - ${item.pacienteNormalizado || "—"}`}
                      >
                        <strong>{item.horaNormalizada || "—"}</strong>{" "}
                        {item.pacienteNormalizado || "Paciente"}
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
              <div>
                {consultasDoDiaSelecionado.length} paciente(s) agendado(s) neste dia
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
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
                    <td
                      onClick={(event) => abrirAtendimentoPeloAgendamento(item, event)}
                      style={{
                        cursor: onAbrirAtendimento ? "pointer" : "default",
                      }}
                    >
                      {item.pacienteNormalizado}
                    </td>
                    <td>{item.telefoneNormalizado}</td>
                    <td>{item.especialidadeNormalizada}</td>
                    <td>{item.medicoNormalizado}</td>
                    <td>{item.horaNormalizada}</td>
                    <td>{labelStatus(item.status)}</td>
                  </tr>
                ))}

                {consultasDoDiaSelecionado.length === 0 && (
                  <tr>
                    <td colSpan="6">Nenhum paciente agendado neste dia.</td>
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