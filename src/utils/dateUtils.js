/**
 * dateUtils.js — Funções centralizadas de data/hora e status para o Vynor Clinic.
 *
 * Timezone: `new Date().toISOString()` retorna UTC e pode divergir 1 dia no Brasil
 * (UTC-3). Todas as funções aqui usam componentes locais do objeto Date para
 * garantir que "hoje" represente sempre o dia local do usuário.
 *
 * Status canônico: agendado | confirmado | aguardando | presente | em_atendimento | finalizado | cancelado | faltou | remarcado
 */

/** Retorna a data local de hoje no formato YYYY-MM-DD. */
export function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Retorna a data e hora local atual no formato ISO (YYYY-MM-DDTHH:MM:SS). */
export function agoraISO() {
  const d = new Date();
  const date = hojeISO();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${date}T${h}:${min}:${sec}`;
}

/** Retorna a hora local atual no formato HH:MM. */
export function horaAtualHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Compara duas strings YYYY-MM-DD.
 * Retorna true se dataStr corresponde ao dia de hoje.
 */
export function isHoje(dataStr) {
  return typeof dataStr === "string" && dataStr.slice(0, 10) === hojeISO();
}

/**
 * Retorna true se dataStr é estritamente posterior a hoje.
 * Usar para bloquear atendimento de agendamentos futuros.
 */
export function isFuturo(dataStr) {
  if (!dataStr) return false;
  return dataStr.slice(0, 10) > hojeISO();
}

/**
 * Retorna true se dataStr é anterior a hoje (data passada).
 */
export function isPassado(dataStr) {
  if (!dataStr) return false;
  return dataStr.slice(0, 10) < hojeISO();
}

/**
 * Formata YYYY-MM-DD → DD/MM/YYYY para exibição.
 * Retorna "—" para valores nulos/inválidos.
 */
export function formatarData(dataStr) {
  if (!dataStr) return "—";
  const s = String(dataStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return dataStr;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Formata ISO datetime → DD/MM/YYYY HH:MM para exibição.
 */
export function formatarDataHora(isoStr) {
  if (!isoStr) return "—";
  const data = formatarData(isoStr.slice(0, 10));
  const hora = isoStr.length >= 16 ? isoStr.slice(11, 16) : "";
  return hora ? `${data} ${hora}` : data;
}

/**
 * Retorna o nome do dia da semana (segunda, terça…) para uma data YYYY-MM-DD.
 * Usa T00:00:00 sem sufixo Z para interpretar como hora local.
 */
export function diaSemanaLocal(dataStr) {
  if (!dataStr) return "";
  const d = new Date(`${dataStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "long" }).toLowerCase();
}

/**
 * Calcula idade em anos a partir de data de nascimento YYYY-MM-DD.
 * Retorna null se inválido.
 */
export function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const nasc = new Date(`${dataNasc}T00:00:00`);
  if (isNaN(nasc)) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? idade : null;
}

/**
 * Retorna label de "há X min / X h / hoje / ontem / DD/MM" a partir de ISO.
 */
export function tempoRelativo(isoStr) {
  if (!isoStr) return "—";
  const passado = new Date(isoStr);
  const diff = Math.floor((Date.now() - passado) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return formatarData(isoStr.slice(0, 10));
}

/**
 * Normaliza forma de pagamento para capitalização consistente.
 * Evita duplicatas como "dinheiro" e "Dinheiro".
 */
export function normalizarFormaPagamento(forma) {
  const map = {
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    "cartão": "Cartão",
    "cartao de credito": "Cartão de Crédito",
    "cartão de crédito": "Cartão de Crédito",
    "cartao de debito": "Cartão de Débito",
    "cartão de débito": "Cartão de Débito",
    pix: "PIX",
    boleto: "Boleto",
    transferencia: "Transferência",
    "transferência": "Transferência",
    convenio: "Convênio",
    "convênio": "Convênio",
    cortesia: "Cortesia",
    isento: "Isento",
    cheque: "Cheque",
  };
  if (!forma) return "";
  const key = forma.toLowerCase().trim();
  return map[key] || forma.trim();
}

/**
 * Converte um objeto Date para YYYY-MM-DD usando componentes locais (sem UTC shift).
 * Substitui `d.toISOString().slice(0, 10)` que retorna a data em UTC.
 */
export function dateToLocalISO(d) {
  if (!d || !(d instanceof Date) || isNaN(d)) return "";
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Status canônico ────────────────────────────────────────────────────────────

const STATUS_MAP = {
  agendada: "agendado", agendado: "agendado",
  confirmado: "confirmado", confirmada: "confirmado",
  aguardando: "aguardando", "aguardando atendimento": "aguardando",
  "aguardando medico": "aguardando", espera: "aguardando",
  presente: "presente", chegou: "presente",
  em_atendimento: "em_atendimento", "em atendimento": "em_atendimento",
  atendimento: "em_atendimento", atendendo: "em_atendimento",
  finalizado: "finalizado", finalizada: "finalizado",
  concluido: "finalizado", concluida: "finalizado",
  encerrado: "finalizado",
  cancelado: "cancelado", cancelada: "cancelado",
  faltou: "faltou", "nao compareceu": "faltou", ausente: "faltou",
  remarcado: "remarcado", remarcada: "remarcado",
};

/**
 * Retorna o status canônico a partir de qualquer variante de string.
 * agendado | aguardando | em_atendimento | finalizado | cancelado
 */
export function normalizarStatus(status) {
  return STATUS_MAP[(status || "").toLowerCase().trim()] || (status || "").toLowerCase().trim() || "agendado";
}

const LABEL_STATUS = {
  agendado:       "Agendado",
  confirmado:     "Confirmado",
  aguardando:     "Aguardando",
  presente:       "Presente",
  em_atendimento: "Em Atendimento",
  finalizado:     "Finalizado",
  cancelado:      "Cancelado",
  faltou:         "Faltou",
  remarcado:      "Remarcado",
};

/** Retorna o rótulo em português para exibição. */
export function labelStatus(status) {
  return LABEL_STATUS[normalizarStatus(status)] || status || "—";
}

const COR_STATUS = {
  agendado:       "#2563eb",
  confirmado:     "#059669",
  aguardando:     "#f59e0b",
  presente:       "#d97706",
  em_atendimento: "#0f766e",
  finalizado:     "#16a34a",
  cancelado:      "#94a3b8",
  faltou:         "#dc2626",
  remarcado:      "#7c3aed",
};

/** Retorna a cor hex associada ao status para uso em badges/dots. */
export function corStatus(status) {
  return COR_STATUS[normalizarStatus(status)] || "#64748b";
}

/**
 * Normaliza origem de pagamento para exibição consistente.
 */
export function normalizarOrigem(origem) {
  const map = {
    medico: "Médico",
    médico: "Médico",
    odonto: "Odontologia",
    odontologia: "Odontologia",
    enfermagem: "Enfermagem",
    procedimento: "Procedimento",
    estetica: "Estética",
    estética: "Estética",
    avulso: "Avulso",
    "recepcao": "Recepção",
    "recepção": "Recepção",
    financeiro: "Financeiro",
    estoque: "Estoque",
  };
  if (!origem) return "Avulso";
  const key = (origem || "").toLowerCase().trim();
  return map[key] || origem;
}
