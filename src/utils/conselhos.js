// Validação e formatação de números de conselhos profissionais brasileiros:
// CRM (medicina), CRO (odontologia), COREN (enfermagem).
//
// IMPORTANTE: validação é APENAS de formato e plausibilidade.
// Não consultamos os conselhos em tempo real porque CFM/CFO/COFEN
// não oferecem API pública. Veja `linkConselho()` para abrir o site
// oficial de busca pré-preenchido.

export const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// Regex aceitando variações comuns:
//   CRM-SP 123456, CRM/SP 123456, CRMSP123456, "crm sp 123456"
const PATTERN = /^\s*(CRM|CRO|COREN)\s*[-/\s]?\s*([A-Z]{2})\s*[-/\s]?\s*(\d{1,7})\s*$/i;

/**
 * Faz parse robusto de um número de conselho.
 * Aceita variações comuns ("CRM-SP 123", "crm sp 123", "CRM/SP123") e devolve
 * sempre o objeto normalizado ou null se inválido.
 *
 * @returns {{tipo: 'CRM'|'CRO'|'COREN', uf: string, numero: string, formatado: string} | null}
 */
export function parseConselho(input) {
  if (!input || typeof input !== "string") return null;
  const m = input.match(PATTERN);
  if (!m) return null;
  const tipo = m[1].toUpperCase();
  const uf   = m[2].toUpperCase();
  const num  = m[3];
  if (!UFS.includes(uf)) return null;
  // Range plausível: ≥ 3 dígitos (alguns CRMs antigos têm 4; novos têm 5–6+).
  // Bloqueia "1" ou "12" óbvios. Não rejeita números altos — alguns conselhos
  // já passaram dos 200 mil registros.
  if (num.length < 3) return null;
  if (Number(num) === 0) return null;
  return { tipo, uf, numero: num, formatado: `${tipo}-${uf} ${num}` };
}

/**
 * Verifica se a string é um número de conselho válido em formato.
 * Use para gates de submit. NÃO confirma existência no conselho.
 */
export function isConselhoValido(input, tipoEsperado) {
  const p = parseConselho(input);
  if (!p) return false;
  if (tipoEsperado && p.tipo !== String(tipoEsperado).toUpperCase()) return false;
  return true;
}

/**
 * Retorna mensagem de erro humana sobre o que está faltando, ou null se OK.
 * Pensada para feedback inline no form.
 */
export function descreverErroConselho(input, tipoEsperado) {
  if (!input || !String(input).trim()) {
    return `Informe o ${tipoEsperado}`;
  }
  const m = String(input).match(PATTERN);
  if (!m) {
    return `Formato inválido. Use ex.: ${tipoEsperado}-SP 12345`;
  }
  const tipoStr = m[1].toUpperCase();
  if (tipoEsperado && tipoStr !== tipoEsperado.toUpperCase()) {
    return `Esperado ${tipoEsperado}, recebi ${tipoStr}`;
  }
  const uf = m[2].toUpperCase();
  if (!UFS.includes(uf)) {
    return `UF "${uf}" não é válida`;
  }
  if (m[3].length < 3) {
    return "Número muito curto (mínimo 3 dígitos)";
  }
  return null;
}

/**
 * Constrói URL do site OFICIAL do conselho com a busca pré-preenchida.
 * Usado pelo botão "Verificar no conselho" — abre em nova aba para o
 * admin conferir manualmente. (Esses sites não têm API pública.)
 */
export function linkConselho(input) {
  const p = parseConselho(input);
  if (!p) return null;
  const { tipo, uf, numero } = p;
  if (tipo === "CRM") {
    // CFM tem busca de médicos online (formulário público).
    return `https://portal.cfm.org.br/busca-medicos/?uf=${uf}&numero=${numero}`;
  }
  if (tipo === "CRO") {
    // CFO mantém o portal de busca de profissionais.
    return `https://website.cfo.org.br/profissionais/?uf=${uf}&numero=${numero}`;
  }
  if (tipo === "COREN") {
    return `https://servicos.cofen.gov.br/busca-cofen.aspx?uf=${uf}&numero=${numero}`;
  }
  return null;
}
