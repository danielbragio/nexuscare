/**
 * Vynor Clinic — utilitários financeiros unificados.
 *
 * Define a fonte de verdade para o cálculo de faturamento em TODOS os módulos
 * (Dashboard, DashboardFinanceiro, Financeiro, Faturamento, Relatórios).
 *
 * Regras:
 *   - Faturamento confirmado = pagamentos com status pago OU cortesia,
 *     não cancelados, respeitando o período.
 *   - Valor canônico = valorFinal quando > 0; senão (valor - desconto), nunca negativo.
 *   - Pagamentos cortesia legítimos têm valorFinal = 0 e contribuem 0 ao total.
 *   - Soft-delete (deleted_at) já é filtrado no backend; o frontend só recebe ativos.
 */

/** Normaliza um campo de status texto livre para minúsculas sem acento/espaços. */
export function normalizarStatusFinanceiro(p) {
  return String(p?.statusPagamento ?? p?.status ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Pagamento conta como faturamento confirmado (pago ou cortesia)? */
export function isFaturamentoConfirmado(p) {
  const s = normalizarStatusFinanceiro(p);
  return s === 'pago' || s === 'paga' || s === 'cortesia';
}

/** Pagamento pendente (ainda a receber)? */
export function isPagamentoPendente(p) {
  const s = normalizarStatusFinanceiro(p);
  return s === 'pendente' || s === 'aguardando';
}

/**
 * Valor canônico de um pagamento (em R$).
 *
 *   - Usa valorFinal quando disponível e > 0.
 *   - Fallback: max(valor - desconto, 0) — cobre dado legado com valorFinal=0.
 *   - Cortesia legítima (valor=0) retorna 0.
 */
export function valorCanonicoPagamento(p) {
  if (!p) return 0;
  const vf       = Number(p.valorFinal ?? p.valor_final ?? 0);
  const valor    = Number(p.valor ?? 0);
  const desconto = Number(p.desconto ?? 0);
  if (vf > 0) return vf;
  return Math.max(valor - desconto, 0);
}

/**
 * Soma o faturamento confirmado de uma lista de pagamentos.
 *
 * @param {Array} pagamentos
 * @param {{ inicio?: string, fim?: string, campo?: 'data'|'dataPagamento' }} [opts]
 *   - inicio/fim em YYYY-MM-DD (string). Use undefined para sem filtro de período.
 *   - campo: qual data usar para filtrar (default: 'dataPagamento' com fallback 'data').
 */
export function somarFaturamentoConfirmado(pagamentos, opts = {}) {
  const { inicio, fim, campo } = opts;
  return (pagamentos || []).reduce((total, p) => {
    if (!isFaturamentoConfirmado(p)) return total;
    if (inicio || fim) {
      const ref = String(
        (campo === 'data' ? p.data : p.dataPagamento) || p.dataPagamento || p.data || ''
      ).slice(0, 10);
      if (!ref) return total;
      if (inicio && ref < inicio) return total;
      if (fim    && ref > fim)    return total;
    }
    return total + valorCanonicoPagamento(p);
  }, 0);
}

/** Soma valores pendentes (status pendente/aguardando) — mesmo critério canônico. */
export function somarPendencias(pagamentos) {
  return (pagamentos || []).reduce(
    (t, p) => (isPagamentoPendente(p) ? t + valorCanonicoPagamento(p) : t),
    0
  );
}
