import { useMemo, useState } from "react";

export default function Prontuario({ consultas = [] }) {
  const [busca, setBusca] = useState("");
  const [prontuarioSelecionado, setProntuarioSelecionado] = useState(null);

  const prontuarios = useMemo(() => {
    return consultas.filter(
      (item) => item.status === "Finalizado" && item.prontuario
    );
  }, [consultas]);

  const filtrados = useMemo(() => {
    return prontuarios.filter((item) =>
      (item.paciente || "").toLowerCase().includes(busca.toLowerCase())
    );
  }, [prontuarios, busca]);

  function abrirProntuario(item) {
    setProntuarioSelecionado(item);
  }

  function fecharProntuario() {
    setProntuarioSelecionado(null);
  }

  if (prontuarioSelecionado) {
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

        <div className="page-card module-medico">
          <div className="med-panel-grid">
            <div className="muted-box">
              <strong>Paciente</strong>
              <div>{prontuarioSelecionado.paciente}</div>
            </div>

            <div className="muted-box">
              <strong>Médico</strong>
              <div>{prontuarioSelecionado.medico}</div>
            </div>

            <div className="muted-box">
              <strong>Especialidade</strong>
              <div>{prontuarioSelecionado.especialidade}</div>
            </div>

            <div className="muted-box">
              <strong>Data</strong>
              <div>{prontuarioSelecionado.data}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Anamnese</strong>
              <div>{prontuarioSelecionado.prontuario?.anamnese || "—"}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Exame físico</strong>
              <div>{prontuarioSelecionado.prontuario?.exameFisico || "—"}</div>
            </div>

            <div className="muted-box">
              <strong>Hipótese diagnóstica</strong>
              <div>{prontuarioSelecionado.prontuario?.hipoteseDiagnostica || "—"}</div>
            </div>

            <div className="muted-box">
              <strong>CID</strong>
              <div>{prontuarioSelecionado.prontuario?.cid || "—"}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Conduta</strong>
              <div>{prontuarioSelecionado.prontuario?.conduta || "—"}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Exames solicitados</strong>
              <div>{prontuarioSelecionado.prontuario?.exames || "—"}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Evolução</strong>
              <div>{prontuarioSelecionado.prontuario?.evolucao || "—"}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Observações</strong>
              <div>{prontuarioSelecionado.prontuario?.observacoes || "—"}</div>
            </div>

            <div className="muted-box">
              <strong>Retorno</strong>
              <div>{prontuarioSelecionado.prontuario?.retorno || "—"}</div>
            </div>

            <div className="muted-box med-full">
              <strong>Receita</strong>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {prontuarioSelecionado.prontuario?.receita || "—"}
              </div>
            </div>

            <div className="muted-box med-full">
              <strong>Atestado</strong>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {prontuarioSelecionado.prontuario?.atestado || "—"}
              </div>
            </div>
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

      <div className="toolbar">
        <input
          className="input search-input"
          placeholder="Buscar paciente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="page-card module-medico">
        <h3>Prontuários</h3>

        <table className="table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Médico</th>
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
                <td>{item.paciente}</td>
                <td>{item.medico}</td>
                <td>{item.data}</td>
                <td>{item.status}</td>
                <td>{item.prontuario?.hipoteseDiagnostica || "-"}</td>
                <td>{item.prontuario?.conduta || "-"}</td>
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
                <td colSpan="7">Nenhum prontuário encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}