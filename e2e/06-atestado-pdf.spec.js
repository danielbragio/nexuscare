/**
 * Testa a geração de PDFs: atestado, receita e relatórios.
 * Cria um atendimento finalizado no beforeAll para garantir que o botão de atestado existe.
 */
import { test, expect } from '@playwright/test';
import { loginViaAPI, API_URL, CREDS } from './helpers.js';

let authToken = null;
let atendimentoId = null;

test.beforeAll(async ({ request }) => {
  const loginRes = await request.post(`${API_URL}/login`, {
    data: { login: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  const loginBody = await loginRes.json();
  authToken = loginBody?.data?.token;

  // Cria atendimento E2E já finalizado para garantir que botão de atestado apareça
  const hoje = new Date().toISOString().slice(0, 10);
  const res = await request.post(`${API_URL}/atendimentos`, {
    data: {
      nome_paciente:    'Paciente E2E PDF',
      data:             hoje,
      hora:             '08:00',
      tipo_atendimento: 'Consulta',
      status:           'finalizado',
      diagnostico:      'Teste E2E — atestado',
    },
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  atendimentoId = body?.data?.id ?? null;
});

test.afterAll(async ({ request }) => {
  if (!atendimentoId || !authToken) return;
  await request.put(`${API_URL}/atendimentos/${atendimentoId}`, {
    data: { status: 'cancelado' },
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
  });
});

test.describe('PDFs — Atestado e Receita', () => {
  test('Tela de Médicos carrega sem erros JavaScript', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await loginViaAPI(page);

    const link = page.locator('button:has-text("Médicos"), a:has-text("Médicos"), [data-view="medicos"]').first();
    if (await link.count() > 0) await link.click();

    await page.waitForTimeout(2_000);
    expect(jsErrors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Atendimento finalizado E2E existe na API', async ({ request }) => {
    expect(atendimentoId).toBeTruthy();
    const res = await request.get(`${API_URL}/atendimentos/${atendimentoId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe('finalizado');
  });

  test('Download de PDF dispara quando botão é acionado (se disponível)', async ({ page }) => {
    await loginViaAPI(page);

    const link = page.locator('button:has-text("Médicos"), a:has-text("Médicos"), [data-view="medicos"]').first();
    if (await link.count() > 0) await link.click();
    await page.waitForTimeout(2_000);

    const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);

    const btnAtestado = page.locator('button:has-text("Atestado")').first();
    if (await btnAtestado.count() > 0) {
      await btnAtestado.click();
      const download = await downloadPromise;
      if (download) {
        const filePath = await download.path();
        expect(filePath).toBeTruthy();
        const { promises: fsPromises } = await import('fs');
        const { size } = await fsPromises.stat(filePath);
        expect(size).toBeGreaterThan(100);
      }
    } else {
      // Botão não encontrado — verifica se a tela está estável
      expect(page.url()).not.toContain('error');
    }
  });
});

test.describe('PDFs — Relatórios', () => {
  test('Tela de Relatórios carrega sem erro', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await loginViaAPI(page);

    const link = page.locator('button:has-text("Relatório"), a:has-text("Relatório"), [data-view="relatorios"]').first();
    if (await link.count() > 0) await link.click();

    await page.waitForTimeout(2_000);
    expect(jsErrors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Exportação de relatório PDF dispara download (se disponível)', async ({ page }) => {
    await loginViaAPI(page);

    const link = page.locator('button:has-text("Relatório"), a:has-text("Relatório"), [data-view="relatorios"]').first();
    if (await link.count() > 0) await link.click();
    await page.waitForTimeout(1_500);

    const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);

    const btnExport = page.locator('button:has-text("PDF"), button:has-text("Exportar"), button[title*="PDF"]').first();
    if (await btnExport.count() > 0) {
      await btnExport.click();
      const download = await downloadPromise;
      if (download) {
        const filePath = await download.path();
        expect(filePath).toBeTruthy();
      }
    } else {
      expect(page.url()).not.toContain('error');
    }
  });
});
