/**
 * NexusCare — Camada de serviço para o backend PHP
 * Centraliza todas as chamadas HTTP para a API MySQL.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost/nexuscare-api/api';
const TOKEN_KEY = 'nexuscare_token';

export const tokenStorage = {
  get:    ()      => localStorage.getItem(TOKEN_KEY),
  set:    (token) => localStorage.setItem(TOKEN_KEY, token),
  remove: ()      => localStorage.removeItem(TOKEN_KEY),
};

// ── Normalização de campos (snake_case → camelCase) ────────────────────────

export function normalizePaciente(p) {
  if (!p) return null;
  return {
    id:                  p.id,
    firebase_id:         p.firebase_id || '',
    nome:                p.nome || '',
    cpf:                 p.cpf || '',
    rg:                  p.rg || '',
    dataNascimento:      p.data_nascimento || p.dataNascimento || '',
    sexo:                p.sexo || '',
    telefone:            p.telefone || '',
    telefoneEmergencia:  p.telefone_emergencia || p.telefoneEmergencia || '',
    email:               p.email || '',
    endereco:            p.endereco || '',
    rua:                 p.endereco || '',
    numero:              p.numero || '',
    complemento:         p.complemento || '',
    bairro:              p.bairro || '',
    cidade:              p.cidade || '',
    estado:              p.estado || '',
    cep:                 p.cep || '',
    planoSaude:          p.plano_saude || p.planoSaude || '',
    convenio:            p.plano_saude || p.convenio || 'Particular',
    numeroCarteirinha:   p.numero_carteirinha || p.numeroCarteirinha || '',
    tipoSanguineo:       p.tipo_sanguineo || p.tipoSanguineo || '',
    alergias:            p.alergias || '',
    observacoes:         p.observacoes || '',
    ativo:               p.ativo ?? 1,
    status:              (p.ativo ?? 1) ? 'Ativo' : 'Inativo',
    createdAt:           p.created_at ? { seconds: Math.floor(new Date(p.created_at).getTime() / 1000) } : null,
    updatedAt:           p.updated_at || '',
  };
}

export function normalizePagamento(p) {
  if (!p) return null;
  // atendimentoId: usa atendimento_id (MySQL) ou atendimento_odonto_id (Firebase ref transitional)
  const atendimentoId = p.atendimento_id
    ? String(p.atendimento_id)
    : (p.atendimento_odonto_id || p.atendimentoId || '');

  return {
    id:                    p.id,
    firebase_id:           p.firebase_id || '',
    pacienteId:            p.paciente_id || p.pacienteId || '',
    nomePaciente:          p.nome_paciente || p.nomePaciente || p.paciente || '',
    paciente:              p.nome_paciente || p.nomePaciente || p.paciente || '',
    atendimentoId,
    atendimento_id:        p.atendimento_id || null,
    atendimento_odonto_id: p.atendimento_odonto_id || '',
    descricao:             p.descricao || '',
    tipoAtendimento:       p.descricao || p.tipoAtendimento || '',
    servico:               p.servico || '',
    valor:                 Number(p.valor || 0),
    desconto:              Number(p.desconto || 0),
    valorFinal:            Number(p.valor_final || p.valorFinal || p.valor || 0),
    status:                p.status || '',
    statusPagamento:       p.status_pagamento || p.statusPagamento || p.status || '',
    formaPagamento:        p.forma_pagamento || p.formaPagamento || '',
    tipo:                  p.tipo || '',
    origem:                p.origem || '',
    profissional:          p.profissional || '',
    data:                  p.data || '',
    dataPagamento:         p.data_pagamento || p.dataPagamento || '',
    observacoes:           p.observacoes || '',
    createdAt:             p.created_at ? { seconds: Math.floor(new Date(p.created_at).getTime() / 1000) } : null,
    updatedAt:             p.updated_at || '',
  };
}

export function normalizeAgendamentoOdonto(a) {
  if (!a) return null;
  let procedimentos = a.procedimentos_solicitados;
  if (typeof procedimentos === 'string') {
    try { procedimentos = JSON.parse(procedimentos); } catch { procedimentos = []; }
  }
  return {
    id:                      a.id,
    firebase_id:             a.firebase_id || '',
    pacienteId:              a.paciente_id || '',
    pacienteNome:            a.paciente_nome || '',
    profissionalId:          a.profissional_id || '',
    profissionalNome:        a.profissional_nome || '',
    data:                    a.data || '',
    hora:                    a.hora || '',
    tipoAtendimento:         a.tipo_atendimento || '',
    status:                  a.status || 'agendado',
    observacoes:             a.observacoes || '',
    pagamentoId:             a.pagamento_id ? String(a.pagamento_id) : '',
    procedimentosSolicitados: Array.isArray(procedimentos) ? procedimentos : [],
    createdAt:               a.created_at ? { seconds: Math.floor(new Date(a.created_at).getTime() / 1000) } : null,
  };
}

export function normalizeAtendimentoOdonto(a) {
  if (!a) return null;
  const parseJson = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
    return v || [];
  };
  const parseJsonObj = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return null;
  };
  return {
    id:                       a.id,
    firebase_id:              a.firebase_id || '',
    agendamentoId:            a.agendamento_id || null,
    pacienteId:               a.paciente_id || '',
    pacienteNome:             a.paciente_nome || '',
    profissionalId:           a.profissional_id || '',
    profissionalNome:         a.profissional_nome || '',
    tipoAtendimento:          a.tipo_atendimento || '',
    status:                   a.status || 'aguardando',
    statusPagamento:          a.status_pagamento || '',
    anamnese:                 parseJsonObj(a.anamnese),
    procedimentosSolicitados: parseJson(a.procedimentos_solicitados),
    procedimentosRealizados:  parseJson(a.procedimentos_realizados),
    observacoesRecepcao:      a.observacoes_recepcao || '',
    observacoesAtendimento:   a.observacoes_atendimento || '',
    total:                    Number(a.total || 0),
    desconto:                 Number(a.desconto || 0),
    valorFinal:               Number(a.valor_final || 0),
    formaPagamento:           a.forma_pagamento || '',
    pagamentoId:              a.pagamento_id ? String(a.pagamento_id) : '',
    financeiro:               parseJsonObj(a.financeiro),
    data:                     a.data || '',
    hora:                     a.hora || '',
    finalizadoEm:             a.finalizado_em || null,
    createdAt:                a.created_at ? { seconds: Math.floor(new Date(a.created_at).getTime() / 1000) } : null,
  };
}

export function normalizeUsuario(u) {
  if (!u) return null;
  const parseArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
    return [];
  };
  let permissions = u.permissions;
  if (typeof permissions === 'string') { try { permissions = JSON.parse(permissions); } catch { permissions = []; } }
  if (!Array.isArray(permissions)) permissions = [];
  return {
    id:                 u.id,
    firebase_uid:       u.firebase_uid || '',
    // login — alias triplo para retrocompatibilidade
    login:              u.login || '',
    username:           u.login || '',
    usuario:            u.login || '',
    nome:               u.nome || '',
    email:              u.email || '',
    role:               u.role || 'recepcao',
    cargo:              u.cargo || '',
    perfil_base:        u.perfil_base || u.role || 'recepcao',
    permissions,
    crm:                u.crm || '',
    coren:              u.coren || '',
    especialidade:      u.especialidade || '',
    especialidades:     parseArr(u.especialidades),
    telefone:           u.telefone || '',
    ativo:              u.ativo != null ? Boolean(Number(u.ativo)) : true,
    atende_pacientes:   Boolean(Number(u.atende_pacientes || 0)),
    exige_consultorio:  Boolean(Number(u.exige_consultorio || 0)),
    photoURL:           u.photo_url || u.photoURL || '',
    photo_url:          u.photo_url || u.photoURL || '',
    // agenda
    diasAtendimento:    parseArr(u.dias_atendimento),
    horarios:           parseArr(u.horarios),
    horaInicio:         u.hora_inicio || '',
    horaFim:            u.hora_fim || '',
    intervalo:          Number(u.intervalo_minutos || 30),
    intervalo_minutos:  Number(u.intervalo_minutos || 30),
    pausaInicio:        u.pausa_inicio || '',
    pausaFim:           u.pausa_fim || '',
    createdAt:          u.created_at ? { seconds: Math.floor(new Date(u.created_at).getTime() / 1000) } : null,
    updatedAt:          u.updated_at || '',
  };
}

export function normalizeAtendimento(a) {
  if (!a) return null;
  const parseJson = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return null;
  };
  return {
    id:                       a.id,
    firebase_id:              a.firebase_id || '',
    paciente:                 a.nome_paciente || a.paciente || '',
    nomePaciente:             a.nome_paciente || a.nomePaciente || '',
    pacienteId:               a.paciente_id || '',
    medico:                   a.nome_medico || a.medico || '',
    nomeMedico:               a.nome_medico || a.nomeMedico || '',
    usuarioId:                a.usuario_id || null,
    profissionalId:           a.profissional_firebase_id || a.profissionalId || '',
    profissionalFirebaseId:   a.profissional_firebase_id || '',
    consultorioId:            a.consultorio_id || '',
    data:                     a.data || '',
    hora:                     a.hora || '',
    tipoAtendimento:          a.tipo_atendimento || a.tipoAtendimento || '',
    especialidade:            a.especialidade || '',
    status:                   a.status || 'agendado',
    observacoes:              a.observacoes || '',
    prontuario:               parseJson(a.prontuario),
    anamnese:                 parseJson(a.anamnese),
    prescricao:               a.prescricao || '',
    cid:                      a.cid || '',
    peso:                     a.peso != null ? Number(a.peso) : '',
    altura:                   a.altura != null ? Number(a.altura) : '',
    pa:                       a.pa || '',
    temp:                     a.temp != null ? Number(a.temp) : '',
    saturacao:                a.saturacao != null ? Number(a.saturacao) : '',
    pagamentoId:              a.pagamento_id ? String(a.pagamento_id) : '',
    finalizadoEm:             a.finalizado_em || null,
    createdAt:                a.created_at ? { seconds: Math.floor(new Date(a.created_at).getTime() / 1000) } : null,
  };
}

export function normalizeContaPagar(c) {
  if (!c) return null;
  const parseJson = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
    return v || [];
  };
  return {
    id:                    c.id,
    firebase_id:           c.firebase_id || '',
    fornecedor:            c.fornecedor || '',
    cnpjFornecedor:        c.cnpj_fornecedor || '',
    dataEmissao:           c.data_emissao || '',
    numeroNotaFiscal:      c.numero_nota_fiscal || '',
    tipoDocumento:         c.tipo_documento || 'Nota Fiscal',
    mesCompetencia:        c.mes_competencia || '',
    anoCompetencia:        c.ano_competencia || '',
    dataVencimento:        c.data_vencimento || '',
    previsaoPagamento:     c.previsao_pagamento || '',
    dataPagamento:         c.data_pagamento || '',
    tipoPagamento:         c.tipo_pagamento || 'Boleto',
    codigoBarrasBoleto:    c.codigo_barras_boleto || '',
    valorBruto:            Number(c.valor_bruto || 0),
    valorImpostosRetidos:  Number(c.valor_impostos_retidos || 0),
    valorLiquidoPagar:     Number(c.valor_liquido_pagar || 0),
    valorDesconto:         Number(c.valor_desconto || 0),
    valorJuros:            Number(c.valor_juros || 0),
    valorMulta:            Number(c.valor_multa || 0),
    valorPago:             Number(c.valor_pago || 0),
    valorPendente:         Number(c.valor_pendente || 0),
    status:                c.status || 'Pendente',
    categoria:             c.categoria || '',
    observacoes:           c.observacoes || '',
    usuarioInclusao:       c.usuario_inclusao || '',
    impostos:              parseJson(c.impostos),
    criadoEm:              c.created_at ? { seconds: Math.floor(new Date(c.created_at).getTime() / 1000) } : null,
    atualizadoEm:          c.updated_at || '',
  };
}

export function normalizeFornecedor(f) {
  if (!f) return null;
  return {
    id:          f.id,
    firebase_id: f.firebase_id || '',
    nome:        f.nome || '',
    cnpj:        f.cnpj || '',
    telefone:    f.telefone || '',
    email:       f.email || '',
    categoria:   f.categoria || '',
    contato:     f.contato || '',
    endereco:    f.endereco || '',
    observacoes: f.observacoes || '',
    ativo:       f.ativo ?? 1,
  };
}

export function normalizeProcedimentoOdonto(p) {
  if (!p) return null;
  return {
    id:            p.id,
    nome:          p.nome || '',
    categoria:     p.categoria || '',
    valor:         Number(p.valor || 0),
    tempoEstimado: p.tempo_estimado ? Number(p.tempo_estimado) : 0,
    status:        p.status || 'ativo',
  };
}

// ── Cliente HTTP base ──────────────────────────────────────────────────────

async function request(method, path, body = null, options = {}) {
  const token = tokenStorage.get();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = { method: method.toUpperCase(), headers };

  if (body !== null && !['GET', 'HEAD'].includes(config.method)) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, config);

    if (response.status === 401) {
      tokenStorage.remove();
      window.dispatchEvent(new CustomEvent('nexuscare:unauthorized'));
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(data?.message || `Erro HTTP ${response.status}`);
      error.status = response.status;
      error.data   = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) throw err;
    const netError = new Error('Não foi possível conectar ao servidor.');
    netError.isNetworkError = true;
    throw netError;
  }
}

// ── Upload multipart (para anexos) ────────────────────────────────────────

export async function uploadAnexo(formData) {
  const token = tokenStorage.get();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE}/anexos-financeiros`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || `Erro HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// ── API pública ────────────────────────────────────────────────────────────

const api = {
  get:    (path, params) => request('GET',    buildUrl(path, params)),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),

  // ── Auth ──────────────────────────────────────────────────────────────
  auth: {
    /** Login direto no MySQL — aceita login ou e-mail como identifier. */
    login: async (identifier, password) => {
      const res = await api.post('/login', { login: identifier, password });
      if (res?.data?.token) tokenStorage.set(res.data.token);
      return { ...res, data: { ...res.data, user: normalizeUsuario(res.data?.user) } };
    },
    logout: async () => {
      try { await api.post('/logout'); } finally { tokenStorage.remove(); }
    },
    me: () => api.get('/me').then(r => ({ ...r, data: normalizeUsuario(r?.data) })),

    /** Sincroniza usuário Firebase → MySQL (mantido para legado). */
    syncFirebase: async ({ uid, email, nome, displayName, role }) => {
      const res = await api.post('/auth/firebase-sync', {
        uid, email, nome: nome || displayName || '', role: role || 'recepcao',
      });
      if (res?.data?.token) tokenStorage.set(res.data.token);
      return res;
    },

    lookupEmail: (login) => api.get('/auth/lookup-email', { login }),
  },

  // ── Pacientes ─────────────────────────────────────────────────────────
  pacientes: {
    listar:    (params)       => api.get('/pacientes', params)
                                    .then(r => ({ ...r, data: (r?.data || []).map(normalizePaciente) })),
    buscar:    (q)            => api.get('/pacientes', { q })
                                    .then(r => ({ ...r, data: (r?.data || []).map(normalizePaciente) })),
    obter:     (id)           => api.get(`/pacientes/${id}`)
                                    .then(r => ({ ...r, data: normalizePaciente(r?.data) })),
    criar:     (dados)        => api.post('/pacientes', dados)
                                    .then(r => ({ ...r, data: normalizePaciente(r?.data) })),
    atualizar: (id, dados)    => api.put(`/pacientes/${id}`, dados)
                                    .then(r => ({ ...r, data: normalizePaciente(r?.data) })),
    excluir:   (id)           => api.delete(`/pacientes/${id}`),
  },

  // ── Atendimentos (médico) ─────────────────────────────────────────────
  atendimentos: {
    listar:    (params)       => api.get('/atendimentos', params)
                                    .then(r => ({ ...r, data: (r?.data || []).map(normalizeAtendimento) })),
    hoje:      ()             => api.get('/atendimentos/hoje'),
    obter:     (id)           => api.get(`/atendimentos/${id}`)
                                    .then(r => ({ ...r, data: normalizeAtendimento(r?.data) })),
    criar:     (dados)        => api.post('/atendimentos', dados)
                                    .then(r => ({ ...r, data: normalizeAtendimento(r?.data) })),
    atualizar: (id, dados)    => api.put(`/atendimentos/${id}`, dados)
                                    .then(r => ({ ...r, data: normalizeAtendimento(r?.data) })),
  },

  // ── Agendamentos Odonto ───────────────────────────────────────────────
  agendamentosOdonto: {
    listar:    (params)       => api.get('/agendamentos-odonto', params)
                                    .then(r => ({ ...r, data: (r?.data || []).map(normalizeAgendamentoOdonto) })),
    obter:     (id)           => api.get(`/agendamentos-odonto/${id}`)
                                    .then(r => ({ ...r, data: normalizeAgendamentoOdonto(r?.data) })),
    criar:     (dados)        => api.post('/agendamentos-odonto', dados)
                                    .then(r => ({ ...r, data: normalizeAgendamentoOdonto(r?.data) })),
    atualizar: (id, dados)    => api.put(`/agendamentos-odonto/${id}`, dados)
                                    .then(r => ({ ...r, data: normalizeAgendamentoOdonto(r?.data) })),
    excluir:   (id)           => api.delete(`/agendamentos-odonto/${id}`),
  },

  // ── Atendimentos Odonto (clínico) ────────────────────────────────────────
  atendimentosOdonto: {
    listar:    (params)    => api.get('/atendimentos-odonto', params)
                                 .then(r => ({ ...r, data: (r?.data || []).map(normalizeAtendimentoOdonto) })),
    obter:     (id)        => api.get(`/atendimentos-odonto/${id}`)
                                 .then(r => ({ ...r, data: normalizeAtendimentoOdonto(r?.data) })),
    criar:     (dados)     => api.post('/atendimentos-odonto', dados)
                                 .then(r => ({ ...r, data: normalizeAtendimentoOdonto(r?.data) })),
    atualizar: (id, dados) => api.put(`/atendimentos-odonto/${id}`, dados)
                                 .then(r => ({ ...r, data: normalizeAtendimentoOdonto(r?.data) })),
    excluir:   (id)        => api.delete(`/atendimentos-odonto/${id}`),
  },

  // ── Procedimentos Odonto ──────────────────────────────────────────────────
  procedimentosOdonto: {
    listar:    (params)    => api.get('/procedimentos-odonto', params)
                                 .then(r => ({ ...r, data: (r?.data || []).map(normalizeProcedimentoOdonto) })),
    criar:     (dados)     => api.post('/procedimentos-odonto', dados)
                                 .then(r => ({ ...r, data: normalizeProcedimentoOdonto(r?.data) })),
    atualizar: (id, dados) => api.put(`/procedimentos-odonto/${id}`, dados)
                                 .then(r => ({ ...r, data: normalizeProcedimentoOdonto(r?.data) })),
    excluir:   (id)        => api.delete(`/procedimentos-odonto/${id}`),
    seed:      ()          => api.post('/procedimentos-odonto/seed', {}),
  },

  // ── Pagamentos ────────────────────────────────────────────────────────
  pagamentos: {
    listar:    (params)       => api.get('/pagamentos', params)
                                    .then(r => ({ ...r, data: (r?.data || []).map(normalizePagamento) })),
    criar:     (dados)        => api.post('/pagamentos', dados)
                                    .then(r => ({ ...r, data: normalizePagamento(r?.data) })),
    atualizar: (id, dados)    => api.put(`/pagamentos/${id}`, dados)
                                    .then(r => ({ ...r, data: normalizePagamento(r?.data) })),
  },

  // ── Financeiro ────────────────────────────────────────────────────────
  financeiro: {
    kpis:         (params)    => api.get('/financeiro/kpis', params),
    movimentacoes:(params)    => api.get('/financeiro/movimentacoes', params),
    criarMov:     (dados)     => api.post('/financeiro/movimentacoes', dados),
    atualizarMov: (id, dados) => api.put(`/financeiro/movimentacoes/${id}`, dados),
  },

  // ── Contas a Pagar ────────────────────────────────────────────────────
  contasPagar: {
    listar:    (params)    => api.get('/contas-pagar', params)
                                 .then(r => ({ ...r, data: (r?.data || []).map(normalizeContaPagar) })),
    criar:     (dados)     => api.post('/contas-pagar', dados)
                                 .then(r => ({ ...r, data: normalizeContaPagar(r?.data) })),
    atualizar: (id, dados) => api.put(`/contas-pagar/${id}`, dados)
                                 .then(r => ({ ...r, data: normalizeContaPagar(r?.data) })),
    excluir:   (id)        => api.delete(`/contas-pagar/${id}`),
  },

  // ── Fornecedores ──────────────────────────────────────────────────────
  fornecedores: {
    listar:    (params)    => api.get('/fornecedores', params)
                                 .then(r => ({ ...r, data: (r?.data || []).map(normalizeFornecedor) })),
    criar:     (dados)     => api.post('/fornecedores', dados)
                                 .then(r => ({ ...r, data: normalizeFornecedor(r?.data) })),
    atualizar: (id, dados) => api.put(`/fornecedores/${id}`, dados)
                                 .then(r => ({ ...r, data: normalizeFornecedor(r?.data) })),
    excluir:   (id)        => api.delete(`/fornecedores/${id}`),
  },

  // ── Consultorios ──────────────────────────────────────────────────────
  consultorios: {
    listar:  ()           => api.get('/consultorios'),
    ocupar:  (dados)      => api.post('/consultorios', dados),
    liberar: (usuarioId)  => api.delete(`/consultorios/${usuarioId}`),
  },

  // ── Estoque ───────────────────────────────────────────────────────────
  estoque: {
    listar:             ()           => api.get('/estoque'),
    criar:              (dados)      => api.post('/estoque', dados),
    atualizar:          (id, dados)  => api.put(`/estoque/${id}`, dados),
    excluir:            (id)         => api.delete(`/estoque/${id}`),
    listarMovimentacoes:()           => api.get('/estoque/movimentacoes'),
    registrarMovimentacao: (dados)   => api.post('/estoque/movimentacoes', dados),
  },

  // ── Histórico Financeiro ──────────────────────────────────────────────
  historicoFinanceiro: {
    listar: (params) => api.get('/historico-financeiro', params),
    criar:  (dados)  => api.post('/historico-financeiro', dados),
  },

  // ── Anexos Financeiros ────────────────────────────────────────────────
  anexosFinanceiros: {
    listar:  (params) => api.get('/anexos-financeiros', params),
    excluir: (id)     => api.delete(`/anexos-financeiros/${id}`),
  },

  // ── Usuários ──────────────────────────────────────────────────────────
  usuarios: {
    listar:    (params)       => api.get('/usuarios', params)
                                    .then(r => ({ ...r, data: (r?.data || []).map(normalizeUsuario) })),
    obter:     (id)           => api.get(`/usuarios/${id}`)
                                    .then(r => ({ ...r, data: normalizeUsuario(r?.data) })),
    criar:     (dados)        => api.post('/usuarios', dados)
                                    .then(r => ({ ...r, data: normalizeUsuario(r?.data) })),
    atualizar: (id, dados)    => api.put(`/usuarios/${id}`, dados)
                                    .then(r => ({ ...r, data: normalizeUsuario(r?.data) })),
    excluir:   (id)           => api.delete(`/usuarios/${id}`),
  },

  health: () => api.get('/health'),
  status: () => api.get('/status'),
};

export default api;

function buildUrl(path, params) {
  if (!params || Object.keys(params).length === 0) return path;
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString();
  return qs ? `${path}?${qs}` : path;
}
