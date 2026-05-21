import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { hojeISO, normalizarFormaPagamento } from "../utils/dateUtils";

function normalizarTexto(valor) {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarStatusPagamento(status) {
  const texto = normalizarTexto(status);

  if (texto === "pago" || texto === "paga") return "pago";
  if (texto === "pendente") return "pendente";
  if (texto === "cancelado" || texto === "cancelada") return "cancelado";
  if (texto === "cortesia") return "cortesia";

  return texto;
}


export default function Pagamentos({ pacientes = [], consultas = [], pagamentos = [], pagamentoCheckout = null, onLimparCheckout, onIrParaFinanceiro, onIrParaRelatorios, onPagamentoCriado, carregando = false }) {
  const toast = useToast();

  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [pagamentoIdParaAtualizar, setPagamentoIdParaAtualizar] = useState(null);

  const [pagamento, setPagamento] = useState({
    pacienteId: "",
    paciente: "",
    cpf: "",
    telefone: "",
    atendimentoId: "",
    atendimentoOdontoId: "",
    agendamentoOdontoId: "",
    tipoAtendimento: "",
    valor: "",
    formaPagamento: "",
    statusPagamento: "",
    dataPagamento: hojeISO(),
    observacoes: "",
  });

  useEffect(() => {
    if (!pagamentoCheckout) return;
    setPagamento({
      pacienteId: pagamentoCheckout.pacienteId || "",
      paciente: pagamentoCheckout.paciente || "",
      cpf: pagamentoCheckout.cpf || "",
      telefone: pagamentoCheckout.telefone || "",
      atendimentoId: pagamentoCheckout.atendimentoId || "",
      atendimentoOdontoId: pagamentoCheckout.atendimentoOdontoId || "",
      agendamentoOdontoId: pagamentoCheckout.agendamentoOdontoId || "",
      tipoAtendimento: pagamentoCheckout.tipoAtendimento || "",
      valor: pagamentoCheckout.valor || "",
      formaPagamento: "",
      statusPagamento: "",
      dataPagamento: hojeISO(),
      observacoes: "",
    });
    setPagamentoIdParaAtualizar(pagamentoCheckout.pagamentoId || null);
  }, [pagamentoCheckout]);

  const atendimentosPagos = useMemo(() => {
    return pagamentos
      .filter((item) => {
        const s = normalizarStatusPagamento(item.statusPagamento);
        return s === "pago" || s === "cortesia";
      })
      .map((item) => String(item.atendimentoId || item.atendimento_id || ""))
      .filter(Boolean);
  }, [pagamentos]);

  const atendimentosDoDia = useMemo(() => {
    const hoje = hojeISO();

    const pagamentosClinicosPendentes = pagamentos
      .filter((p) => {
        const statusP = normalizarStatusPagamento(p.statusPagamento);
        const dataP = (p.dataPagamento || p.data || "").slice(0, 10);
        const ehClinico = !!(p.atendimentoId || p.atendimento_id) && !p.atendimento_odonto_id;
        const ehHojeOuAntes = dataP && dataP <= hoje;
        return statusP === "pendente" && ehClinico && ehHojeOuAntes;
      })
      .map((p) => {
        const atendimentoRef = p.atendimentoId || p.atendimento_id;
        const consulta = consultas.find((c) => String(c.id) === String(atendimentoRef));
        const dataP = (p.dataPagamento || p.data || "").slice(0, 10);
        return {
          id:              atendimentoRef || p.id,
          pacienteId:      p.pacienteId || p.paciente_id || consulta?.pacienteId || "",
          paciente:        p.paciente || p.nomePaciente || consulta?.paciente || "",
          nomePaciente:    p.paciente || p.nomePaciente || consulta?.paciente || "",
          data:            dataP,
          hora:            consulta?.hora || "",
          tipoAtendimento: p.descricao || consulta?.especialidade || "Consulta",
          cpf:             consulta?.cpf || "",
          telefone:        consulta?.telefone || "",
          _tipoFila:       "clinico_pendente",
          _pagamentoId:    p.id,
          _valor:          p.valorFinal || p.valor,
          _profissional:   p.profissional || consulta?.medico || "",
          _descricao:      p.descricao || consulta?.tipoAtendimento || "Consulta",
          _atrasado:       dataP < hoje,
        };
      });

    // Pagamentos Odonto pendentes (hoje ou atrasados — ainda não confirmados)
    const pagamentosOdontoPendentes = pagamentos
      .filter((p) => {
        const statusP = normalizarStatusPagamento(p.statusPagamento);
        const origem = (p.origem || p.tipo || "").toLowerCase();
        const dataP = (p.dataPagamento || p.data || "").slice(0, 10);
        const ehOdonto = origem === "odonto" || !!p.atendimento_odonto_id;
        const ehHojeOuAntes = dataP && dataP <= hoje;
        return statusP === "pendente" && ehOdonto && ehHojeOuAntes;
      })
      .map((p) => {
        const dataP = (p.dataPagamento || p.data || "").slice(0, 10);
        return {
          id:              p.atendimento_odonto_id || p.atendimentoId || p.id,
          paciente:        p.paciente || p.nomePaciente || "",
          nomePaciente:    p.paciente || p.nomePaciente || "",
          data:            dataP,
          hora:            "",
          tipoAtendimento: p.descricao || p.tipoAtendimento || "Odontologia",
          cpf:             "",
          telefone:        "",
          _tipoFila:       "odonto_pendente",
          _pagamentoId:    p.id,
          _valor:          p.valor,
          _profissional:   p.profissional || "",
          _descricao:      p.descricao || p.tipoAtendimento || "Odontologia",
          _atrasado:       dataP < hoje,
        };
      });

    return [...pagamentosClinicosPendentes, ...pagamentosOdontoPendentes]
      .sort(
        (a, b) =>
          (a.data || "").localeCompare(b.data || "") ||
          (a.hora || "").localeCompare(b.hora || "") ||
          (a.paciente || "").localeCompare(b.paciente || "")
      );
  }, [consultas, pagamentos]);

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
    // Verificar se é um item odonto pendente da fila
    const itemFila = atendimentosDoDia.find((item) => String(item.id) === String(atendimentoId));
    if (itemFila?._tipoFila === "odonto_pendente" || itemFila?._tipoFila === "clinico_pendente") {
      // Pagamento já existe — só precisamos atualizar forma/status
      setPagamentoIdParaAtualizar(itemFila._pagamentoId);
      setPagamento((prev) => ({
        ...prev,
        atendimentoId:   String(itemFila.id),
        pacienteId:      itemFila.pacienteId || "",
        paciente:        itemFila.paciente || "",
        cpf:             itemFila.cpf || "",
        telefone:        itemFila.telefone || "",
        tipoAtendimento: itemFila._descricao || itemFila.tipoAtendimento || "Atendimento",
        valor:           String(itemFila._valor || ""),
      }));
      return;
    }

    const atendimentoSelecionado = consultas.find((item) => item.id === atendimentoId);

    if (!atendimentoSelecionado) {
      setPagamentoIdParaAtualizar(null);
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
      formaPagamento: "",
      statusPagamento: "",
      dataPagamento: hojeISO(),
      observacoes: "",
    });
    setPagamentoIdParaAtualizar(null);
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
      toast.warn("Preencha paciente, serviço, valor, forma, status e data do pagamento.");
      return;
    }

    const temReferenciaAtendimento =
      pagamento.atendimentoId || pagamento.atendimentoOdontoId || pagamento.agendamentoOdontoId;

    if (!temReferenciaAtendimento) {
      toast.warn("Selecione um atendimento do dia para evitar duplicidade de pagamento.");
      return;
    }

    if (
      normalizarStatusPagamento(pagamento.statusPagamento) === "pago" &&
      pagamento.atendimentoId &&
      atendimentosPagos.includes(String(pagamento.atendimentoId))
    ) {
      toast.warn("Este atendimento já possui pagamento registrado como pago.");
      limparPagamento();
      return;
    }

    const valorNumerico = Number(String(pagamento.valor).replace(",", "."));

    if (Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.warn("Informe um valor válido para o pagamento.");
      return;
    }

    try {
      setSalvandoPagamento(true);

      const statusNorm = pagamento.statusPagamento.toLowerCase();
      const formaNorm = normalizarFormaPagamento(pagamento.formaPagamento);

      if (pagamentoIdParaAtualizar) {
        // Atualizar pagamento existente via API MySQL
        await api.pagamentos.atualizar(pagamentoIdParaAtualizar, {
          nome_paciente:    pagamento.paciente,
          descricao:        pagamento.tipoAtendimento,
          valor:            valorNumerico,
          valor_final:      valorNumerico,
          forma_pagamento:  formaNorm,
          status_pagamento: pagamento.statusPagamento,
          status:           statusNorm,
          data_pagamento:   pagamento.dataPagamento,
          observacoes:      pagamento.observacoes || "",
        });
      } else {
        // Criar novo pagamento via API MySQL
        // atendimento_id = médico; atendimento_odonto_id = odonto
        const atendimentoRef = pagamento.atendimentoId ? String(pagamento.atendimentoId) : null;
        const atendimentoOdontoRef = pagamento.atendimentoOdontoId ? String(pagamento.atendimentoOdontoId) : null;
        const agendamentoOdontoRef = pagamento.agendamentoOdontoId ? String(pagamento.agendamentoOdontoId) : null;
        await api.pagamentos.criar({
          paciente_id:      pagamento.pacienteId || null,
          nome_paciente:    pagamento.paciente,
          descricao:        pagamento.tipoAtendimento,
          servico:          pagamento.tipoAtendimento,
          valor:            valorNumerico,
          desconto:         0,
          valor_final:      valorNumerico,
          status:           statusNorm,
          status_pagamento: pagamento.statusPagamento,
          forma_pagamento:  formaNorm,
          tipo:             "Entrada",
          origem:           "Pagamentos",
          atendimento_id:   atendimentoOdontoRef || agendamentoOdontoRef ? null : atendimentoRef,
          atendimento_odonto_id: atendimentoOdontoRef,
          agendamento_odonto_id: agendamentoOdontoRef,
          data:             pagamento.dataPagamento,
          data_pagamento:   pagamento.dataPagamento,
          observacoes:      pagamento.observacoes || "",
        });
      }

      setPagamentoIdParaAtualizar(null);
      onLimparCheckout?.();
      limparPagamento();
      onPagamentoCriado?.();
      toast.success("Pagamento registrado com sucesso. Financeiro e Faturamento atualizados.");
    } catch (error) {
      console.error("Erro ao salvar pagamento:", error);
      toast.error("Não foi possível registrar o pagamento.");
    } finally {
      setSalvandoPagamento(false);
    }
  }

  if (carregando && pagamentos.length === 0) {
    return (
      <div className="patients-page" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>
          <div style={{ width: 36, height: 36, border: "3px solid rgba(148,163,184,0.3)", borderTopColor: "#0f8ec7", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p>Carregando pagamentos...</p>
        </div>
      </div>
    );
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

        <div className="patients-hero-badges" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span className="patients-chip">Atendimentos: {atendimentosDoDia.length}</span>
          <span className="patients-chip">Recebido: {formatarMoeda(totalRecebido)}</span>
          {pagamentosPendentes.length > 0 && (
            <span className="patients-chip" style={{ background: "rgba(245,158,11,0.15)", color: "#92400e", border: "1px solid rgba(245,158,11,0.3)" }}>
              {pagamentosPendentes.length} pendente{pagamentosPendentes.length !== 1 ? "s" : ""}
            </span>
          )}
          {onIrParaFinanceiro && (
            <button onClick={onIrParaFinanceiro} style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700,
              border: "1.5px solid rgba(15,118,110,0.5)", background: "rgba(15,118,110,0.1)",
              color: "#0f766e", cursor: "pointer",
            }}>
              Ver no Financeiro →
            </button>
          )}
          {onIrParaRelatorios && (
            <button onClick={onIrParaRelatorios} style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700,
              border: "1.5px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.08)",
              color: "#6366f1", cursor: "pointer",
            }}>
              Relatórios
            </button>
          )}
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

              {pagamentoCheckout && (
                <div
                  style={{
                    marginBottom: "14px",
                    padding: "12px 14px",
                    background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                    border: "1px solid #86efac",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    color: "#15803d",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      Checkout encaminhado pela recepção
                    </div>
                    <div style={{ color: "#16a34a", marginTop: "2px" }}>
                      {pagamentoCheckout.paciente} — {pagamentoCheckout.tipoAtendimento}
                      {pagamentoCheckout.profissional ? ` · ${pagamentoCheckout.profissional}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => { onLimparCheckout?.(); setPagamentoIdParaAtualizar(null); limparPagamento(); }}
                    style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "16px", padding: "2px 6px" }}
                    title="Limpar checkout"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="patients-form-grid">
                {!pagamentoCheckout && (
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
                )}

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
                    <option value="">Selecione a forma</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Convênio">Convênio</option>
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
                    <option value="">Selecione o status</option>
                    <option value="Pago">Pago</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="Cortesia">Cortesia</option>
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
                  disabled={
                    salvandoPagamento ||
                    !pagamento.valor ||
                    Number(String(pagamento.valor).replace(",", ".")) <= 0 ||
                    !pagamento.statusPagamento ||
                    !pagamento.formaPagamento
                  }
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
                          <span style={{ fontSize: "10px", color: "#cbd5e1", fontFamily: "monospace" }}>
                            #{item.id}
                            {item.atendimentoId ? ` · At.${item.atendimentoId}` : ""}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: "15px", color: statusNorm === "pago" ? "#16a34a" : statusNorm === "cortesia" ? "#0891b2" : "var(--text)" }}>
                          {formatarMoeda(item.valorFinal > 0 ? item.valorFinal : Math.max(Number(item.valor || 0) - Number(item.desconto || 0), 0))}
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
                {atendimentosDoDia.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    className="secondary-btn"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      justifyContent: "flex-start",
                      whiteSpace: "normal",
                      borderColor: item._atrasado ? "#fca5a5" : undefined,
                      background: item._atrasado ? "#fff5f5" : undefined,
                    }}
                    onClick={() => selecionarAtendimentoPagamento(item.id)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {item._atrasado && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: "#fee2e2", color: "#dc2626", flexShrink: 0,
                        }}>
                          Atrasado
                        </span>
                      )}
                      <span>
                        {(item.paciente || item.nomePaciente || "Paciente")}
                        {item.data ? ` • ${item.data}` : ""}
                        {item.hora ? ` ${item.hora}` : ""}
                      </span>
                    </span>
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
