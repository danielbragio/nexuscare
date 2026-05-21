# Análise: Migração do Token JWT para Cookie HttpOnly

**Data:** 2026-05-17  
**Status:** PLANEJADO — Não implementar parcialmente.

---

## Estado Atual

| Item | Valor |
|------|-------|
| Armazenamento do token | `localStorage` (`vynorclinic_token`) |
| Envio do token | Header `Authorization: Bearer <jwt>` |
| Risco principal | Token legível por qualquer JS na página (XSS) |
| Mitigação atual | CSP no `.htaccess` reduz superfície de injeção |

---

## O Que Já Está Pronto (Zero Trabalho Adicional)

- **CORS** — `Access-Control-Allow-Credentials: true` já está em `CorsMiddleware.php`
- **CORS Origin** — Já envia origem específica (não `*`) quando `localhost` — requisito para cookies com credenciais
- **`/auth/refresh`** — Endpoint já existe em `AuthController.php` para renovar token sem re-login

---

## Bloqueadores Que Devem Ser Resolvidos Antes de Começar

### 1. HTTPS Obrigatório em Produção
Cookies `HttpOnly; Secure` só são enviados em HTTPS. Em `localhost`, o atributo `Secure` pode ser omitido para desenvolvimento, mas **em produção é obrigatório**. Sem HTTPS, o cookie viaja em claro — pior que `localStorage`.

### 2. Cross-Port em Localhost
Frontend roda em `localhost:5173`, backend em `localhost:80`. Navegadores modernos consideram portas diferentes como origens distintas. O cookie definido pelo backend em `:80` **não é enviado automaticamente** para requests de `:5173`.

**Solução para desenvolvimento:** Configurar proxy no Vite:
```js
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost/vynor-clinic-api'
  }
}
```
Isso faz o frontend usar a mesma origem para tudo — o cookie funciona.

### 3. Proteção CSRF
Cookies são enviados automaticamente pelo navegador em **toda** requisição para o domínio. Isso abre CSRF. Opções:

| Opção | Custo | Proteção |
|-------|-------|----------|
| `SameSite=Strict` | Zero (já no Set-Cookie) | Boa para maioria dos casos modernos |
| Double-submit cookie | Médio | Robusta; requer ajuste em frontend e backend |
| Token CSRF no header | Médio | Compatível com SPAs |

**Recomendação:** `SameSite=Strict` é suficiente para esta aplicação clínica (não usa links externos que disparam formulários).

### 4. Logout Verdadeiro
JWT é stateless — o cookie expira no cliente, mas o token continua válido no servidor até seu `exp`. Para logout real, precisa de uma **blocklist de tokens inválidos** (tabela `jwt_blocklist` no banco, consultada pelo `AuthMiddleware`).

---

## Plano de Implementação (Ordem Obrigatória)

### Fase 1 — Backend (não pode ser parcial)

**`AuthController::login()`**
```php
// Adicionar APÓS gerar o $token:
$secure   = !str_contains($_SERVER['SERVER_NAME'] ?? '', 'localhost');
$cookieOpts = [
    'expires'  => time() + $this->cfg['jwt']['expiration'],
    'path'     => '/vynor-clinic-api/api',
    'domain'   => '',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
];
setcookie('vynorclinic_token', $token, $cookieOpts);
// Manter 'token' no JSON durante período de transição
```

**`AuthController::logout()`**
```php
// Expirar cookie:
setcookie('vynorclinic_token', '', [
    'expires'  => time() - 3600,
    'path'     => '/vynor-clinic-api/api',
    'httponly' => true,
    'samesite' => 'Strict',
]);
```

**`AuthController::refresh()`** — mesma lógica do login: definir cookie + retornar token no JSON.

**`AuthMiddleware::handle()`**
```php
// Modo dual: aceita cookie E header Authorization
private static function extractToken(): ?string
{
    // 1. Cookie HttpOnly (modo novo)
    if (!empty($_COOKIE['vynorclinic_token'])) {
        return $_COOKIE['vynorclinic_token'];
    }
    // 2. Header Bearer (retrocompatibilidade)
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if (str_starts_with($header, 'Bearer ')) {
        return substr($header, 7);
    }
    return null;
}
```

### Fase 2 — Frontend (só após Fase 1 completa e testada)

**`api.js`**
```js
// Remover tokenStorage (localStorage)
// Adicionar credentials: 'include' em todos os fetch
const config = { method, headers, credentials: 'include' };

// Remover: Authorization: `Bearer ${token}`
// Implementar interceptor 401 → /auth/refresh:
if (response.status === 401) {
    const refreshed = await api.auth.refresh();
    if (refreshed) return fetch(...); // retry
    window.dispatchEvent(new CustomEvent('vynorclinic:unauthorized'));
}
```

### Fase 3 — Vite Proxy (desenvolvimento)

```js
// vite.config.js
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost',
        rewrite: (path) => '/vynor-clinic-api' + path,
      }
    }
  }
})
```

---

## Testes Necessários Antes do Deploy

- [ ] Login define cookie com `HttpOnly; SameSite=Strict`
- [ ] Requests subsequentes enviam o cookie automaticamente
- [ ] Logout expira o cookie (verificar DevTools → Application → Cookies)
- [ ] Refresh renovaa o cookie sem re-login
- [ ] Token antigo no `localStorage` não causa conflito (limpar no primeiro login pós-migração)
- [ ] Teste com Playwright: todos os 23 testes API continuam passando
- [ ] CSRF: formulário externo não consegue disparar ação autenticada

---

## Riscos Conhecidos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Logout em massa se cookie não chegar | Alto | Manter dual-mode por 1 sprint; testar staging antes |
| `SameSite=Strict` quebra OAuth/SSO externo | Médio | Não aplicável — sistema não usa SSO |
| Token localStorage sobrevive após migração | Baixo | `tokenStorage.remove()` no primeiro load pós-migração |
| Produção sem HTTPS | Crítico | Obter certificado TLS antes de ativar `Secure` |

---

## Decisão

**Não implementar agora.** Pré-requisitos:
1. Domínio e certificado TLS configurados em produção
2. Vite proxy configurado para desenvolvimento  
3. Sprint dedicado (mudança incompatível com versão atual)
4. Testes em ambiente de staging antes do rollout
