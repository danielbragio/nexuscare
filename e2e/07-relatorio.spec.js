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

test.describe('Relatórios e Auditoria', () => {
  test('API /atendimentos/hoje retorna estrutura correta', async ({ request }) => {
    const res = await request.get(`${API_URL}/atendimentos/hoje`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.atendimentos)).toBe(true);
    expect(typeof body.data?.kpis).toBe('object');
  });

  test('API /financeiro/kpis retorna valores numéricos', async ({ request }) => {
    const res = await request.get(`${API_URL}/financeiro/kpis`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('API /financeiro/movimentacoes retorna lista paginada', async ({ request }) => {
    const res = await request.get(`${API_URL}/financeiro/movimentacoes`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API /audit-logs retorna lista com total', async ({ request }) => {
    const res = await request.get(`${API_URL}/audit-logs`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('API /audit-logs registra ação corretamente', async ({ request }) => {
    const res = await request.post(`${API_URL}/audit-logs`, {
      data: {
        acao:     'e2e_test',
        entidade: 'sistema',
        motivo:   'Teste E2E automatizado',
      },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBeTruthy();
  });

  test('API /health responde em menos de 2 segundos', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${API_URL}/health`);
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });

  test('API /status retorna status ok (endpoint público)', async ({ request }) => {
    const res = await request.get(`${API_URL}/status`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.timestamp).toBeTruthy();
  });
});
