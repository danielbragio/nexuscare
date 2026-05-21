import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function ModalPerfil({ userData, onClose }) {
  const { refreshUserData } = useAuth();
  const [aba, setAba] = useState("perfil");

  const [senhaAtual, setSenhaAtual]       = useState("");
  const [novaSenha, setNovaSenha]         = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha]           = useState(null);

  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const [msgFoto, setMsgFoto]               = useState(null);
  const fileInputRef                         = useRef(null);

  const nomeExibicao = userData?.nome || userData?.email || "Usuário";
  const inicial = nomeExibicao.charAt(0).toUpperCase();

  function formatarData(ts) {
    if (!ts) return "—";
    let d;
    if (ts?.seconds) d = new Date(ts.seconds * 1000);
    else if (typeof ts === "string") d = new Date(ts);
    else return "—";
    return d.toLocaleDateString("pt-BR");
  }

  async function trocarSenha() {
    setMsgSenha(null);

    if (!senhaAtual) {
      setMsgSenha({ tipo: "erro", texto: "Informe a senha atual." });
      return;
    }
    if (!novaSenha || novaSenha.length < 6) {
      setMsgSenha({ tipo: "erro", texto: "A nova senha deve ter ao menos 6 caracteres." });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setMsgSenha({ tipo: "erro", texto: "Nova senha e confirmação não coincidem." });
      return;
    }

    try {
      setSalvandoSenha(true);

      // Verifica senha atual tentando fazer login com ela
      try {
        await api.auth.login(userData.login || userData.email, senhaAtual);
      } catch {
        setMsgSenha({ tipo: "erro", texto: "Senha atual incorreta." });
        return;
      }

      // Atualiza para a nova senha
      await api.usuarios.atualizar(userData.id, { senha: novaSenha });
      await refreshUserData();

      setMsgSenha({ tipo: "sucesso", texto: "Senha alterada com sucesso!" });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch (error) {
      console.error("Erro ao trocar senha:", error);
      setMsgSenha({ tipo: "erro", texto: `Erro ao alterar senha: ${error.message || ""}` });
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function trocarFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsgFoto(null);
    setUploadandoFoto(true);
    try {
      await api.usuarios.uploadFoto(userData.id, file);
      await refreshUserData();
      setMsgFoto({ tipo: "sucesso", texto: "Foto atualizada com sucesso!" });
    } catch (err) {
      setMsgFoto({ tipo: "erro", texto: err.message || "Não foi possível enviar a foto." });
    } finally {
      setUploadandoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const infoRows = [
    { label: "Nome",           value: userData?.nome || "—" },
    { label: "E-mail",         value: userData?.email || "—" },
    { label: "Usuário",        value: userData?.login || userData?.username || "—" },
    { label: "Perfil",         value: userData?.role || "—" },
    { label: "Cargo",          value: userData?.cargo || null },
    { label: "Especialidade",  value: userData?.especialidade || null },
    { label: "CRM",            value: userData?.crm || null },
    { label: "CRO",            value: userData?.cro || null },
    { label: "COREN",          value: userData?.coren || null },
    { label: "Telefone",       value: userData?.telefone || null },
    { label: "Cadastrado em",  value: formatarData(userData?.createdAt) },
  ].filter((row) => row.value !== null && row.value !== undefined && row.value !== "");

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", zIndex: 1000 }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "100%",
          maxWidth: "480px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)",
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              border: "3px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {userData?.photoURL
              ? <img src={userData.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : inicial}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "17px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nomeExibicao}
            </div>
            <div style={{ color: "rgba(255,255,255,0.68)", fontSize: "12px", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userData?.email}
            </div>
            <div style={{ display: "inline-block", marginTop: "7px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, textTransform: "capitalize" }}>
              {userData?.role || "Usuário"}
            </div>
          </div>

          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px", alignSelf: "flex-start", flexShrink: 0 }} title="Fechar">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 }}>
          {[
            { key: "perfil",    label: "Dados do Perfil" },
            { key: "seguranca", label: "Segurança" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setAba(tab.key); setMsgSenha(null); }}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: "none",
                border: "none",
                borderBottom: aba === tab.key ? "2px solid #7C3AED" : "2px solid transparent",
                color: aba === tab.key ? "#7C3AED" : "#64748b",
                fontWeight: aba === tab.key ? 700 : 400,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {aba === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {infoRows.map((row) => (
                <div
                  key={row.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#f8fafc", borderRadius: "8px", gap: "12px", border: "1px solid #f0f4f8" }}
                >
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: 600, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.value}
                  </span>
                </div>
              ))}

              {/* Foto de perfil */}
              <div style={{ marginTop: 8, padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", fontWeight: 600 }}>Foto de perfil</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "#e2e8f0", border: "2px solid #cbd5e1",
                    overflow: "hidden", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 700, color: "#64748b",
                  }}>
                    {userData?.photoURL
                      ? <img src={userData.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : inicial}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={trocarFoto}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadandoFoto}
                      style={{
                        padding: "7px 14px", borderRadius: 7, border: "1px solid #cbd5e1",
                        background: "#fff", cursor: uploadandoFoto ? "not-allowed" : "pointer",
                        fontSize: 12, fontWeight: 600, color: "#374151",
                      }}
                    >
                      {uploadandoFoto ? "Enviando…" : "Alterar foto"}
                    </button>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>JPEG, PNG, GIF ou WEBP · máx. 5 MB</p>
                  </div>
                </div>
                {msgFoto && (
                  <div style={{
                    marginTop: 8, padding: "7px 10px", borderRadius: 6, fontSize: 12,
                    background: msgFoto.tipo === "sucesso" ? "#f0fdf4" : "#fef2f2",
                    color: msgFoto.tipo === "sucesso" ? "#15803d" : "#dc2626",
                    border: `1px solid ${msgFoto.tipo === "sucesso" ? "#bbf7d0" : "#fecaca"}`,
                  }}>
                    {msgFoto.tipo === "sucesso" ? "✓ " : "⚠ "}{msgFoto.texto}
                  </div>
                )}
              </div>
            </div>
          )}

          {aba === "seguranca" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px", color: "#64748b", border: "1px solid #e2e8f0", marginBottom: "4px" }}>
                Para alterar a senha, confirme a senha atual e informe a nova.
              </div>

              {[
                { label: "Senha atual", value: senhaAtual, set: setSenhaAtual, auto: "current-password" },
                { label: "Nova senha", value: novaSenha, set: setNovaSenha, auto: "new-password", placeholder: "Mínimo 6 caracteres" },
                { label: "Confirmar nova senha", value: confirmarSenha, set: setConfirmarSenha, auto: "new-password", placeholder: "Repita a nova senha" },
              ].map((campo) => (
                <div key={campo.label}>
                  <label style={{ fontSize: "12px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    {campo.label}
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={campo.value}
                    onChange={(e) => campo.set(e.target.value)}
                    placeholder={campo.placeholder || `Digite ${campo.label.toLowerCase()}`}
                    autoComplete={campo.auto}
                    onKeyDown={(e) => { if (e.key === "Enter") trocarSenha(); }}
                  />
                </div>
              ))}

              {msgSenha && (
                <div style={{ padding: "10px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, background: msgSenha.tipo === "sucesso" ? "#f0fdf4" : "#fef2f2", color: msgSenha.tipo === "sucesso" ? "#15803d" : "#dc2626", border: `1px solid ${msgSenha.tipo === "sucesso" ? "#bbf7d0" : "#fecaca"}` }}>
                  {msgSenha.tipo === "sucesso" ? "✓ " : "⚠ "}{msgSenha.texto}
                </div>
              )}

              <button className="primary-btn" onClick={trocarSenha} disabled={salvandoSenha} style={{ marginTop: "2px" }}>
                {salvandoSenha ? "Alterando senha..." : "Trocar senha"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", flexShrink: 0, background: "#f8fafc" }}>
          <button className="secondary-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </>
  );
}
