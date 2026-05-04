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

function normalizarTexto(valor) {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarStatus(status) {
  const texto = normalizarTexto(status);

  if (texto === "finalizado" || texto === "finalizada") return "finalizado";
  if (texto === "em atendimento" || texto === "em_atendimento") return "em_atendimento";
  if (texto === "agendada" || texto === "agendado") return "agendado";

  return texto || "agendado";
}

function normalizarStatusPagamento(status) {
  const texto = normalizarTexto(status);

  if (texto === "pago" || texto === "paga") return "pago";
  if (texto === "pendente") return "pendente";
  if (texto === "cancelado" || texto === "cancelada") return "cancelado";
  if (texto === "cortesia") return "cortesia";

  return texto;
}

function obterDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

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
      setPagamentos(
        snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  const atendimentosPagos = useMemo(() => {
    return pagamentos
      .filter((item) => normalizarStatusPagamento(item.statusPagamento) === "pago")
      .map((item) => item.atendimentoId)
      .filter(Boolean);
  }, [pagamentos]);

  const atendimentosDoDia = useMemo(() => {
    const hoje = obterDataHoje();

    return consultas
      .filter((item) => {
        const statusConsulta = normalizarStatus(item.status);
        const atendimentoAtivo =
          statusConsulta === "agendado" || statusConsulta === "em_atendimento";
        const atendimentoHoje = item.data === hoje || item.chegouHoje;
        const atendimentoImediato =
          normalizarTexto(item.tipoAtendimento).includes("imediato") ||
          normalizarTexto(item.tipoAtendimento).includes("pronto");
        const temPaciente = item.paciente || item.nomePaciente || item.cpf;
        const aindaNaoPago = !atendimentosPagos.includes(item.id);

        return (
          temPaciente &&
          aindaNaoPago &&
          statusConsulta !== "finalizado" &&
          (atendimentoHoje || atendimentoAtivo || atendimentoImediato)
        );
      })
      .sort(
        (a, b) =>
          (a.data || "").localeCompare(b.data || "") ||
          (a.hora || "").localeCompare(b.hora || "") ||
          (a.paciente || "").localeCompare(b.paciente || "")
      );
  }, [consultas, atendimentosPagos]);

  const pagamentosPagos = pagamentos.filter(
    (item) => normalizarStatusPagamento(item.statusPagamento) === "pago"
  );

  const pagamentosPendentes = pagamentos.filter(
    (item) => normalizarStatusPagamento(item.statusPagamento) === "pendente"
  );

  const totalRecebido = pagamentosPagos.reduce(
    (total, item) => total + Number(item.valor || 0),
    0
  );

  const pagamentosRecentes = pagamentos.slice(0, 8);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function badgePagamentoClasse(status) {
    const statusNormalizado = normalizarStatusPagamento(status);

    if (statusNormalizado === "pago") return "patients-badge patients-badge-blue";
    if (statusNormalizado === "pendente") return "patients-badge patients-badge-purple";
    if (statusNormalizado === "cancelado") return "patients-badge";
    if (statusNormalizado === "cortesia") return "patients-badge patients-badge-green";

    return "patients-badge";
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
      normalizarStatusPagamento(pagamento.statusPagamento) === "pago" &&
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

  return (
    <div className="patients-page" style={{ height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <h1>Pagamentos</h1>
        <p className="page-subtitle">
          Checkout do paciente integrado com o financeiro.
        </p>
      </div>

      <div
        className="patients-hero"
        style={{
          background:
            "linear-gradient(135deg, rgba(15,142,199,0.12), rgba(124,58,237,0.10))",
          border: "1px solid rgba(15,142,199,0.16)",
        }}
      >
        <div>
          <div className="patients-hero-kicker">Checkout financeiro</div>
          <h2 className="patients-hero-title">
            Controle de recebimentos por atendimento
          </h2>
          <p className="patients-hero-text">
            Selecione o atendimento enviado pela recepção, registre forma de pagamento,
            status e valor sem duplicidade.
          </p>
        </div>

        <div className="patients-hero-badges">
          <span className="patients-chip">Atendimentos: {atendimentosDoDia.length}</span>
          <span className="patients-chip">Recebido: {formatarMoeda(totalRecebido)}</span>
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
          <div className="stat-value">{pagamentosPagos.length}</div>
          <div className="stat-info">Recebimentos confirmados</div>
        </div>

        <div className="stat-box patients-stat patients-stat-purple">
          <div className="stat-label">Pendentes</div>
          <div className="stat-value">{pagamentosPendentes.length}</div>
          <div className="stat-info">Aguardando pagamento</div>
        </div>

        <div className="stat-box patients-stat patients-stat-cyan">
          <div className="stat-label">Total recebido</div>
          <div className="stat-value">{formatarMoeda(totalRecebido)}</div>
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
              Atendimento, valor e forma de pagamento em um único fluxo.
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
              <div className="patients-card-header" style={{ marginBottom: "14px" }}>
                <div>
                  <h4 className="patients-section-title">Dados do pagamento</h4>
                  <p className="patients-card-subtitle">
                    Selecione o atendimento antes de lançar o recebimento.
                  </p>
                </div>

                <span className={badgePagamentoClasse(pagamento.statusPagamento)}>
                  {pagamento.statusPagamento}
                </span>
              </div>

              <div className="patients-form-grid">
                <div className="patients-full-width">
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
                        {item.data || "Hoje"} {item.hora || ""} -{" "}
                        {item.tipoAtendimento || item.especialidade || "Atendimento"}
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
              <div className="patients-card-header" style={{ marginBottom: "12px" }}>
                <div>
                  <h4 className="patients-section-title">Pagamentos recentes</h4>
                  <p className="patients-card-subtitle">
                    Últimos recebimentos de todos os módulos.
                  </p>
                </div>
                <span className="patients-chip">{pagamentos.length} registros</span>
              </div>

              <div style={{ display: "grid", gap: "10px", maxHeight: "320px", overflowY: "auto", paddingRight: "4px" }}>
                {pagamentosRecentes.map((item) => {
                  const origemOdonto = item.tipo === "odonto" || item.origem === "odonto";
                  const statusNorm = normalizarStatusPagamento(item.statusPagamento || item.status || "");
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--bg-muted, #f8fafc)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "10px",
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px" }}>
                            {item.paciente || item.nomePaciente || "—"}
                          </span>
                          {origemOdonto && (
                            <span style={{ fontSize: "11px", background: "#f0fdf9", color: "#0f766e", border: "1px solid #99f6e4", borderRadius: "20px", padding: "1px 8px", fontWeight: 600 }}>
                              🦷 Odonto
                            </span>
                          )}
                          {!origemOdonto && (
                            <span style={{ fontSize: "11px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "20px", padding: "1px 8px", fontWeight: 600 }}>
                              🏥 Clínica
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                          {item.tipoAtendimento || item.descricao || item.servico || "Atendimento"}
                          {item.dataPagamento ? ` • ${item.dataPagamento}` : ""}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                          <span className={badgePagamentoClasse(item.statusPagamento || item.status)}>
                            {statusNorm === "pago" ? "✓ Pago" : statusNorm === "pendente" ? "⏳ Pendente" : statusNorm === "cortesia" ? "🎁 Cortesia" : item.statusPagamento || "—"}
                          </span>
                          {item.formaPagamento && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {item.formaPagamento}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: "15px", color: statusNorm === "pago" ? "#16a34a" : statusNorm === "cortesia" ? "#0891b2" : "var(--text)" }}>
                          {formatarMoeda(item.valor || item.valorFinal || 0)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {pagamentosRecentes.length === 0 && (
                  <div className="muted-box">Nenhum pagamento registrado.</div>
                )}
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

              <div style={{ marginTop: "12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "10px 12px", fontSize: "13px", color: "#15803d" }}>
                ✓ Ao salvar, atualiza automaticamente:<br />
                <strong>Financeiro · Dashboard · Relatórios</strong>
              </div>
            </div>

            <div className="page-card patients-card" style={{ marginTop: "14px" }}>
              <h4 className="patients-section-title">Fila para pagamento</h4>

              <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                {atendimentosDoDia.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    className="secondary-btn"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      justifyContent: "flex-start",
                      whiteSpace: "normal",
                    }}
                    onClick={() => selecionarAtendimentoPagamento(item.id)}
                  >
                    {(item.paciente || item.nomePaciente || "Paciente")} •{" "}
                    {item.hora || "sem horário"}
                  </button>
                ))}

                {atendimentosDoDia.length === 0 && (
                  <div className="muted-box">
                    Nenhum atendimento disponível para pagamento.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}