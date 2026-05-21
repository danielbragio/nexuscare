/**
 * Helpers reutilizáveis para os testes E2E da Vynor Clinic.
 */

export const CREDS = {
  email:    'master',
  password: 't7898852',
};

export const BASE_URL = 'http://localhost:5173';
export const API_URL  = 'http://localhost/vynor-clinic-api/api';

/**
 * Faz login via UI e aguarda o dashboard carregar.
 * Salva o estado de autenticação para reutilizar entre testes.
 */
export async function loginViaUI(page) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="mail"], input[placeholder*="Login"]', { timeout: 10_000 });

  // Preenche o campo de identificador (email ou login)
  const identField = page.locator('input').first();
  await identField.fill(CREDS.email);

  const passField = page.locator('input[type="password"]');
  await passField.fill(CREDS.password);

  await page.locator('button[type="submit"], button:has-text("Acessar"), button:has-text("Entrar"), button:has-text("Login")').click();

  // Aguarda o dashboard ou qualquer elemento pós-login
  await page.waitForSelector('[data-testid="sidebar"], nav, .sidebar, aside, [class*="sidebar"]', { timeout: 15_000 }).catch(async () => {
    // Fallback: aguarda URL mudar do login
    await page.waitForURL((url) => !url.toString().includes('login'), { timeout: 10_000 });
  });
}

/**
 * Faz login direto via API e injeta o token no localStorage.
 * Mais rápido que loginViaUI — use para testes que não testam o login em si.
 */
export async function loginViaAPI(page) {
  const res = await page.request.post(`${API_URL}/login`, {
    data: { login: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  const token = body?.data?.token;
  if (!token) throw new Error('Login falhou: ' + JSON.stringify(body));

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('vynorclinic_token', t), token);
  await page.reload();

  // Aguarda a aplicação reagir ao token
  await page.waitForSelector('[data-testid="sidebar"], nav, .sidebar, aside, [class*="sidebar"]', { timeout: 12_000 }).catch(() => {});
}
