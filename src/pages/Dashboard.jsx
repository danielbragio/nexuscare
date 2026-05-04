import { useEffect, useMemo, useState } from "react";

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obterNomePaciente(item) {
  return (
    item?.paciente ||
    item?.nomePaciente ||
    item?.nome ||
    item?.patientName ||
    "Paciente não informado"
  );
}

function obterMedico(item) {
  return (
    item?.medico ||
    item?.nomeMedico ||
    item?.profissional ||
    item?.doctorName ||
    "Sem médico definido"
  );
}

function obterConsultorio(item) {
  const valor =
    item?.consultorio ||
    item?.sala ||
    item?.consultorioNumero ||
    item?.room ||
    "";

  const numero = String(valor).replace(/\D/g, "");
  return numero ? Number(numero) : null;
}

function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function calcularMinutos(data, hora) {
  if (!data || !hora) return 0;

  const chegada = new Date(`${data}T${hora}`);
  const agora = new Date();

  if (Number.isNaN(chegada.getTime())) return 0;

  const diff = Math.floor((agora - chegada) / 60000);
  return diff > 0 ? diff : 0;
}

function formatarTempo(minutos) {
  const total = Number(minutos || 0);

  if (total < 60) return `${total} min`;

  const h = Math.floor(total / 60);
  const m = total % 60;

  return `${h}h ${m}min`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusOperacional(status) {
  const texto = normalizarTexto(status);

  if (
    !texto ||
    texto === "cadastro" ||
    texto === "chegada" ||
    texto === "recepcionado" ||
    texto === "recepcao"
  ) {
    return "chegada";
  }

  if (
    texto === "agendada" ||
    texto === "agendado" ||
    texto === "aguardando" ||
    texto === "aguardando atendimento" ||
    texto === "aguardando medico" ||
    texto === "espera"
  ) {
    return "aguardando";
  }

  if (
    texto === "em atendimento" ||
    texto === "atendimento" ||
    texto === "atendendo"
  ) {
    return "atendimento";
  }

  if (
    texto === "finalizado" ||
    texto === "finalizada" ||
    texto === "concluido" ||
    texto === "concluida" ||
    texto === "encerrado"
  ) {
    return "finalizado";
  }

  return "chegada";
}

function DashboardStyle() {
  return (
    <style>{`
      .dashboard-pro {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .dashboard-pro-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 18px;
        border-radius: 18px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #334155 100%);
        color: #fff;
        box-shadow: 0 18px 35px rgba(15, 23, 42, 0.16);
      }

      .dashboard-pro-header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .dashboard-pro-header p {
        margin: 6px 0 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.75);
      }

      .dashboard-live-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.16);
        font-size: 12px;
        white-space: nowrap;
      }

      .dashboard-live-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.18);
      }

      .dashboard-kpis {
        display: grid;
        grid-template-columns: repeat(6, minmax(120px, 1fr));
        gap: 12px;
      }

      .dashboard-kpi-card {
        min-height: 92px;
        padding: 15px;
        border-radius: 18px;
        background: #fff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .dashboard-kpi-card span {
        font-size: 12px;
        color: #64748b;
        font-weight: 700;
      }

      .dashboard-kpi-card strong {
        font-size: 28px;
        color: #0f172a;
        line-height: 1;
        letter-spacing: -0.04em;
      }

      .dashboard-kpi-card small {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 6px;
      }

      .dashboard-kpi-card.blue {
        background: #eff6ff;
        border-color: #bfdbfe;
      }

      .dashboard-kpi-card.green {
        background: #ecfdf5;
        border-color: #bbf7d0;
      }

      .dashboard-kpi-card.orange {
        background: #fff7ed;
        border-color: #fed7aa;
      }

      .dashboard-kpi-card.purple {
        background: #faf5ff;
        border-color: #e9d5ff;
      }

      .dashboard-main-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
        gap: 16px;
        align-items: start;
      }

      .dashboard-panel {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
        overflow: hidden;
      }

      .dashboard-panel-header {
        padding: 15px 16px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .dashboard-panel-header h2,
      .dashboard-panel-header h3 {
        margin: 0;
        font-size: 16px;
        color: #0f172a;
      }

      .dashboard-panel-header span {
        font-size: 12px;
        color: #64748b;
      }

      .patient-flow-pro {
        display: grid;
        grid-template-columns: repeat(4, minmax(170px, 1fr));
        gap: 12px;
        padding: 14px;
        max-height: 470px;
        overflow: auto;
      }

      .flow-column-pro {
        min-height: 395px;
        border-radius: 16px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .flow-column-header-pro {
        padding: 12px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .flow-column-header-pro strong {
        font-size: 13px;
        color: #0f172a;
      }

      .flow-column-header-pro span {
        min-width: 25px;
        height: 25px;
        padding: 0 7px;
        border-radius: 999px;
        background: #fff;
        border: 1px solid #e2e8f0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        color: #334155;
      }

      .flow-list-pro {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: auto;
      }

      .patient-card-pro {
        padding: 12px;
        border-radius: 15px;
        background: #fff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
      }

      .patient-card-top-pro {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 10px;
      }

      .patient-card-top-pro strong {
        font-size: 13px;
        color: #0f172a;
        line-height: 1.25;
      }

      .patient-tag-pro {
        padding: 4px 8px;
        border-radius: 999px;
        background: #f1f5f9;
        color: #475569;
        font-size: 10px;
        font-weight: 800;
        white-space: nowrap;
      }

      .patient-card-grid-pro {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .patient-mini-info {
        padding: 8px;
        border-radius: 12px;
        background: #f8fafc;
      }

      .patient-mini-info small {
        display: block;
        font-size: 10px;
        color: #64748b;
        margin-bottom: 3px;
      }

      .patient-mini-info b {
        font-size: 12px;
        color: #0f172a;
      }

      .tempo-alerta {
        color: #ea580c !important;
      }

      .dashboard-side-stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .consultorios-grid {
        padding: 14px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
        max-height: 470px;
        overflow: auto;
      }

      .consultorio-card {
        padding: 13px;
        border-radius: 16px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
      }

      .consultorio-card.ocupado {
        background: #eff6ff;
        border-color: #bfdbfe;
      }

      .consultorio-card.livre {
        background: #f8fafc;
      }

      .consultorio-top {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
      }

      .consultorio-top strong {
        font-size: 13px;
        color: #0f172a;
      }

      .consultorio-status {
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 900;
      }

      .consultorio-status.ocupado {
        color: #1d4ed8;
        background: #dbeafe;
      }

      .consultorio-status.livre {
        color: #64748b;
        background: #e2e8f0;
      }

      .consultorio-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .consultorio-info div {
        padding: 8px;
        border-radius: 12px;
        background: rgba(255,255,255,0.8);
      }

      .consultorio-info small {
        display: block;
        font-size: 10px;
        color: #64748b;
        margin-bottom: 3px;
      }

      .consultorio-info b {
        font-size: 12px;
        color: #0f172a;
      }

      .dashboard-bottom-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 0.55fr);
        gap: 16px;
      }

      .alerts-list-pro {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 230px;
        overflow: auto;
      }

      .alert-pro {
        padding: 11px 12px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .alert-pro strong {
        display: block;
        font-size: 12px;
        color: #0f172a;
        margin-bottom: 2px;
      }

      .alert-pro span {
        display: block;
        font-size: 12px;
        color: #64748b;
      }

      .alert-pro.alto {
        background: #fff7ed;
        border-color: #fed7aa;
      }

      .alert-pro.ok {
        background: #ecfdf5;
        border-color: #bbf7d0;
      }

      .recent-list-pro {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 230px;
        overflow: auto;
      }

      .recent-item-pro {
        padding: 11px 12px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
      }

      .recent-item-pro strong {
        display: block;
        font-size: 12px;
        color: #0f172a;
      }

      .recent-item-pro span {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        color: #64748b;
      }

      .empty-dashboard-pro {
        padding: 14px;
        border-radius: 14px;
        background: #fff;
        border: 1px dashed #cbd5e1;
        color: #94a3b8;
        font-size: 12px;
        text-align: center;
      }

      @media (max-width: 1250px) {
        .dashboard-kpis {
          grid-template-columns: repeat(3, 1fr);
        }

        .dashboard-main-grid,
        .dashboard-bottom-grid {
          grid-template-columns: 1fr;
        }

        .patient-flow-pro {
          grid-template-columns: repeat(2, minmax(180px, 1fr));
        }
      }

      @media (max-width: 760px) {
        .dashboard-pro-header {
          flex-direction: column;
        }

        .dashboard-kpis {
          grid-template-columns: repeat(2, 1fr);
        }

        .patient-flow-pro {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}

function PacienteCard({ item }) {
  const esperaAlta = item.tempoEspera >= 60;

  return (
    <div className="patient-card-pro">
      <div className="patient-card-top-pro">
        <strong>{item.nomePaciente}</strong>
        <span className="patient-tag-pro">{item.tipoAtendimento}</span>
      </div>

      <div className="patient-card-grid-pro">
        <div className="patient-mini-info">
          <small>Chegada</small>
          <b>{item.hora || "--:--"}</b>
        </div>

        <div className="patient-mini-info">
          <small>Tempo</small>
          <b className={esperaAlta ? "tempo-alerta" : ""}>
            {formatarTempo(item.tempoEspera)}
          </b>
        </div>

        <div className="patient-mini-info">
          <small>Médico</small>
          <b>{item.medico}</b>
        </div>

        <div className="patient-mini-info">
          <small>Consultório</small>
          <b>{item.consultorio ? `Consultório ${item.consultorio}` : "Não definido"}</b>
        </div>
      </div>
    </div>
  );
}

function ColunaFluxo({ titulo, lista }) {
  return (
    <div className="flow-column-pro">
      <div className="flow-column-header-pro">
        <strong>{titulo}</strong>
        <span>{lista.length}</span>
      </div>

      <div className="flow-list-pro">
        {lista.length > 0 ? (
          lista.map((item, index) => (
            <PacienteCard key={item.id || `${item.nomePaciente}-${index}`} item={item} />
          ))
        ) : (
          <div className="empty-dashboard-pro">Sem pacientes</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ consultas = [], pagamentos = [], atendimentosOdonto = [] }) {
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dataHoje = hojeISO();

  const consultasTratadas = useMemo(() => {
    return consultas.map((item) => {
      const status = statusOperacional(item.status);
      const nomePaciente = obterNomePaciente(item);
      const medico = obterMedico(item);
      const consultorio = obterConsultorio(item);

      return {
        ...item,
        statusOperacional: status,
        nomePaciente,
        medico,
        consultorio,
        tipoAtendimento:
          item.tipoAtendimento ||
          item.tipo ||
          item.servico ||
          item.especialidade ||
          "Atendimento",
        tempoEspera: calcularMinutos(item.data, item.hora),
      };
    });
  }, [consultas, agora]);

  const chegada = consultasTratadas.filter(
    (item) => item.statusOperacional === "chegada"
  );

  const aguardando = consultasTratadas.filter(
    (item) => item.statusOperacional === "aguardando"
  );

  const emAtendimento = consultasTratadas.filter(
    (item) => item.statusOperacional === "atendimento"
  );

  const finalizados = consultasTratadas.filter(
    (item) => item.statusOperacional === "finalizado"
  );

  const finalizadosHoje = finalizados.filter((item) => {
    if (!item.data) return true;
    return item.data === dataHoje;
  });

  const pacientesNaUnidade =
    chegada.length + aguardando.length + emAtendimento.length;

  const tempoMedioEspera =
    aguardando.length > 0
      ? Math.round(
          aguardando.reduce((total, item) => total + item.tempoEspera, 0) /
            aguardando.length
        )
      : 0;

  const receitaHoje = useMemo(() => {
    return pagamentos
      .filter((pagamento) => {
        const status = normalizarTexto(pagamento.status);
        const data = pagamento.dataPagamento || pagamento.data || pagamento.createdAt;

        return (
          (status === "pago" || status === "paga") &&
          (!data || String(data).slice(0, 10) === dataHoje)
        );
      })
      .reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
  }, [pagamentos, dataHoje]);

  const odontoAguardando = atendimentosOdonto.filter((a) => a.status === "aguardando").length;
  const odontoEmAtendimento = atendimentosOdonto.filter((a) => a.status === "em_atendimento").length;
  const odontoFinalizados = atendimentosOdonto.filter((a) => a.status === "finalizado").length;
  const receitaOdonto = useMemo(() => {
    const dePagamentos = pagamentos
      .filter((p) => {
        const origem = normalizarTexto(p.origem || p.tipo || "");
        const status = normalizarTexto(p.statusPagamento || p.status || "");
        return origem === "odonto" && (status === "pago" || status === "paga");
      })
      .reduce((acc, p) => acc + Number(p.valor || p.valorFinal || 0), 0);

    const deAtendimentos = atendimentosOdonto
      .filter((a) => {
        if (a.pagamentoId) return false;
        const st = normalizarTexto(a.statusPagamento || a.financeiro?.statusFinanceiro || "");
        return st === "pago" || st === "paga";
      })
      .reduce((acc, a) => acc + Number(a.valorFinal || 0), 0);

    return dePagamentos + deAtendimentos;
  }, [pagamentos, atendimentosOdonto]);

  const consultorios = useMemo(() => {
    const salas = Array.from({ length: 7 }, (_, index) => ({
      numero: index + 1,
      medico: "Sem médico vinculado",
      pacienteAtual: null,
      tempo: 0,
      atendidosHoje: 0,
      status: "livre",
    }));

    consultasTratadas.forEach((consulta) => {
      const numero = consulta.consultorio;

      if (numero && numero >= 1 && numero <= 7) {
        const sala = salas[numero - 1];

        if (consulta.medico && consulta.medico !== "Sem médico definido") {
          sala.medico = consulta.medico;
        }

        if (consulta.statusOperacional === "atendimento") {
          sala.pacienteAtual = consulta;
          sala.tempo = consulta.tempoEspera;
          sala.status = "ocupado";
        }

        if (
          consulta.statusOperacional === "finalizado" &&
          (!consulta.data || consulta.data === dataHoje)
        ) {
          sala.atendidosHoje += 1;
        }
      }
    });

    return salas;
  }, [consultasTratadas, dataHoje]);

  const alertas = useMemo(() => {
    const lista = [];

    aguardando
      .filter((item) => item.tempoEspera >= 60)
      .forEach((item) => {
        lista.push({
          tipo: "Espera acima do recomendado",
          texto: `${item.nomePaciente} aguardando há ${formatarTempo(
            item.tempoEspera
          )}.`,
          nivel: "alto",
        });
      });

    consultorios
      .filter((sala) => sala.status === "ocupado" && !sala.medico)
      .forEach((sala) => {
        lista.push({
          tipo: "Consultório ocupado sem médico",
          texto: `Consultório ${sala.numero} está ocupado sem médico vinculado.`,
          nivel: "alto",
        });
      });

    if (lista.length === 0) {
      lista.push({
        tipo: "Operação estável",
        texto: "Nenhum alerta operacional no momento.",
        nivel: "ok",
      });
    }

    return lista;
  }, [aguardando, consultorios]);

  const ultimosFinalizados = finalizadosHoje.slice(0, 6);

  return (
    <div className="dashboard-pro">
      <DashboardStyle />

      <div className="dashboard-pro-header">
        <div>
          <h1>Central de Operação da Unidade</h1>
          <p>
            Acompanhamento em tempo real da recepção, fila médica, atendimentos e
            consultórios.
          </p>
        </div>

        <div className="dashboard-live-badge">
          <span className="dashboard-live-dot" />
          Atualizado às {agora.toLocaleTimeString("pt-BR")}
        </div>
      </div>

      <div className="dashboard-kpis">
        <div className="dashboard-kpi-card">
          <span>Pacientes na unidade</span>
          <strong>{pacientesNaUnidade}</strong>
          <small>Recepção + espera + atendimento</small>
        </div>

        <div className="dashboard-kpi-card orange">
          <span>Aguardando médico</span>
          <strong>{aguardando.length}</strong>
          <small>Fila atual de atendimento</small>
        </div>

        <div className="dashboard-kpi-card blue">
          <span>Em atendimento</span>
          <strong>{emAtendimento.length}</strong>
          <small>Pacientes em consultório</small>
        </div>

        <div className="dashboard-kpi-card green">
          <span>Finalizados hoje</span>
          <strong>{finalizadosHoje.length}</strong>
          <small>Atendimentos concluídos</small>
        </div>

        <div className="dashboard-kpi-card purple">
          <span>Tempo médio de espera</span>
          <strong>{formatarTempo(tempoMedioEspera)}</strong>
          <small>Média da fila atual</small>
        </div>

        <div className="dashboard-kpi-card green">
          <span>Receita do dia</span>
          <strong>{formatarMoeda(receitaHoje)}</strong>
          <small>Pagamentos confirmados</small>
        </div>
      </div>

      {atendimentosOdonto.length > 0 && (
        <div style={{ background: "#f0fdf9", border: "1px solid #99f6e4", borderRadius: "18px", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <span style={{ fontSize: "18px" }}>🦷</span>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f766e" }}>Odontologia — tempo real</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(100px, 1fr))", gap: "10px" }}>
            <div className="dashboard-kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
              <span>Aguardando</span>
              <strong style={{ color: "#f59e0b" }}>{odontoAguardando}</strong>
              <small>Na fila odonto</small>
            </div>
            <div className="dashboard-kpi-card" style={{ borderTop: "3px solid #0f766e" }}>
              <span>Em atendimento</span>
              <strong style={{ color: "#0f766e" }}>{odontoEmAtendimento}</strong>
              <small>No consultório odonto</small>
            </div>
            <div className="dashboard-kpi-card" style={{ borderTop: "3px solid #16a34a" }}>
              <span>Finalizados</span>
              <strong style={{ color: "#16a34a" }}>{odontoFinalizados}</strong>
              <small>Atendimentos concluídos</small>
            </div>
            <div className="dashboard-kpi-card" style={{ borderTop: "3px solid #0f766e" }}>
              <span>Receita odonto</span>
              <strong style={{ color: "#0f766e" }}>{formatarMoeda(receitaOdonto)}</strong>
              <small>Pagamentos confirmados</small>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-main-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Fluxo de pacientes</h2>
              <span>Controle operacional por etapa do atendimento</span>
            </div>
          </div>

          <div className="patient-flow-pro">
            <ColunaFluxo titulo="Chegada / Recepção" lista={chegada} />
            <ColunaFluxo titulo="Aguardando médico" lista={aguardando} />
            <ColunaFluxo titulo="Em atendimento" lista={emAtendimento} />
            <ColunaFluxo titulo="Finalizados" lista={finalizadosHoje} />
          </div>
        </section>

        <aside className="dashboard-side-stack">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3>Consultórios</h3>
                <span>Status operacional das salas</span>
              </div>
            </div>

            <div className="consultorios-grid">
              {consultorios.map((sala) => (
                <div
                  key={sala.numero}
                  className={`consultorio-card ${sala.status}`}
                >
                  <div className="consultorio-top">
                    <strong>Consultório {sala.numero}</strong>
                    <span className={`consultorio-status ${sala.status}`}>
                      {sala.status === "ocupado" ? "Ocupado" : "Livre"}
                    </span>
                  </div>

                  <div className="consultorio-info">
                    <div>
                      <small>Médico</small>
                      <b>{sala.medico}</b>
                    </div>

                    <div>
                      <small>Paciente</small>
                      <b>
                        {sala.pacienteAtual
                          ? sala.pacienteAtual.nomePaciente
                          : "Sem atendimento"}
                      </b>
                    </div>

                    <div>
                      <small>Tempo</small>
                      <b>{formatarTempo(sala.tempo)}</b>
                    </div>

                    <div>
                      <small>Atendidos hoje</small>
                      <b>{sala.atendidosHoje}</b>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3>Alertas operacionais</h3>
              <span>Ocorrências que precisam de atenção</span>
            </div>
          </div>

          <div className="alerts-list-pro">
            {alertas.map((alerta, index) => (
              <div key={index} className={`alert-pro ${alerta.nivel}`}>
                <div>
                  <strong>{alerta.tipo}</strong>
                  <span>{alerta.texto}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3>Últimos finalizados</h3>
              <span>Atendimentos concluídos hoje</span>
            </div>
          </div>

          <div className="recent-list-pro">
            {ultimosFinalizados.length > 0 ? (
              ultimosFinalizados.map((item, index) => (
                <div key={item.id || index} className="recent-item-pro">
                  <strong>{item.nomePaciente}</strong>
                  <span>
                    {item.medico} • {item.hora || "--:--"} •{" "}
                    {item.tipoAtendimento}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-dashboard-pro">
                Nenhum atendimento finalizado hoje
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}