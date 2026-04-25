import { useEffect, useMemo, useState } from "react";

function calcularMinutos(data, hora) {
  if (!data || !hora) return 0;
  const chegada = new Date(`${data}T${hora}`);
  const agora = new Date();
  const diff = Math.floor((agora - chegada) / 60000);
  return diff > 0 ? diff : 0;
}

function formatarTempo(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h ${m}min`;
}

export default function Dashboard({ consultas = [] }) {
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const consultasComTempo = useMemo(() => {
    return consultas.map((item) => ({
      ...item,
      tempoEspera: calcularMinutos(item.data, item.hora),
      critico:
        item.prioridade === "Crítico" ||
        item.classificacao === "Vermelho" ||
        item.tipoRisco === "Crítico",
    }));
  }, [consultas, agora]);

  const cadastroChegada = consultasComTempo.filter(
    (item) => !item.status || item.status === "Cadastro" || item.status === "Chegada"
  );

  const aguardando = consultasComTempo.filter(
    (item) =>
      item.status === "Agendada" ||
      item.status === "Aguardando" ||
      item.status === "Aguardando atendimento"
  );

  const emAtendimento = consultasComTempo.filter(
    (item) => item.status === "Em atendimento"
  );

  const observacao = consultasComTempo.filter(
    (item) => item.status === "Observação" || item.status === "Em observação"
  );

  const finalizados = consultasComTempo.filter(
    (item) => item.status === "Finalizado"
  );

  const pacientesNaUnidade =
    cadastroChegada.length + aguardando.length + emAtendimento.length + observacao.length;

  const tempoMedioEspera =
    aguardando.length > 0
      ? Math.round(
          aguardando.reduce((total, item) => total + item.tempoEspera, 0) /
            aguardando.length
        )
      : 0;

  const criticosAguardando = aguardando.filter((item) => item.critico).length;

  const consultorios = useMemo(() => {
    const medicos = {};

    consultasComTempo.forEach((consulta) => {
      const medico = consulta.medico || "Sem médico definido";

      if (!medicos[medico]) {
        medicos[medico] = {
          medico,
          atual: null,
          realizados: 0,
        };
      }

      if (consulta.status === "Em atendimento") medicos[medico].atual = consulta;
      if (consulta.status === "Finalizado") medicos[medico].realizados += 1;
    });

    return Object.values(medicos).slice(0, 5);
  }, [consultasComTempo]);

  const alertas = [
    ...aguardando
      .filter((item) => item.tempoEspera > 120)
      .map((item) => ({
        tipo: "Tempo excedido",
        texto: `${item.paciente} aguardando há ${formatarTempo(item.tempoEspera)}.`,
        nivel: "alto",
      })),
    ...aguardando
      .filter((item) => item.critico)
      .map((item) => ({
        tipo: "Paciente crítico",
        texto: `${item.paciente} crítico sem atendimento.`,
        nivel: "critico",
      })),
    ...consultorios
      .filter((item) => !item.atual)
      .map((item) => ({
        tipo: "Consultório ocioso",
        texto: `${item.medico} sem paciente.`,
        nivel: "medio",
      })),
  ];

  function PacienteCard({ item }) {
    return (
      <div className={`flow-card ${item.critico ? "critical" : ""}`}>
        <div className="flow-card-top">
          <strong>{item.paciente || item.nome || "Paciente"}</strong>
          <span>{item.critico ? "Crítico" : item.tipoAtendimento || "PA"}</span>
        </div>

        <div className="flow-card-info">
          <div>
            <small>Espera</small>
            <b>{formatarTempo(item.tempoEspera)}</b>
          </div>

          <div>
            <small>Chegada</small>
            <b>{item.hora || "--:--"}</b>
          </div>
        </div>
      </div>
    );
  }

  function ColunaKanban({ titulo, lista }) {
    return (
      <div className="flow-column">
        <div className="flow-column-header">
          <strong>{titulo}</strong>
          <span>{lista.length}</span>
        </div>

        <div className="flow-column-list">
          {lista.length > 0 ? (
            lista.map((item) => <PacienteCard key={item.id} item={item} />)
          ) : (
            <div className="empty-flow">Sem pacientes</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-realtime dashboard-compact">
      <div className="realtime-kpis">
        <div className="realtime-kpi">
          <span>Total na unidade</span>
          <strong>{pacientesNaUnidade}</strong>
        </div>

        <div className="realtime-kpi warning">
          <span>Em espera</span>
          <strong>{aguardando.length}</strong>
        </div>

        <div className="realtime-kpi blue">
          <span>Em atendimento</span>
          <strong>{emAtendimento.length}</strong>
        </div>

        <div className="realtime-kpi purple">
          <span>Observação</span>
          <strong>{observacao.length}</strong>
        </div>

        <div className="realtime-kpi">
          <span>Tempo médio</span>
          <strong>{formatarTempo(tempoMedioEspera)}</strong>
        </div>

        <div className="realtime-kpi danger">
          <span>Críticos</span>
          <strong>{criticosAguardando}</strong>
        </div>
      </div>

      <div className="compact-alert-bar">
        <strong>Alertas:</strong>
        {alertas.length > 0 ? (
          alertas.slice(0, 4).map((alerta, index) => (
            <span key={index} className={`compact-alert ${alerta.nivel}`}>
              {alerta.tipo}: {alerta.texto}
            </span>
          ))
        ) : (
          <span className="compact-alert ok">Nenhum alerta crítico no momento</span>
        )}
      </div>

      <div className="realtime-layout compact-layout">
        <div className="kanban-area">
          <div className="section-title-row">
            <h2>Fluxo de pacientes</h2>
            <span>{agora.toLocaleTimeString("pt-BR")}</span>
          </div>

          <div className="patient-flow">
            <ColunaKanban titulo="Cadastro / Chegada" lista={cadastroChegada} />
            <ColunaKanban titulo="Aguardando" lista={aguardando} />
            <ColunaKanban titulo="Em atendimento" lista={emAtendimento} />
            <ColunaKanban titulo="Observação" lista={observacao} />
            <ColunaKanban titulo="Finalizados" lista={finalizados} />
          </div>
        </div>

        <aside className="right-panel">
          <div className="panel-card compact-doctors">
            <h3>Consultórios</h3>

            <div className="doctor-list">
              {consultorios.length > 0 ? (
                consultorios.map((item) => (
                  <div key={item.medico} className="doctor-card">
                    <div className="doctor-card-header">
                      <strong>{item.medico}</strong>
                      <span className={item.atual ? "status-online" : "status-idle"}>
                        {item.atual ? "Ativo" : "Ocioso"}
                      </span>
                    </div>

                    <p>
                      Paciente: <b>{item.atual?.paciente || "Sem atendimento"}</b>
                    </p>

                    <div className="doctor-metrics">
                      <span>
                        Tempo:{" "}
                        <b>{item.atual ? formatarTempo(item.atual.tempoEspera) : "0 min"}</b>
                      </span>
                      <span>
                        Atendidos: <b>{item.realizados}</b>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-flow">Nenhum consultório em uso</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}