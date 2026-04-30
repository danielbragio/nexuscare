import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

import { auth, db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export default function Pacientes({
  pacientes = [],
  consultas = [],
  onAdicionarPaciente,
  onAdicionarConsulta,
}) {
  const { userData, firebaseUser } = useAuth();

  const [abaAtiva, setAbaAtiva] = useState("cadastro");
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [salvandoConsulta, setSalvandoConsulta] = useState(false);

  const [paginaBusca, setPaginaBusca] = useState(1);
  const itensPorPagina = 8;

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    dataNascimento: "",
    sexo: "",
    mae: "",
    pai: "",
    endereco: "",
    rua: "",
    cep: "",
    convenio: "Particular",
    status: "Ativo",
    observacoes: "",
  });

  const [agendamento, setAgendamento] = useState({
    nomePaciente: "",
    cpf: "",
    telefone: "",
    especialidade: "",
    medico: "",
    data: "",
    hora: "",
    observacoesRecepcao: "",
    tipoAtendimento: "Agendamento",
  });

  const isAdmin = userData?.role === "admin";

  function calcularIdade(dataNascimento) {
    if (!dataNascimento) return "";
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();

    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }

    return idade >= 0 ? idade : "";
  }

  const idadeAtual = calcularIdade(form.dataNascimento);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleAgendamentoChange(e) {
    const { name, value } = e.target;
    setAgendamento((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function limparFormulario() {
    setForm({
      nome: "",
      cpf: "",
      telefone: "",
      dataNascimento: "",
      sexo: "",
      mae: "",
      pai: "",
      endereco: "",
      rua: "",
      cep: "",
      convenio: "Particular",
      status: "Ativo",
      observacoes: "",
    });
  }

  function limparAgendamento() {
    setAgendamento({
      nomePaciente: "",
      cpf: "",
      telefone: "",
      especialidade: "",
      medico: "",
      data: "",
      hora: "",
      observacoesRecepcao: "",
      tipoAtendimento: "Agendamento",
    });
  }

  function novoCadastro() {
    limparFormulario();
    setAbaAtiva("cadastro");

    setTimeout(() => {
      const campoNome = document.querySelector('input[name="nome"]');
      if (campoNome) campoNome.focus();
    }, 100);
  }

  function novoAtendimento() {
    limparAgendamento();
    setAbaAtiva("agendamento");

    setTimeout(() => {
      const campoPaciente = document.querySelector('input[name="nomePaciente"]');
      if (campoPaciente) campoPaciente.focus();
    }, 100);
  }

  async function salvarPaciente() {
    if (!form.nome || !form.cpf || !form.telefone) {
      alert("Preencha nome, CPF e telefone.");
      return;
    }

    try {
      setSalvandoPaciente(true);
      await onAdicionarPaciente(form);
      limparFormulario();
      setAbaAtiva("buscar");
      alert("Paciente salvo com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar paciente:", error);
      alert("Não foi possível salvar o paciente.");
    } finally {
      setSalvandoPaciente(false);
    }
  }

  async function registrarAtendimento() {
    if (
      !agendamento.nomePaciente ||
      !agendamento.cpf ||
      !agendamento.telefone ||
      !agendamento.medico ||
      !agendamento.especialidade ||
      !agendamento.data ||
      !agendamento.hora ||
      !agendamento.tipoAtendimento
    ) {
      alert("Preencha os dados do atendimento.");
      return;
    }

    try {
      setSalvandoConsulta(true);
      await onAdicionarConsulta({
        paciente: agendamento.nomePaciente,
        cpf: agendamento.cpf,
        telefone: agendamento.telefone,
        especialidade: agendamento.especialidade,
        medico: agendamento.medico,
        data: agendamento.data,
        hora: agendamento.hora,
        observacoesRecepcao: agendamento.observacoesRecepcao,
        tipoAtendimento:
          agendamento.tipoAtendimento === "Atendimento Imediato"
            ? "Atendimento Imediato"
            : "Agendamento",
        chegouHoje: agendamento.tipoAtendimento === "Atendimento Imediato",
        fichaAberta: agendamento.tipoAtendimento === "Atendimento Imediato",
        tempoEsperaMinutos: 0,
      });

      limparAgendamento();
      alert("Atendimento registrado com sucesso.");
    } catch (error) {
      console.error("Erro ao registrar atendimento:", error);
      alert("Não foi possível registrar o atendimento.");
    } finally {
      setSalvandoConsulta(false);
    }
  }

  async function validarSenhaAdministrador() {
    if (!firebaseUser || !firebaseUser.email) {
      alert("Não foi possível validar o usuário logado.");
      return false;
    }

    const senha = prompt("Digite sua senha de administrador para confirmar:");

    if (!senha) return false;

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, senha);
      await reauthenticateWithCredential(auth.currentUser, credential);
      return true;
    } catch (error) {
      console.error("Erro ao validar senha:", error);
      alert("Senha inválida. Exclusão cancelada.");
      return false;
    }
  }

  async function excluirPaciente(paciente) {
    if (!isAdmin) {
      alert("Apenas administradores podem excluir cadastros.");
      return;
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o cadastro de ${paciente.nome}?`
    );

    if (!confirmar) return;

    const senhaValida = await validarSenhaAdministrador();

    if (!senhaValida) return;

    const motivo = prompt("Informe o motivo da exclusão:");

    if (!motivo) {
      alert("Informe o motivo para concluir a exclusão.");
      return;
    }

    try {
      await addDoc(collection(db, "auditLogs"), {
        tipo: "EXCLUSAO_PACIENTE",
        pacienteId: paciente.id,
        pacienteNome: paciente.nome || "",
        pacienteCpf: paciente.cpf || "",
        motivo,
        excluidoPor:
          userData?.nome || userData?.name || firebaseUser?.email || "Administrador",
        excluidoPorEmail: firebaseUser?.email || "",
        criadoEm: serverTimestamp(),
      });

      await deleteDoc(doc(db, "patients", paciente.id));

      alert("Cadastro excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir paciente:", error);
      alert("Erro ao excluir cadastro.");
    }
  }

  function carregarPaciente(item) {
    setForm({
      nome: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
      dataNascimento: item.dataNascimento || "",
      sexo: item.sexo || "",
      mae: item.mae || "",
      pai: item.pai || "",
      endereco: item.endereco || "",
      rua: item.rua || "",
      cep: item.cep || "",
      convenio: item.convenio || "Particular",
      status: item.status || "Ativo",
      observacoes: item.observacoes || "",
    });

    setAgendamento((prev) => ({
      ...prev,
      nomePaciente: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
    }));

    setAbaAtiva("cadastro");
  }

  function carregarParaAtendimento(item) {
    setAgendamento((prev) => ({
      ...prev,
      nomePaciente: item.nome || "",
      cpf: item.cpf || "",
      telefone: item.telefone || "",
    }));
    setAbaAtiva("agendamento");
  }

  const buscaCadastroFiltrada = useMemo(() => {
    return pacientes.filter((item) => {
      const termo = buscaCadastro.toLowerCase();
      return (
        (item.nome || "").toLowerCase().includes(termo) ||
        (item.cpf || "").toLowerCase().includes(termo) ||
        (item.telefone || "").toLowerCase().includes(termo) ||
        (item.convenio || "").toLowerCase().includes(termo)
      );
    });
  }, [pacientes, buscaCadastro]);

  const consultasDoPaciente = useMemo(() => {
    if (!agendamento.nomePaciente || !agendamento.cpf) return [];
    return consultas.filter(
      (item) =>
        item.paciente === agendamento.nomePaciente && item.cpf === agendamento.cpf
    );
  }, [consultas, agendamento.nomePaciente, agendamento.cpf]);

  const totalPacientes = pacientes.length;
  const pacientesAtivos = pacientes.filter((item) => item.status === "Ativo").length;
  const pacientesRetorno = pacientes.filter((item) => item.status === "Retorno").length;

  const totalPaginasBusca = Math.max(
    1,
    Math.ceil(buscaCadastroFiltrada.length / itensPorPagina)
  );

  const buscaPaginada = buscaCadastroFiltrada.slice(
    (paginaBusca - 1) * itensPorPagina,
    paginaBusca * itensPorPagina
  );

  function badgeClass(status) {
    if (status === "Ativo") return "patients-badge patients-badge-blue";
    if (status === "Retorno") return "patients-badge patients-badge-purple";
    return "patients-badge";
  }

  const painelInternoStyle = {
    maxHeight: "calc(100vh - 250px)",
    overflow: "hidden",
  };

  const conteudoAbaStyle = {
    marginTop: "20px",
    height: "calc(100vh - 360px)",
    minHeight: "360px",
    overflow: "hidden",
  };

  const scrollInternoStyle = {
    height: "100%",
    overflowY: "auto",
    paddingRight: "4px",
  };

  const tabelaScrollStyle = {
    maxHeight: "calc(100vh - 460px)",
    minHeight: "280px",
    overflowY: "auto",
    borderRadius: "12px",
  };

  return (
    <div className="patients-page" style={{ height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <h1>Recepção</h1>
        <p className="page-subtitle">
          Cadastro completo, busca rápida e envio para o fluxo do profissional.
        </p>
      </div>

      <div className="patients-hero">
        <div>
          <div className="patients-hero-kicker">Central de recepção</div>
          <h2 className="patients-hero-title">
            Cadastro, busca e envio para agendamento ou atendimento imediato
          </h2>
          <p className="patients-hero-text">
            Cadastre pacientes, localize registros existentes e envie para a fila do profissional.
          </p>
        </div>

        <div className="patients-hero-badges">
          <span className="patients-chip">Total: {totalPacientes}</span>
          <span className="patients-chip">Ativos: {pacientesAtivos}</span>
          <span className="patients-chip">Retorno: {pacientesRetorno}</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-box patients-stat patients-stat-blue">
          <div className="stat-label">Total de pacientes</div>
          <div className="stat-value">{totalPacientes}</div>
          <div className="stat-info">Base cadastrada</div>
        </div>

        <div className="stat-box patients-stat patients-stat-cyan">
          <div className="stat-label">Pacientes ativos</div>
          <div className="stat-value">{pacientesAtivos}</div>
          <div className="stat-info">Em acompanhamento</div>
        </div>

        <div className="stat-box patients-stat patients-stat-purple">
          <div className="stat-label">Retornos</div>
          <div className="stat-value">{pacientesRetorno}</div>
          <div className="stat-info">Consultas de revisão</div>
        </div>

        <div className="stat-box patients-stat patients-stat-green">
          <div className="stat-label">Atendimentos do paciente</div>
          <div className="stat-value">{consultasDoPaciente.length}</div>
          <div className="stat-info">Histórico na recepção</div>
        </div>
      </div>

      <div
        className="page-card patients-card patients-main-card"
        style={{ marginTop: "20px", ...painelInternoStyle }}
      >
        <div className="patients-card-header">
          <div>
            <h3>Central de recepção</h3>
            <p className="patients-card-subtitle">Use as abas para organizar o fluxo</p>
          </div>

          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="secondary-btn" onClick={novoCadastro}>
              Novo cadastro
            </button>
            <button className="secondary-btn" onClick={novoAtendimento}>
              Limpar atendimento
            </button>
          </div>
        </div>

        <div className="patients-tabs">
          <button
            className={`patients-tab ${abaAtiva === "cadastro" ? "active" : ""}`}
            onClick={() => setAbaAtiva("cadastro")}
          >
            Cadastro
          </button>

          <button
            className={`patients-tab ${abaAtiva === "buscar" ? "active" : ""}`}
            onClick={() => {
              setAbaAtiva("buscar");
              setPaginaBusca(1);
            }}
          >
            Buscar cadastro
          </button>

          <button
            className={`patients-tab ${abaAtiva === "agendamento" ? "active" : ""}`}
            onClick={() => setAbaAtiva("agendamento")}
          >
            Encaminhar atendimento
          </button>
        </div>

        <div style={conteudoAbaStyle}>
          {abaAtiva === "cadastro" && (
            <div className="patients-cadastro-layout" style={{ height: "100%" }}>
              <div className="patients-cadastro-main" style={scrollInternoStyle}>
                <div className="patients-section-card">
                  <h4 className="patients-section-title">Dados pessoais</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Nome completo</label>
                      <input
                        className="input"
                        name="nome"
                        value={form.nome}
                        onChange={handleChange}
                        placeholder="Digite o nome do paciente"
                      />
                    </div>

                    <div>
                      <label>CPF</label>
                      <input
                        className="input"
                        name="cpf"
                        value={form.cpf}
                        onChange={handleChange}
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div>
                      <label>Telefone</label>
                      <input
                        className="input"
                        name="telefone"
                        value={form.telefone}
                        onChange={handleChange}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <label>Data de nascimento</label>
                      <input
                        className="input"
                        type="date"
                        name="dataNascimento"
                        value={form.dataNascimento}
                        onChange={handleChange}
                      />
                    </div>

                    <div>
                      <label>Idade</label>
                      <input
                        className="input"
                        value={idadeAtual}
                        readOnly
                        placeholder="Calculada automaticamente"
                      />
                    </div>

                    <div>
                      <label>Sexo</label>
                      <select
                        className="select"
                        name="sexo"
                        value={form.sexo}
                        onChange={handleChange}
                      >
                        <option value="">Selecione</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div>
                      <label>Convênio</label>
                      <select
                        className="select"
                        name="convenio"
                        value={form.convenio}
                        onChange={handleChange}
                      >
                        <option>Particular</option>
                        <option>Unimed</option>
                        <option>SUS</option>
                      </select>
                    </div>

                    <div>
                      <label>Status</label>
                      <select
                        className="select"
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                      >
                        <option>Ativo</option>
                        <option>Retorno</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="patients-section-card">
                  <h4 className="patients-section-title">Filiação</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Nome da mãe</label>
                      <input
                        className="input"
                        name="mae"
                        value={form.mae}
                        onChange={handleChange}
                        placeholder="Digite o nome da mãe"
                      />
                    </div>

                    <div>
                      <label>Nome do pai</label>
                      <input
                        className="input"
                        name="pai"
                        value={form.pai}
                        onChange={handleChange}
                        placeholder="Digite o nome do pai"
                      />
                    </div>
                  </div>
                </div>

                <div className="patients-section-card">
                  <h4 className="patients-section-title">Endereço</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Endereço / bairro</label>
                      <input
                        className="input"
                        name="endereco"
                        value={form.endereco}
                        onChange={handleChange}
                        placeholder="Digite o bairro ou endereço geral"
                      />
                    </div>

                    <div>
                      <label>Rua</label>
                      <input
                        className="input"
                        name="rua"
                        value={form.rua}
                        onChange={handleChange}
                        placeholder="Digite a rua"
                      />
                    </div>

                    <div>
                      <label>CEP</label>
                      <input
                        className="input"
                        name="cep"
                        value={form.cep}
                        onChange={handleChange}
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                </div>

                <div className="patients-section-card">
                  <h4 className="patients-section-title">Observações</h4>

                  <div>
                    <label>Observações do paciente</label>
                    <textarea
                      className="textarea"
                      name="observacoes"
                      value={form.observacoes}
                      onChange={handleChange}
                      placeholder="Digite observações importantes do paciente"
                    />
                  </div>
                </div>

                <div className="patients-form-actions">
                  <button
                    onClick={salvarPaciente}
                    className="primary-btn patients-save-btn"
                    disabled={salvandoPaciente}
                  >
                    {salvandoPaciente ? "Salvando..." : "Salvar paciente"}
                  </button>
                  <button onClick={limparFormulario} className="secondary-btn">
                    Limpar
                  </button>
                </div>
              </div>

              <div className="patients-cadastro-side">
                <div className="page-card patients-card patients-side-highlight">
                  <h4 className="patients-section-title">Resumo do cadastro</h4>

                  <div className="patients-summary-card-item">
                    <span>Nome</span>
                    <strong>{form.nome || "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>CPF</span>
                    <strong>{form.cpf || "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>Idade</span>
                    <strong>{idadeAtual !== "" ? `${idadeAtual} anos` : "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>Convênio</span>
                    <strong>{form.convenio || "—"}</strong>
                  </div>

                  <div className="patients-summary-card-item">
                    <span>Status</span>
                    <strong>{form.status || "—"}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === "buscar" && (
            <div style={scrollInternoStyle}>
              <div className="toolbar">
                <input
                  className="input search-input"
                  value={buscaCadastro}
                  onChange={(e) => {
                    setBuscaCadastro(e.target.value);
                    setPaginaBusca(1);
                  }}
                  placeholder="Buscar por nome, CPF, telefone ou convênio"
                />
              </div>

              <div style={tabelaScrollStyle}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>CPF</th>
                      <th>Telefone</th>
                      <th>Convênio</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buscaPaginada.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nome}</td>
                        <td>{item.cpf}</td>
                        <td>{item.telefone}</td>
                        <td>{item.convenio}</td>
                        <td>
                          <span className={badgeClass(item.status)}>{item.status}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              className="secondary-btn"
                              onClick={() => carregarPaciente(item)}
                            >
                              Carregar cadastro
                            </button>

                            <button
                              className="secondary-btn"
                              onClick={() => carregarParaAtendimento(item)}
                            >
                              Encaminhar
                            </button>

                            {isAdmin && (
                              <button
                                className="danger-btn"
                                onClick={() => excluirPaciente(item)}
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {buscaCadastroFiltrada.length === 0 && (
                      <tr>
                        <td colSpan="6">Nenhum cadastro encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  className="secondary-btn"
                  disabled={paginaBusca === 1}
                  onClick={() => setPaginaBusca((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </button>

                <span>
                  Página {paginaBusca} de {totalPaginasBusca}
                </span>

                <button
                  className="secondary-btn"
                  disabled={paginaBusca >= totalPaginasBusca}
                  onClick={() =>
                    setPaginaBusca((prev) => Math.min(totalPaginasBusca, prev + 1))
                  }
                >
                  Próxima
                </button>
              </div>
            </div>
          )}

          {abaAtiva === "agendamento" && (
            <div className="patients-cadastro-layout" style={{ height: "100%" }}>
              <div className="patients-cadastro-main" style={scrollInternoStyle}>
                <div className="patients-section-card">
                  <h4 className="patients-section-title">Encaminhar atendimento</h4>

                  <div className="patients-form-grid">
                    <div>
                      <label>Nome do paciente</label>
                      <input
                        className="input"
                        name="nomePaciente"
                        value={agendamento.nomePaciente}
                        onChange={handleAgendamentoChange}
                        placeholder="Nome do paciente"
                      />
                    </div>

                    <div>
                      <label>CPF</label>
                      <input
                        className="input"
                        name="cpf"
                        value={agendamento.cpf}
                        onChange={handleAgendamentoChange}
                        placeholder="CPF"
                      />
                    </div>

                    <div>
                      <label>Telefone</label>
                      <input
                        className="input"
                        name="telefone"
                        value={agendamento.telefone}
                        onChange={handleAgendamentoChange}
                        placeholder="Telefone"
                      />
                    </div>

                    <div>
                      <label>Tipo de atendimento</label>
                      <select
                        className="select"
                        name="tipoAtendimento"
                        value={agendamento.tipoAtendimento}
                        onChange={handleAgendamentoChange}
                      >
                        <option value="Agendamento">Agendamento</option>
                        <option value="Atendimento Imediato">Atendimento Imediato</option>
                      </select>
                    </div>

                    <div>
                      <label>Profissional</label>
                      <input
                        className="input"
                        name="medico"
                        value={agendamento.medico}
                        onChange={handleAgendamentoChange}
                        placeholder="Nome do profissional"
                      />
                    </div>

                    <div>
                      <label>Especialidade</label>
                      <input
                        className="input"
                        name="especialidade"
                        value={agendamento.especialidade}
                        onChange={handleAgendamentoChange}
                        placeholder="Ex.: Médico, Enfermeiro, Odontólogo, Fisioterapeuta"
                      />
                    </div>

                    <div>
                      <label>Data</label>
                      <input
                        className="input"
                        type="date"
                        name="data"
                        value={agendamento.data}
                        onChange={handleAgendamentoChange}
                      />
                    </div>

                    <div>
                      <label>Hora</label>
                      <input
                        className="input"
                        type="time"
                        name="hora"
                        value={agendamento.hora}
                        onChange={handleAgendamentoChange}
                      />
                    </div>

                    <div className="patients-full-width">
                      <label>Observações da recepção</label>
                      <textarea
                        className="textarea"
                        name="observacoesRecepcao"
                        value={agendamento.observacoesRecepcao}
                        onChange={handleAgendamentoChange}
                        placeholder="Digite observações para o atendimento"
                      />
                    </div>
                  </div>

                  <div className="patients-form-actions">
                    <button
                      onClick={registrarAtendimento}
                      className="primary-btn"
                      disabled={salvandoConsulta}
                    >
                      {salvandoConsulta ? "Enviando..." : "Enviar para o profissional"}
                    </button>
                    <button onClick={limparAgendamento} className="secondary-btn">
                      Limpar
                    </button>
                  </div>
                </div>
              </div>

              <div className="patients-cadastro-side" style={{ overflowY: "auto" }}>
                <div className="page-card patients-card patients-side-highlight">
                  <h4 className="patients-section-title">Histórico do paciente</h4>

                  {consultasDoPaciente.length > 0 ? (
                    <div className="patients-mini-list">
                      {consultasDoPaciente.map((item) => (
                        <div
                          key={item.id}
                          className="muted-box"
                          style={{ marginBottom: "12px" }}
                        >
                          <strong>
                            {item.data} às {item.hora}
                          </strong>
                          <div>{item.tipoAtendimento}</div>
                          <div>Profissional: {item.medico}</div>
                          <div>Especialidade: {item.especialidade}</div>
                          <div>Status: {item.status}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted-box">
                      Nenhum atendimento vinculado a este paciente ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}