import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { tokenStorage } from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);

  // Ao montar: valida o JWT salvo e carrega o usuário
  useEffect(() => {
    async function init() {
      const token = tokenStorage.get();
      if (!token) { setLoading(false); return; }
      try {
        const res = await api.auth.me();
        if (res?.data) setUserData(res.data);
        else tokenStorage.remove();
      } catch {
        tokenStorage.remove();
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await api.auth.login(identifier, password);
    if (res?.data?.user) setUserData(res.data.user);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch { }
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

export function useAuth() {
  return useContext(AuthContext);
}
