export default function EmptyState({ icon, titulo, descricao, acao, onAcao, cor = "#7C3AED" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center",
    }}>
      {icon && (
        <div style={{
          width: "64px", height: "64px", borderRadius: "16px",
          background: `${cor}14`, display: "flex", alignItems: "center",
          justifyContent: "center", marginBottom: "16px",
        }}>
          <div style={{ color: cor, opacity: 0.7 }}>{icon}</div>
        </div>
      )}
      <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
        {titulo}
      </h3>
      {descricao && (
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b", maxWidth: "320px", lineHeight: 1.5 }}>
          {descricao}
        </p>
      )}
      {acao && onAcao && (
        <button
          onClick={onAcao}
          style={{
            padding: "9px 20px", borderRadius: "8px", border: "none",
            background: cor, color: "#fff", fontSize: "13px",
            fontWeight: 600, cursor: "pointer",
          }}
        >
          {acao}
        </button>
      )}
    </div>
  );
}
