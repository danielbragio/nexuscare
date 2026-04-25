import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (error) {
      console.error("ERRO FIREBASE LOGIN:", error);
      setErro("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-v2">
      <div className="login-wrapper-v2">
        <div className="login-brand-panel-v2">
          <div className="login-brand-chip-v2">Sistema de Saúde</div>
          <h1 className="login-title-v2">Bem-vindo de volta</h1>
          <p className="login-description-v2">
            Acesse seu painel para gerenciar pacientes, consultas, prontuários e
            setores com segurança e organização.
          </p>

          <div className="login-info-list-v2">
            <div className="login-info-item-v2">
              <strong>Acesso por perfil</strong>
              <span>Menus liberados conforme o usuário e o setor.</span>
            </div>

            <div className="login-info-item-v2">
              <strong>Fluxo clínico organizado</strong>
              <span>Pacientes, agenda e prontuário no mesmo ambiente.</span>
            </div>

            <div className="login-info-item-v2">
              <strong>Base pronta para crescer</strong>
              <span>Estrutura profissional com autenticação e persistência.</span>
            </div>
          </div>
        </div>

        <div className="login-card-v2">
          <div className="login-card-header-v2">
            <h2>Conecte-se</h2>
            <p>Entre com seu usuário para acessar o sistema.</p>
          </div>

          <form onSubmit={handleLogin} className="login-form-v2">
            <div className="login-field-v2">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input-v2"
              />
            </div>

            <div className="login-field-v2">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="login-input-v2"
              />
            </div>

            {erro && <div className="login-error-v2">{erro}</div>}

            <button
              type="submit"
              className="login-button-v2"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}