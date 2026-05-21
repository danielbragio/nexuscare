import { test, expect } from '@playwright/test';
import { CREDS, API_URL } from './helpers.js';

test.describe('Login', () => {
  test('exibe formulário de login na raiz', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10_000 });
  });

  test('login com credenciais válidas redireciona para o sistema', async ({ page }) => {
    await page.goto('/');

    const identField = page.locator('input').first();
    await identField.fill(CREDS.email);
    await page.locator('input[type="password"]').fill(CREDS.password);
    await page.locator('button[type="submit"], button:has-text("Acessar"), button:has-text("Entrar"), button:has-text("Login")').click();

    // Token deve ter sido salvo no localStorage
    await page.waitForFunction(() => !!localStorage.getItem('vynorclinic_token'), { timeout: 12_000 });
    const token = await page.evaluate(() => localStorage.getItem('vynorclinic_token'));
    expect(token).toBeTruthy();
  });

  test('login com senha errada mostra mensagem de erro', async ({ page }) => {
    await page.goto('/');

    const identField = page.locator('input').first();
    await identField.fill(CREDS.email);
    await page.locator('input[type="password"]').fill('SenhaErrada123!');
    await page.locator('button[type="submit"], button:has-text("Acessar"), button:has-text("Entrar"), button:has-text("Login")').click();

    // Deve exibir alguma mensagem de erro (toast, alert, texto de erro)
    await expect(
      page.locator('[class*="toast"], [class*="error"], [class*="alert"], [role="alert"]')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('API de login retorna token e dados do usuário', async ({ request }) => {
    const res = await request.post(`${API_URL}/login`, {
      data: { login: CREDS.email, password: CREDS.password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.login).toBe(CREDS.email);
    expect(body.data.user.role).toBe('admin');
  });

  test('API de login com credenciais inválidas retorna 401', async ({ request }) => {
    const res = await request.post(`${API_URL}/login`, {
      data: { login: CREDS.email, password: 'errado' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });
});
