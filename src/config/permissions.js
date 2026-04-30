export const allModules = [
  { key: "dashboard", label: "Painel" },
  { key: "pacientes", label: "Pacientes" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "agendamentos", label: "Agendamentos" },
  { key: "medicos", label: "Médicos" },
  { key: "enfermagem", label: "Enfermagem" },
  { key: "odonto", label: "Odonto" },
  { key: "faturamento", label: "Faturamento" },
  { key: "financeiro", label: "Financeiro" },
  { key: "administracao", label: "Administração" },
  { key: "normas", label: "Normas" },
  { key: "prontuario", label: "Prontuário" },
  { key: "estoque", label: "Estoque" },
  { key: "relatorios", label: "Relatórios" },
  { key: "telemedicina", label: "Telemedicina" },
];

export const rolePermissions = {
  admin: allModules.map((item) => item.key),
  recepcao: ["dashboard", "pacientes", "pagamentos", "agendamentos"],
  medico: ["dashboard", "medicos", "prontuario"],
  enfermagem: ["dashboard", "enfermagem", "prontuario"],
  odonto: ["dashboard", "odonto", "prontuario"],
  financeiro: ["dashboard", "pagamentos", "financeiro", "faturamento", "relatorios"],
  estoque: ["dashboard", "estoque"],
  telemedicina: ["dashboard", "telemedicina"],
};

export function getAllowedViews(userData) {
  if (!userData) return [];

  if (Array.isArray(userData.permissions) && userData.permissions.length > 0) {
    return userData.permissions;
  }

  if (userData.role && rolePermissions[userData.role]) {
    return rolePermissions[userData.role];
  }

  return [];
}

export function hasPermission(userData, view) {
  const allowed = getAllowedViews(userData);
  return allowed.includes(view);
}