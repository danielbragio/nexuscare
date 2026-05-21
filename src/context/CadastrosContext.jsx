import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

const CadastrosContext = createContext(null);

export function CadastrosProvider({ children }) {
  const { userData } = useAuth();

  const [cids, setCids]                            = useState([]);
  const [procedimentosEsteticos, setProcEsteticos] = useState([]);
  const [especialidadesExtras, setEspExtras]       = useState({ medico: [], odonto: [] });

  function buildExtras(lista) {
    const extras = { medico: [], odonto: [] };
    (lista || []).forEach((e) => {
      const tipo = e.tipo === "odonto" ? "odonto" : "medico";
      extras[tipo].push({ id: e.id, nome: e.nome });
    });
    return extras;
  }

  const carregarTudo = useCallback(async () => {
    if (!userData) return; // aguarda login

    try {
      const [resCids, resEst, resEsp] = await Promise.allSettled([
        api.cids.listar({ per_page: 100 }),
        api.procedimentosEsteticos.listar({ per_page: 100 }),
        api.especialidadesExtras.listar({ per_page: 100 }),
      ]);

      if (resCids.status === "fulfilled") {
        const data = resCids.value?.data || [];
        if (data.length === 0) {
          await api.cids.seed().catch(() => {});
          const seeded = await api.cids.listar({ per_page: 100 }).catch(() => ({ data: [] }));
          setCids(seeded?.data || []);
        } else {
          setCids(data);
        }
      }

      if (resEst.status === "fulfilled") {
        const data = resEst.value?.data || [];
        if (data.length === 0) {
          await api.procedimentosEsteticos.seed().catch(() => {});
          const seeded = await api.procedimentosEsteticos.listar({ per_page: 100 }).catch(() => ({ data: [] }));
          setProcEsteticos(seeded?.data || []);
        } else {
          setProcEsteticos(data);
        }
      }

      if (resEsp.status === "fulfilled") {
        setEspExtras(buildExtras(resEsp.value?.data));
      }
    } catch (e) {
      console.error("Erro ao carregar cadastros:", e);
    }
  }, [userData]);

  useEffect(() => {
    if (!userData) {
      setCids([]); // eslint-disable-line react-hooks/set-state-in-effect
      setProcEsteticos([]);
      setEspExtras({ medico: [], odonto: [] });
      return;
    }
    carregarTudo();
  }, [userData, carregarTudo]);

  // ── CID CRUD ──────────────────────────────────────────────────────────────
  async function adicionarCid(cid) {
    const res = await api.cids.criar(cid);
    const novo = res?.data || { ...cid, id: Date.now() };
    setCids((prev) => [...prev, novo]);
  }

  async function atualizarCid(id, dados) {
    await api.cids.atualizar(id, dados);
    setCids((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...c, ...dados } : c)));
  }

  async function removerCid(id) {
    await api.cids.excluir(id);
    setCids((prev) => prev.filter((c) => String(c.id) !== String(id)));
  }

  // ── Estético CRUD ─────────────────────────────────────────────────────────
  async function adicionarEstetico(proc) {
    const res = await api.procedimentosEsteticos.criar(proc);
    const novo = res?.data || { ...proc, id: Date.now() };
    setProcEsteticos((prev) => [...prev, novo]);
  }

  async function atualizarEstetico(id, dados) {
    await api.procedimentosEsteticos.atualizar(id, dados);
    setProcEsteticos((prev) => prev.map((p) => (String(p.id) === String(id) ? { ...p, ...dados } : p)));
  }

  async function removerEstetico(id) {
    await api.procedimentosEsteticos.excluir(id);
    setProcEsteticos((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }

  // ── Especialidades CRUD ───────────────────────────────────────────────────
  async function adicionarEspecialidadeExtra(tipo, nome) {
    const res = await api.especialidadesExtras.criar({ tipo, nome });
    const novo = res?.data || { id: Date.now(), tipo, nome };
    setEspExtras((prev) => ({
      ...prev,
      [tipo]: [...(prev[tipo] || []), { id: novo.id, nome }],
    }));
  }

  async function removerEspecialidadeExtra(tipo, id) {
    await api.especialidadesExtras.excluir(id);
    setEspExtras((prev) => ({
      ...prev,
      [tipo]: (prev[tipo] || []).filter((e) => String(e.id) !== String(id)),
    }));
  }

  return (
    <CadastrosContext.Provider value={{
      cids,
      procedimentosEsteticos,
      especialidadesExtras,
      adicionarCid,
      atualizarCid,
      removerCid,
      adicionarEstetico,
      atualizarEstetico,
      removerEstetico,
      adicionarEspecialidadeExtra,
      removerEspecialidadeExtra,
    }}>
      {children}
    </CadastrosContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCadastros() {
  const ctx = useContext(CadastrosContext);
  if (!ctx) throw new Error("useCadastros deve ser usado dentro de CadastrosProvider");
  return ctx;
}
