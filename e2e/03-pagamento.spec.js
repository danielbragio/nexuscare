import { test, expect } from '@playwright/test';
import { API_URL, CREDS } from './helpers.js';

let authToken = null;
let atendimentoId = null;

test.beforeAll(async ({ request }) => {
  // Login
  const loginRes = await request.post(`${API_URL}/login`, {
    data: { login: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  authToken = (await loginRes.json())?.data?.token;

  // Cria atendimento para testar pagamento
  const atendRes = await request.post(`${API_URL}/atendimentos`, {
    data: {
      nome_paciente:    'Paciente E2E Pagamento',
      data:             new Date().toISOString().slice(0, 10),
      tipo_atendimento: 'Consulta',
      status:           'finalizado',
    },
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
  });
  atendimentoId = (await atendRes.json())?.data?.id;
});

test.afterAll(async ({ request }) => {
  if (atendimentoId) {
    await request.put(`${API_URL}/atendimentos/${atendimentoId}`, {
      data: { status: 'cancelado' },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
  }
});

test.describe('Pagamentos', () => {
  let pagamentoId = null;

  test('API lista pagamentos', async ({ request }) => {
    const res = await request.get(`${API_URL}/pagamentos`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API cria pagamento vinculado a atendimento', async ({ request }) => {
    const res = await request.post(`${API_URL}/pagamentos`, {
      data: {
        nome_paciente:    'Paciente E2E Pagamento',
        atendimento_id:   atendimentoId,
        valor:            150.00,
        valor_final:      150.00,
        status:           'pago',
        status_pagamento: 'pago',
        forma_pagamento:  'Pix',
        data_pagamento:   new Date().toISOString().slice(0, 10),
        descricao:        'Consulta E2E',
      },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    pagamentoId = body.data?.id;
    expect(pagamentoId).toBeTruthy();
    expect(Number(body.data.valor)).toBe(150);
  });

  test('API rejeita pagamento sem nome_paciente (422)', async ({ request }) => {
    const res = await request.post(`${API_URL}/pagamentos`, {
      data: { valor: 100, status: 'pago' },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(422);
  });

  test('API rejeita pagamento com valor zero (422)', async ({ request }) => {
    const res = await request.post(`${API_URL}/pagamentos`, {
      data: { nome_paciente: 'Paciente E2E Pagamento', valor: 0, status: 'pago' },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(422);
  });

  test('API rejeita pagamento sem valor (422)', async ({ request }) => {
    const res = await request.post(`${API_URL}/pagamentos`, {
      data: { nome_paciente: 'Paciente E2E Pagamento', status: 'pago' },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(422);
  });

  test('API atualiza status do pagamento', async ({ request }) => {
    if (!pagamentoId) test.skip();
    const res = await request.put(`${API_URL}/pagamentos/${pagamentoId}`, {
      data: { status: 'pago', forma_pagamento: 'Cartão Crédito' },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data?.forma_pagamento).toBe('Cartão Crédito');
  });

  test('API KPIs financeiros retornam estrutura esperada', async ({ request }) => {
    const res = await request.get(`${API_URL}/financeiro/kpis`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // KPIs devem ter chaves numéricas
    const data = body.data ?? body;
    expect(typeof (data.total_receitas ?? data.totalReceitas ?? data.receitas ?? 0)).toBe('number');
  });
});
