import { useRef, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../services/firebase";

export default function ModalPerfil({ firebaseUser, userData, onClose, onPhotoUpdate }) {
  const [aba, setAba] = useState("perfil");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoURL, setPhotoURL] = useState(userData?.photoURL || "");
  const fileInputRef = useRef(null);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState(null);

  const nomeExibicao = userData?.nome || userData?.name || firebaseUser?.email || "Usuário";
  const inicial = nomeExibicao.charAt(0).toUpperCase();

  function formatarData(ts) {
    if (!ts) return "—";
    let d;
    if (ts?.toDate) d = ts.toDate();
    else if (typeof ts === "string") d = new Date(ts);
    else return "—";
    return d.toLocaleDateString("pt-BR");
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter menos de 5 MB.");
      return;
    }

    try {
      setUploadingPhoto(true);
      const storageRef = ref(storage, `profilePhotos/${firebaseUser.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "users", firebaseUser.uid), {
        photoURL: url,
        updatedAt: serverTimestamp(),
      });

      setPhotoURL(url);
      if (onPhotoUpdate) onPhotoUpdate(url);
    } catch (error) {
      console.error("Erro ao salvar foto:", error);
      alert("Não foi possível salvar a foto. Verifique as permissões do Storage.");
    } finally {
      setUploadingPhoto(false);
    }
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
      const credential = EmailAuthProvider.credential(firebaseUser.email, senhaAtual);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, novaSenha);
      setMsgSenha({ tipo: "sucesso", texto: "Senha alterada com sucesso!" });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch (error) {
      console.error("Erro ao trocar senha:", error);
      const code = error.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setMsgSenha({ tipo: "erro", texto: "Senha atual incorreta." });
      } else if (code === "auth/too-many-requests") {
        setMsgSenha({ tipo: "erro", texto: "Muitas tentativas. Aguarde e tente novamente." });
      } else {
        setMsgSenha({ tipo: "erro", texto: `Erro ao alterar senha: ${error.message}` });
      }
    } finally {
      setSalvandoSenha(false);
    }
  }

  const infoRows = [
    { label: "Nome", value: userData?.nome || userData?.name || "—" },
    { label: "E-mail", value: firebaseUser?.email || "—" },
    { label: "Perfil / Cargo", value: userData?.role || "—" },
    { label: "Especialidade", value: userData?.especialidade || null },
    { label: "CRM", value: userData?.crm || null },
    { label: "COREN", value: userData?.coren || null },
    { label: "CRO", value: userData?.cro || null },
    { label: "Telefone", value: userData?.telefone || userData?.phone || null },
    { label: "Usuário de login", value: userData?.username || userData?.usuario || userData?.login || "—" },
    { label: "Cadastrado em", value: formatarData(userData?.createdAt) },
  ].filter((row) => row.value !== null && row.value !== undefined && row.value !== "");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.48)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
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
            background: "linear-gradient(135deg, #0C2218 0%, #1F7A63 100%)",
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          {/* Avatar / Foto */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {photoURL ? (
              <img
                src={photoURL}
                alt="Foto de perfil"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid rgba(255,255,255,0.3)",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.18)",
                  border: "3px solid rgba(255,255,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {inicial}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title={uploadingPhoto ? "Enviando..." : "Alterar foto"}
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#1F7A63",
                border: "2px solid #fff",
                cursor: uploadingPhoto ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                color: "#fff",
                padding: 0,
              }}
            >
              {uploadingPhoto ? "…" : "✏"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFotoChange}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "17px",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nomeExibicao}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.68)",
                fontSize: "12px",
                marginTop: "3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {firebaseUser?.email}
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: "7px",
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.9)",
                padding: "2px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {userData?.role || "Usuário"}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px",
              alignSelf: "flex-start",
              flexShrink: 0,
            }}
            title="Fechar"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          {[
            { key: "perfil", label: "Dados do Perfil" },
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
                borderBottom: aba === tab.key ? "2px solid #1F7A63" : "2px solid transparent",
                color: aba === tab.key ? "#1F7A63" : "#64748b",
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
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {aba === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {infoRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 12px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    gap: "12px",
                    border: "1px solid #f0f4f8",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#1e293b",
                      fontWeight: 600,
                      textAlign: "right",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}

              <div
                style={{
                  marginTop: "8px",
                  padding: "10px 12px",
                  background: "#f0fdf4",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#15803d",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  border: "1px solid #bbf7d0",
                }}
              >
                <span>📷</span>
                <span>
                  Clique no ícone de lápis sobre a foto para alterar sua imagem de perfil.
                  Formatos aceitos: JPG, PNG, WEBP (máx. 5 MB).
                </span>
              </div>
            </div>
          )}

          {aba === "seguranca" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  marginBottom: "4px",
                }}
              >
                Para alterar a senha, confirme a senha atual e informe a nova.
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#475569",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Senha atual
                </label>
                <input
                  type="password"
                  className="input"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Digite sua senha atual"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#475569",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Nova senha
                </label>
                <input
                  type="password"
                  className="input"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#475569",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  className="input"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") trocarSenha();
                  }}
                />
              </div>

              {msgSenha && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    background: msgSenha.tipo === "sucesso" ? "#f0fdf4" : "#fef2f2",
                    color: msgSenha.tipo === "sucesso" ? "#15803d" : "#dc2626",
                    border: `1px solid ${msgSenha.tipo === "sucesso" ? "#bbf7d0" : "#fecaca"}`,
                  }}
                >
                  {msgSenha.tipo === "sucesso" ? "✓ " : "⚠ "}{msgSenha.texto}
                </div>
              )}

              <button
                className="primary-btn"
                onClick={trocarSenha}
                disabled={salvandoSenha}
                style={{ marginTop: "2px" }}
              >
                {salvandoSenha ? "Alterando senha..." : "Trocar senha"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
            background: "#f8fafc",
          }}
        >
          <button className="secondary-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
