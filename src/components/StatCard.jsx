export default function StatCard({ title, value, info }) {
  return (
    <div className="card">
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: "bold", margin: "10px 0" }}>
        {value}
      </div>
      <div style={{ color: "#0ea5e9", fontSize: 13 }}>{info}</div>
    </div>
  );
}