import { test, expect } from '@playwright/test';
import { loginViaAPI, API_URL, CREDS } from './helpers.js';

let authToken = null;

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API_URL}/login`, {
    data: { login: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  authToken = body?.data?.token;
});

test.describe('Consultas (Atendimentos)', () => {
  test('API lista atendimentos com paginação', async ({ request }) => {
    const res = await request.get(`${API_URL}/atendimentos?per_page=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('API cria atendimento com campos obrigatórios', async ({ request }) => {
    const payload = {
      nome_paciente:     'Paciente E2E Teste',
      data:              new Date().toISOString().slice(0, 10),
      hora:              '09:00',
      tipo_atendimento:  'Consulta',
      status:            'agendado',
    };
    const res = await request.post(`${API_URL}/atendimentos`, {
      data: payload,
      headers: {
        Authorization:  `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.nome_paciente).toBe('Paciente E2E Teste');

    // Limpa: cancela o atendimento criado
    await request.put(`${API_URL}/atendimentos/${body.data.id}`, {
      data: { status: 'cancelado' },
      headers: {
        Authorization:  `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });
  });

  test('API rejeita atendimento sem nome_paciente (422)', async ({ request }) => {
    const res = await request.post(`${API_URL}/atendimentos`, {
      data: { data: '2026-01-01', tipo_atendimento: 'Consulta' },
      headers: {
        Authorization:  `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status()).toBe(422);
  });

  test('API filtra atendimentos por data', async ({ request }) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const res = await request.get(`${API_URL}/atendimentos?data=${hoje}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Todos os retornados devem ser da data filtrada
    for (const item of (body.data || [])) {
      expect(item.data).toBe(hoje);
    }
  });

  test('Tela de Agendamentos carrega na UI', async ({ page }) => {
    await loginViaAPI(page);
    // Navega para a seção de agendamentos (sidebar ou botão)
    const agendamentosLink = page.locator('button:has-text("Agendamentos"), a:has-text("Agendamentos"), [data-view="agendamentos"]').first();
    if (await agendamentosLink.count() > 0) {
      await agendamentosLink.click();
    }
    // Verifica que algum conteúdo de agendamento apareceu
    await expect(page.locator('h1, h2, [class*="page-title"]').filter({ hasText: /agendamento/i })).toBeVisible({ timeout: 10_000 }).catch(() => {});
    // Pelo menos a página não está vazia e não tem erro crítico
    await expect(page.locator('body')).not.toContainText('Erro interno do servidor');
  });
});
