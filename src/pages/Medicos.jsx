import { useMemo, useState } from "react";

function normalizarTipo(tipo) {
  const texto = (tipo || "").toString().trim().toLowerCase();

  if (texto.includes("pronto")) return "Atendimento Imediato";
  return "Agendamento";
}

function ordenarConsultas(lista) {
  return [...lista].sort((a, b) => {
    const dataA = `${a.data || ""} ${a.hora || ""}`;
    const dataB = `${b.data || ""} ${b.hora || ""}`;
    return dataA.localeCompare(dataB);
  });
}

export default function Medicos({
  consultas = [],
  onIniciarAtendimento,
  onSalvarProntuario,
  onFinalizarAtendimento,
}) {
  const [busca, setBusca] = useState("");
  const [abaLista, setAbaLista] = useState("agendados");
  const [consultaSelecionada, setConsultaSelecionada] = useState(null);
  const [abaAtendimento, setAbaAtendimento] = useState("dados");

  const [form, setForm] = useState({
    statusAtendimento: "Em atendimento",
    anamnese: "",
    exameFisico: "",
    hipoteseDiagnostica: "",
    cid: "",
    conduta: "",
    exames: "",
    evolucao: "",
    observacoes: "",
    retorno: "",
    receita: "",
    atestado: "",
  });

  const consultasAtivas = useMemo(() => {
    return ordenarConsultas(
      consultas.filter((item) => item.status !== "Finalizado")
    );
  }, [consultas]);

  const consultasFiltradas = useMemo(() => {
    return consultasAtivas.filter((item) =>
      (item.paciente || "").toLowerCase().includes(busca.toLowerCase())
    );
  }, [consultasAtivas, busca]);

  const consultasAgendadas = useMemo(() => {
    return consultasFiltradas.filter(
      (item) => normalizarTipo(item.tipoAtendimento) === "Agendamento"
    );
  }, [consultasFiltradas]);

  const consultasProntoAtendimento = useMemo(() => {
    return consultasFiltradas.filter(
      (item) => normalizarTipo(item.tipoAtendimento) === "Atendimento Imediato"
    );
  }, [consultasFiltradas]);

  async function abrirAtendimento(consulta) {
    setConsultaSelecionada(consulta);
    setAbaAtendimento("dados");

    if (consulta.status === "Agendada" && onIniciarAtendimento) {
      await onIniciarAtendimento(consulta.id);
    }

    if (consulta.prontuario) {
      setForm({
        statusAtendimento: consulta.prontuario.statusAtendimento || "Em atendimento",
        anamnese: consulta.prontuario.anamnese || "",
        exameFisico: consulta.prontuario.exameFisico || "",
        hipoteseDiagnostica: consulta.prontuario.hipoteseDiagnostica || "",
        cid: consulta.prontuario.cid || "",
        conduta: consulta.prontuario.conduta || "",
        exames: consulta.prontuario.exames || "",
        evolucao: consulta.prontuario.evolucao || "",
        observacoes: consulta.prontuario.observacoes || "",
        retorno: consulta.prontuario.retorno || "",
        receita: consulta.prontuario.receita || "",
        atestado: consulta.prontuario.atestado || "",
      });
    } else {
      setForm({
        statusAtendimento: "Em atendimento",
        anamnese: "",
        exameFisico: "",
        hipoteseDiagnostica: "",
        cid: "",
        conduta: "",
        exames: "",
        evolucao: "",
        observacoes: "",
        retorno: "",
        receita: "",
        atestado: "",
      });
    }
  }

  function voltarParaLista() {
    setConsultaSelecionada(null);
    setAbaAtendimento("dados");
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function gerarReceitaModelo() {
    setForm((prev) => ({
      ...prev,
      receita:
        "1. Dipirona 500mg - tomar 1 comprimido de 6/6h se dor ou febre.\n2. Hidratação oral.\n3. Repouso.\n4. Retornar em caso de piora.",
    }));
    setAbaAtendimento("receita");
  }

  function gerarAtestadoModelo() {
    if (!consultaSelecionada) return;

    setForm((prev) => ({
      ...prev,
      atestado: `Atesto para os devidos fins que o(a) paciente ${consultaSelecionada.paciente} necessita de afastamento de suas atividades por 02 dias, a partir desta data, por motivo de saúde.`,
    }));
    setAbaAtendimento("atestado");
  }

  async function salvarProntuario() {
    if (!consultaSelecionada || !onSalvarProntuario) return;

    try {
      await onSalvarProntuario(consultaSelecionada.id, form);
      alert(`Prontuário de ${consultaSelecionada.paciente} salvo com sucesso.`);
    } catch (error) {
      console.error("Erro ao salvar prontuário:", error);
      alert("Não foi possível salvar o prontuário.");
    }
  }

  async function finalizarAtendimento() {
    if (!consultaSelecionada || !onFinalizarAtendimento) return;

    try {
      const prontuarioFinal = {
        ...form,
        statusAtendimento: "Finalizado",
      };

      await onFinalizarAtendimento(consultaSelecionada.id, prontuarioFinal);

      setConsultaSelecionada(null);
      setAbaAtendimento("dados");
      alert("Atendimento finalizado com sucesso.");
    } catch (error) {
      console.error("Erro ao finalizar atendimento:", error);
      alert("Não foi possível finalizar o atendimento.");
    }
  }

  function renderTabela(lista) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Especialidade</th>
            <th>Médico</th>
            <th>Data</th>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((consulta) => (
            <tr key={consulta.id}>
              <td>{consulta.paciente || "—"}</td>
              <td>{consulta.especialidade || "—"}</td>
              <td>{consulta.medico || "—"}</td>
              <td>{consulta.data || "—"}</td>
              <td>{consulta.hora || "—"}</td>
              <td>{normalizarTipo(consulta.tipoAtendimento)}</td>
              <td>{consulta.status || "Agendada"}</td>
              <td>
                <button
                  className="primary-btn"
                  onClick={() => abrirAtendimento(consulta)}
                >
                  Abrir atendimento
                </button>
              </td>
            </tr>
          ))}

          {lista.length === 0 && (
            <tr>
              <td colSpan="8">Nenhum paciente encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  function renderAbaAtendimento() {
    if (!consultaSelecionada) return null;

    if (abaAtendimento === "dados") {
      return (
        <div className="med-panel-grid">
          <div className="muted-box">
            <strong>Paciente</strong>
            <div>{consultaSelecionada.paciente}</div>
          </div>

          <div className="muted-box">
            <strong>CPF</strong>
            <div>{consultaSelecionada.cpf || "—"}</div>
          </div>

          <div className="muted-box">
            <strong>Telefone</strong>
            <div>{consultaSelecionada.telefone || "—"}</div>
          </div>

          <div className="muted-box">
            <strong>Status</strong>
            <div>{consultaSelecionada.status || "Agendada"}</div>
          </div>

          <div className="muted-box">
            <strong>Especialidade</strong>
            <div>{consultaSelecionada.especialidade || "—"}</div>
          </div>

          <div className="muted-box">
            <strong>Médico</strong>
            <div>{consultaSelecionada.medico || "—"}</div>
          </div>

          <div className="muted-box">
            <strong>Data</strong>
            <div>{consultaSelecionada.data || "—"}</div>
          </div>

          <div className="muted-box">
            <strong>Hora</strong>
            <div>{consultaSelecionada.hora || "—"}</div>
          </div>

          <div className="muted-box med-full">
            <strong>Tipo de atendimento</strong>
            <div>{normalizarTipo(consultaSelecionada.tipoAtendimento)}</div>
          </div>

          <div className="muted-box med-full">
            <strong>Observações da recepção</strong>
            <div>{consultaSelecionada.observacoesRecepcao || "Sem observações."}</div>
          </div>
        </div>
      );
    }

    if (abaAtendimento === "prontoatendimento") {
      return (
        <div className="med-form-grid">
          <div>
            <label>Status do atendimento</label>
            <select
              className="select"
              name="statusAtendimento"
              value={form.statusAtendimento}
              onChange={handleChange}
            >
              <option value="Em atendimento">Em atendimento</option>
              <option value="Em observação">Em observação</option>
              <option value="Encaminhado">Encaminhado</option>
            </select>
          </div>

          <div>
            <label>CID</label>
            <input
              className="input"
              name="cid"
              value={form.cid}
              onChange={handleChange}
              placeholder="Ex.: J06.9"
            />
          </div>

          <div className="med-full">
            <label>Anamnese</label>
            <textarea
              className="textarea"
              name="anamnese"
              value={form.anamnese}
              onChange={handleChange}
              placeholder="Descreva a história clínica do paciente"
            />
          </div>

          <div className="med-full">
            <label>Exame físico</label>
            <textarea
              className="textarea"
              name="exameFisico"
              value={form.exameFisico}
              onChange={handleChange}
              placeholder="Descreva o exame físico"
            />
          </div>

          <div>
            <label>Hipótese diagnóstica</label>
            <textarea
              className="textarea"
              name="hipoteseDiagnostica"
              value={form.hipoteseDiagnostica}
              onChange={handleChange}
              placeholder="Hipótese diagnóstica"
            />
          </div>

          <div>
            <label>Conduta</label>
            <textarea
              className="textarea"
              name="conduta"
              value={form.conduta}
              onChange={handleChange}
              placeholder="Conduta médica"
            />
          </div>

          <div>
            <label>Exames solicitados</label>
            <textarea
              className="textarea"
              name="exames"
              value={form.exames}
              onChange={handleChange}
              placeholder="Exames solicitados"
            />
          </div>

          <div>
            <label>Evolução</label>
            <textarea
              className="textarea"
              name="evolucao"
              value={form.evolucao}
              onChange={handleChange}
              placeholder="Evolução clínica"
            />
          </div>

          <div className="med-full">
            <label>Observações</label>
            <textarea
              className="textarea"
              name="observacoes"
              value={form.observacoes}
              onChange={handleChange}
              placeholder="Observações adicionais"
            />
          </div>

          <div>
            <label>Orientação de retorno</label>
            <input
              className="input"
              name="retorno"
              value={form.retorno}
              onChange={handleChange}
              placeholder="Ex.: retorno em 7 dias"
            />
          </div>
        </div>
      );
    }

    if (abaAtendimento === "receita") {
      return (
        <div>
          <div className="card-title-row">
            <h3 style={{ marginBottom: 0 }}>Receita médica</h3>
            <button className="secondary-btn" onClick={gerarReceitaModelo}>
              Gerar modelo
            </button>
          </div>

          <textarea
            className="textarea"
            name="receita"
            value={form.receita}
            onChange={handleChange}
            placeholder="Digite a receita médica"
          />
        </div>
      );
    }

    if (abaAtendimento === "atestado") {
      return (
        <div>
          <div className="card-title-row">
            <h3 style={{ marginBottom: 0 }}>Atestado médico</h3>
            <button className="secondary-btn" onClick={gerarAtestadoModelo}>
              Gerar modelo
            </button>
          </div>

          <textarea
            className="textarea"
            name="atestado"
            value={form.atestado}
            onChange={handleChange}
            placeholder="Digite o atestado médico"
          />
        </div>
      );
    }

    return null;
  }

  if (consultaSelecionada) {
    return (
      <div>
        <div className="page-header med-header-inline">
          <div className="med-header-left">
            <button className="med-back-btn" onClick={voltarParaLista}>
              ←
            </button>

            <div>
              <h1>Médicos</h1>
              <p className="page-subtitle">
                Atendimento em andamento de {consultaSelecionada.paciente}
              </p>
            </div>
          </div>

          <div className="badge">{consultaSelecionada.status || "Agendada"}</div>
        </div>

        <div className="page-card module-medico">
          <div className="medical-tabs">
            <button
              className={`medical-tab ${abaAtendimento === "dados" ? "active" : ""}`}
              onClick={() => setAbaAtendimento("dados")}
            >
              Dados
            </button>

            <button
              className={`medical-tab ${abaAtendimento === "prontoatendimento" ? "active" : ""}`}
              onClick={() => setAbaAtendimento("prontoatendimento")}
            >
              Atendimento Imediato
            </button>

            <button
              className={`medical-tab ${abaAtendimento === "receita" ? "active" : ""}`}
              onClick={() => setAbaAtendimento("receita")}
            >
              Receita
            </button>

            <button
              className={`medical-tab ${abaAtendimento === "atestado" ? "active" : ""}`}
              onClick={() => setAbaAtendimento("atestado")}
            >
              Atestado
            </button>
          </div>

          <div style={{ marginTop: "20px" }}>{renderAbaAtendimento()}</div>
        </div>

        <div className="toolbar" style={{ marginTop: "20px" }}>
          <button className="primary-btn" onClick={salvarProntuario}>
            Salvar prontuário
          </button>

          <button className="secondary-btn" onClick={finalizarAtendimento}>
            Finalizar atendimento
          </button>

          <button className="secondary-btn" onClick={voltarParaLista}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Médicos</h1>
        <p className="page-subtitle">
          Atendimento médico com abas de agendados e atendimento imediato.
        </p>
      </div>

      <div className="two-columns">
        <div className="page-card module-medico">
          <div className="toolbar">
            <input
              className="input search-input"
              placeholder="Buscar paciente por nome"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="medical-tabs" style={{ marginBottom: "20px" }}>
            <button
              className={`medical-tab ${abaLista === "agendados" ? "active" : ""}`}
              onClick={() => setAbaLista("agendados")}
            >
              Agendados
            </button>

            <button
              className={`medical-tab ${abaLista === "prontoatendimento" ? "active" : ""}`}
              onClick={() => setAbaLista("prontoatendimento")}
            >
              Atendimento Imediato
            </button>
          </div>

          {abaLista === "agendados" && renderTabela(consultasAgendadas)}
          {abaLista === "prontoatendimento" && renderTabela(consultasProntoAtendimento)}
        </div>

        <div className="page-card module-medico">
          <h3>Resumo do setor</h3>

          <div className="muted-box" style={{ marginBottom: "12px" }}>
            Total de consultas ativas: <strong>{consultasAtivas.length}</strong>
          </div>

          <div className="muted-box" style={{ marginBottom: "12px" }}>
            Agendados: <strong>{consultasAgendadas.length}</strong>
          </div>

          <div className="muted-box" style={{ marginBottom: "12px" }}>
            Atendimento imediato: <strong>{consultasProntoAtendimento.length}</strong>
          </div>

          <div className="muted-box">
            Em atendimento:{" "}
            <strong>
              {consultasAtivas.filter((c) => c.status === "Em atendimento").length}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}