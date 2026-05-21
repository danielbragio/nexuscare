import { test, expect } from '@playwright/test';
import { API_URL, CREDS } from './helpers.js';

let authToken = null;

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API_URL}/login`, {
    data: { login: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  authToken = (await res.json())?.data?.token;
});

test.describe('Odontologia', () => {
  let agendamentoId = null;

  test('API lista agendamentos odonto', async ({ request }) => {
    const res = await request.get(`${API_URL}/agendamentos-odonto`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API cria agendamento odonto', async ({ request }) => {
    const res = await request.post(`${API_URL}/agendamentos-odonto`, {
      data: {
        paciente_nome:    'Paciente E2E Odonto',
        data:             new Date().toISOString().slice(0, 10),
        hora:             '10:00',
        tipo_atendimento: 'Avaliação',
        status:           'agendado',
      },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    agendamentoId = body.data?.id;
    expect(agendamentoId).toBeTruthy();
  });

  test('API atualiza status do agendamento odonto', async ({ request }) => {
    if (!agendamentoId) test.skip();
    const res = await request.put(`${API_URL}/agendamentos-odonto/${agendamentoId}`, {
      data: { status: 'confirmado' },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data?.status).toBe('confirmado');
  });

  test('API lista procedimentos odonto', async ({ request }) => {
    const res = await request.get(`${API_URL}/procedimentos-odonto`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API lista atendimentos odonto', async ({ request }) => {
    const res = await request.get(`${API_URL}/atendimentos-odonto`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    if (agendamentoId) {
      await request.delete(`${API_URL}/agendamentos-odonto/${agendamentoId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  });
});
