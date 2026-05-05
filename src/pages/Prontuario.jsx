import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Prontuario({ consultas = [], atendimentosOdonto = [] }) {
  const { userData, firebaseUser } = useAuth();
  const isAdmin =
    userData?.role === "admin" ||
    (Array.isArray(userData?.permissions) && userData.permissions.includes("administracao"));
  const isMedico = userData?.role === "medico" || userData?.role === "médico";

  const [busca, setBusca] = useState("");
  const [filtroProfissional, setFiltroProfissional] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [prontuarioSelecionado, setProntuarioSelecionado] = useState(null);
  const [abaDetalhe, setAbaDetalhe] = useState("resumo");

  const prontuarios = useMemo(() => {
    const base = consultas
      .filter((item) => item.status === "Finalizado" && item.prontuario)
      .sort((a, b) => {
        const dataA = new Date(a.data || 0).getTime();
        const dataB = new Date(b.data || 0).getTime();
        return dataB - dataA;
      });
    if (isAdmin) return base;
    if (isMedico && firebaseUser?.uid) {
      const uid = firebaseUser.uid;
      const nome = (userData?.nome || userData?.name || "").toLowerCase().trim();
      return base.filter(
        (item) =>
          item.medicoId === uid ||
          (item.medico || "").toLowerCase().trim() === nome
      );
    }
    return base;
  }, [consultas, isAdmin, isMedico, firebaseUser, userData]);

  const profissionais = useMemo(() => {
    return [...new Set(prontuarios.map((item) => item.medico).filter(Boolean))];
  }, [prontuarios]);

  const especialidades = useMemo(() => {
    return [...new Set(prontuarios.map((item) => item.especialidade).filter(Boolean))];
  }, [prontuarios]);

  const filtrados = useMemo(() => {
    return prontuarios.filter((item) => {
      const pacienteMatch = (item.paciente || "")
        .toLowerCase()
        .includes(busca.toLowerCase());

      const profissionalMatch = filtroProfissional
        ? item.medico === filtroProfissional
        : true;

      const especialidadeMatch = filtroEspecialidade
        ? item.especialidade === filtroEspecialidade
        : true;

      const periodoMatch = filtroPeriodo
        ? item.data === filtroPeriodo
        : true;

      return pacienteMatch && profissionalMatch && especialidadeMatch && periodoMatch;
    });
  }, [prontuarios, busca, filtroProfissional, filtroEspecialidade, filtroPeriodo]);

  const historicoPaciente = useMemo(() => {
    if (!prontuarioSelecionado?.paciente) return [];

    return prontuarios
      .filter((item) => item.paciente === prontuarioSelecionado.paciente)
      .sort((a, b) => {
        const dataA = new Date(a.data || 0).getTime();
        const dataB = new Date(b.data || 0).getTime();
        return dataB - dataA;
      });
  }, [prontuarios, prontuarioSelecionado]);

  const historicoOdontoPaciente = useMemo(() => {
    if (!prontuarioSelecionado?.paciente) return [];
    const nomePaciente = prontuarioSelecionado.paciente;
    return atendimentosOdonto
      .filter(
        (a) =>
          a.status === "finalizado" &&
          (a.pacienteNome === nomePaciente ||
            a.paciente === nomePaciente)
      )
      .sort((a, b) => {
        const tA = a.finalizadoEm?.toDate ? a.finalizadoEm.toDate().getTime() : 0;
        const tB = b.finalizadoEm?.toDate ? b.finalizadoEm.toDate().getTime() : 0;
        return tB - tA;
      });
  }, [atendimentosOdonto, prontuarioSelecionado]);

  const totalProntuarios = prontuarios.length;
  const totalPacientes = new Set(prontuarios.map((item) => item.paciente)).size;
  const totalProfissionais = new Set(prontuarios.map((item) => item.medico).filter(Boolean)).size;
  const totalEspecialidades = new Set(
    prontuarios.map((item) => item.especialidade).filter(Boolean)
  ).size;

  function abrirProntuario(item) {
    setProntuarioSelecionado(item);
    setAbaDetalhe("resumo");
  }

  function fecharProntuario() {
    setProntuarioSelecionado(null);
    setAbaDetalhe("resumo");
  }

  function limparFiltros() {
    setBusca("");
    setFiltroProfissional("");
    setFiltroEspecialidade("");
    setFiltroPeriodo("");
  }

  function formatarValor(valor) {
    return valor && String(valor).trim() !== "" ? valor : "—";
  }

  function gerarDeclaracaoComparecimento(item) {
    return `DECLARAÇÃO DE COMPARECIMENTO

Declaramos, para os devidos fins, que ${item.paciente || "—"} compareceu a esta unidade de saúde na data de ${item.data || "—"}, às ${item.hora || "—"}, para atendimento do tipo ${item.tipoAtendimento || "—"}.

Profissional responsável: ${item.medico || "—"}
Especialidade: ${item.especialidade || "—"}

Esta declaração é emitida para fins de comprovação de comparecimento.`;
  }

  function gerarResumoClinico(item) {
    return `RESUMO CLÍNICO

Paciente: ${item.paciente || "—"}
Data: ${item.data || "—"}
Hora: ${item.hora || "—"}
Profissional: ${item.medico || "—"}
Especialidade: ${item.especialidade || "—"}

Anamnese:
${item.prontuario?.anamnese || "—"}

Evolução:
${item.prontuario?.evolucao || "—"}

Hipótese diagnóstica:
${item.prontuario?.hipoteseDiagnostica || "—"}

CID:
${item.prontuario?.cid || "—"}

Conduta:
${item.prontuario?.conduta || "—"}

Exames solicitados:
${item.prontuario?.exames || "—"}

Observações:
${item.prontuario?.observacoes || "—"}`;
  }

  function copiarTexto(texto) {
    navigator.clipboard
      .writeText(texto)
      .then(() => alert("Texto copiado com sucesso."))
      .catch(() => alert("Não foi possível copiar o texto."));
  }

  if (prontuarioSelecionado) {
    const prontuario = prontuarioSelecionado.prontuario || "";
    const declaracao = gerarDeclaracaoComparecimento(prontuarioSelecionado);
    const resumoClinico = gerarResumoClinico(prontuarioSelecionado);

    return (
      <div>
        <div className="page-header med-header-inline">
          <div className="med-header-left">
            <button className="med-back-btn" onClick={fecharProntuario}>
              ←
            </button>

            <div>
              <h1>Prontuário</h1>
              <p className="page-subtitle">
                Visualizando prontuário de {prontuarioSelecionado.paciente}
              </p>
            </div>
          </div>

          <div className="badge">{prontuarioSelecionado.status}</div>
        </div>

        <div className="stats-grid">
          <div className="stat-box patients-stat patients-stat-blue">
            <div className="stat-label">Paciente</div>
            <div className="stat-value" style={{ fontSize: "18px" }}>
              {formatarValor(prontuarioSelecionado.paciente)}
            </div>
            <div className="stat-info">Registro clínico</div>
          </div>

          <div className="stat-box patients-stat patients-stat-cyan">
            <div className="stat-label">Profissional</div>
            <div className="stat-value" style={{ fontSize: "18px" }}>
              {formatarValor(prontuarioSelecionado.medico)}
            </div>
            <div className="stat-info">Responsável pelo atendimento</div>
          </div>

          <div className="stat-box patients-stat patients-stat-purple">
            <div className="stat-label">Especialidade</div>
            <div className="stat-value" style={{ fontSize: "18px" }}>
              {formatarValor(prontuarioSelecionado.especialidade)}
            </div>
            <div className="stat-info">Área/função do profissional</div>
          </div>

          <div className="stat-box patients-stat patients-stat-green">
            <div className="stat-label">Atendimentos no histórico</div>
            <div className="stat-value">{historicoPaciente.length}</div>
            <div className="stat-info">Registros finalizados</div>
          </div>
        </div>

        <div className="page-card module-medico" style={{ marginTop: "20px" }}>
          <div className="patients-card-header">
            <div>
              <h3>Ficha clínica do atendimento</h3>
              <p className="patients-card-subtitle">
                Dados clínicos organizados por profissional e especialidade
              </p>
            </div>

            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button className="secondary-btn" onClick={() => window.print()}>
                Imprimir
              </button>

              <button
                className="secondary-btn"
                onClick={() => copiarTexto(resumoClinico)}
              >
                Copiar resumo
              </button>
            </div>
          </div>

          <div className="patients-tabs">
            <button
              className={`patients-tab ${abaDetalhe === "resumo" ? "active" : ""}`}
              onClick={() => setAbaDetalhe("resumo")}
            >
              Resumo
            </button>

            <button
              className={`patients-tab ${abaDetalhe === "clinico" ? "active" : ""}`}
              onClick={() => setAbaDetalhe("clinico")}
            >
              Ficha clínica
            </button>

            <button
              className={`patients-tab ${abaDetalhe === "evolucao" ? "active" : ""}`}
              onClick={() => setAbaDetalhe("evolucao")}
            >
              Evolução
            </button>

            <button
              className={`patients-tab ${abaDetalhe === "documentos" ? "active" : ""}`}
              onClick={() => setAbaDetalhe("documentos")}
            >
              Documentos
            </button>

            <button
              className={`patients-tab ${abaDetalhe === "historico" ? "active" : ""}`}
              onClick={() => setAbaDetalhe("historico")}
            >
              Histórico
            </button>

            <button
              className={`patients-tab ${abaDetalhe === "odonto" ? "active" : ""}`}
              onClick={() => setAbaDetalhe("odonto")}
              style={abaDetalhe === "odonto" ? { background: "#0f766e", borderColor: "#0f766e" } : {}}
            >
              🦷 Odonto
            </button>
          </div>

          <div style={{ marginTop: "20px", maxHeight: "calc(100vh - 390px)", overflowY: "auto", paddingRight: "4px" }}>
            {abaDetalhe === "resumo" && (
              <div className="med-panel-grid">
                <div className="muted-box">
                  <strong>Paciente</strong>
                  <div>{formatarValor(prontuarioSelecionado.paciente)}</div>
                </div>

                <div className="muted-box">
                  <strong>Profissional</strong>
                  <div>{formatarValor(prontuarioSelecionado.medico)}</div>
                </div>

                <div className="muted-box">
                  <strong>Especialidade</strong>
                  <div>{formatarValor(prontuarioSelecionado.especialidade)}</div>
                </div>

                <div className="muted-box">
                  <strong>Data / Hora</strong>
                  <div>
                    {formatarValor(prontuarioSelecionado.data)} às{" "}
                    {formatarValor(prontuarioSelecionado.hora)}
                  </div>
                </div>

                <div className="muted-box">
                  <strong>Tipo de atendimento</strong>
                  <div>{formatarValor(prontuarioSelecionado.tipoAtendimento)}</div>
                </div>

                <div className="muted-box">
                  <strong>Status</strong>
                  <div>{formatarValor(prontuarioSelecionado.status)}</div>
                </div>

                <div className="muted-box med-full">
                  <strong>Resumo da conduta</strong>
                  <div>{formatarValor(prontuario.conduta)}</div>
                </div>

                <div className="muted-box med-full">
                  <strong>Hipótese diagnóstica / CID</strong>
                  <div>
                    {formatarValor(prontuario.hipoteseDiagnostica)}{" "}
                    {prontuario.cid ? `- CID: ${prontuario.cid}` : ""}
                  </div>
                </div>
              </div>
            )}

            {abaDetalhe === "clinico" && (
              <div className="med-panel-grid">
                <div className="muted-box med-full">
                  <strong>Anamnese</strong>
                  <div>{formatarValor(prontuario.anamnese)}</div>
                </div>

                <div className="muted-box med-full">
                  <strong>Exame físico</strong>
                  <div>{formatarValor(prontuario.exameFisico)}</div>
                </div>

                <div className="muted-box">
                  <strong>Hipótese diagnóstica</strong>
                  <div>{formatarValor(prontuario.hipoteseDiagnostica)}</div>
                </div>

                <div className="muted-box">
                  <strong>CID</strong>
                  <div>{formatarValor(prontuario.cid)}</div>
                </div>

                <div className="muted-box med-full">
                  <strong>Conduta / Procedimento</strong>
                  <div>{formatarValor(prontuario.conduta)}</div>
                </div>

                <div className="muted-box med-full">
                  <strong>Exames solicitados</strong>
                  <div>{formatarValor(prontuario.exames)}</div>
                </div>

                <div className="muted-box med-full">
                  <strong>Observações</strong>
                  <div>{formatarValor(prontuario.observacoes)}</div>
                </div>

                <div className="muted-box">
                  <strong>Retorno</strong>
                  <div>{formatarValor(prontuario.retorno)}</div>
                </div>
              </div>
            )}

            {abaDetalhe === "evolucao" && (
              <div className="med-panel-grid">
                <div className="muted-box med-full">
                  <strong>Evolução do atendimento</strong>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {formatarValor(prontuario.evolucao)}
                  </div>
                </div>

                <div className="muted-box med-full">
                  <strong>Linha do tempo clínica</strong>

                  {historicoPaciente.length > 0 ? (
                    <div style={{ marginTop: "12px" }}>
                      {historicoPaciente.map((item) => (
                        <div
                          key={item.id}
                          className="muted-box"
                          style={{ marginBottom: "12px" }}
                        >
                          <strong>
                            {formatarValor(item.data)} às {formatarValor(item.hora)}
                          </strong>
                          <div>Profissional: {formatarValor(item.medico)}</div>
                          <div>Especialidade: {formatarValor(item.especialidade)}</div>
                          <div>
                            Evolução: {formatarValor(item.prontuario?.evolucao)}
                          </div>
                          <div>
                            Conduta: {formatarValor(item.prontuario?.conduta)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>Nenhum histórico encontrado.</div>
                  )}
                </div>
              </div>
            )}

            {abaDetalhe === "documentos" && (
              <div className="med-panel-grid">
                <div className="muted-box med-full">
                  <strong>Declaração de comparecimento</strong>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: "10px" }}>
                    {declaracao}
                  </div>

                  <div className="toolbar" style={{ marginTop: "12px" }}>
                    <button
                      className="secondary-btn"
                      onClick={() => copiarTexto(declaracao)}
                    >
                      Copiar declaração
                    </button>
                  </div>
                </div>

                <div className="muted-box med-full">
                  <strong>Receita</strong>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: "10px" }}>
                    {formatarValor(prontuario.receita)}
                  </div>

                  <div className="toolbar" style={{ marginTop: "12px" }}>
                    <button
                      className="secondary-btn"
                      onClick={() => copiarTexto(prontuario.receita || "")}
                      disabled={!prontuario.receita}
                    >
                      Copiar receita
                    </button>
                  </div>
                </div>

                <div className="muted-box med-full">
                  <strong>Atestado</strong>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: "10px" }}>
                    {formatarValor(prontuario.atestado)}
                  </div>

                  <div className="toolbar" style={{ marginTop: "12px" }}>
                    <button
                      className="secondary-btn"
                      onClick={() => copiarTexto(prontuario.atestado || "")}
                      disabled={!prontuario.atestado}
                    >
                      Copiar atestado
                    </button>
                  </div>
                </div>
              </div>
            )}

            {abaDetalhe === "historico" && (
              <div>
                <div className="muted-box" style={{ marginBottom: "16px" }}>
                  <strong>Histórico completo do paciente</strong>
                  <div>
                    Registros finalizados vinculados a {prontuarioSelecionado.paciente}.
                  </div>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Profissional</th>
                      <th>Especialidade</th>
                      <th>Diagnóstico</th>
                      <th>Conduta</th>
                      <th>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {historicoPaciente.map((item) => (
                      <tr key={item.id}>
                        <td>{formatarValor(item.data)}</td>
                        <td>{formatarValor(item.medico)}</td>
                        <td>{formatarValor(item.especialidade)}</td>
                        <td>{formatarValor(item.prontuario?.hipoteseDiagnostica)}</td>
                        <td>{formatarValor(item.prontuario?.conduta)}</td>
                        <td>
                          <button
                            className="secondary-btn"
                            onClick={() => abrirProntuario(item)}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}

                    {historicoPaciente.length === 0 && (
                      <tr>
                        <td colSpan="6">Nenhum histórico encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {abaDetalhe === "odonto" && (
              <div>
                <div className="muted-box" style={{ marginBottom: "16px", background: "#f0fdf9", border: "1px solid #99f6e4" }}>
                  <strong>Histórico odontológico de {prontuarioSelecionado.paciente}</strong>
                  <div>Atendimentos finalizados no módulo Odonto.</div>
                </div>

                {historicoOdontoPaciente.length === 0 ? (
                  <div className="muted-box">Nenhum atendimento odontológico registrado.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Profissional</th>
                        <th>Procedimentos</th>
                        <th>Total</th>
                        <th>Desconto</th>
                        <th>Valor final</th>
                        <th>Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoOdontoPaciente.map((item) => {
                        const dataFmt = item.finalizadoEm?.toDate
                          ? item.finalizadoEm.toDate().toLocaleDateString("pt-BR")
                          : item.data || "—";
                        const procs = (item.procedimentosRealizados || [])
                          .map((p) => p.nome)
                          .join(", ") || "—";
                        const moeda = (v) =>
                          Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                        return (
                          <tr key={item.id}>
                            <td>{dataFmt}</td>
                            <td>{item.profissionalNome || "—"}</td>
                            <td style={{ maxWidth: "240px", whiteSpace: "normal" }}>{procs}</td>
                            <td>{moeda(item.total)}</td>
                            <td style={{ color: "#dc2626" }}>{moeda(item.desconto)}</td>
                            <td><strong style={{ color: "#0f766e" }}>{moeda(item.valorFinal)}</strong></td>
                            <td>
                              <span className="badge" style={{
                                background: item.statusPagamento === "pago" ? "#dcfce7" : "#fef9c3",
                                color: item.statusPagamento === "pago" ? "#15803d" : "#854d0e",
                                fontSize: "12px"
                              }}>
                                {item.statusPagamento || "pendente"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Prontuário</h1>
        <p className="page-subtitle">
          Histórico completo dos atendimentos finalizados.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box patients-stat patients-stat-blue">
          <div className="stat-label">Prontuários</div>
          <div className="stat-value">{totalProntuarios}</div>
          <div className="stat-info">Atendimentos finalizados</div>
        </div>

        <div className="stat-box patients-stat patients-stat-cyan">
          <div className="stat-label">Pacientes</div>
          <div className="stat-value">{totalPacientes}</div>
          <div className="stat-info">Com histórico clínico</div>
        </div>

        <div className="stat-box patients-stat patients-stat-purple">
          <div className="stat-label">Profissionais</div>
          <div className="stat-value">{totalProfissionais}</div>
          <div className="stat-info">Com registros vinculados</div>
        </div>

        <div className="stat-box patients-stat patients-stat-green">
          <div className="stat-label">Especialidades</div>
          <div className="stat-value">{totalEspecialidades}</div>
          <div className="stat-info">Áreas registradas</div>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: "20px", flexWrap: "wrap" }}>
        <input
          className="input search-input"
          placeholder="Buscar paciente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <select
          className="select"
          value={filtroProfissional}
          onChange={(e) => setFiltroProfissional(e.target.value)}
        >
          <option value="">Todos os profissionais</option>
          {profissionais.map((profissional) => (
            <option key={profissional} value={profissional}>
              {profissional}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={filtroEspecialidade}
          onChange={(e) => setFiltroEspecialidade(e.target.value)}
        >
          <option value="">Todas as especialidades</option>
          {especialidades.map((especialidade) => (
            <option key={especialidade} value={especialidade}>
              {especialidade}
            </option>
          ))}
        </select>

        <input
          className="input"
          type="date"
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value)}
        />

        <button className="secondary-btn" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      <div className="page-card module-medico">
        <div className="patients-card-header">
          <div>
            <h3>Prontuários</h3>
            <p className="patients-card-subtitle">
              Lista clínica organizada por paciente, profissional e especialidade
            </p>
          </div>

          <div className="badge">{filtrados.length} registro(s)</div>
        </div>

        <div style={{ maxHeight: "calc(100vh - 360px)", overflowY: "auto", marginTop: "16px" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Profissional</th>
                <th>Especialidade</th>
                <th>Data</th>
                <th>Status</th>
                <th>Diagnóstico</th>
                <th>Conduta</th>
                <th>Ação</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map((item) => (
                <tr key={item.id}>
                  <td>{formatarValor(item.paciente)}</td>
                  <td>{formatarValor(item.medico)}</td>
                  <td>{formatarValor(item.especialidade)}</td>
                  <td>{formatarValor(item.data)}</td>
                  <td>{formatarValor(item.status)}</td>
                  <td>{formatarValor(item.prontuario?.hipoteseDiagnostica)}</td>
                  <td>{formatarValor(item.prontuario?.conduta)}</td>
                  <td>
                    <button
                      className="secondary-btn"
                      onClick={() => abrirProntuario(item)}
                    >
                      Abrir prontuário
                    </button>
                  </td>
                </tr>
              ))}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan="8">Nenhum prontuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}