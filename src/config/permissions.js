// ── Módulos da sidebar (chaves legadas — mantidas para compatibilidade) ────────
export const allModules = [
  { key: "dashboard",     label: "Painel" },
  { key: "pacientes",     label: "Pacientes" },
  { key: "pagamentos",    label: "Pagamentos" },
  { key: "agendamentos",  label: "Agendamentos" },
  { key: "medicos",       label: "Consulta" },
  { key: "enfermagem",    label: "Enfermagem" },
  { key: "odonto",        label: "Odonto" },
  { key: "faturamento",   label: "Faturamento" },
  { key: "financeiro",    label: "Financeiro" },
  { key: "administracao", label: "Administração" },
  { key: "normas",        label: "Normas" },
  { key: "prontuario",    label: "Prontuário" },
  { key: "estoque",       label: "Estoque" },
  { key: "relatorios",    label: "Relatórios" },
];

// ── Grupos granulares de permissão ────────────────────────────────────────────
export const PERMISSION_GROUPS = [
  {
    grupo: "Atendimento",
    permissoes: [
      { key: "recepcao",            label: "Recepção" },
      { key: "triagem",             label: "Triagem" },
      { key: "agendamentos",        label: "Agendamentos" },
      { key: "painel_atendimento",  label: "Painel de atendimento" },
    ],
  },
  {
    grupo: "Assistencial",
    permissoes: [
      { key: "consultas",   label: "Consultas" },
      { key: "medicos",     label: "Médico" },
      { key: "odonto",      label: "Odonto" },
      { key: "enfermagem",  label: "Enfermagem" },
      { key: "prontuario",  label: "Prontuário" },
    ],
  },
  {
    grupo: "Financeiro",
    permissoes: [
      { key: "resumo_financeiro",      label: "Resumo financeiro" },
      { key: "pagamentos",             label: "Pagamentos" },
      { key: "contas_receber",         label: "Contas a receber" },
      { key: "contas_pagar",           label: "Contas a pagar" },
      { key: "movimentacoes",          label: "Movimentações" },
      { key: "estoque",                label: "Estoque" },
      { key: "relatorios_financeiros", label: "Relatórios" },
    ],
  },
  {
    grupo: "Administração",
    permissoes: [
      { key: "usuarios",              label: "Usuários" },
      { key: "permissoes",            label: "Permissões" },
      { key: "especialidades_config", label: "Especialidades" },
      { key: "profissionais",         label: "Profissionais" },
      { key: "configuracoes",         label: "Configurações" },
    ],
  },
  {
    grupo: "Relatórios",
    permissoes: [
      { key: "relatorio_financeiro",    label: "Relatório financeiro" },
      { key: "relatorio_atendimentos",  label: "Relatório de atendimentos" },
      { key: "relatorio_pacientes",     label: "Relatório de pacientes" },
      { key: "exportar_pdf",            label: "Exportar PDF" },
      { key: "exportar_excel",          label: "Exportar Excel" },
    ],
  },
];

// ── Mapa: chave granular → views da sidebar ───────────────────────────────────
export const PERMISSION_VIEW_MAP = {
  // Atendimento
  recepcao:                ["pacientes", "agendamentos"],
  triagem:                 ["pacientes"],
  agendamentos:            ["agendamentos"],
  painel_atendimento:      ["agendamentos"],
  // Assistencial
  consultas:               ["medicos"],
  medicos:                 ["medicos"],
  odonto:                  ["odonto"],
  enfermagem:              ["enfermagem"],
  prontuario:              ["prontuario"],
  // Financeiro
  resumo_financeiro:       ["financeiro"],
  pagamentos:              ["pagamentos"],
  contas_receber:          ["financeiro"],
  contas_pagar:            ["financeiro"],
  movimentacoes:           ["financeiro"],
  estoque:                 ["estoque"],
  relatorios_financeiros:  ["relatorios"],
  // Administração → tudo aponta para Configurações
  usuarios:                ["configuracoes", "cadastros"],
  permissoes:              ["configuracoes", "cadastros"],
  especialidades_config:   ["configuracoes", "cadastros"],
  profissionais:           ["configuracoes", "cadastros"],
  configuracoes:           ["configuracoes", "cadastros"],
  // Relatórios
  relatorio_financeiro:    ["relatorios"],
  relatorio_atendimentos:  ["relatorios"],
  relatorio_pacientes:     ["relatorios"],
  exportar_pdf:            ["relatorios"],
  exportar_excel:          ["relatorios"],
  // Chaves legadas (passadas diretamente no JSON de permissions)
  dashboard:               ["dashboard"],
  pacientes:               ["pacientes"],
  pagamentos_view:         ["pagamentos"],
  financeiro:              ["financeiro"],
  faturamento:             ["faturamento"],
  relatorios:              ["relatorios"],
  administracao:           ["configuracoes", "cadastros"],
  normas:                  ["normas"],
  cadastros:               ["cadastros"],
};

// ── Permissões padrão por perfil base ─────────────────────────────────────────
export const rolePermissions = {
  admin: [
    "recepcao","triagem","agendamentos","painel_atendimento",
    "consultas","medicos","odonto","enfermagem","prontuario",
    "resumo_financeiro","pagamentos","contas_receber","contas_pagar","movimentacoes","estoque","relatorios_financeiros",
    "usuarios","permissoes","especialidades_config","profissionais","configuracoes",
    "relatorio_financeiro","relatorio_atendimentos","relatorio_pacientes","exportar_pdf","exportar_excel",
    // legadas
    "dashboard","pacientes","faturamento","normas","cadastros",
  ],
  recepcao:   ["recepcao","agendamentos","painel_atendimento","dashboard","pacientes","pagamentos"],
  medico:     ["consultas","medicos","prontuario","dashboard"],
  enfermagem: ["enfermagem","prontuario","dashboard"],
  odonto:     ["odonto","prontuario","dashboard"],
  financeiro: ["resumo_financeiro","pagamentos","contas_receber","contas_pagar","movimentacoes","relatorios_financeiros","relatorio_financeiro","exportar_pdf","exportar_excel","faturamento","dashboard"],
  estoque:    ["estoque","dashboard"],
};

// ── Funções de acesso ─────────────────────────────────────────────────────────

export function getAllowedViews(userData) {
  if (!userData) return [];

  let keys = [];

  if (Array.isArray(userData.permissions) && userData.permissions.length > 0) {
    keys = userData.permissions;
  } else if (userData.role && rolePermissions[userData.role]) {
    keys = rolePermissions[userData.role];
  }

  // dashboard sempre disponível
  const views = new Set(["dashboard"]);

  for (const key of keys) {
    const mapped = PERMISSION_VIEW_MAP[key];
    if (mapped) {
      mapped.forEach((v) => views.add(v));
    } else {
      // chave legada usada diretamente como view
      views.add(key);
    }
  }

  return Array.from(views);
}

export function hasPermission(userData, view) {
  return getAllowedViews(userData).includes(view);
}

// Retorna as chaves granulares padrão para um perfil
export function getDefaultPermissions(role) {
  return rolePermissions[role] || rolePermissions["recepcao"];
}
