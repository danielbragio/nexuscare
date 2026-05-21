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

test.describe('Estoque', () => {
  let itemId = null;

  test('API lista itens do estoque', async ({ request }) => {
    const res = await request.get(`${API_URL}/estoque`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API cria item no estoque', async ({ request }) => {
    const res = await request.post(`${API_URL}/estoque`, {
      data: {
        nome:        'Item E2E Teste',
        categoria:   'Medicamento',
        unidade:     'un',
        quantidade:  100,
        minimo:      10,
      },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    itemId = body.data?.id;
    expect(itemId).toBeTruthy();
    expect(body.data.nome).toBe('Item E2E Teste');
  });

  test('API atualiza item do estoque', async ({ request }) => {
    if (!itemId) test.skip();
    const res = await request.put(`${API_URL}/estoque/${itemId}`, {
      data: { quantidade: 90, minimo: 15 },
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Number(body.data?.quantidade)).toBe(90);
  });

  test('API lista movimentações de estoque', async ({ request }) => {
    const res = await request.get(`${API_URL}/estoque/movimentacoes`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    if (itemId) {
      await request.delete(`${API_URL}/estoque/${itemId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  });
});
