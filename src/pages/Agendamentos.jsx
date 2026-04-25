function formatarDataBr(dataISO) {
  if (!dataISO) return "Sem data";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Agendamentos({ consultas = [] }) {
  const consultasOrdenadas = [...consultas].sort((a, b) =>
    a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora)
  );

  const agrupadasPorDia = consultasOrdenadas.reduce((acc, consulta) => {
    if (!acc[consulta.data]) {
      acc[consulta.data] = [];
    }
    acc[consulta.data].push(consulta);
    return acc;
  }, {});

  const dias = Object.keys(agrupadasPorDia);

  return (
    <div>
      <div className="page-header">
        <h1>Agendamentos</h1>
        <p className="page-subtitle">
          Visualização dos pacientes agendados por dia, com dados salvos no banco.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Total de consultas</div>
          <div className="stat-value">{consultas.length}</div>
          <div className="stat-info">Registros na agenda</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Dias com agenda</div>
          <div className="stat-value">{dias.length}</div>
          <div className="stat-info">Datas com pacientes marcados</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Agendadas</div>
          <div className="stat-value">
            {consultas.filter((item) => item.status === "Agendada").length}
          </div>
          <div className="stat-info">Aguardando atendimento</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Finalizadas</div>
          <div className="stat-value">
            {consultas.filter((item) => item.status === "Finalizado").length}
          </div>
          <div className="stat-info">Atendimentos concluídos</div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: "20px" }}>
        <h3>Agenda por dia</h3>

        {dias.length === 0 && <p>Nenhum paciente agendado.</p>}

        {dias.map((data) => (
          <div key={data} style={{ marginTop: "20px" }}>
            <div className="muted-box" style={{ marginBottom: "12px" }}>
              <strong>{formatarDataBr(data)}</strong>
              <div>
                {agrupadasPorDia[data].length} paciente(s) agendado(s) neste dia
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Telefone</th>
                  <th>Especialidade</th>
                  <th>Médico</th>
                  <th>Hora</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {agrupadasPorDia[data].map((item) => (
                  <tr key={item.id}>
                    <td>{item.paciente}</td>
                    <td>{item.telefone}</td>
                    <td>{item.especialidade}</td>
                    <td>{item.medico}</td>
                    <td>{item.hora}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}