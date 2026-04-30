import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "../services/firebase";

export default function Financeiro() {
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [pagamentos, setPagamentos] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [anexosFinanceiros, setAnexosFinanceiros] = useState([]);
  const [historicoFinanceiro, setHistoricoFinanceiro] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [salvandoAnexo, setSalvandoAnexo] = useState(false);

  const [filtros, setFiltros] = useState({
    fornecedor: "",
    status: "",
    vencimento: "",
    periodoInicio: "",
    periodoFim: "",
    nf: "",
    paciente: "",
    formaPagamento: "",
    categoria: "",
  });

  const [novaConta, setNovaConta] = useState({
    fornecedor: "",
    cnpjFornecedor: "",
    dataEmissao: "",
    numeroNotaFiscal: "",
    tipoDocumento: "Nota Fiscal",
    mesCompetencia: "",
    anoCompetencia: "",
    dataVencimento: "",
    previsaoPagamento: "",
    dataPagamento: "",
    tipoPagamento: "Boleto",
    codigoBarrasBoleto: "",
    valorBruto: "",
    valorImpostosRetidos: "",
    valorLiquidoPagar: "",
    valorDesconto: "",
    valorJuros: "",
    valorMulta: "",
    valorPago: "",
    valorPendente: "",
    status: "Pendente",
    categoria: "",
    observacoes: "",
    usuarioInclusao: "",
  });

  const [novoAnexo, setNovoAnexo] = useState({
    tipoDocumento: "Nota Fiscal",
    descricao: "",
    arquivo: null,
  });

  const [novoImposto, setNovoImposto] = useState({
    tipoImposto: "",
    baseCalculo: "",
    aliquota: "",
    valorRetido: "",
    observacao: "",
  });

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

  useEffect(() => {
    const q = query(collection(db, "contasPagar"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setContasPagar(lista);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "anexosFinanceiros"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setAnexosFinanceiros(lista);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "historicoFinanceiro"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setHistoricoFinanceiro(lista);
    });

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

  function numero(valor) {
    return Number(String(valor || 0).replace(",", "."));
  }

  function alterarConta(campo, valor) {
    setNovaConta((prev) => {
      const atualizado = {
        ...prev,
        [campo]: valor,
      };

      const bruto =
        campo === "valorBruto" ? numero(valor) : numero(atualizado.valorBruto);
      const impostos =
        campo === "valorImpostosRetidos"
          ? numero(valor)
          : numero(atualizado.valorImpostosRetidos);
      const desconto =
        campo === "valorDesconto" ? numero(valor) : numero(atualizado.valorDesconto);
      const juros =
        campo === "valorJuros" ? numero(valor) : numero(atualizado.valorJuros);
      const multa =
        campo === "valorMulta" ? numero(valor) : numero(atualizado.valorMulta);
      const pago =
        campo === "valorPago" ? numero(valor) : numero(atualizado.valorPago);

      const liquido = bruto - impostos - desconto + juros + multa;
      const pendente = Math.max(liquido - pago, 0);

      return {
        ...atualizado,
        valorLiquidoPagar: liquido ? String(liquido.toFixed(2)) : "",
        valorPendente: pendente ? String(pendente.toFixed(2)) : "",
      };
    });
  }

  function limparConta() {
    setContaSelecionada(null);
    setModoEdicao(false);
    setNovaConta({
      fornecedor: "",
      cnpjFornecedor: "",
      dataEmissao: "",
      numeroNotaFiscal: "",
      tipoDocumento: "Nota Fiscal",
      mesCompetencia: "",
      anoCompetencia: "",
      dataVencimento: "",
      previsaoPagamento: "",
      dataPagamento: "",
      tipoPagamento: "Boleto",
      codigoBarrasBoleto: "",
      valorBruto: "",
      valorImpostosRetidos: "",
      valorLiquidoPagar: "",
      valorDesconto: "",
      valorJuros: "",
      valorMulta: "",
      valorPago: "",
      valorPendente: "",
      status: "Pendente",
      categoria: "",
      observacoes: "",
      usuarioInclusao: "",
    });
    setNovoAnexo({
      tipoDocumento: "Nota Fiscal",
      descricao: "",
      arquivo: null,
    });
    setNovoImposto({
      tipoImposto: "",
      baseCalculo: "",
      aliquota: "",
      valorRetido: "",
      observacao: "",
    });
  }

  async function registrarHistorico({
    contaId,
    alteracao,
    statusAnterior = "",
    novoStatus = "",
  }) {
    await addDoc(collection(db, "historicoFinanceiro"), {
      contaId,
      criadoPor: novaConta.usuarioInclusao || "Usuário do sistema",
      editadoPor: novaConta.usuarioInclusao || "Usuário do sistema",
      alteracao,
      statusAnterior,
      novoStatus,
      criadoEm: serverTimestamp(),
    });
  }

  async function salvarContaPagar() {
    if (
      !novaConta.fornecedor ||
      !novaConta.numeroNotaFiscal ||
      !novaConta.valorBruto ||
      !novaConta.dataVencimento
    ) {
      alert("Preencha fornecedor, número da NF, valor bruto e vencimento.");
      return;
    }

    try {
      setSalvandoConta(true);

      const payload = {
        ...novaConta,
        valorBruto: numero(novaConta.valorBruto),
        valorImpostosRetidos: numero(novaConta.valorImpostosRetidos),
        valorLiquidoPagar: numero(novaConta.valorLiquidoPagar),
        valorDesconto: numero(novaConta.valorDesconto),
        valorJuros: numero(novaConta.valorJuros),
        valorMulta: numero(novaConta.valorMulta),
        valorPago: numero(novaConta.valorPago),
        valorPendente: numero(novaConta.valorPendente),
        atualizadoEm: serverTimestamp(),
      };

      if (modoEdicao && contaSelecionada?.id) {
        const statusAnterior = contaSelecionada.status || "";
        await updateDoc(doc(db, "contasPagar", contaSelecionada.id), payload);

        await registrarHistorico({
          contaId: contaSelecionada.id,
          alteracao: "Conta a pagar editada",
          statusAnterior,
          novoStatus: novaConta.status,
        });

        alert("Conta atualizada com sucesso.");
      } else {
        const docRef = await addDoc(collection(db, "contasPagar"), {
          ...payload,
          criadoEm: serverTimestamp(),
        });

        await registrarHistorico({
          contaId: docRef.id,
          alteracao: "Conta a pagar criada",
          statusAnterior: "",
          novoStatus: novaConta.status,
        });

        alert("Conta cadastrada com sucesso.");
      }

      limparConta();
    } catch (error) {
      console.error("Erro ao salvar conta a pagar:", error);
      alert("Não foi possível salvar a conta.");
    } finally {
      setSalvandoConta(false);
    }
  }

  function editarConta(conta) {
    setContaSelecionada(conta);
    setModoEdicao(true);
    setNovaConta({
      fornecedor: conta.fornecedor || "",
      cnpjFornecedor: conta.cnpjFornecedor || "",
      dataEmissao: conta.dataEmissao || "",
      numeroNotaFiscal: conta.numeroNotaFiscal || "",
      tipoDocumento: conta.tipoDocumento || "Nota Fiscal",
      mesCompetencia: conta.mesCompetencia || "",
      anoCompetencia: conta.anoCompetencia || "",
      dataVencimento: conta.dataVencimento || "",
      previsaoPagamento: conta.previsaoPagamento || "",
      dataPagamento: conta.dataPagamento || "",
      tipoPagamento: conta.tipoPagamento || "Boleto",
      codigoBarrasBoleto: conta.codigoBarrasBoleto || "",
      valorBruto: conta.valorBruto || "",
      valorImpostosRetidos: conta.valorImpostosRetidos || "",
      valorLiquidoPagar: conta.valorLiquidoPagar || "",
      valorDesconto: conta.valorDesconto || "",
      valorJuros: conta.valorJuros || "",
      valorMulta: conta.valorMulta || "",
      valorPago: conta.valorPago || "",
      valorPendente: conta.valorPendente || "",
      status: conta.status || "Pendente",
      categoria: conta.categoria || "",
      observacoes: conta.observacoes || "",
      usuarioInclusao: conta.usuarioInclusao || "",
    });
    setAbaAtiva("pagar");
  }

  async function excluirConta(conta) {
    const confirmar = window.confirm(
      `Deseja excluir a conta da NF ${conta.numeroNotaFiscal}?`
    );

    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "contasPagar", conta.id));

      await registrarHistorico({
        contaId: conta.id,
        alteracao: "Conta a pagar excluída",
        statusAnterior: conta.status || "",
        novoStatus: "Excluída",
      });

      if (contaSelecionada?.id === conta.id) limparConta();

      alert("Conta excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      alert("Não foi possível excluir a conta.");
    }
  }

  async function marcarContaComoPaga(conta) {
    try {
      await updateDoc(doc(db, "contasPagar", conta.id), {
        status: "Pago",
        dataPagamento: dataAtualFormatada(),
        valorPago: Number(conta.valorLiquidoPagar || conta.valorBruto || 0),
        valorPendente: 0,
        atualizadoEm: serverTimestamp(),
      });

      await registrarHistorico({
        contaId: conta.id,
        alteracao: "Conta marcada como paga",
        statusAnterior: conta.status || "",
        novoStatus: "Pago",
      });

      alert("Conta marcada como paga.");
    } catch (error) {
      console.error("Erro ao marcar conta como paga:", error);
      alert("Não foi possível marcar como paga.");
    }
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

  async function adicionarImposto() {
    if (!contaSelecionada?.id) {
      alert("Selecione ou salve uma conta antes de adicionar impostos.");
      return;
    }

    if (!novoImposto.tipoImposto || !novoImposto.valorRetido) {
      alert("Informe o tipo de imposto e o valor retido.");
      return;
    }

    const impostosAtuais = Array.isArray(contaSelecionada.impostos)
      ? contaSelecionada.impostos
      : [];

    const imposto = {
      id: Date.now().toString(),
      tipoImposto: novoImposto.tipoImposto,
      baseCalculo: numero(novoImposto.baseCalculo),
      aliquota: numero(novoImposto.aliquota),
      valorRetido: numero(novoImposto.valorRetido),
      observacao: novoImposto.observacao || "",
    };

    try {
      await updateDoc(doc(db, "contasPagar", contaSelecionada.id), {
        impostos: [...impostosAtuais, imposto],
        atualizadoEm: serverTimestamp(),
      });

      await registrarHistorico({
        contaId: contaSelecionada.id,
        alteracao: `Imposto ${novoImposto.tipoImposto} adicionado`,
        statusAnterior: contaSelecionada.status || "",
        novoStatus: contaSelecionada.status || "",
      });

      setNovoImposto({
        tipoImposto: "",
        baseCalculo: "",
        aliquota: "",
        valorRetido: "",
        observacao: "",
      });

      alert("Imposto adicionado.");
    } catch (error) {
      console.error("Erro ao adicionar imposto:", error);
      alert("Não foi possível adicionar o imposto.");
    }
  }

  async function enviarAnexo() {
    if (!contaSelecionada?.id) {
      alert("Selecione ou salve uma conta antes de adicionar anexos.");
      return;
    }

    if (!novoAnexo.arquivo) {
      alert("Selecione um arquivo para anexar.");
      return;
    }

    try {
      setSalvandoAnexo(true);

      const caminho = `financeiro/contasPagar/${contaSelecionada.id}/${Date.now()}-${
        novoAnexo.arquivo.name
      }`;

      const storageRef = ref(storage, caminho);
      await uploadBytes(storageRef, novoAnexo.arquivo);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "anexosFinanceiros"), {
        contaId: contaSelecionada.id,
        tipoDocumento: novoAnexo.tipoDocumento,
        descricao: novoAnexo.descricao || "",
        nomeArquivo: novoAnexo.arquivo.name,
        caminhoStorage: caminho,
        url,
        criadoEm: serverTimestamp(),
      });

      await registrarHistorico({
        contaId: contaSelecionada.id,
        alteracao: `Anexo incluído: ${novoAnexo.arquivo.name}`,
        statusAnterior: contaSelecionada.status || "",
        novoStatus: contaSelecionada.status || "",
      });

      setNovoAnexo({
        tipoDocumento: "Nota Fiscal",
        descricao: "",
        arquivo: null,
      });

      alert("Anexo enviado com sucesso.");
    } catch (error) {
      console.error("Erro ao enviar anexo:", error);
      alert("Não foi possível enviar o anexo.");
    } finally {
      setSalvandoAnexo(false);
    }
  }

  async function excluirAnexo(anexo) {
    const confirmar = window.confirm("Deseja excluir este anexo?");
    if (!confirmar) return;

    try {
      if (anexo.caminhoStorage) {
        await deleteObject(ref(storage, anexo.caminhoStorage));
      }

      await deleteDoc(doc(db, "anexosFinanceiros", anexo.id));

      await registrarHistorico({
        contaId: anexo.contaId,
        alteracao: `Anexo excluído: ${anexo.nomeArquivo}`,
        statusAnterior: contaSelecionada?.status || "",
        novoStatus: contaSelecionada?.status || "",
      });

      alert("Anexo excluído.");
    } catch (error) {
      console.error("Erro ao excluir anexo:", error);
      alert("Não foi possível excluir o anexo.");
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

    const contasPagarMes = contasPagar.filter((item) => {
      const dataBase = item.dataPagamento || item.dataVencimento;
      if (!dataBase) return false;
      const data = new Date(`${dataBase}T00:00:00`);
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    });

    const receitaMes = pagamentosDoMes
      .filter((item) => item.statusPagamento === "Pago")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const despesasMes = contasPagarMes
      .filter((item) => item.status === "Pago")
      .reduce(
        (total, item) =>
          total + Number(item.valorPago || item.valorLiquidoPagar || item.valorBruto || 0),
        0
      );

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

    const contasPagarPendentes = contasPagar.filter(
      (item) => item.status === "Pendente"
    ).length;

    const contasPagarPagas = contasPagar.filter((item) => item.status === "Pago").length;

    const contasVencidas = contasPagar.filter((item) => {
      if (!item.dataVencimento || item.status === "Pago" || item.status === "Cancelado") {
        return false;
      }

      return new Date(`${item.dataVencimento}T00:00:00`) < new Date(dataAtualFormatada());
    }).length;

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
      contasPagarPendentes,
      contasPagarPagas,
      contasVencidas,
      totalMovimentacoes: pagamentos.length + contasPagar.length,
    };
  }, [pagamentos, contasPagar]);

  const contasAReceber = pagamentos.filter(
    (item) => item.statusPagamento === "Pendente"
  );

  const contasPagas = pagamentos.filter((item) => item.statusPagamento === "Pago");

  const contasPagarFiltradas = useMemo(() => {
    return contasPagar.filter((item) => {
      const fornecedorOk = (item.fornecedor || "")
        .toLowerCase()
        .includes(filtros.fornecedor.toLowerCase());

      const statusOk = filtros.status ? item.status === filtros.status : true;

      const nfOk = (item.numeroNotaFiscal || "")
        .toLowerCase()
        .includes(filtros.nf.toLowerCase());

      const vencimentoOk = filtros.vencimento
        ? item.dataVencimento === filtros.vencimento
        : true;

      const periodoInicioOk = filtros.periodoInicio
        ? item.dataVencimento >= filtros.periodoInicio
        : true;

      const periodoFimOk = filtros.periodoFim
        ? item.dataVencimento <= filtros.periodoFim
        : true;

      return (
        fornecedorOk &&
        statusOk &&
        nfOk &&
        vencimentoOk &&
        periodoInicioOk &&
        periodoFimOk
      );
    });
  }, [contasPagar, filtros]);

  const anexosDaConta = anexosFinanceiros.filter(
    (item) => item.contaId === contaSelecionada?.id
  );

  const historicoDaConta = historicoFinanceiro.filter(
    (item) => item.contaId === contaSelecionada?.id
  );

  const movimentacoes = useMemo(() => {
    const entradas = pagamentos.map((item) => ({
      id: `pagamento-${item.id}`,
      data: item.dataPagamento,
      tipo: "Entrada",
      origem: item.origem || "Recepção",
      descricao: item.tipoAtendimento || "Pagamento de paciente",
      pessoa: item.paciente || "—",
      forma: item.formaPagamento || "—",
      status: item.statusPagamento || "—",
      categoria: "Receita",
      valor: Number(item.valor || 0),
    }));

    const saidas = contasPagar.map((item) => ({
      id: `conta-${item.id}`,
      data: item.dataPagamento || item.dataVencimento,
      tipo: "Saída",
      origem: "Conta a pagar",
      descricao: item.numeroNotaFiscal
        ? `NF ${item.numeroNotaFiscal}`
        : item.tipoDocumento || "Conta a pagar",
      pessoa: item.fornecedor || "—",
      forma: item.tipoPagamento || "—",
      status: item.status || "—",
      categoria: item.categoria || "Despesa",
      valor: Number(item.valorPago || item.valorLiquidoPagar || item.valorBruto || 0),
    }));

    return [...entradas, ...saidas].sort((a, b) =>
      String(b.data || "").localeCompare(String(a.data || ""))
    );
  }, [pagamentos, contasPagar]);

  const resumoPorFormaPagamento = useMemo(() => {
    const mapa = {};

    pagamentos.forEach((item) => {
      const forma = item.formaPagamento || "Não informado";
      mapa[forma] = (mapa[forma] || 0) + Number(item.valor || 0);
    });

    return Object.entries(mapa).map(([forma, valor]) => ({ forma, valor }));
  }, [pagamentos]);

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
          <div className="stat-info">Contas pagas</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Saldo previsto</div>
          <div className="stat-value">
            {formatarMoeda(dadosFinanceiros.saldoPrevisto)}
          </div>
          <div className="stat-info">Recebido + pendente - despesas</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Contas vencidas</div>
          <div className="stat-value">{dadosFinanceiros.contasVencidas}</div>
          <div className="stat-info">Contas a pagar vencidas</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Contas pendentes</div>
          <div className="stat-value">
            {dadosFinanceiros.contasPendentes + dadosFinanceiros.contasPagarPendentes}
          </div>
          <div className="stat-info">Receber + pagar</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Contas pagas</div>
          <div className="stat-value">
            {dadosFinanceiros.contasPagas + dadosFinanceiros.contasPagarPagas}
          </div>
          <div className="stat-info">Recebidas e pagas</div>
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
            className={`patients-tab ${abaAtiva === "pagar" ? "active" : ""}`}
            onClick={() => setAbaAtiva("pagar")}
          >
            Contas a Pagar
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
                <h3>Dashboard Financeiro</h3>

                <div className="stats-grid" style={{ marginTop: "16px" }}>
                  <div className="stat-box">
                    <div className="stat-label">Receitas</div>
                    <div className="stat-value">
                      {formatarMoeda(dadosFinanceiros.receitaMes)}
                    </div>
                    <div className="stat-info">Mês atual</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Despesas</div>
                    <div className="stat-value">
                      {formatarMoeda(dadosFinanceiros.despesasMes)}
                    </div>
                    <div className="stat-info">Mês atual</div>
                  </div>
                </div>

                <h3 style={{ marginTop: "20px" }}>Últimas movimentações</h3>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Origem</th>
                        <th>Descrição</th>
                        <th>Status</th>
                        <th>Valor</th>
                      </tr>
                    </thead>

                    <tbody>
                      {movimentacoes.slice(0, 10).map((item) => (
                        <tr key={item.id}>
                          <td>{item.data || "—"}</td>
                          <td>{item.tipo}</td>
                          <td>{item.origem}</td>
                          <td>{item.descricao}</td>
                          <td>{item.status}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                        </tr>
                      ))}

                      {movimentacoes.length === 0 && (
                        <tr>
                          <td colSpan="6">Nenhuma movimentação encontrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === "pagar" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Contas a Pagar</h3>

                <div className="patients-form-grid" style={{ marginTop: "16px" }}>
                  <div>
                    <label>Fornecedor</label>
                    <input
                      className="input"
                      value={novaConta.fornecedor}
                      onChange={(e) => alterarConta("fornecedor", e.target.value)}
                      placeholder="Nome do fornecedor"
                    />
                  </div>

                  <div>
                    <label>CNPJ do fornecedor</label>
                    <input
                      className="input"
                      value={novaConta.cnpjFornecedor}
                      onChange={(e) => alterarConta("cnpjFornecedor", e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div>
                    <label>Data de emissão</label>
                    <input
                      className="input"
                      type="date"
                      value={novaConta.dataEmissao}
                      onChange={(e) => alterarConta("dataEmissao", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Número da nota fiscal</label>
                    <input
                      className="input"
                      value={novaConta.numeroNotaFiscal}
                      onChange={(e) =>
                        alterarConta("numeroNotaFiscal", e.target.value)
                      }
                      placeholder="NF"
                    />
                  </div>

                  <div>
                    <label>Tipo de documento</label>
                    <select
                      className="select"
                      value={novaConta.tipoDocumento}
                      onChange={(e) => alterarConta("tipoDocumento", e.target.value)}
                    >
                      <option>Nota Fiscal</option>
                      <option>Boleto</option>
                      <option>Recibo</option>
                      <option>Contrato</option>
                      <option>Fatura</option>
                    </select>
                  </div>

                  <div>
                    <label>Mês de competência</label>
                    <input
                      className="input"
                      value={novaConta.mesCompetencia}
                      onChange={(e) =>
                        alterarConta("mesCompetencia", e.target.value)
                      }
                      placeholder="Ex.: Janeiro"
                    />
                  </div>

                  <div>
                    <label>Ano de competência</label>
                    <input
                      className="input"
                      value={novaConta.anoCompetencia}
                      onChange={(e) =>
                        alterarConta("anoCompetencia", e.target.value)
                      }
                      placeholder="2026"
                    />
                  </div>

                  <div>
                    <label>Data de vencimento</label>
                    <input
                      className="input"
                      type="date"
                      value={novaConta.dataVencimento}
                      onChange={(e) => alterarConta("dataVencimento", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Previsão de pagamento</label>
                    <input
                      className="input"
                      type="date"
                      value={novaConta.previsaoPagamento}
                      onChange={(e) =>
                        alterarConta("previsaoPagamento", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label>Data de pagamento</label>
                    <input
                      className="input"
                      type="date"
                      value={novaConta.dataPagamento}
                      onChange={(e) => alterarConta("dataPagamento", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Tipo de pagamento</label>
                    <select
                      className="select"
                      value={novaConta.tipoPagamento}
                      onChange={(e) => alterarConta("tipoPagamento", e.target.value)}
                    >
                      <option>Boleto</option>
                      <option>Pix</option>
                      <option>Transferência</option>
                      <option>Cartão</option>
                      <option>Dinheiro</option>
                    </select>
                  </div>

                  <div>
                    <label>Código de barras do boleto</label>
                    <input
                      className="input"
                      value={novaConta.codigoBarrasBoleto}
                      onChange={(e) =>
                        alterarConta("codigoBarrasBoleto", e.target.value)
                      }
                      placeholder="Linha digitável"
                    />
                  </div>

                  <div>
                    <label>Valor bruto</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorBruto}
                      onChange={(e) => alterarConta("valorBruto", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Valor de impostos retidos</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorImpostosRetidos}
                      onChange={(e) =>
                        alterarConta("valorImpostosRetidos", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label>Valor líquido a pagar</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorLiquidoPagar}
                      onChange={(e) =>
                        alterarConta("valorLiquidoPagar", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label>Valor de desconto</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorDesconto}
                      onChange={(e) => alterarConta("valorDesconto", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Valor de juros</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorJuros}
                      onChange={(e) => alterarConta("valorJuros", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Valor de multa</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorMulta}
                      onChange={(e) => alterarConta("valorMulta", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Valor pago</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorPago}
                      onChange={(e) => alterarConta("valorPago", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Valor pendente</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={novaConta.valorPendente}
                      onChange={(e) => alterarConta("valorPendente", e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Status</label>
                    <select
                      className="select"
                      value={novaConta.status}
                      onChange={(e) => alterarConta("status", e.target.value)}
                    >
                      <option>Pendente</option>
                      <option>Pago</option>
                      <option>Vencido</option>
                      <option>Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <label>Categoria</label>
                    <input
                      className="input"
                      value={novaConta.categoria}
                      onChange={(e) => alterarConta("categoria", e.target.value)}
                      placeholder="Medicamentos, manutenção, serviços..."
                    />
                  </div>

                  <div>
                    <label>Usuário de inclusão</label>
                    <input
                      className="input"
                      value={novaConta.usuarioInclusao}
                      onChange={(e) =>
                        alterarConta("usuarioInclusao", e.target.value)
                      }
                      placeholder="Nome do usuário"
                    />
                  </div>

                  <div>
                    <label>Observações</label>
                    <textarea
                      className="textarea"
                      value={novaConta.observacoes}
                      onChange={(e) => alterarConta("observacoes", e.target.value)}
                      placeholder="Observações da conta"
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px" }}>
                  <button
                    className="primary-btn"
                    onClick={salvarContaPagar}
                    disabled={salvandoConta}
                  >
                    {salvandoConta
                      ? "Salvando..."
                      : modoEdicao
                      ? "Salvar alterações"
                      : "Adicionar nova conta"}
                  </button>

                  <button className="secondary-btn" onClick={limparConta}>
                    Limpar
                  </button>
                </div>

                {contaSelecionada?.id && (
                  <>
                    <h3 style={{ marginTop: "24px" }}>Anexos da Conta a Pagar</h3>

                    <div className="patients-form-grid" style={{ marginTop: "16px" }}>
                      <div>
                        <label>Tipo de documento</label>
                        <select
                          className="select"
                          value={novoAnexo.tipoDocumento}
                          onChange={(e) =>
                            setNovoAnexo({
                              ...novoAnexo,
                              tipoDocumento: e.target.value,
                            })
                          }
                        >
                          <option>Nota Fiscal</option>
                          <option>Boleto</option>
                          <option>Comprovante</option>
                          <option>Contrato</option>
                          <option>Outros</option>
                        </select>
                      </div>

                      <div>
                        <label>Descrição</label>
                        <input
                          className="input"
                          value={novoAnexo.descricao}
                          onChange={(e) =>
                            setNovoAnexo({
                              ...novoAnexo,
                              descricao: e.target.value,
                            })
                          }
                          placeholder="Descrição do anexo"
                        />
                      </div>

                      <div>
                        <label>Upload de arquivo</label>
                        <input
                          className="input"
                          type="file"
                          onChange={(e) =>
                            setNovoAnexo({
                              ...novoAnexo,
                              arquivo: e.target.files?.[0] || null,
                            })
                          }
                        />
                      </div>
                    </div>

                    <button
                      className="primary-btn"
                      style={{ marginTop: "10px" }}
                      onClick={enviarAnexo}
                      disabled={salvandoAnexo}
                    >
                      {salvandoAnexo ? "Enviando..." : "Adicionar anexo"}
                    </button>

                    <div className="table-wrapper" style={{ marginTop: "16px" }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Tipo</th>
                            <th>Descrição</th>
                            <th>Arquivo</th>
                            <th>Ações</th>
                          </tr>
                        </thead>

                        <tbody>
                          {anexosDaConta.map((item) => (
                            <tr key={item.id}>
                              <td>{item.tipoDocumento}</td>
                              <td>{item.descricao || "—"}</td>
                              <td>{item.nomeArquivo}</td>
                              <td>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <a
                                    className="secondary-btn"
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Visualizar
                                  </a>

                                  <a
                                    className="secondary-btn"
                                    href={item.url}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Baixar
                                  </a>

                                  <button
                                    className="danger-btn"
                                    onClick={() => excluirAnexo(item)}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {anexosDaConta.length === 0 && (
                            <tr>
                              <td colSpan="4">Nenhum anexo vinculado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h3 style={{ marginTop: "24px" }}>Impostos</h3>

                    <div className="patients-form-grid" style={{ marginTop: "16px" }}>
                      <div>
                        <label>Tipo de imposto</label>
                        <input
                          className="input"
                          value={novoImposto.tipoImposto}
                          onChange={(e) =>
                            setNovoImposto({
                              ...novoImposto,
                              tipoImposto: e.target.value,
                            })
                          }
                          placeholder="ISS, INSS, IRRF, PIS..."
                        />
                      </div>

                      <div>
                        <label>Base de cálculo</label>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          value={novoImposto.baseCalculo}
                          onChange={(e) =>
                            setNovoImposto({
                              ...novoImposto,
                              baseCalculo: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>Alíquota</label>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          value={novoImposto.aliquota}
                          onChange={(e) =>
                            setNovoImposto({
                              ...novoImposto,
                              aliquota: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>Valor retido</label>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          value={novoImposto.valorRetido}
                          onChange={(e) =>
                            setNovoImposto({
                              ...novoImposto,
                              valorRetido: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>Observação</label>
                        <input
                          className="input"
                          value={novoImposto.observacao}
                          onChange={(e) =>
                            setNovoImposto({
                              ...novoImposto,
                              observacao: e.target.value,
                            })
                          }
                          placeholder="Observação"
                        />
                      </div>
                    </div>

                    <button
                      className="primary-btn"
                      style={{ marginTop: "10px" }}
                      onClick={adicionarImposto}
                    >
                      Adicionar imposto
                    </button>

                    <div className="table-wrapper" style={{ marginTop: "16px" }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Imposto</th>
                            <th>Base</th>
                            <th>Alíquota</th>
                            <th>Valor retido</th>
                            <th>Observação</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(contaSelecionada.impostos || []).map((item) => (
                            <tr key={item.id}>
                              <td>{item.tipoImposto}</td>
                              <td>{formatarMoeda(item.baseCalculo)}</td>
                              <td>{item.aliquota}%</td>
                              <td>{formatarMoeda(item.valorRetido)}</td>
                              <td>{item.observacao || "—"}</td>
                            </tr>
                          ))}

                          {(!contaSelecionada.impostos ||
                            contaSelecionada.impostos.length === 0) && (
                            <tr>
                              <td colSpan="5">Nenhum imposto lançado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h3 style={{ marginTop: "24px" }}>Etapas / Histórico</h3>

                    <div className="table-wrapper" style={{ marginTop: "16px" }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Alteração</th>
                            <th>Status anterior</th>
                            <th>Novo status</th>
                            <th>Usuário</th>
                          </tr>
                        </thead>

                        <tbody>
                          {historicoDaConta.map((item) => (
                            <tr key={item.id}>
                              <td>{item.alteracao}</td>
                              <td>{item.statusAnterior || "—"}</td>
                              <td>{item.novoStatus || "—"}</td>
                              <td>{item.editadoPor || item.criadoPor || "—"}</td>
                            </tr>
                          ))}

                          {historicoDaConta.length === 0 && (
                            <tr>
                              <td colSpan="4">Nenhum histórico registrado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <h3 style={{ marginTop: "24px" }}>Filtros</h3>

                <div className="patients-form-grid" style={{ marginTop: "16px" }}>
                  <input
                    className="input"
                    placeholder="Filtrar por fornecedor"
                    value={filtros.fornecedor}
                    onChange={(e) =>
                      setFiltros({ ...filtros, fornecedor: e.target.value })
                    }
                  />

                  <select
                    className="select"
                    value={filtros.status}
                    onChange={(e) =>
                      setFiltros({ ...filtros, status: e.target.value })
                    }
                  >
                    <option value="">Todos os status</option>
                    <option>Pendente</option>
                    <option>Pago</option>
                    <option>Vencido</option>
                    <option>Cancelado</option>
                  </select>

                  <input
                    className="input"
                    type="date"
                    value={filtros.vencimento}
                    onChange={(e) =>
                      setFiltros({ ...filtros, vencimento: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    type="date"
                    value={filtros.periodoInicio}
                    onChange={(e) =>
                      setFiltros({ ...filtros, periodoInicio: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    type="date"
                    value={filtros.periodoFim}
                    onChange={(e) =>
                      setFiltros({ ...filtros, periodoFim: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Buscar por número da NF"
                    value={filtros.nf}
                    onChange={(e) =>
                      setFiltros({ ...filtros, nf: e.target.value })
                    }
                  />
                </div>

                <div className="table-wrapper" style={{ marginTop: "20px" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fornecedor</th>
                        <th>CNPJ</th>
                        <th>NF</th>
                        <th>Documento</th>
                        <th>Competência</th>
                        <th>Vencimento</th>
                        <th>Valor líquido</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {contasPagarFiltradas.map((item) => (
                        <tr key={item.id}>
                          <td>{item.fornecedor || "—"}</td>
                          <td>{item.cnpjFornecedor || "—"}</td>
                          <td>{item.numeroNotaFiscal || "—"}</td>
                          <td>{item.tipoDocumento || "—"}</td>
                          <td>
                            {item.mesCompetencia || "—"}/{item.anoCompetencia || "—"}
                          </td>
                          <td>{item.dataVencimento || "—"}</td>
                          <td>
                            {formatarMoeda(
                              item.valorLiquidoPagar || item.valorBruto || 0
                            )}
                          </td>
                          <td>{item.status || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                className="secondary-btn"
                                onClick={() => editarConta(item)}
                              >
                                Editar
                              </button>

                              {item.status !== "Pago" && (
                                <button
                                  className="secondary-btn"
                                  onClick={() => marcarContaComoPaga(item)}
                                >
                                  Marcar como pago
                                </button>
                              )}

                              <button
                                className="danger-btn"
                                onClick={() => excluirConta(item)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {contasPagarFiltradas.length === 0 && (
                        <tr>
                          <td colSpan="9">Nenhuma conta a pagar encontrada.</td>
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
                        <th>Paciente/Convênio</th>
                        <th>Serviço</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Data pagamento</th>
                        <th>Status</th>
                        <th>Forma</th>
                        <th>Observações</th>
                        <th>Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {contasAReceber.map((item) => (
                        <tr key={item.id}>
                          <td>{item.paciente || "—"}</td>
                          <td>{item.tipoAtendimento || "—"}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                          <td>{item.dataVencimento || item.dataPagamento || "—"}</td>
                          <td>{item.dataPagamento || "—"}</td>
                          <td>{item.statusPagamento || "Pendente"}</td>
                          <td>{item.formaPagamento || "—"}</td>
                          <td>{item.observacoes || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                          <td colSpan="9">Nenhuma conta pendente encontrada.</td>
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
                        <th>Paciente/Fornecedor</th>
                        <th>Descrição</th>
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

                      {contasPagar
                        .filter((item) => item.status === "Pago")
                        .map((item) => (
                          <tr key={item.id}>
                            <td>{item.fornecedor || "—"}</td>
                            <td>{item.numeroNotaFiscal || item.tipoDocumento || "—"}</td>
                            <td>
                              {formatarMoeda(
                                item.valorPago ||
                                  item.valorLiquidoPagar ||
                                  item.valorBruto
                              )}
                            </td>
                            <td>{item.tipoPagamento || "—"}</td>
                            <td>{item.dataPagamento || "—"}</td>
                            <td>Conta a pagar</td>
                          </tr>
                        ))}

                      {contasPagas.length === 0 &&
                        contasPagar.filter((item) => item.status === "Pago")
                          .length === 0 && (
                          <tr>
                            <td colSpan="6">Nenhuma conta paga encontrada.</td>
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
                        <th>Origem</th>
                        <th>Paciente/Fornecedor</th>
                        <th>Descrição</th>
                        <th>Forma</th>
                        <th>Status</th>
                        <th>Categoria</th>
                        <th>Valor</th>
                      </tr>
                    </thead>

                    <tbody>
                      {movimentacoes.map((item) => (
                        <tr key={item.id}>
                          <td>{item.data || "—"}</td>
                          <td>{item.tipo}</td>
                          <td>{item.origem}</td>
                          <td>{item.pessoa}</td>
                          <td>{item.descricao}</td>
                          <td>{item.forma}</td>
                          <td>{item.status}</td>
                          <td>{item.categoria}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                        </tr>
                      ))}

                      {movimentacoes.length === 0 && (
                        <tr>
                          <td colSpan="9">Nenhuma movimentação encontrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === "relatorios" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Relatórios Financeiros</h3>

                <div className="patients-form-grid" style={{ marginTop: "16px" }}>
                  <input
                    className="input"
                    type="date"
                    value={filtros.periodoInicio}
                    onChange={(e) =>
                      setFiltros({ ...filtros, periodoInicio: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    type="date"
                    value={filtros.periodoFim}
                    onChange={(e) =>
                      setFiltros({ ...filtros, periodoFim: e.target.value })
                    }
                  />

                  <select
                    className="select"
                    value={filtros.status}
                    onChange={(e) =>
                      setFiltros({ ...filtros, status: e.target.value })
                    }
                  >
                    <option value="">Todos os status</option>
                    <option>Pendente</option>
                    <option>Pago</option>
                    <option>Vencido</option>
                    <option>Cancelado</option>
                  </select>

                  <input
                    className="input"
                    placeholder="Fornecedor"
                    value={filtros.fornecedor}
                    onChange={(e) =>
                      setFiltros({ ...filtros, fornecedor: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Paciente"
                    value={filtros.paciente}
                    onChange={(e) =>
                      setFiltros({ ...filtros, paciente: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Forma de pagamento"
                    value={filtros.formaPagamento}
                    onChange={(e) =>
                      setFiltros({ ...filtros, formaPagamento: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Categoria"
                    value={filtros.categoria}
                    onChange={(e) =>
                      setFiltros({ ...filtros, categoria: e.target.value })
                    }
                  />
                </div>

                <div className="stats-grid" style={{ marginTop: "16px" }}>
                  <div className="stat-box">
                    <div className="stat-label">Contas a pagar</div>
                    <div className="stat-value">{contasPagar.length}</div>
                    <div className="stat-info">Total cadastrado</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Contas pagas</div>
                    <div className="stat-value">
                      {
                        contasPagar.filter((item) => item.status === "Pago").length
                      }
                    </div>
                    <div className="stat-info">Saídas pagas</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Contas vencidas</div>
                    <div className="stat-value">
                      {dadosFinanceiros.contasVencidas}
                    </div>
                    <div className="stat-info">Pendências vencidas</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Fluxo de caixa</div>
                    <div className="stat-value">
                      {formatarMoeda(
                        dadosFinanceiros.receitaMes - dadosFinanceiros.despesasMes
                      )}
                    </div>
                    <div className="stat-info">Receita - despesa</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Receita mensal</div>
                    <div className="stat-value">
                      {formatarMoeda(dadosFinanceiros.receitaMes)}
                    </div>
                    <div className="stat-info">Entradas do mês</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">Despesa mensal</div>
                    <div className="stat-value">
                      {formatarMoeda(dadosFinanceiros.despesasMes)}
                    </div>
                    <div className="stat-info">Saídas do mês</div>
                  </div>
                </div>

                <h3 style={{ marginTop: "24px" }}>
                  Recebimentos por forma de pagamento
                </h3>

                <div className="table-wrapper" style={{ marginTop: "16px" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Forma de pagamento</th>
                        <th>Valor recebido</th>
                      </tr>
                    </thead>

                    <tbody>
                      {resumoPorFormaPagamento.map((item) => (
                        <tr key={item.forma}>
                          <td>{item.forma}</td>
                          <td>{formatarMoeda(item.valor)}</td>
                        </tr>
                      ))}

                      {resumoPorFormaPagamento.length === 0 && (
                        <tr>
                          <td colSpan="2">Nenhum recebimento encontrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}