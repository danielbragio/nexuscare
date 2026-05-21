/**
 * Vynor Clinic — Cliente Server-Sent Events (SSE)
 *
 * Conecta ao endpoint /api/realtime/stream e entrega eventos nomeados
 * para os ouvintes registrados via `.on(evento, handler)`.
 *
 * Autenticação: token JWT passado como query-param ?token=<jwt>
 * (EventSource API do browser não suporta headers customizados).
 *
 * Reconexão automática com backoff exponencial: 1s, 2s, 4s … 30s máx.
 * Quando offline, o App.jsx encurta o intervalo de polling para 10s.
 */

const API_BASE =
  import.meta.env.VITE_API_URL ||
  `${window.location.origin}/vynor-clinic-api/api`;

// SSE ativo por padrão; desabilitar explicitamente com VITE_ENABLE_REALTIME=false
const REALTIME_ENABLED = import.meta.env.VITE_ENABLE_REALTIME !== 'false';

export const REALTIME_STATUS = {
  CONNECTING:   'connecting',
  ONLINE:       'online',
  RECONNECTING: 'reconnecting',
  OFFLINE:      'offline',
};

/** Todos os tipos de evento que o backend pode emitir. */
const SSE_EVENTS = [
  'pacientes.created',
  'pacientes.updated',
  'atendimentos.created',
  'atendimentos.updated',
  'atendimentos.status_changed',
  'pagamentos.created',
  'pagamentos.updated',
  'pagamentos.status_changed',
  'odonto.agendamento_created',
  'odonto.agendamento_updated',
  'odonto.atendimento_created',
  'odonto.atendimento_updated',
  'consultorios.updated',
];

export class RealtimeClient {
  constructor(token) {
    this._token          = token;
    this._listeners      = {};
    this._statusListeners = [];
    this._es             = null;
    this._status         = REALTIME_STATUS.OFFLINE;
    this._retries        = 0;
    this._retryTimer     = null;
    this._lastEventId    = null;
    this._disabled       = false;
  }

  /** Inicia a conexão SSE. Não faz nada se já estiver conectado. */
  connect() {
    if (this._es || this._disabled) return;
    if (!REALTIME_ENABLED) {
      this._disabled = true;
      this._setStatus(REALTIME_STATUS.OFFLINE);
      return;
    }
    this._setStatus(REALTIME_STATUS.CONNECTING);
    this._open(); // EventSource nativo — mais confiável que o fetch pré-voo
  }

  /** Encerra a conexão e cancela qualquer retentativa pendente. */
  disconnect() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._es) {
      this._es.close();
      this._es = null;
    }
    this._setStatus(REALTIME_STATUS.OFFLINE);
  }

  /**
   * Registra um handler para um tipo de evento SSE.
   * Retorna uma função de cancelamento (unsubscribe).
   */
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return () => {
      this._listeners[event] = (this._listeners[event] || []).filter(
        (h) => h !== handler
      );
    };
  }

  /**
   * Registra um callback que recebe o status da conexão sempre que ele muda.
   * Retorna uma função de cancelamento.
   */
  onStatusChange(handler) {
    this._statusListeners.push(handler);
    return () => {
      this._statusListeners = this._statusListeners.filter((h) => h !== handler);
    };
  }

  get status() {
    return this._status;
  }

  // ── Privado ──────────────────────────────────────────────────────────────

  _open() {
    const url = this._buildUrl();

    const es = new EventSource(url.toString());
    this._es = es;

    es.onopen = () => {
      this._disabled = false;
      this._retries = 0;
      this._setStatus(REALTIME_STATUS.ONLINE);
    };

    es.onerror = () => {
      // EventSource fecha automaticamente — recriamos manualmente para
      // controlar o backoff em vez de depender do comportamento padrão
      es.close();
      this._es = null;
      this._setStatus(REALTIME_STATUS.RECONNECTING);
      this._scheduleReconnect();
    };

    // Registra handlers para cada tipo de evento nomeado
    SSE_EVENTS.forEach((evt) => {
      es.addEventListener(evt, (e) => {
        if (e.lastEventId) this._lastEventId = e.lastEventId;
        this._dispatch(evt, e.data);
      });
    });
  }

  async _connectAsync() {
    const url = this._buildUrl();
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      });
      if (res.status === 404 || res.status === 405) {
        this._disabled = true;
        this._setStatus(REALTIME_STATUS.OFFLINE);
        res.body?.cancel?.();
        return;
      }
      res.body?.cancel?.();
      if (!this._es && !this._disabled) this._open();
    } catch (err) {
      console.error('[Realtime] connect error:', err);
      this._setStatus(REALTIME_STATUS.OFFLINE);
      this._scheduleReconnect();
    }
  }

  _buildUrl() {
    const url = new URL(
      `${API_BASE.replace(/\/$/, '')}/realtime/stream`,
      window.location.origin
    );
    url.searchParams.set('token', this._token);
    if (this._lastEventId) {
      url.searchParams.set('lastEventId', this._lastEventId);
    }
    return url;
  }

  _dispatch(type, rawData) {
    let data = null;
    try {
      data = JSON.parse(rawData);
    } catch {
      // payload não-JSON — mantém null
    }
    (this._listeners[type] || []).forEach((h) => {
      try {
        h(data);
      } catch (err) {
        console.error('[Realtime] handler error:', err);
      }
    });
  }

  _setStatus(status) {
    if (this._status === status) return;
    this._status = status;
    this._statusListeners.forEach((h) => {
      try {
        h(status);
      } catch {
        /* ignora */
      }
    });
  }

  _scheduleReconnect() {
    if (this._disabled) return;
    // Backoff exponencial: 1s, 2s, 4s, 8s, 16s, 30s (máximo)
    const delay = Math.min(1000 * Math.pow(2, Math.min(this._retries, 5)), 30000);
    this._retries++;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      if (!this._es) {
        try {
          this._open();
        } catch (err) {
          console.error('[Realtime] reconnect error:', err);
          this._setStatus(REALTIME_STATUS.OFFLINE);
          this._scheduleReconnect();
        }
      }
    }, delay);
  }

  async _checkEndpoint(url) {
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      });
      if (res.status === 404 || res.status === 405) {
        this._disabled = true;
        if (this._retryTimer) {
          clearTimeout(this._retryTimer);
          this._retryTimer = null;
        }
        this._setStatus(REALTIME_STATUS.OFFLINE);
      }
      res.body?.cancel?.();
    } catch {
      // Mantem a reconexao normal para falhas temporarias de rede.
    }
  }
}
