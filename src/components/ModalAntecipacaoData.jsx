import { useState } from "react";
import api from "../services/api";
import { hojeISO, agoraISO, formatarData } from "../utils/dateUtils";

export default function ModalAntecipacaoData({ consulta, userData, onConfirm, onCancel }) {
  const hoje = hojeISO();
  const [opcao, setOpcao] = useState("antecipar");
  const [novaData, setNovaData] = useState(hoje);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const dataOriginal = consulta.data_original || consulta.data;
  const pacienteNome =
    consulta.paciente || consulta.nome_paciente || consulta.nomePaciente || "Paciente";

  const diasAte = (() => {
    try {
      return Math.ceil(
        (new Date(dataOriginal + "T00:00:00") - new Date(hoje + "T00:00:00")) / 86400000
      );
    } catch {
      return 0;
    }
  })();

  async function confirmar() {
    if (!motivo.trim()) {
      setErro("O motivo é obrigatório.");
      return;
    }
    if (opcao === "remarcar" && !novaData) {
      setErro("Informe a nova data.");
      return;
    }
    setErro("");
    setLoading(true);
    try {
      const dataOrig = dataOriginal;
      const payload = {
        data_original: dataOrig,
        antecipado_por: userData?.nome || userData?.email || "",
        motivo_antecipacao: motivo.trim(),
      };

      let novaDataFinal = consulta.data;
      if (opcao === "antecipar") {
        novaDataFinal = hoje;
        payload.data = novaDataFinal;
        payload.antecipado_em = agoraISO();
      } else if (opcao === "remarcar") {
        novaDataFinal = novaData;
        payload.data = novaDataFinal;
        // antecipado_em intencionalmente não definido — remarcação não autoriza atendimento antecipado
      } else {
        // autorizar fora da data
        payload.antecipado_em = agoraISO();
      }

      await api.atendimentos.atualizar(consulta.id, payload);

      await api.auditLogs.registrar({
        acao:
          opcao === "antecipar"
            ? "antecipacao_atendimento"
            : opcao === "remarcar"
            ? "remarcacao_atendimento"
            : "autorizacao_fora_data",
        entidade: "atendimentos",
        entidade_id: String(consulta.id),
        data_original: dataOrig,
        motivo: motivo.trim(),
        detalhes: JSON.stringify({
          paciente: pacienteNome,
          data_original: dataOrig,
          nova_data: novaDataFinal,
          opcao,
          autorizado_por: userData?.nome || userData?.email || "",
        }),
      });

      const consultaAtualizada = { ...consulta, ...payload, data: novaDataFinal };
      onConfirm({ acao: opcao, novaData: novaDataFinal, consultaAtualizada });
    } catch {
      setErro("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const OPCOES = [
    {
      valor: "antecipar",
      titulo: `Antecipar para hoje — ${formatarData(hoje)}`,
      desc: "Move o atendimento para hoje. A data original é registrada no histórico.",
    },
    {
      valor: "remarcar",
      titulo: "Remarcar para outra data",
      desc: "Altera a data do agendamento. O atendimento ocorrerá na nova data.",
    },
    {
      valor: "autorizar",
      titulo: "Autorizar atendimento fora da data",
      desc: "Mantém a data original mas libera o atendimento hoje mediante justificativa.",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 24px 64px rgba(15,23,42,0.24)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.65)",
              marginBottom: "4px",
            }}
          >
            Agendamento em Data Futura
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "3px" }}>
            {pacienteNome}
          </div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
            Agendado para {formatarData(dataOriginal)}
            {diasAte > 0 && ` · daqui ${diasAte} dia${diasAte !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>
          <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 16px" }}>
            Esta consulta está agendada para uma data futura. Para prosseguir, selecione como
            deseja tratar este caso:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
            {OPCOES.map((opt) => {
              const ativo = opcao === opt.valor;
              return (
                <button
                  key={opt.valor}
                  onClick={() => setOpcao(opt.valor)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 14px",
                    border: `2px solid ${ativo ? "#7c3aed" : "#e2e8f0"}`,
                    borderRadius: "12px",
                    background: ativo ? "#faf5ff" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: `2px solid ${ativo ? "#7c3aed" : "#cbd5e1"}`,
                      background: ativo ? "#7c3aed" : "#fff",
                      flexShrink: 0,
                      marginTop: "1px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {ativo && (
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#fff",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                      {opt.titulo}
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                      {opt.desc}
                    </div>
                    {opt.valor === "remarcar" && ativo && (
                      <input
                        type="date"
                        value={novaData}
                        min={hoje}
                        onChange={(e) => setNovaData(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          marginTop: "8px",
                          padding: "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Motivo <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErro("");
              }}
              placeholder="Descreva o motivo para este procedimento..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${erro ? "#ef4444" : "#e2e8f0"}`,
                borderRadius: "10px",
                fontSize: "13px",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
                color: "#0f172a",
              }}
            />
          </div>

          {erro && (
            <div
              style={{
                fontSize: "12px",
                color: "#ef4444",
                marginBottom: "14px",
                padding: "8px 12px",
                background: "#fef2f2",
                borderRadius: "8px",
              }}
            >
              {erro}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                background: "#fff",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={loading}
              style={{
                flex: 2,
                padding: "10px",
                background: loading ? "#a78bfa" : "#7c3aed",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Processando..." : "Confirmar e Prosseguir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
