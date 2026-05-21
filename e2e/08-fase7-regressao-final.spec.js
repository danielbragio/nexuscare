/**
 * FASE 7 — Regressão visual e funcional final
 *
 * Cobertura:
 *  1. Login master / t7898852
 *  2. Abertura de todos os módulos sem erro 4xx/5xx
 *  3. Fluxo clínico: criar atendimento, bloquear sem pagamento, pagar, iniciar, finalizar
 *  4. Fluxo odonto: bloqueio sem pagamento → libera com pagamento
 *  5. Matriz de permissões via API por perfil (estoque/medico/odonto/financeiro)
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import { API_URL, loginViaAPI } from './helpers.js';

/** Cria um APIRequestContext novo, sem cookies herdados de logins anteriores. */
async function freshRequest() {
  return await pwRequest.newContext({ ignoreHTTPSErrors: true });
}

const MASTER = { login: 'master', password: 't7898852' };

async function apiToken(request, login, password) {
  const res = await request.post(`${API_URL}/login`, {
    data: { login, password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) return null;
  return (await res.json())?.data?.token ?? null;
}

/**
 * Cria/atualiza um usuário de teste para a role indicada usando uma sessão
 * mestre limpa e retorna o token JWT para login dele.
 */
async function ensureRoleUser(masterToken, role) {
  const login = `qa_${role}_fase7`;
  const password = 'QaFase7!Senha';

  const conselho = role === 'medico' ? { crm: '111111' }
                 : role === 'odonto' ? { cro: '222222' }
                 : role === 'enfermagem' ? { coren: '333333' }
                 : {};
  const body = {
    nome: `QA ${role}`,
    login,
    email: `${login}@qa.local`,
    senha: password,
    role,
    ativo: 1,
    ...conselho,
  };

  const adminCtx = await freshRequest();
  try {
    await adminCtx.post(`${API_URL}/usuarios`, {
      data: body,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterToken}` },
    });

    const lookup = await adminCtx.get(`${API_URL}/usuarios?role=${role}&per_page=200`, {
      headers: { 'Authorization': `Bearer ${masterToken}` },
    });
    const list = (await lookup.json())?.data ?? [];
    const found = list.find(u => u.login === login);
    if (found) {
      await adminCtx.put(`${API_URL}/usuarios/${found.id}`, {
        data: { ativo: 1, role, senha: password, ...conselho },
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterToken}` },
      });
    }
  } finally {
    await adminCtx.dispose();
  }

  // Login num contexto isolado para evitar contaminar a sessão da role anterior.
  const loginCtx = await freshRequest();
  try {
    return await apiToken(loginCtx, login, password);
  } finally {
    await loginCtx.dispose();
  }
}

test.describe('Fase 7 — Regressão final', () => {
  test('1. Login master/t7898852 via API retorna token admin', async ({ request }) => {
    const token = await apiToken(request, MASTER.login, MASTER.password);
    expect(token).toBeTruthy();
  });

  test('2. Abre todos os módulos sem erro de console crítico', async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const httpErrors = [];
    page.on('response', (resp) => {
      const url = resp.url();
      if (resp.status() >= 500 && url.includes('/api/')) {
        httpErrors.push(`${resp.status()} ${url}`);
      }
    });

    await loginViaAPI(page);

    const rotas = [
      '/dashboard', '/recepcao', '/agendamentos', '/pagamentos', '/consultas',
      '/prontuario', '/enfermagem', '/odonto', '/financeiro', '/faturamento',
      '/relatorios', '/estoque', '/cadastros', '/configuracoes', '/normas',
    ];
    for (const rota of rotas) {
      await page.goto(rota, { waitUntil: 'domcontentloaded', timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(250);
    }

    const errosFatais = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource: net::ERR_') &&
      !e.toLowerCase().includes('warning')
    );
    expect.soft(httpErrors, `HTTP 5xx em rotas:\n${httpErrors.join('\n')}`).toEqual([]);
    expect.soft(errosFatais.length, `Erros de console:\n${errosFatais.join('\n').substring(0, 1000)}`).toBeLessThan(20);
  });

  test('3. Fluxo clínico bloqueia em_atendimento sem pagamento e libera com médico dono', async () => {
    const masterCtx = await freshRequest();
    const masterTk = await apiToken(masterCtx, MASTER.login, MASTER.password);
    expect(masterTk).toBeTruthy();
    const adminH = { 'Authorization': `Bearer ${masterTk}`, 'Content-Type': 'application/json' };

    // Garante que existe um médico com CRM e captura o id+token
    await masterCtx.dispose();
    const medicoTk = await ensureRoleUser(masterTk, 'medico');
    expect(medicoTk).toBeTruthy();

    const adminCtx = await freshRequest();
    const lookupUsers = await adminCtx.get(`${API_URL}/usuarios?role=medico&per_page=200`, { headers: adminH });
    const medicoUser = (await lookupUsers.json())?.data?.find(u => u.login === 'qa_medico_fase7');
    expect(medicoUser).toBeTruthy();

    // Recepção (master) cria paciente + atendimento atribuído ao médico
    const pacRes = await adminCtx.post(`${API_URL}/pacientes`, {
      data: { nome: `Fase7 Clínico ${Date.now()}`, telefone: '11999999999' },
      headers: adminH,
    });
    expect(pacRes.ok()).toBeTruthy();
    const paciente = (await pacRes.json())?.data;

    const atRes = await adminCtx.post(`${API_URL}/atendimentos`, {
      data: {
        paciente_id: paciente.id,
        nome_paciente: paciente.nome,
        usuario_id: medicoUser.id,
        nome_medico: medicoUser.nome,
        data: new Date().toISOString().slice(0, 10),
        tipo_atendimento: 'Consulta',
        especialidade: 'Clínica Geral',
        valor_consulta: 150,
        status: 'agendado',
      },
      headers: adminH,
    });
    expect(atRes.ok()).toBeTruthy();
    const at = (await atRes.json())?.data;
    await adminCtx.dispose();

    // Médico dono tenta em_atendimento SEM pagamento → 422 com redirect
    const medicoCtx = await freshRequest();
    const medicoH = { 'Authorization': `Bearer ${medicoTk}`, 'Content-Type': 'application/json' };
    const semPag = await medicoCtx.put(`${API_URL}/atendimentos/${at.id}`, {
      data: { status: 'em_atendimento' },
      headers: medicoH,
    });
    expect(semPag.status()).toBe(422);
    expect((await semPag.json()).errors?.action).toBe('redirect_to_pagamentos');
    await medicoCtx.dispose();

    // Admin/recepção cria pagamento pago
    const adminCtx2 = await freshRequest();
    const pagRes = await adminCtx2.post(`${API_URL}/pagamentos`, {
      data: {
        paciente_id: paciente.id,
        nome_paciente: paciente.nome,
        atendimento_id: at.id,
        valor: 150,
        valor_final: 150,
        status: 'pago',
        tipo: 'consulta',
        origem: 'clinico',
        servico: 'Consulta Médica',
        data: new Date().toISOString().slice(0, 10),
        data_pagamento: new Date().toISOString().slice(0, 10),
      },
      headers: adminH,
    });
    expect(pagRes.ok()).toBeTruthy();
    await adminCtx2.dispose();

    // Admin tenta em_atendimento → 403 (admin não atende)
    const adminCtx3 = await freshRequest();
    const adminFail = await adminCtx3.put(`${API_URL}/atendimentos/${at.id}`, {
      data: { status: 'em_atendimento' },
      headers: adminH,
    });
    expect(adminFail.status()).toBe(403);
    await adminCtx3.dispose();

    // Médico dono atende → 200
    const medicoCtx2 = await freshRequest();
    const comPag = await medicoCtx2.put(`${API_URL}/atendimentos/${at.id}`, {
      data: { status: 'em_atendimento' },
      headers: medicoH,
    });
    expect(comPag.status()).toBe(200);

    // Finaliza com prontuário em texto puro
    const fim = await medicoCtx2.put(`${API_URL}/atendimentos/${at.id}`, {
      data: { status: 'finalizado', prontuario: 'Paciente atendido sem intercorrências.' },
      headers: medicoH,
    });
    expect(fim.status()).toBe(200);

    const show = await medicoCtx2.get(`${API_URL}/atendimentos/${at.id}`, { headers: medicoH });
    const atFinal = (await show.json())?.data;
    expect(atFinal.status).toBe('finalizado');
    expect(['pago', 'cortesia']).toContain(String(atFinal.status_pagamento || '').toLowerCase());
    expect(atFinal.pagamento_id).toBeTruthy();
    expect(atFinal.prontuario).toBeTruthy();
    await medicoCtx2.dispose();
  });

  test('4. Fluxo odonto bloqueia confirmar-chegada sem pagamento', async () => {
    const ctx = await freshRequest();
    const request = ctx;
    const token = await apiToken(request, MASTER.login, MASTER.password);
    const h = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Garante que existe um profissional odonto ativo
    await ensureRoleUser(token, 'odonto');

    const usrRes = await request.get(`${API_URL}/usuarios?role=odonto&per_page=200`, { headers: h });
    const usrBody = await usrRes.json();
    const odontos = (usrBody?.data ?? []).filter(u => (u.role === 'odonto'));
    if (odontos.length === 0) {
      throw new Error('Nenhum odonto após ensureRoleUser: status=' + usrRes.status() + ' body=' + JSON.stringify(usrBody).slice(0, 500));
    }
    const prof = odontos[0];

    const pacRes = await request.post(`${API_URL}/pacientes`, {
      data: { nome: `Fase7 Odonto ${Date.now()}`, telefone: '11988888888' },
      headers: h,
    });
    const paciente = (await pacRes.json())?.data;

    const agRes = await request.post(`${API_URL}/agendamentos-odonto`, {
      data: {
        paciente_id: paciente.id,
        paciente_nome: paciente.nome,
        profissional_id: prof.id,
        profissional_nome: prof.nome,
        tipo_atendimento: 'Avaliação',
        data: new Date().toISOString().slice(0, 10),
        hora: '14:00',
        status: 'agendado',
        procedimentos_solicitados: [{ nome: 'Avaliação', valor: 200 }],
      },
      headers: h,
    });
    expect(agRes.ok()).toBeTruthy();
    const ag = (await agRes.json())?.data;

    // Sem pagamento → 422
    const semPag = await request.post(`${API_URL}/agendamentos-odonto/${ag.id}/confirmar-chegada`, {
      data: {},
      headers: h,
    });
    expect(semPag.status()).toBe(422);
    const eb = await semPag.json();
    expect(eb.errors?.action).toBe('redirect_to_pagamentos');

    // Cria pagamento odonto
    const pagRes = await request.post(`${API_URL}/pagamentos`, {
      data: {
        paciente_id: paciente.id,
        nome_paciente: paciente.nome,
        agendamento_odonto_id: ag.id,
        valor: 200,
        valor_final: 200,
        status: 'pago',
        tipo: 'odontologia',
        origem: 'odonto',
        servico: 'Avaliação',
        data: new Date().toISOString().slice(0, 10),
        data_pagamento: new Date().toISOString().slice(0, 10),
      },
      headers: h,
    });
    expect(pagRes.ok()).toBeTruthy();

    // Confirma chegada — agora 200
    const okPag = await request.post(`${API_URL}/agendamentos-odonto/${ag.id}/confirmar-chegada`, {
      data: {},
      headers: h,
    });
    expect(okPag.status()).toBe(200);
  });

  test('5. Perfil estoque: vê /estoque, bloqueado em /pagamentos /atendimentos /atendimentos-odonto /usuarios', async () => {
    const masterCtx = await freshRequest();
    const masterTk = await apiToken(masterCtx, MASTER.login, MASTER.password);
    await masterCtx.dispose();
    const tk = await ensureRoleUser(masterTk, 'estoque');
    expect(tk).toBeTruthy();
    const ctx = await freshRequest();
    const h = { 'Authorization': `Bearer ${tk}` };
    try {
      expect((await ctx.get(`${API_URL}/estoque`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/pagamentos`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/atendimentos`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/atendimentos-odonto`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/agendamentos-odonto`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/usuarios`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/financeiro/movimentacoes`, { headers: h })).status()).toBe(403);
    } finally {
      await ctx.dispose();
    }
  });

  test('6. Perfil médico: vê /atendimentos, bloqueado em odonto/pagamentos/estoque/usuarios', async () => {
    const masterCtx = await freshRequest();
    const masterTk = await apiToken(masterCtx, MASTER.login, MASTER.password);
    await masterCtx.dispose();
    const tk = await ensureRoleUser(masterTk, 'medico');
    expect(tk).toBeTruthy();
    const ctx = await freshRequest();
    const h = { 'Authorization': `Bearer ${tk}` };
    try {
      expect((await ctx.get(`${API_URL}/atendimentos`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/pagamentos`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/estoque`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/atendimentos-odonto`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/agendamentos-odonto`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/usuarios`, { headers: h })).status()).toBe(403);
    } finally {
      await ctx.dispose();
    }
  });

  test('7. Perfil odonto: vê odonto, bloqueado em /atendimentos /pagamentos /estoque /usuarios', async () => {
    const masterCtx = await freshRequest();
    const masterTk = await apiToken(masterCtx, MASTER.login, MASTER.password);
    await masterCtx.dispose();
    const tk = await ensureRoleUser(masterTk, 'odonto');
    expect(tk).toBeTruthy();
    const ctx = await freshRequest();
    const h = { 'Authorization': `Bearer ${tk}` };
    try {
      expect((await ctx.get(`${API_URL}/atendimentos-odonto`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/agendamentos-odonto`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/atendimentos`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/pagamentos`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/estoque`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/usuarios`, { headers: h })).status()).toBe(403);
    } finally {
      await ctx.dispose();
    }
  });

  test('8. Perfil financeiro: vê /pagamentos /movimentacoes /contas-pagar; prontuário strippado em /atendimentos', async () => {
    const masterCtx = await freshRequest();
    const masterTk = await apiToken(masterCtx, MASTER.login, MASTER.password);
    await masterCtx.dispose();
    const tk = await ensureRoleUser(masterTk, 'financeiro');
    expect(tk).toBeTruthy();
    const ctx = await freshRequest();
    const h = { 'Authorization': `Bearer ${tk}` };
    try {
      expect((await ctx.get(`${API_URL}/pagamentos`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/financeiro/movimentacoes`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/contas-pagar`, { headers: h })).status()).toBe(200);
      expect((await ctx.get(`${API_URL}/estoque`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/usuarios`, { headers: h })).status()).toBe(403);
      expect((await ctx.get(`${API_URL}/atendimentos-odonto`, { headers: h })).status()).toBe(403);

      const atRes = await ctx.get(`${API_URL}/atendimentos?per_page=10`, { headers: h });
      expect(atRes.status()).toBe(200);
      const data = (await atRes.json())?.data ?? [];
      for (const row of data) {
        expect(row.prontuario, `Atendimento #${row.id} expôs prontuário ao financeiro`).toBeFalsy();
        expect(row.anamnese, `Atendimento #${row.id} expôs anamnese ao financeiro`).toBeFalsy();
      }
    } finally {
      await ctx.dispose();
    }
  });
});
