import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export default function Pagamentos({ pacientes = [], consultas = [] }) {
  const { userData, firebaseUser } = useAuth();

  const [pagamentos, setPagamentos] = useState([]);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  const [pagamento, setPagamento] = useState({
    pacienteId: "",
    paciente: "",
    cpf: "",
    telefone: "",
    atendimentoId: "",
    tipoAtendimento: "",
    valor: "",
    formaPagamento: "Dinheiro",
    statusPagamento: "Pago",
    dataPagamento: new Date().toISOString().split("T")[0],
    observacoes: "",
  });

  useEffect(() => {
    const q = query(collection(db, "pagamentos"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setPagamentos(lista);
    });

    return () => unsubscribe();
  }, []);

  const atendimentosPagos = useMemo(() => {
    return pagamentos
      .filter((item) => item.statusPagamento === "Pago")
      .map((item) => item.atendimentoId)
      .filter(Boolean);
  }, [pagamentos]);

  const atendimentosDoDia = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];

    return consultas.filter((item) => {
      const atendimentoHoje = item.data === hoje || item.chegouHoje;
      const aindaNaoPago = !atendimentosPagos.includes(item.id);

      return atendimentoHoje && aindaNaoPago;
    });
  }, [consultas, atendimentosPagos]);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function handlePagamentoChange(e) {
    const { name, value } = e.target;

    setPagamento((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function selecionarAtendimentoPagamento(atendimentoId) {
    const atendimentoSelecionado = consultas.find((item) => item.id === atendimentoId);

    if (!atendimentoSelecionado) {
      setPagamento((prev) => ({
        ...prev,
        atendimentoId: "",
        pacienteId: "",
        paciente: "",
        cpf: "",
        telefone: "",
        tipoAtendimento: "",
      }));
      return;
    }

    const pacienteVinculado = pacientes.find(
      (item) =>
        item.cpf &&
        atendimentoSelecionado.cpf &&
        item.cpf === atendimentoSelecionado.cpf
    );

    setPagamento((prev) => ({
      ...prev,
      atendimentoId: atendimentoSelecionado.id || "",
      pacienteId: pacienteVinculado?.id || "",
      paciente:
        atendimentoSelecionado.paciente ||
        atendimentoSelecionado.nomePaciente ||
        pacienteVinculado?.nome ||
        "",
      cpf: atendimentoSelecionado.cpf || pacienteVinculado?.cpf || "",
      telefone: atendimentoSelecionado.telefone || pacienteVinculado?.telefone || "",
      tipoAtendimento:
        atendimentoSelecionado.tipoAtendimento ||
        atendimentoSelecionado.especialidade ||
        "",
    }));
  }

  function limparPagamento() {
    setPagamento({
      pacienteId: "",
      paciente: "",
      cpf: "",
      telefone: "",
      atendimentoId: "",
      tipoAtendimento: "",
      valor: "",
      formaPagamento: "Dinheiro",
      statusPagamento: "Pago",
      dataPagamento: new Date().toISOString().split("T")[0],
      observacoes: "",
    });
  }

  async function salvarPagamento() {
    if (
      !pagamento.paciente ||
      !pagamento.tipoAtendimento ||
      !pagamento.valor ||
      !pagamento.formaPagamento ||
      !pagamento.statusPagamento ||
      !pagamento.dataPagamento
    ) {
      alert("Preencha paciente, serviço, valor, forma, status e data do pagamento.");
      return;
    }

    if (!pagamento.atendimentoId) {
      alert("Selecione um atendimento do dia para evitar duplicidade de pagamento.");
      return;
    }

    if (
      pagamento.statusPagamento === "Pago" &&
      atendimentosPagos.includes(pagamento.atendimentoId)
    ) {
      alert("Este atendimento já possui pagamento registrado como pago.");
      limparPagamento();
      return;
    }

    const valorNumerico = Number(String(pagamento.valor).replace(",", "."));

    if (Number.isNaN(valorNumerico) || valorNumerico < 0) {
      alert("Informe um valor válido para o pagamento.");
      return;
    }

    try {
      setSalvandoPagamento(true);

      await addDoc(collection(db, "pagamentos"), {
        pacienteId: pagamento.pacienteId || "",
        paciente: pagamento.paciente,
        cpf: pagamento.cpf || "",
        telefone: pagamento.telefone || "",
        atendimentoId: pagamento.atendimentoId || "",
        tipoAtendimento: pagamento.tipoAtendimento,
        valor: valorNumerico,
        formaPagamento: pagamento.formaPagamento,
        statusPagamento: pagamento.statusPagamento,
        dataPagamento: pagamento.dataPagamento,
        observacoes: pagamento.observacoes || "",
        origem: "Pagamentos",
        tipoMovimentacao: "Receita",
        criadoPor:
          userData?.nome || userData?.name || firebaseUser?.email || "Usuário",
        criadoPorEmail: firebaseUser?.email || "",
        criadoEm: serverTimestamp(),
      });

      limparPagamento();
      alert("Pagamento registrado com sucesso. Ele já ficará disponível no Financeiro.");
    } catch (error) {
      console.error("Erro ao salvar pagamento:", error);
      alert("Não foi possível registrar o pagamento.");
    } finally {
      setSalvandoPagamento(false);
    }
  }

  const pagamentosRecentes = pagamentos.slice(0, 8);

  return (
    <div className="patients-page" style={{ height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <h1>Pagamentos</h1>
        <p className="page-subtitle">
          Checkout do paciente integrado com o financeiro.
        </p>
      </div>

      <div className="patients-hero">
        <div>
          <div className="patients-hero-kicker">Checkout financeiro</div>
          <h2 className="patients-hero-title">
            Registro de pagamentos de consultas, procedimentos e convênios
          </h2>
          <p className="patients-hero-text">
            Selecione o atendimento do dia, registre o pagamento e envie automaticamente
            para o Financeiro.
          </p>
        </div>

        <div className="patients-hero-badges">
          <span className="patients-chip">Atendimentos hoje: {atendimentosDoDia.length}</span>
          <span className="patients-chip">Pagamentos: {pagamentos.length}</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-box patients-stat patients-stat-blue">
          <div className="stat-label">Atendimentos disponíveis</div>
          <div className="stat-value">{atendimentosDoDia.length}</div>
          <div className="stat-info">Ainda sem pagamento confirmado</div>
        </div>

        <div className="stat-box patients-stat patients-stat-green">
          <div className="stat-label">Pagamentos pagos</div>
          <div className="stat-value">
            {pagamentos.filter((item) => item.statusPagamento === "Pago").length}
          </div>
          <div className="stat-info">Recebimentos confirmados</div>
        </div>

        <div className="stat-box patients-stat patients-stat-purple">
          <div className="stat-label">Pendentes</div>
          <div className="stat-value">
            {pagamentos.filter((item) => item.statusPagamento === "Pendente").length}
          </div>
          <div className="stat-info">Aguardando pagamento</div>
        </div>

        <div className="stat-box patients-stat patients-stat-cyan">
          <div className="stat-label">Total recebido</div>
          <div className="stat-value">
            {formatarMoeda(
              pagamentos
                .filter((item) => item.statusPagamento === "Pago")
                .reduce((total, item) => total + Number(item.valor || 0), 0)
            )}
          </div>
          <div className="stat-info">Pagamentos confirmados</div>
        </div>
      </div>

      <div
        className="page-card patients-card patients-main-card"
        style={{
          marginTop: "20px",
          maxHeight: "calc(100vh - 250px)",
          overflow: "hidden",
        }}
      >
        <div className="patients-card-header">
          <div>
            <h3>Checkout do paciente</h3>
            <p className="patients-card-subtitle">
              Registre pagamentos sem duplicidade por atendimento.
            </p>
          </div>

          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="secondary-btn" onClick={limparPagamento}>
              Limpar pagamento
            </button>
          </div>
        </div>

        <div
          className="patients-cadastro-layout"
          style={{
            marginTop: "20px",
            height: "calc(100vh - 360px)",
            minHeight: "360px",
            overflow: "hidden",
          }}
        >
          <div
            className="patients-cadastro-main"
            style={{
              height: "100%",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            <div className="patients-section-card">
              <h4 className="patients-section-title">Dados do pagamento</h4>

              <div className="patients-form-grid">
                <div>
                  <label>Atendimento do dia</label>
                  <select
                    className="select"
                    value={pagamento.atendimentoId}
                    onChange={(e) => selecionarAtendimentoPagamento(e.target.value)}
                  >
                    <option value="">Selecionar atendimento/agendamento</option>
                    {atendimentosDoDia.map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.paciente || item.nomePaciente || "Paciente")} -{" "}
                        {item.data || "Hoje"} {item.hora || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Nome do paciente</label>
                  <input
                    className="input"
                    name="paciente"
                    value={pagamento.paciente}
                    onChange={handlePagamentoChange}
                    placeholder="Nome do paciente"
                  />
                </div>

                <div>
                  <label>CPF</label>
                  <input
                    className="input"
                    name="cpf"
                    value={pagamento.cpf}
                    onChange={handlePagamentoChange}
                    placeholder="CPF"
                  />
                </div>

                <div>
                  <label>Telefone</label>
                  <input
                    className="input"
                    name="telefone"
                    value={pagamento.telefone}
                    onChange={handlePagamentoChange}
                    placeholder="Telefone"
                  />
                </div>

                <div>
                  <label>Tipo de atendimento ou serviço</label>
                  <input
                    className="input"
                    name="tipoAtendimento"
                    value={pagamento.tipoAtendimento}
                    onChange={handlePagamentoChange}
                    placeholder="Consulta, procedimento ou exame"
                  />
                </div>

                <div>
                  <label>Valor</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    name="valor"
                    value={pagamento.valor}
                    onChange={handlePagamentoChange}
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label>Forma de pagamento</label>
                  <select
                    className="select"
                    name="formaPagamento"
                    value={pagamento.formaPagamento}
                    onChange={handlePagamentoChange}
                  >
                    <option>Dinheiro</option>
                    <option>Pix</option>
                    <option>Cartão de Débito</option>
                    <option>Cartão de Crédito</option>
                    <option>Convênio</option>
                  </select>
                </div>

                <div>
                  <label>Status do pagamento</label>
                  <select
                    className="select"
                    name="statusPagamento"
                    value={pagamento.statusPagamento}
                    onChange={handlePagamentoChange}
                  >
                    <option>Pago</option>
                    <option>Pendente</option>
                    <option>Cancelado</option>
                    <option>Cortesia</option>
                  </select>
                </div>

                <div>
                  <label>Data do pagamento</label>
                  <input
                    className="input"
                    type="date"
                    name="dataPagamento"
                    value={pagamento.dataPagamento}
                    onChange={handlePagamentoChange}
                  />
                </div>

                <div className="patients-full-width">
                  <label>Observações</label>
                  <textarea
                    className="textarea"
                    name="observacoes"
                    value={pagamento.observacoes}
                    onChange={handlePagamentoChange}
                    placeholder="Observações do pagamento"
                  />
                </div>
              </div>

              <div className="patients-form-actions">
                <button
                  onClick={salvarPagamento}
                  className="primary-btn"
                  disabled={salvandoPagamento}
                >
                  {salvandoPagamento ? "Salvando..." : "Salvar pagamento"}
                </button>

                <button onClick={limparPagamento} className="secondary-btn">
                  Limpar
                </button>
              </div>
            </div>

            <div className="patients-section-card">
              <h4 className="patients-section-title">Pagamentos recentes</h4>

              <div
                style={{
                  maxHeight: "280px",
                  overflowY: "auto",
                  borderRadius: "12px",
                }}
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Serviço</th>
                      <th>Valor</th>
                      <th>Forma</th>
                      <th>Status</th>
                      <th>Data</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagamentosRecentes.map((item) => (
                      <tr key={item.id}>
                        <td>{item.paciente || "—"}</td>
                        <td>{item.tipoAtendimento || "—"}</td>
                        <td>{formatarMoeda(item.valor)}</td>
                        <td>{item.formaPagamento || "—"}</td>
                        <td>{item.statusPagamento || "—"}</td>
                        <td>{item.dataPagamento || "—"}</td>
                      </tr>
                    ))}

                    {pagamentosRecentes.length === 0 && (
                      <tr>
                        <td colSpan="6">Nenhum pagamento registrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="patients-cadastro-side" style={{ overflowY: "auto" }}>
            <div className="page-card patients-card patients-side-highlight">
              <h4 className="patients-section-title">Resumo do pagamento</h4>

              <div className="patients-summary-card-item">
                <span>Paciente</span>
                <strong>{pagamento.paciente || "—"}</strong>
              </div>

              <div className="patients-summary-card-item">
                <span>Serviço</span>
                <strong>{pagamento.tipoAtendimento || "—"}</strong>
              </div>

              <div className="patients-summary-card-item">
                <span>Valor</span>
                <strong>
                  {pagamento.valor
                    ? formatarMoeda(String(pagamento.valor).replace(",", "."))
                    : "—"}
                </strong>
              </div>

              <div className="patients-summary-card-item">
                <span>Forma</span>
                <strong>{pagamento.formaPagamento || "—"}</strong>
              </div>

              <div className="patients-summary-card-item">
                <span>Status</span>
                <strong>{pagamento.statusPagamento || "—"}</strong>
              </div>

              <div className="muted-box" style={{ marginTop: "12px" }}>
                Ao salvar, este registro será gravado na coleção pagamentos do
                Firebase e consumido automaticamente pelo Financeiro.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}