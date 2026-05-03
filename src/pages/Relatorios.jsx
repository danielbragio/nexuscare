import React, { useEffect, useMemo, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { getApp } from "firebase/app";

const db = getFirestore(getApp());

export default function Relatorios() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "agendamentos"), (snap) => {
      setAgendamentos(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsub2 = onSnapshot(collection(db, "pagamentos"), (snap) => {
      setPagamentos(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsub3 = onSnapshot(collection(db, "usuarios"), (snap) => {
      setUsuarios(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const normalizarData = (data) => {
    if (!data) return null;
    if (data?.toDate) return data.toDate();
    return new Date(data);
  };

  const dentroPeriodo = (item) => {
    const data = normalizarData(item.data || item.dataAgendamento);
    if (!data) return false;

    const hoje = new Date();
    let inicio = new Date();

    if (periodo === "hoje") {
      inicio.setHours(0, 0, 0, 0);
    }

    if (periodo === "7") {
      inicio.setDate(hoje.getDate() - 7);
    }

    if (periodo === "30") {
      inicio.setDate(hoje.getDate() - 30);
    }

    if (periodo === "personalizado") {
      const ini = new Date(dataInicio);
      const fim = new Date(dataFim);
      return data >= ini && data <= fim;
    }

    return data >= inicio && data <= hoje;
  };

  const dados = useMemo(() => {
    return agendamentos.filter(dentroPeriodo);
  }, [agendamentos, periodo, dataInicio, dataFim]);

  const pagamentosFiltrados = useMemo(() => {
    return pagamentos.filter(dentroPeriodo);
  }, [pagamentos, periodo, dataInicio, dataFim]);

  const receita = pagamentosFiltrados
    .filter((p) => p.status === "pago")
    .reduce((acc, p) => acc + Number(p.valor || 0), 0);

  const total = dados.length;

  const finalizados = dados.filter((d) => d.status === "finalizado").length;
  const cancelados = dados.filter((d) => d.status === "cancelado").length;

  const ticket = total ? receita / total : 0;

  const formatarMoeda = (v) =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* FILTROS */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setPeriodo("hoje")}>Hoje</button>
        <button onClick={() => setPeriodo("7")}>7 dias</button>
        <button onClick={() => setPeriodo("30")}>30 dias</button>
        <button onClick={() => setPeriodo("personalizado")}>
          Personalizado
        </button>

        {periodo === "personalizado" && (
          <>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </>
        )}
      </div>

      {/* KPIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Card titulo="Atendimentos" valor={total} />
        <Card titulo="Finalizados" valor={finalizados} />
        <Card titulo="Cancelados" valor={cancelados} />
        <Card titulo="Receita" valor={formatarMoeda(receita)} />
        <Card titulo="Ticket médio" valor={formatarMoeda(ticket)} />
      </div>

      {/* TABELA */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "auto", maxHeight: 300 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Médico</th>
              <th>Status</th>
              <th>Data</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item) => {
              const pagamento = pagamentosFiltrados.find(
                (p) => p.pacienteId === item.pacienteId
              );

              return (
                <tr key={item.id}>
                  <td>{item.nomePaciente}</td>
                  <td>{item.medico}</td>
                  <td>{item.status}</td>
                  <td>
                    {normalizarData(item.data)?.toLocaleDateString("pt-BR")}
                  </td>
                  <td>{formatarMoeda(pagamento?.valor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ titulo, valor }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <span>{titulo}</span>
      <strong style={{ display: "block", fontSize: 18 }}>{valor}</strong>
    </div>
  );
}