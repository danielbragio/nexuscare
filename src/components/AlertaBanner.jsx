export default function AlertaBanner({ alertas = [] }) {
  if (!alertas.length) return null;
  const TIPOS = {
    urgente: { bg: "#fef2f2", border: "#fca5a5", cor: "#dc2626", icone: "⚠" },
    atencao: { bg: "#fffbeb", border: "#fcd34d", cor: "#d97706", icone: "⏰" },
    info:    { bg: "#eff6ff", border: "#93c5fd", cor: "#2563eb", icone: "ℹ" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {alertas.map((a, i) => {
        const cfg = TIPOS[a.tipo] || TIPOS.info;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "10px 14px", borderRadius: "10px",
            background: cfg.bg, border: `1px solid ${cfg.border}`,
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{cfg.icone}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: cfg.cor }}>{a.titulo}</span>
              {a.detalhe && (
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "6px" }}>{a.detalhe}</span>
              )}
            </div>
            {a.acao && a.onAcao && (
              <button
                onClick={a.onAcao}
                style={{
                  padding: "4px 10px", borderRadius: "6px", border: `1px solid ${cfg.border}`,
                  background: "transparent", color: cfg.cor, fontSize: "11px",
                  fontWeight: 600, cursor: "pointer", flexShrink: 0,
                }}
              >
                {a.acao}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
