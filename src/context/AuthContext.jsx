import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api, { tokenStorage } from "../services/api";

const AuthContext = createContext();

// Decodifica o payload do JWT sem verificar assinatura (feito no servidor)
function jwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// Retorna em quantos ms o token vai expirar (negativo = já expirou)
function msParaExpirar(token) {
  const p = jwtPayload(token);
  if (!p?.exp) return -1;
  return p.exp * 1000 - Date.now();
}

const REFRESH_ANTECIPACAO_MS = 2 * 60 * 60 * 1000; // renovar 2h antes do vencimento

export function AuthProvider({ children }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const refreshTimerRef         = useRef(null);

  // Stable callback via [] deps — the recursive call works because agendarRefresh
  // is a stable reference from useCallback, so the closure inside setTimeout always
  // sees the same function instance.
  const agendarRefresh = useCallback((token) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const ms = msParaExpirar(token) - REFRESH_ANTECIPACAO_MS;
    if (ms <= 0) return;
    refreshTimerRef.current = setTimeout(async () => {
      try {
        await api.auth.refresh();
        const novoToken = tokenStorage.get();
        if (novoToken) agendarRefresh(novoToken);
      } catch {
        // Se falhar, o usuário será deslogado pela próxima requisição 401
      }
    }, ms);
  }, []);

  // Ao montar: valida o JWT salvo e carrega o usuário
  useEffect(() => {
    async function init() {
      const token = tokenStorage.get();
      if (!token) { setLoading(false); return; }
      try {
        const res = await api.auth.me();
        if (res?.data) {
          setUserData(res.data);
          agendarRefresh(token);
        } else {
          tokenStorage.remove();
        }
      } catch {
        tokenStorage.remove();
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [agendarRefresh]);

  const login = useCallback(async (identifier, password) => {
    const res = await api.auth.login(identifier, password);
    if (res?.data?.user) {
      setUserData(res.data.user);
      const token = tokenStorage.get();
      if (token) agendarRefresh(token);
    }
    return res;
  }, [agendarRefresh]);

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try { await api.auth.logout(); } catch { /* logout remoto falhou */ }
    tokenStorage.remove();
    setUserData(null);
  }, []);

  const refreshUserData = useCallback(async () => {
    try {
      const res = await api.auth.me();
      if (res?.data) setUserData(res.data);
    } catch (err) {
      console.error("Erro ao recarregar userData:", err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ userData, loading, login, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
