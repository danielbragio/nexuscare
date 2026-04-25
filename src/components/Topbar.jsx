export default function Topbar() {
  return (
    <header
      style={{
        height: 72,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <div>
        <h3 style={{ fontSize: 20 }}>Sistema de Gestão Clínica</h3>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Controle completo da operação
        </p>
      </div>

      <div
        style={{
          background: "#eff6ff",
          color: "#1d4ed8",
          padding: "10px 14px",
          borderRadius: 999,
          fontWeight: "bold",
        }}
      >
        Admin
      </div>
    </header>
  );
}