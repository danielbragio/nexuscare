import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";

export default function Financeiro() {
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [pagamentos, setPagamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "pagamentos"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }));

        setPagamentos(lista);
        setCarregando(false);
      },
      (error) => {
        console.error("Erro ao buscar pagamentos:", error);
        setCarregando(false);
      }
    );

    return () => unsubscribe();
  }, []);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function dataAtualFormatada() {
    return new Date().toISOString().split("T")[0];
  }

  async function marcarComoPago(pagamentoId) {
    try {
      await updateDoc(doc(db, "pagamentos", pagamentoId), {
        statusPagamento: "Pago",
        dataPagamento: dataAtualFormatada(),
        atualizadoEm: serverTimestamp(),
      });

      alert("Conta marcada como paga.");
    } catch (error) {
      console.error("Erro ao marcar como pago:", error);
      alert("Não foi possível atualizar o pagamento.");
    }
  }

  async function cancelarPagamento(pagamentoId) {
    const confirmar = window.confirm("Deseja cancelar este pagamento?");

    if (!confirmar) return;

    try {
      await updateDoc(doc(db, "pagamentos", pagamentoId), {
        statusPagamento: "Cancelado",
        atualizadoEm: serverTimestamp(),
      });

      alert("Pagamento cancelado.");
    } catch (error) {
      console.error("Erro ao cancelar pagamento:", error);
      alert("Não foi possível cancelar o pagamento.");
    }
  }

  const dadosFinanceiros = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const pagamentosDoMes = pagamentos.filter((item) => {
      if (!item.dataPagamento) return false;

      const data = new Date(`${item.dataPagamento}T00:00:00`);

      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    });

    const receitaMes = pagamentosDoMes
      .filter((item) => item.statusPagamento === "Pago")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const despesasMes = 0;

    const contasReceber = pagamentos
      .filter((item) => item.statusPagamento === "Pendente")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const contasPagas = pagamentos
      .filter((item) => item.statusPagamento === "Pago")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const contasPendentes = pagamentos.filter(
      (item) => item.statusPagamento === "Pendente"
    ).length;

    const contasCanceladas = pagamentos.filter(
      (item) => item.statusPagamento === "Cancelado"
    ).length;

    const cortesias = pagamentos.filter(
      (item) => item.statusPagamento === "Cortesia"
    ).length;

    const saldoPrevisto = receitaMes + contasReceber - despesasMes;

    return {
      receitaMes,
      despesasMes,
      saldoPrevisto,
      contasReceber,
      contasPagas,
      contasPendentes,
      contasCanceladas,
      cortesias,
      totalMovimentacoes: pagamentos.length,
    };
  }, [pagamentos]);

  const contasAReceber = pagamentos.filter(
    (item) => item.statusPagamento === "Pendente"
  );

  const contasPagas = pagamentos.filter(
    (item) => item.statusPagamento === "Pago"
  );

  const movimentacoes = pagamentos;

  return (
    <div className="financeiro-page">
      <div className="page-header">
        <h1>Financeiro</h1>
        <p className="page-subtitle">
          Controle financeiro integrado com os pagamentos registrados na recepção.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Receita do mês</div>
          <div className="stat-value">
            {formatarMoeda(dadosFinanceiros.receitaMes)}
          </div>
          <div className="stat-info">Pagamentos confirmados</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Despesas do mês</div>
          <div className="stat-value">
            {formatarMoeda(dadosFinanceiros.despesasMes)}
          </div>
          <div className="stat-info">Despesas cadastradas</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Saldo previsto</div>
          <div className="stat-value">
            {formatarMoeda(dadosFinanceiros.saldoPrevisto)}
          </div>
          <div className="stat-info">Recebido + pendente</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Contas a receber</div>
          <div className="stat-value">
            {formatarMoeda(dadosFinanceiros.contasReceber)}
          </div>
          <div className="stat-info">Pagamentos pendentes</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Contas pagas</div>
          <div className="stat-value">
            {formatarMoeda(dadosFinanceiros.contasPagas)}
          </div>
          <div className="stat-info">Total recebido</div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: "20px" }}>
        <div className="patients-tabs">
          <button
            className={`patients-tab ${abaAtiva === "resumo" ? "active" : ""}`}
            onClick={() => setAbaAtiva("resumo")}
          >
            Resumo
          </button>

          <button
            className={`patients-tab ${abaAtiva === "receber" ? "active" : ""}`}
            onClick={() => setAbaAtiva("receber")}
          >
            Contas a Receber
          </button>

          <button
            className={`patients-tab ${abaAtiva === "pagas" ? "active" : ""}`}
            onClick={() => setAbaAtiva("pagas")}
          >
            Contas Pagas
          </button>

          <button
            className={`patients-tab ${
              abaAtiva === "movimentacoes" ? "active" : ""
            }`}
            onClick={() => setAbaAtiva("movimentacoes")}
          >
            Movimentações
          </button>

          <button
            className={`patients-tab ${
              abaAtiva === "relatorios" ? "active" : ""
            }`}
            onClick={() => setAbaAtiva("relatorios")}
          >
            Relatórios
          </button>
        </div>

        {carregando ? (
          <div className="muted-box" style={{ marginTop: "20px" }}>
            Carregando dados financeiros...
          </div>
        ) : (
          <>
            {abaAtiva === "resumo" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Resumo Financeiro</h3>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Serviço</th>
                        <th>Valor</th>
                        <th>Forma</th>
                        <th>Status</th>
                        <th>Data</th>
                        <th>Origem</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pagamentos.slice(0, 10).map((item) => (
                        <tr key={item.id}>
                          <td>{item.paciente || "—"}</td>
                          <td>{item.tipoAtendimento || "—"}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                          <td>{item.formaPagamento || "—"}</td>
                          <td>{item.statusPagamento || "—"}</td>
                          <td>{item.dataPagamento || "—"}</td>
                          <td>{item.origem || "Recepção"}</td>
                        </tr>
                      ))}

                      {pagamentos.length === 0 && (
                        <tr>
                          <td colSpan="7">
                            Nenhum pagamento encontrado. Registre um pagamento em
                            Pacientes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === "receber" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Contas a Receber</h3>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th>Forma</th>
                        <th>Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {contasAReceber.map((item) => (
                        <tr key={item.id}>
                          <td>{item.paciente || "—"}</td>
                          <td>{item.tipoAtendimento || "—"}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                          <td>{item.dataPagamento || "—"}</td>
                          <td>{item.statusPagamento || "Pendente"}</td>
                          <td>{item.formaPagamento || "—"}</td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                className="secondary-btn"
                                onClick={() => marcarComoPago(item.id)}
                              >
                                Marcar como pago
                              </button>

                              <button
                                className="danger-btn"
                                onClick={() => cancelarPagamento(item.id)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {contasAReceber.length === 0 && (
                        <tr>
                          <td colSpan="7">
                            Nenhuma conta pendente encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === "pagas" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Contas Pagas</h3>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Serviço</th>
                        <th>Valor</th>
                        <th>Forma</th>
                        <th>Data</th>
                        <th>Origem</th>
                      </tr>
                    </thead>

                    <tbody>
                      {contasPagas.map((item) => (
                        <tr key={item.id}>
                          <td>{item.paciente || "—"}</td>
                          <td>{item.tipoAtendimento || "—"}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                          <td>{item.formaPagamento || "—"}</td>
                          <td>{item.dataPagamento || "—"}</td>
                          <td>{item.origem || "Recepção"}</td>
                        </tr>
                      ))}

                      {contasPagas.length === 0 && (
                        <tr>
                          <td colSpan="6">
                            Nenhuma conta paga encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === "movimentacoes" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Movimentações</h3>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Paciente</th>
                        <th>Descrição</th>
                        <th>Forma</th>
                        <th>Status</th>
                        <th>Valor</th>
                      </tr>
                    </thead>

                    <tbody>
                      {movimentacoes.map((item) => (
                        <tr key={item.id}>
                          <td>{item.dataPagamento || "—"}</td>
                          <td>{item.tipoMovimentacao || "Receita"}</td>
                          <td>{item.paciente || "—"}</td>
                          <td>{item.tipoAtendimento || "—"}</td>
                          <td>{item.formaPagamento || "—"}</td>
                          <td>{item.statusPagamento || "—"}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                        </tr>
                      ))}

                      {movimentacoes.length === 0 && (
                        <tr>
                          <td colSpan="7">
                            Nenhuma movimentação encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === "relatorios" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Relatório de Movimentações</h3>

                <div className="stats-grid" style={{ marginTop: "16px" }}>
                  <div className="stat-box">
                    <div className="stat-label">Recebido</div>
                    <div className="stat-value">
                      {formatarMoeda(dadosFinanceiros.contasPagas)}
                    </div>
                    <div className="stat-info">Pagamentos com status Pago</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">A receber</div>
                    <div className="stat-value">
                      {formatarMoeda(dadosFinanceiros.contasReceber)}
                    </div>
                    <div className="stat-info">Pagamentos pendentes</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Pendentes</div>
                    <div className="stat-value">
                      {dadosFinanceiros.contasPendentes}
                    </div>
                    <div className="stat-info">Quantidade pendente</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Cancelados</div>
                    <div className="stat-value">
                      {dadosFinanceiros.contasCanceladas}
                    </div>
                    <div className="stat-info">Pagamentos cancelados</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Cortesias</div>
                    <div className="stat-value">
                      {dadosFinanceiros.cortesias}
                    </div>
                    <div className="stat-info">Atendimentos sem cobrança</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Movimentações</div>
                    <div className="stat-value">
                      {dadosFinanceiros.totalMovimentacoes}
                    </div>
                    <div className="stat-info">Total de registros</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}