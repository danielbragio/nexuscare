import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  HeartPulse,
  Smile,
  Receipt,
  Wallet,
  Shield,
  FileText,
  ClipboardPlus,
  Boxes,
  BarChart3,
  Video,
} from "lucide-react";

const menu = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { to: "/medicos", label: "Médicos", icon: Stethoscope },
  { to: "/enfermagem", label: "Enfermagem", icon: HeartPulse },
  { to: "/odonto", label: "Odonto", icon: Smile },
  { to: "/faturamento", label: "Faturamento", icon: Receipt },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/administracao", label: "Administração", icon: Shield },
  { to: "/normas", label: "Normas", icon: FileText },
  { to: "/prontuario", label: "Prontuário", icon: ClipboardPlus },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/telemedicina", label: "Telemedicina", icon: Video },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 260,
        background: "#0f172a",
        color: "#fff",
        padding: 20,
        borderRight: "1px solid #1e293b",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>🏥 HealthSystem</h2>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Painel administrativo</p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                background: isActive ? "#1e293b" : "transparent",
                color: "#fff",
              })}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}