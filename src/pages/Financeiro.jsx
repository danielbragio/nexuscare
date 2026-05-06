import { useEffect, useMemo, useRef, useState } from "react";
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

const METRICA_COR = { receita: "#10b981", despesa: "#ef4444", saldo: "#6366f1" };

function parseDateF(str) {
  if (!str) return null;
  const d = new Date(`${String(str).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function LineChart({ dados, metrica, cor, formatMoeda }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const W = 900, H = 230, padL = 56, padR = 24, padT = 20, padB = 38;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const vals = dados.map(d => d[metrica]);
  const rawMax = Math.max(...vals, 0);
  const rawMin = Math.min(...vals, 0);
  const yPad = Math.max((rawMax - rawMin) * 0.15, rawMax * 0.1, 10);
  const yMax = rawMax + yPad;
  const yMin = rawMin < 0 ? rawMin - yPad : 0;
  const yRange = yMax - yMin || 1;

  const toX = (i) => padL + (i / (dados.length - 1 || 1)) * chartW;
  const toY = (v) => padT + (1 - (v - yMin) / yRange) * chartH;
  const pts = dados.map((d, i) => ({ x: toX(i), y: toY(d[metrica]) }));

  const linePath = (() => {
    if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x},${pts[0].y}` : "";
    const segs = [`M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
    const t = 0.3;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      segs.push(`C ${(p1.x + t * (p2.x - p0.x)).toFixed(1)},${(p1.y + t * (p2.y - p0.y)).toFixed(1)} ${(p2.x - t * (p3.x - p1.x)).toFixed(1)},${(p2.y - t * (p3.y - p1.y)).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
    }
    return segs.join(" ");
  })();

  const zeroY = toY(Math.max(yMin, 0));
  const areaPath = pts.length > 1 ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${zeroY.toFixed(1)} L ${pts[0].x.toFixed(1)},${zeroY.toFixed(1)} Z` : "";
  const gridVals = [yMax, (yMax + yMin) / 2, yMin];
  const step = Math.max(1, Math.floor(dados.length / 6));
  const xLabels = dados.map((d, i) => ({ i, label: d.data.slice(5).replace("-", "/") })).filter(({ i }) => i === 0 || i === dados.length - 1 || i % step === 0);
  const gradId = `sp-${metrica}`;

  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null;
  let ttX = hoverPt ? hoverPt.x : 0, ttY = hoverPt ? Math.max(padT, hoverPt.y - 58) : 0;
  if (ttX + 138 > W) ttX = W - 142;
  if (ttX < padL) ttX = padL;

  function handleMove(e) {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    if (mx < padL || mx > W - padR) { setHoverIdx(null); return; }
    setHoverIdx(Math.max(0, Math.min(dados.length - 1, Math.round(((mx - padL) / chartW) * (dados.length - 1)))));
  }

  function fmtK(v) {
    const abs = Math.abs(v), s = v < 0 ? "-" : "";
    if (abs >= 1e6) return `${s}R$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1000) return `${s}R$${(abs / 1000).toFixed(0)}k`;
    return `${s}R$${abs.toFixed(0)}`;
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", userSelect: "none" }}
      onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.15" />
          <stop offset="75%" stopColor={cor} stopOpacity="0.03" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
        <filter id="tt-sh" x="-15%" y="-25%" width="130%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="rgba(0,0,0,0.1)" />
        </filter>
      </defs>
      {gridVals.map((v, i) => (
        <line key={i} x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)}
          stroke={v === 0 && yMin < 0 ? "rgba(148,163,184,0.3)" : "rgba(226,232,240,0.55)"}
          strokeWidth={v === 0 && yMin < 0 ? "1.5" : "1"}
          strokeDasharray={v === 0 && yMin < 0 ? "4,3" : "0"} />
      ))}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      {linePath && <path d={linePath} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {hoverPt && <line x1={hoverPt.x} y1={padT} x2={hoverPt.x} y2={H - padB} stroke="rgba(148,163,184,0.4)" strokeWidth="1" strokeDasharray="3,2" />}
      {hoverPt && <>
        <circle cx={hoverPt.x} cy={hoverPt.y} r="7" fill={cor} opacity="0.15" />
        <circle cx={hoverPt.x} cy={hoverPt.y} r="4.5" fill={cor} />
        <circle cx={hoverPt.x} cy={hoverPt.y} r="2" fill="white" />
      </>}
      {hoverPt && hoverIdx !== null && <>
        <rect x={ttX} y={ttY} width="138" height="52" rx="10" fill="white" filter="url(#tt-sh)" />
        <rect x={ttX} y={ttY} width="138" height="52" rx="10" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
        <text x={ttX + 12} y={ttY + 18} fontSize="10" fill="#94a3b8" fontWeight="500">{dados[hoverIdx].data.slice(5).replace("-", "/")}</text>
        <text x={ttX + 12} y={ttY + 38} fontSize="14" fontWeight="700" fill={cor}>{formatMoeda ? formatMoeda(dados[hoverIdx][metrica]) : fmtK(dados[hoverIdx][metrica])}</text>
      </>}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="rgba(148,163,184,0.85)">{label}</text>
      ))}
      {gridVals.map((v, i) => (
        <text key={i} x={padL - 8} y={toY(v) + 4} textAnchor="end" fontSize="10" fill="rgba(148,163,184,0.85)">{fmtK(v)}</text>
      ))}
    </svg>
  );
}

export default function Financeiro() {
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [pagamentos, setPagamentos] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [anexosFinanceiros, setAnexosFinanceiros] = useState([]);
  const [historicoFinanceiro, setHistoricoFinanceiro] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [periodo, setPeriodo] = useState("30dias");
  const [periodoCustomInicio, setPeriodoCustomInicio] = useState("");
  const [periodoCustomFim, setPeriodoCustomFim] = useState("");
  const [chartMetrica, setChartMetrica] = useState("receita");

  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [salvandoAnexo, setSalvandoAnexo] = useState(false);

  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState(null);
  const [modoEdicaoFornecedor, setModoEdicaoFornecedor] = useState(false);
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
    categoria: "",
    contato: "",
    endereco: "",
    observacoes: "",
  });

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
    const unsubscribe = onSnapshot(
      collection(db, "pagamentos"),
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

  useEffect(() => {
    const q = query(collection(db, "fornecedores"), orderBy("nome", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFornecedores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => { console.error("fornecedores:", err); });
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
      const dataBase = item.dataPagamento || item.data || "";
      if (!dataBase) return false;
      const data = new Date(`${dataBase}T00:00:00`);
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    });

    const contasPagarMes = contasPagar.filter((item) => {
      const dataBase = item.dataPagamento || item.dataVencimento;
      if (!dataBase) return false;
      const data = new Date(`${dataBase}T00:00:00`);
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    });

    const receitaMes = pagamentosDoMes
      .filter((item) => (item.statusPagamento || item.status || "").toLowerCase() === "pago")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const despesasMes = contasPagarMes
      .filter((item) => item.status === "Pago")
      .reduce(
        (total, item) =>
          total + Number(item.valorPago || item.valorLiquidoPagar || item.valorBruto || 0),
        0
      );

    const statusNorm = (item) => (item.statusPagamento || item.status || "").toLowerCase();

    const contasReceber = pagamentos
      .filter((item) => statusNorm(item) === "pendente")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const contasPagas = pagamentos
      .filter((item) => statusNorm(item) === "pago")
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    const contasPendentes = pagamentos.filter(
      (item) => statusNorm(item) === "pendente"
    ).length;

    const contasCanceladas = pagamentos.filter(
      (item) => statusNorm(item) === "cancelado"
    ).length;

    const cortesias = pagamentos.filter(
      (item) => statusNorm(item) === "cortesia"
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
    (item) => (item.statusPagamento || item.status || "").toLowerCase() === "pendente"
  );

  const contasPagas = pagamentos.filter(
    (item) => (item.statusPagamento || item.status || "").toLowerCase() === "pago"
  );

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
      data: item.dataPagamento || item.data || "",
      tipo: "Entrada",
      origem: item.origem === "odonto" ? "Odontologia" : item.origem || "Recepção",
      descricao: item.tipoAtendimento || item.descricao || item.servico || "Pagamento de paciente",
      pessoa: item.paciente || item.nomePaciente || "—",
      forma: item.formaPagamento || "—",
      status: item.statusPagamento || item.status || "—",
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

  const rangePeriodo = useMemo(() => {
    const hoje = new Date();
    const fimDia = new Date(hoje);
    fimDia.setHours(23, 59, 59, 999);
    if (periodo === "hoje") {
      const ini = new Date(hoje);
      ini.setHours(0, 0, 0, 0);
      return { ini, fim: fimDia };
    }
    if (periodo === "7dias") {
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - 6);
      ini.setHours(0, 0, 0, 0);
      return { ini, fim: fimDia };
    }
    if (periodo === "custom" && periodoCustomInicio && periodoCustomFim) {
      return {
        ini: new Date(`${periodoCustomInicio}T00:00:00`),
        fim: new Date(`${periodoCustomFim}T23:59:59`),
      };
    }
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() - 29);
    ini.setHours(0, 0, 0, 0);
    return { ini, fim: fimDia };
  }, [periodo, periodoCustomInicio, periodoCustomFim]);

  const kpisDashboard = useMemo(() => {
    const { ini, fim } = rangePeriodo;
    const pagsFiltrados = pagamentos.filter(p => {
      const d = parseDateF(p.dataPagamento || p.data);
      return d && d >= ini && d <= fim;
    });
    const despFiltradas = contasPagar.filter(c => {
      const d = parseDateF(c.dataPagamento || c.dataVencimento);
      return d && d >= ini && d <= fim;
    });
    const receita = pagsFiltrados
      .filter(p => (p.statusPagamento || p.status || "").toLowerCase() === "pago")
      .reduce((t, p) => t + Number(p.valor || 0), 0);
    const despesas = despFiltradas
      .filter(c => c.status === "Pago")
      .reduce((t, c) => t + Number(c.valorPago || c.valorLiquidoPagar || c.valorBruto || 0), 0);
    const pendentes = pagamentos
      .filter(p => (p.statusPagamento || p.status || "").toLowerCase() === "pendente")
      .reduce((t, p) => t + Number(p.valor || 0), 0);
    return { receita, despesas, saldo: receita - despesas, pendentes };
  }, [pagamentos, contasPagar, rangePeriodo]);

  const chartDados = useMemo(() => {
    const { ini, fim } = rangePeriodo;
    const dias = [];
    const cur = new Date(ini);
    cur.setHours(0, 0, 0, 0);
    while (cur <= fim) {
      dias.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dias.map(diaStr => {
      const receita = pagamentos
        .filter(p => (p.dataPagamento || p.data || "").slice(0, 10) === diaStr && (p.statusPagamento || p.status || "").toLowerCase() === "pago")
        .reduce((t, p) => t + Number(p.valor || 0), 0);
      const despesa = contasPagar
        .filter(c => (c.dataPagamento || c.dataVencimento || "").slice(0, 10) === diaStr && c.status === "Pago")
        .reduce((t, c) => t + Number(c.valorPago || c.valorLiquidoPagar || c.valorBruto || 0), 0);
      return { data: diaStr, receita, despesa, saldo: receita - despesa };
    });
  }, [pagamentos, contasPagar, rangePeriodo]);

  const receitaPorOrigem = useMemo(() => {
    const { ini, fim } = rangePeriodo;
    const mapa = {};
    pagamentos
      .filter(p => {
        const d = parseDateF(p.dataPagamento || p.data);
        return d && d >= ini && d <= fim && (p.statusPagamento || p.status || "").toLowerCase() === "pago";
      })
      .forEach(p => {
        const o = p.origem === "odonto" ? "Odontologia" : (p.origem || "Recepção");
        mapa[o] = (mapa[o] || 0) + Number(p.valor || 0);
      });
    return Object.entries(mapa).map(([origem, valor]) => ({ origem, valor })).sort((a, b) => b.valor - a.valor);
  }, [pagamentos, rangePeriodo]);

  const despesaPorCategoria = useMemo(() => {
    const { ini, fim } = rangePeriodo;
    const mapa = {};
    contasPagar
      .filter(c => {
        const d = parseDateF(c.dataPagamento || c.dataVencimento);
        return d && d >= ini && d <= fim && c.status === "Pago";
      })
      .forEach(c => {
        const cat = c.categoria || "Outros";
        mapa[cat] = (mapa[cat] || 0) + Number(c.valorPago || c.valorLiquidoPagar || c.valorBruto || 0);
      });
    return Object.entries(mapa).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [contasPagar, rangePeriodo]);

  const ultTransacoes = useMemo(() => {
    const { ini, fim } = rangePeriodo;
    return movimentacoes
      .filter(m => {
        const d = parseDateF(m.data);
        return d && d >= ini && d <= fim;
      })
      .slice(0, 8);
  }, [movimentacoes, rangePeriodo]);

  const labelPeriodo = useMemo(() => {
    if (periodo === "hoje") return "Hoje";
    if (periodo === "7dias") return "Últimos 7 dias";
    if (periodo === "custom" && periodoCustomInicio && periodoCustomFim) return `${periodoCustomInicio} → ${periodoCustomFim}`;
    return "Últimos 30 dias";
  }, [periodo, periodoCustomInicio, periodoCustomFim]);

  function limparFornecedor() {
    setFornecedorSelecionado(null);
    setModoEdicaoFornecedor(false);
    setNovoFornecedor({ nome: "", cnpj: "", telefone: "", email: "", categoria: "", contato: "", endereco: "", observacoes: "" });
  }

  function editarFornecedor(f) {
    setFornecedorSelecionado(f);
    setModoEdicaoFornecedor(true);
    setNovoFornecedor({
      nome: f.nome || "",
      cnpj: f.cnpj || "",
      telefone: f.telefone || "",
      email: f.email || "",
      categoria: f.categoria || "",
      contato: f.contato || "",
      endereco: f.endereco || "",
      observacoes: f.observacoes || "",
    });
  }

  async function salvarFornecedor() {
    if (!novoFornecedor.nome.trim()) {
      alert("Informe o nome do fornecedor.");
      return;
    }
    try {
      setSalvandoFornecedor(true);
      const payload = {
        nome: novoFornecedor.nome.trim(),
        cnpj: novoFornecedor.cnpj.trim(),
        telefone: novoFornecedor.telefone.trim(),
        email: novoFornecedor.email.trim(),
        categoria: novoFornecedor.categoria.trim(),
        contato: novoFornecedor.contato.trim(),
        endereco: novoFornecedor.endereco.trim(),
        observacoes: novoFornecedor.observacoes.trim(),
        atualizadoEm: serverTimestamp(),
      };
      if (modoEdicaoFornecedor && fornecedorSelecionado?.id) {
        await updateDoc(doc(db, "fornecedores", fornecedorSelecionado.id), payload);
        alert("Fornecedor atualizado.");
      } else {
        await addDoc(collection(db, "fornecedores"), { ...payload, criadoEm: serverTimestamp() });
        alert("Fornecedor cadastrado.");
      }
      limparFornecedor();
    } catch (err) {
      console.error("Erro ao salvar fornecedor:", err);
      alert("Não foi possível salvar o fornecedor.");
    } finally {
      setSalvandoFornecedor(false);
    }
  }

  async function excluirFornecedor(f) {
    if (!window.confirm(`Excluir o fornecedor "${f.nome}"?`)) return;
    try {
      await deleteDoc(doc(db, "fornecedores", f.id));
      if (fornecedorSelecionado?.id === f.id) limparFornecedor();
    } catch (err) {
      console.error("Erro ao excluir fornecedor:", err);
      alert("Não foi possível excluir o fornecedor.");
    }
  }

  return (
    <div className="financeiro-page">
      <div className="page-card">
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

          <button
            className={`patients-tab ${abaAtiva === "fornecedores" ? "active" : ""}`}
            onClick={() => setAbaAtiva("fornecedores")}
          >
            🏢 Fornecedores
          </button>
        </div>

        {carregando ? (
          <div className="muted-box" style={{ marginTop: "20px" }}>
            Carregando dados financeiros...
          </div>
        ) : (
          <>
            {abaAtiva === "resumo" && (
              <div style={{ padding: "28px 0 8px" }}>

                {/* ── Header ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "36px", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)" }}>Visão Financeira</h1>
                    <p style={{ margin: "5px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>{labelPeriodo}</p>
                  </div>
                  <div style={{ display: "flex", background: "var(--bg-muted)", borderRadius: "12px", padding: "3px", gap: "2px" }}>
                    {[["hoje", "Hoje"], ["7dias", "7 dias"], ["30dias", "30 dias"], ["custom", "Personalizado"]].map(([p, label]) => (
                      <button key={p} onClick={() => setPeriodo(p)} style={{
                        padding: "7px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer",
                        background: periodo === p ? "var(--bg-card)" : "transparent",
                        color: periodo === p ? "var(--text)" : "var(--text-muted)",
                        boxShadow: periodo === p ? "0 1px 3px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
                        transition: "all 0.15s ease",
                      }}>{label}</button>
                    ))}
                  </div>
                </div>

                {periodo === "custom" && (
                  <div style={{ display: "flex", gap: "14px", marginBottom: "28px", flexWrap: "wrap" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Início</label>
                      <input type="date" className="input" value={periodoCustomInicio} onChange={e => setPeriodoCustomInicio(e.target.value)} style={{ width: "160px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Fim</label>
                      <input type="date" className="input" value={periodoCustomFim} onChange={e => setPeriodoCustomFim(e.target.value)} style={{ width: "160px" }} />
                    </div>
                  </div>
                )}

                {/* ── KPIs ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "28px" }}>
                  {[
                    { title: "Receita Total",  value: kpisDashboard.receita,   color: "#10b981", icon: "↑", sub: "Entradas confirmadas" },
                    { title: "Despesas",        value: kpisDashboard.despesas,  color: "#f43f5e", icon: "↓", sub: "Saídas pagas" },
                    { title: "Saldo Atual",     value: kpisDashboard.saldo,     color: kpisDashboard.saldo >= 0 ? "#6366f1" : "#f59e0b", icon: "≡", sub: "Receita − Despesas" },
                    { title: "Pendências",      value: kpisDashboard.pendentes, color: "#f59e0b", icon: "◷", sub: "Valores a receber" },
                  ].map(card => (
                    <div key={card.title} style={{
                      background: "var(--bg-card)",
                      borderRadius: "20px",
                      padding: "24px 24px 20px",
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.05)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{card.title}</span>
                        <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: card.color + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", color: card.color }}>
                          {card.icon}
                        </div>
                      </div>
                      <div style={{ fontSize: "25px", fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1, marginBottom: "7px" }}>
                        {formatarMoeda(card.value)}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── Chart ── */}
                <div style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "28px 28px 20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.05)", marginBottom: "22px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>Fluxo Financeiro</h3>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Evolução diária no período</p>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[["receita", "#10b981", "Receita"], ["despesa", "#f43f5e", "Despesa"], ["saldo", "#6366f1", "Saldo"]].map(([m, c, lbl]) => (
                        <button key={m} onClick={() => setChartMetrica(m)} style={{
                          padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                          border: `1.5px solid ${chartMetrica === m ? c : "var(--border)"}`,
                          background: chartMetrica === m ? c + "12" : "transparent",
                          color: chartMetrica === m ? c : "var(--text-muted)",
                          transition: "all 0.15s",
                        }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  {chartDados.length === 1 ? (
                    <div style={{ textAlign: "center", padding: "44px 0" }}>
                      <div style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.04em", color: METRICA_COR[chartMetrica] }}>
                        {formatarMoeda(chartDados[0][chartMetrica])}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px" }}>
                        {chartMetrica.charAt(0).toUpperCase() + chartMetrica.slice(1)} de hoje
                      </div>
                    </div>
                  ) : chartDados.length > 1 ? (
                    <LineChart dados={chartDados} metrica={chartMetrica} cor={METRICA_COR[chartMetrica]} formatMoeda={formatarMoeda} />
                  ) : (
                    <div style={{ textAlign: "center", padding: "52px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                      Sem dados no período selecionado.
                    </div>
                  )}
                </div>

                {/* ── Widgets ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "22px" }}>
                  {[
                    { title: "Receita por Origem", items: receitaPorOrigem.map(r => ({ label: r.origem, valor: r.valor })), total: kpisDashboard.receita, cor: "#10b981" },
                    { title: "Despesas por Categoria", items: despesaPorCategoria.map(d => ({ label: d.categoria, valor: d.valor })), total: kpisDashboard.despesas, cor: "#f43f5e" },
                  ].map(widget => (
                    <div key={widget.title} style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "24px", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.05)" }}>
                      <h4 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{widget.title}</h4>
                      {widget.items.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px 0" }}>Sem dados no período.</div>
                      ) : widget.items.map(({ label, valor }) => {
                        const pct = widget.total > 0 ? (valor / widget.total) * 100 : 0;
                        return (
                          <div key={label} style={{ marginBottom: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                              <span style={{ fontSize: "13px", color: "var(--text)", fontWeight: 500 }}>{label}</span>
                              <div>
                                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{formatarMoeda(valor)}</span>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div style={{ background: "var(--bg-muted)", borderRadius: "4px", height: "4px", overflow: "hidden" }}>
                              <div style={{ background: widget.cor, width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: "4px", transition: "width 0.6s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* ── Transactions ── */}
                <div style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "24px", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>Movimentações Recentes</h4>
                      <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Últimas transações do período</p>
                    </div>
                    <button onClick={() => setAbaAtiva("movimentacoes")} style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", padding: "4px 0" }}>
                      Ver todas →
                    </button>
                  </div>
                  {ultTransacoes.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "24px 0", textAlign: "center" }}>Nenhuma transação no período.</div>
                  ) : ultTransacoes.slice(0, 6).map((t, i) => {
                    const isEntry = t.tipo === "Entrada";
                    const statusLow = (t.status || "").toLowerCase();
                    return (
                      <div key={t.id} style={{
                        display: "flex", alignItems: "center", gap: "14px", padding: "13px 0",
                        borderBottom: i < Math.min(ultTransacoes.length, 6) - 1 ? "1px solid var(--border)" : "none",
                      }}>
                        <div style={{
                          width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          background: isEntry ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
                          color: isEntry ? "#10b981" : "#f43f5e", fontSize: "16px", fontWeight: 700,
                        }}>
                          {isEntry ? "↑" : "↓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.descricao}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {t.pessoa && t.pessoa !== "—" ? `${t.pessoa} · ` : ""}{t.data || "—"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: isEntry ? "#10b981" : "#f43f5e" }}>
                            {isEntry ? "+" : "−"}{formatarMoeda(t.valor)}
                          </div>
                          <span style={{
                            display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", marginTop: "3px",
                            background: statusLow === "pago" ? "rgba(16,185,129,0.12)" : statusLow === "pendente" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.12)",
                            color: statusLow === "pago" ? "#10b981" : statusLow === "pendente" ? "#d97706" : "#94a3b8",
                          }}>
                            {t.status || "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {abaAtiva === "pagar" && (
              <div style={{ marginTop: "20px" }}>
                <h3>Contas a Pagar</h3>

                <div className="patients-form-grid" style={{ marginTop: "16px" }}>
                  <div>
                    <label>Fornecedor</label>
                    {fornecedores.length > 0 ? (
                      <select
                        className="select"
                        value={novaConta.fornecedor}
                        onChange={(e) => {
                          const nomeSelecionado = e.target.value;
                          const forn = fornecedores.find((f) => f.nome === nomeSelecionado);
                          if (forn) {
                            setNovaConta((prev) => ({
                              ...prev,
                              fornecedor: forn.nome || "",
                              cnpjFornecedor: forn.cnpj || "",
                              categoria: forn.categoria || prev.categoria,
                            }));
                          } else {
                            alterarConta("fornecedor", nomeSelecionado);
                          }
                        }}
                      >
                        <option value="">Selecione o fornecedor</option>
                        {fornecedores.map((f) => (
                          <option key={f.id} value={f.nome}>{f.nome}</option>
                        ))}
                        <option value="__outro__">Outro (digitar manualmente)</option>
                      </select>
                    ) : (
                      <input
                        className="input"
                        value={novaConta.fornecedor}
                        onChange={(e) => alterarConta("fornecedor", e.target.value)}
                        placeholder="Nome do fornecedor"
                      />
                    )}
                    {novaConta.fornecedor === "__outro__" && (
                      <input
                        className="input"
                        style={{ marginTop: "6px" }}
                        onChange={(e) => alterarConta("fornecedor", e.target.value)}
                        placeholder="Digite o nome do fornecedor"
                      />
                    )}
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
                          <td>{item.tipoAtendimento || item.descricao || item.servico || "—"}</td>
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
                          <td>{item.tipoAtendimento || item.descricao || item.servico || "—"}</td>
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
            {abaAtiva === "fornecedores" && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {modoEdicaoFornecedor ? "Editar Fornecedor" : "Cadastrar Fornecedor"}
                    </h3>
                    <p className="page-subtitle" style={{ margin: "4px 0 0" }}>
                      Gerencie os fornecedores vinculados às contas a pagar.
                    </p>
                  </div>
                  {modoEdicaoFornecedor && (
                    <button className="secondary-btn" onClick={limparFornecedor}>
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
                    <h4 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700 }}>
                      {modoEdicaoFornecedor ? `Editando: ${fornecedorSelecionado?.nome}` : "Novo fornecedor"}
                    </h4>

                    <div className="patients-form-grid">
                      <div className="patients-full-width">
                        <label>Nome do fornecedor *</label>
                        <input
                          className="input"
                          value={novoFornecedor.nome}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, nome: e.target.value }))}
                          placeholder="Razão social ou nome fantasia"
                        />
                      </div>

                      <div>
                        <label>CNPJ</label>
                        <input
                          className="input"
                          value={novoFornecedor.cnpj}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, cnpj: e.target.value }))}
                          placeholder="00.000.000/0000-00"
                        />
                      </div>

                      <div>
                        <label>Categoria</label>
                        <select
                          className="select"
                          value={novoFornecedor.categoria}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, categoria: e.target.value }))}
                        >
                          <option value="">Selecionar categoria</option>
                          <option value="Material médico">Material médico</option>
                          <option value="Material odontológico">Material odontológico</option>
                          <option value="Equipamentos">Equipamentos</option>
                          <option value="Serviços">Serviços</option>
                          <option value="Manutenção">Manutenção</option>
                          <option value="Limpeza">Limpeza</option>
                          <option value="Aluguel">Aluguel</option>
                          <option value="Tecnologia">Tecnologia</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>

                      <div>
                        <label>Telefone / WhatsApp</label>
                        <input
                          className="input"
                          value={novoFornecedor.telefone}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, telefone: e.target.value }))}
                          placeholder="(00) 00000-0000"
                        />
                      </div>

                      <div>
                        <label>E-mail</label>
                        <input
                          className="input"
                          type="email"
                          value={novoFornecedor.email}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, email: e.target.value }))}
                          placeholder="contato@fornecedor.com.br"
                        />
                      </div>

                      <div>
                        <label>Nome do contato</label>
                        <input
                          className="input"
                          value={novoFornecedor.contato}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, contato: e.target.value }))}
                          placeholder="Responsável pelo atendimento"
                        />
                      </div>

                      <div className="patients-full-width">
                        <label>Endereço</label>
                        <input
                          className="input"
                          value={novoFornecedor.endereco}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, endereco: e.target.value }))}
                          placeholder="Rua, número, cidade"
                        />
                      </div>

                      <div className="patients-full-width">
                        <label>Observações</label>
                        <textarea
                          className="textarea"
                          value={novoFornecedor.observacoes}
                          onChange={(e) => setNovoFornecedor((p) => ({ ...p, observacoes: e.target.value }))}
                          placeholder="Prazo de pagamento, condições especiais..."
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="patients-form-actions" style={{ marginTop: "16px" }}>
                      <button
                        className="primary-btn"
                        onClick={salvarFornecedor}
                        disabled={salvandoFornecedor}
                      >
                        {salvandoFornecedor
                          ? "Salvando..."
                          : modoEdicaoFornecedor
                          ? "Atualizar fornecedor"
                          : "Cadastrar fornecedor"}
                      </button>
                      <button className="secondary-btn" onClick={limparFornecedor}>
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                        Fornecedores cadastrados ({fornecedores.length})
                      </h4>
                    </div>

                    <div style={{ display: "grid", gap: "10px", maxHeight: "540px", overflowY: "auto", paddingRight: "4px" }}>
                      {fornecedores.length === 0 && (
                        <div className="muted-box">Nenhum fornecedor cadastrado.</div>
                      )}
                      {fornecedores.map((f) => (
                        <div
                          key={f.id}
                          style={{
                            background: fornecedorSelecionado?.id === f.id ? "rgba(99,102,241,0.07)" : "var(--bg-card)",
                            border: `1px solid ${fornecedorSelecionado?.id === f.id ? "rgba(99,102,241,0.35)" : "var(--border)"}`,
                            borderRadius: "12px",
                            padding: "14px 16px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{f.nome}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                                {f.categoria && (
                                  <span className="patients-badge patients-badge-blue" style={{ fontSize: "11px" }}>
                                    {f.categoria}
                                  </span>
                                )}
                                {f.cnpj && (
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                    CNPJ: {f.cnpj}
                                  </span>
                                )}
                              </div>
                              {(f.telefone || f.email) && (
                                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                  {f.telefone && <span>📞 {f.telefone}</span>}
                                  {f.telefone && f.email && <span style={{ margin: "0 6px" }}>•</span>}
                                  {f.email && <span>✉️ {f.email}</span>}
                                </div>
                              )}
                              {f.contato && (
                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                                  Contato: {f.contato}
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                              <button
                                className="secondary-btn"
                                style={{ padding: "4px 10px", fontSize: "12px" }}
                                onClick={() => editarFornecedor(f)}
                              >
                                Editar
                              </button>
                              <button
                                className="secondary-btn"
                                style={{ padding: "4px 10px", fontSize: "12px", color: "#dc2626", borderColor: "#fca5a5" }}
                                onClick={() => excluirFornecedor(f)}
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                          {f.observacoes && (
                            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", background: "var(--bg-muted)", borderRadius: "8px", padding: "6px 10px" }}>
                              {f.observacoes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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